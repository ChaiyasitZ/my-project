import express from 'express';
import Joi from 'joi';
import crypto from 'crypto';
import Device from '../models/Device.js';
import ConfigurationHistory from '../models/ConfigurationHistory.js';
import ConfigurationBackup from '../models/ConfigurationBackup.js';
import llmService from '../services/llmService.js';
import sshService from '../services/sshService.js';
import backupScheduler from '../services/backupScheduler.js';
import notificationService from '../services/notificationService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Helper function for user-friendly error messages
function getErrorMessage(errorType) {
  switch (errorType) {
    case 'connection_timeout':
      return 'Device is unreachable - check network connectivity and device status';
    case 'authentication_failed':
      return 'Authentication failed - check device credentials';
    case 'deployment_error':
      return 'Configuration deployment failed - check device configuration and syntax';
    default:
      return 'Unknown deployment error occurred';
  }
}

// Validation schemas
const generateConfigSchema = Joi.object({
  device_id: Joi.string().required(),
  prompt: Joi.string().min(10).max(2000).required(),
  yang_model_ids: Joi.array().items(Joi.string()).optional()
});

const applyConfigSchema = Joi.object({
  configuration_id: Joi.string().required(),
  validate_before_apply: Joi.boolean().optional()
});

// Configuration rating schema (simplified for raw AI)
const rateConfigSchema = Joi.object({
  configuration_id: Joi.string().required(),
  user_rating: Joi.number().min(1).max(5).required(),
  feedback_text: Joi.string().max(1000).optional()
});

// GET /api/configurations/ai-status - Get AI service status
router.get('/ai-status', async (req, res) => {
  try {
    const status = await llmService.getServiceStatus();
    res.json({
      success: true,
      llmService: status
    });
  } catch (error) {
    console.error('Error getting AI status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get AI status',
      llmService: { 
        status: 'error', 
        error: error.message 
      }
    });
  }
});

// GET /api/configurations/analytics - Get configuration analytics (simplified for raw AI)
router.get('/analytics', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    // Calculate date threshold using timestamp
    const dateThreshold = Date.now() - (parseInt(days) * 24 * 60 * 60 * 1000);
    
    // Get comprehensive analytics using MongoDB aggregation
    const [performanceStats, deviceTypeStats] = await Promise.all([
      // Performance statistics
      ConfigurationHistory.aggregate([
        { $match: { userId: req.userId, created_at: { $gte: dateThreshold } } },
        {
          $group: {
            _id: null,
            avg_execution_time: { $avg: '$execution_time' },
            min_execution_time: { $min: '$execution_time' },
            max_execution_time: { $max: '$execution_time' },
            total_generations: { $sum: 1 },
            successful_deployments: {
              $sum: { $cond: [{ $eq: ['$status', 'deployed'] }, 1, 0] }
            }
          }
        }
      ]),
      
      // Device type performance
      ConfigurationHistory.aggregate([
        { $match: { userId: req.userId, created_at: { $gte: dateThreshold } } },
        {
          $lookup: {
            from: 'devices',
            localField: 'device_id',
            foreignField: '_id',
            as: 'device'
          }
        },
        { $unwind: '$device' },
        {
          $group: {
            _id: '$device.type',
            generation_count: { $sum: 1 },
            avg_execution_time: { $avg: '$execution_time' },
            deployed_count: {
              $sum: { $cond: [{ $eq: ['$status', 'deployed'] }, 1, 0] }
            }
          }
        },
        { $sort: { generation_count: -1 } },
        {
          $project: {
            device_type: '$_id',
            generation_count: 1,
            avg_execution_time: 1,
            deployed_count: 1,
            _id: 0
          }
        }
      ])
    ]);

    res.json({
      success: true,
      analytics: {
        period: `${days} days`,
        performance: performanceStats[0] || {
          avg_execution_time: 0,
          min_execution_time: 0,
          max_execution_time: 0,
          total_generations: 0,
          successful_applications: 0
        },
        deviceTypes: deviceTypeStats
      }
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics'
    });
  }
});

// Validation schema for translation
const translateSchema = Joi.object({
  text: Joi.string().min(1).max(2000).required(),
  from: Joi.string().valid('en', 'th').required(),
  to: Joi.string().valid('en', 'th').required()
});

// POST /api/configurations/translate - Translate prompt between English and Thai
router.post('/translate', async (req, res) => {
  try {
    const { error, value } = translateSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
      });
    }
    
    const { text, from, to } = value;
    
    if (from === to) {
      return res.json({
        success: true,
        translatedText: text,
        from,
        to
      });
    }
    
    const langNames = { en: 'English', th: 'Thai' };
    const translationPrompt = `Translate the following network configuration prompt from ${langNames[from]} to ${langNames[to]}. 
Keep all technical terms (like IP addresses, interface names, VLAN numbers, protocol names) unchanged.
Only translate the descriptive text.
Return ONLY the translated text, nothing else.

Text to translate:
${text}`;
    
    const translatedText = await llmService.generateRawCompletion(translationPrompt);
    
    res.json({
      success: true,
      translatedText: translatedText.trim(),
      from,
      to
    });
    
  } catch (err) {
    console.error('Translation error:', err);
    res.status(500).json({
      success: false,
      message: 'Translation failed',
      error: err.message
    });
  }
});

// POST /api/configurations/generate - Generate configuration using Enhanced AI
router.post('/generate', async (req, res) => {
  try {
    console.log('🔄 Configuration generation request received:', {
      body: req.body,
      deviceId: req.body.device_id,
      prompt: req.body.prompt?.substring(0, 100) + '...'
    });

    const { error, value } = generateConfigSchema.validate(req.body);
    
    if (error) {
      console.error('❌ Validation error:', error.details);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details,
        receivedData: req.body
      });
    }
    
    const { device_id, prompt } = value;
    console.log('✅ Validation passed, looking for device:', device_id);
    
    // Get device details (with ObjectId validation)
    let device;
    try {
      device = await Device.findOne({ _id: device_id, userId: req.userId });
    } catch (err) {
      console.error('❌ Invalid device ID format:', device_id, err.message);
      return res.status(400).json({
        success: false,
        message: 'Invalid device ID format',
        device_id: device_id,
        error: 'Device ID must be a valid MongoDB ObjectId'
      });
    }
    
    if (!device) {
      console.error('❌ Device not found:', device_id);
      return res.status(404).json({
        success: false,
        message: 'Device not found',
        device_id: device_id
      });
    }
    
    console.log('✅ Device found:', { 
      name: device.name, 
      type: device.type, 
      model: device.model 
    });
    
    // Generate configuration using Enhanced AI
    const startTime = Date.now();
    console.log('🤖 Starting AI generation...');
    
    let aiResult;
    try {
      aiResult = await llmService.generateConfiguration(prompt, device.type, {
        name: device.name,
        model: device.model,
        location: device.location
      });
    } catch (aiError) {
      console.error('❌ AI Service Error:', aiError.message);
      return res.status(503).json({
        success: false,
        message: 'AI service is currently unavailable',
        error: aiError.message,
        suggestions: [
          'Check your OpenRouter API key configuration',
          'Verify OpenRouter API is accessible',
          'Try a different model if current one is unavailable'
        ]
      });
    }
    const executionTime = Date.now() - startTime;
    
    console.log('🤖 AI generation completed:', {
      success: aiResult.success,
      executionTime: executionTime,
      configLength: aiResult.configuration?.length || 0,
      confidenceScore: aiResult.confidenceScore,
      error: aiResult.error
    });
    
    if (!aiResult.success) {
      console.error('❌ AI generation failed:', aiResult.error);
      return res.status(400).json({
        success: false,
        message: 'AI generation failed',
        error: aiResult.error,
        executionTime: executionTime
      });
    }
    
    // Generate explanation for the configuration
    console.log('📖 Generating configuration explanation...');
    const explanationResult = await llmService.generateExplanation(
      aiResult.displayConfig || aiResult.configuration,
      device.type,
      prompt
    );
    
    if (explanationResult.success) {
      console.log('✅ Explanation generated successfully');
    } else {
      console.warn('⚠️ Explanation generation failed:', explanationResult.error);
    }
    
    // Save to configuration history with timestamp and userId
    const currentTimestamp = Date.now();
    const configuration = new ConfigurationHistory({
      device_id,
      userId: req.userId,
      prompt,
      generated_config: aiResult.configuration, // Clean version for output panel
      deployment_config: aiResult.deploymentConfig, // Clean version for device
      ai_model: 'qwen2.5-coder:7b', // Display name
      execution_time: executionTime,
      status: 'generated',
      created_at: currentTimestamp // Explicitly set timestamp
    });
    
    await configuration.save();
    console.log('✅ Configuration saved to history:', configuration._id);
    console.log('📅 Created at timestamp:', configuration.created_at, 'Date:', new Date(configuration.created_at));
    
    const responseConfig = {
      ...configuration.toObject(),
      id: configuration._id, // Add id for compatibility
      device_name: device.name,
      device_type: device.type,
      validation: aiResult.validation,
      confidenceScore: aiResult.confidenceScore,
      recommendations: aiResult.recommendations,
      explanation: explanationResult.success ? explanationResult.explanation : 'Explanation unavailable',
      deployment_config: aiResult.deploymentConfig // Clean version for deployment
    };
    
    console.log('📤 Sending response with created_at:', responseConfig.created_at);
    
    res.json({
      success: true,
      configuration: responseConfig
    });
    
  } catch (error) {
    console.error('❌ Unexpected error in configuration generation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate configuration',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// POST /api/configurations/rate - Rate a configuration (simplified for raw AI)
router.post('/rate', async (req, res) => {
  try {
    const { error, value } = rateConfigSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
      });
    }
    
    const { configuration_id, user_rating, feedback_text } = value;
    
    // Update configuration with simple rating (only if user owns it)
    const configuration = await ConfigurationHistory.findOneAndUpdate(
      { _id: configuration_id, userId: req.userId },
      { user_rating, feedback_text },
      { new: true }
    );
    
    if (!configuration) {
      return res.status(404).json({
        success: false,
        message: 'Configuration not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Configuration rated successfully'
    });
    
  } catch (error) {
    console.error('Error rating configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to rate configuration'
    });
  }
});

// POST /api/configurations/session-apply - Apply configuration using existing SSH session (no enable needed)
router.post('/session-apply', async (req, res) => {
  try {
    const { configuration_id } = req.body;
    
    if (!configuration_id) {
      return res.status(400).json({
        success: false,
        message: 'Configuration ID is required'
      });
    }
    
    const configuration = await ConfigurationHistory.findOne({ _id: configuration_id, userId: req.userId }).populate('device');
    
    if (!configuration) {
      return res.status(404).json({
        success: false,
        message: 'Configuration not found'
      });
    }
    
    if (!configuration.device) {
      return res.status(404).json({
        success: false,
        message: 'Associated device not found'
      });
    }
    
    // Verify user owns the device
    if (configuration.device.userId?.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to apply configuration to this device'
      });
    }
    
    console.log(`🔗 Session-based deployment to ${configuration.device.name} (${configuration.device.ip_address})...`);
    
    try {
      const deploymentStart = Date.now();
      const deployResult = await sshService.fastDeployWithSession(
        configuration.device,
        configuration.deployment_config
      );
      const deploymentTime = Date.now() - deploymentStart;
      
      if (deployResult.success) {
        configuration.status = 'deployed';
        configuration.deployed_at = Date.now();
        configuration.deployment_time = deploymentTime;
        await configuration.save();
        
        // Trigger post-deployment backup schedules (only if user has created a schedule for this device)
        let autoBackupResult = null;
        try {
          console.log(`🔍 Checking for post-deployment backup schedules for device ${configuration.device._id}...`);
          autoBackupResult = await backupScheduler.triggerPostDeploySchedules([configuration.device._id.toString()]);
          
          if (autoBackupResult.devices_backed_up > 0) {
            console.log(`✅ Auto backup triggered for ${autoBackupResult.devices_backed_up} device(s)`);
          } else {
            console.log(`ℹ️ No backup schedule found for this device - skipping auto backup`);
          }
        } catch (scheduleError) {
          console.warn(`⚠️ Failed to trigger post-deployment schedules: ${scheduleError.message}`);
        }
        
        res.json({
          success: true,
          message: autoBackupResult?.devices_backed_up > 0 
            ? 'Configuration deployed successfully with auto backup' 
            : 'Configuration deployed successfully (no backup schedule configured)',
          deployment_time: deploymentTime,
          deployment_time_ms: deploymentTime,
          deployment_time_seconds: (deploymentTime / 1000).toFixed(2),
          output: deployResult.output,
          session_reused: true,
          use_count: deployResult.useCount,
          command_count: deployResult.commandCount,
          auto_backup: {
            enabled: autoBackupResult?.devices_backed_up > 0,
            message: autoBackupResult?.devices_backed_up > 0 
              ? 'Backup created via schedule' 
              : 'No backup schedule configured for this device. Create a backup schedule to enable auto-backup.'
          }
        });
      } else {
        throw new Error('Session-based deployment failed');
      }
      
    } catch (deployError) {
      configuration.status = 'failed';
      configuration.error_message = deployError.message;
      await configuration.save();
      
      let statusCode = 500;
      let userMessage = `Session-based deployment failed: ${deployError.message}`;
      
      if (deployError.message.includes('No active SSH session')) {
        userMessage = `No SSH session connected to ${configuration.device.name}. Please connect SSH session first from Device Management.`;
        statusCode = 400;
      }
      
      res.status(statusCode).json({
        success: false,
        message: userMessage,
        error: deployError.message,
        suggestion: 'Connect SSH session from Device Management page first'
      });
    }
    
  } catch (error) {
    console.error('Error in session-based apply:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during session-based configuration application',
      error: error.message
    });
  }
});

// POST /api/configurations/fast-apply - Fast apply configuration using persistent sessions
router.post('/fast-apply', async (req, res) => {
  try {
    const { configuration_id } = req.body;
    
    if (!configuration_id) {
      return res.status(400).json({
        success: false,
        message: 'Configuration ID is required'
      });
    }
    
    const configuration = await ConfigurationHistory.findOne({ _id: configuration_id, userId: req.userId }).populate('device');
    
    if (!configuration) {
      return res.status(404).json({
        success: false,
        message: 'Configuration not found'
      });
    }
    
    if (!configuration.device) {
      return res.status(404).json({
        success: false,
        message: 'Associated device not found'
      });
    }
    
    // Verify user owns the device
    if (configuration.device.userId?.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to apply configuration to this device'
      });
    }
    
    console.log(`⚡ Fast applying configuration to ${configuration.device.name} (${configuration.device.ip_address})...`);
    
    try {
      const deploymentStart = Date.now();
      const deployResult = await sshService.fastDeploy(
        configuration.device,
        configuration.deployment_config
      );
      const deploymentTime = Date.now() - deploymentStart;
      
      if (deployResult.success) {
        configuration.status = 'deployed';
        configuration.deployed_at = Date.now();
        configuration.deployment_time = deploymentTime;
        await configuration.save();
        
        // Trigger post-deployment backup schedules (only if user has created a schedule for this device)
        let autoBackupResult = null;
        try {
          console.log(`🔍 Checking for post-deployment backup schedules for device ${configuration.device._id}...`);
          autoBackupResult = await backupScheduler.triggerPostDeploySchedules([configuration.device._id.toString()]);
          
          if (autoBackupResult.devices_backed_up > 0) {
            console.log(`✅ Auto backup triggered for ${autoBackupResult.devices_backed_up} device(s)`);
          } else {
            console.log(`ℹ️ No backup schedule found for this device - skipping auto backup`);
          }
        } catch (scheduleError) {
          console.warn(`⚠️ Failed to trigger post-deployment schedules: ${scheduleError.message}`);
        }
        
        res.json({
          success: true,
          message: autoBackupResult?.devices_backed_up > 0 
            ? 'Configuration deployed successfully with auto backup' 
            : 'Configuration deployed successfully (no backup schedule configured)',
          deployment_time: deploymentTime,
          deployment_time_ms: deploymentTime,
          deployment_time_seconds: (deploymentTime / 1000).toFixed(2),
          output: deployResult.output,
          session_reused: deployResult.sessionReused,
          command_count: deployResult.commandCount,
          auto_backup: {
            enabled: autoBackupResult?.devices_backed_up > 0,
            message: autoBackupResult?.devices_backed_up > 0 
              ? 'Backup created via schedule' 
              : 'No backup schedule configured for this device. Create a backup schedule to enable auto-backup.'
          }
        });
      } else {
        throw new Error('Fast deployment failed');
      }
      
    } catch (deployError) {
      configuration.status = 'failed';
      configuration.error_message = deployError.message;
      await configuration.save();
      
      res.status(500).json({
        success: false,
        message: `Fast deployment failed: ${deployError.message}`,
        error: deployError.message
      });
    }
    
  } catch (error) {
    console.error('Error in fast apply:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during fast configuration application',
      error: error.message
    });
  }
});

// POST /api/configurations/apply - Apply configuration to device
router.post('/apply', async (req, res) => {
  try {
    const { error, value } = applyConfigSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
      });
    }
    
    const { configuration_id } = value;
    
    // Get configuration and device details
    const configuration = await ConfigurationHistory.findOne({
      _id: configuration_id,
      userId: req.userId,
      status: 'generated'
    });
    
    if (!configuration) {
      return res.status(404).json({
        success: false,
        message: 'Configuration not found or already deployed'
      });
    }
    
    const device = await Device.findOne({ _id: configuration.device_id, userId: req.userId });
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    try {
      // Apply configuration via SSH using deployment config (no comments)
      const configToApply = configuration.deployment_config || configuration.generated_config;
      console.log(`📡 Deploying configuration to ${device.ip_address} (${configToApply.split('\n').length} lines)`);
      
      // Clean up any existing SSH sessions for this device to prevent "Channel open failure"
      console.log(`🧹 Cleaning up existing SSH sessions for ${device.name}...`);
      sshService.disconnect(device._id);
      
      // Small delay to allow device to release the VTY line
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // STEP 1: Deploy configuration (no automatic backups - user must subscribe for auto-backup)
      notificationService.emitDeploymentProgress(
        'in-progress',
        `Deploying configuration to ${device.name}...`,
        { deviceName: device.name, deviceId: device._id }
      );
      
      const deploymentStart = Date.now();
      const sshResult = await sshService.sendConfigCommands(device, configToApply);
      const deploymentTime = Date.now() - deploymentStart;
      console.log(`✅ Configuration deployed successfully in ${deploymentTime}ms`);
      
      notificationService.emitDeploymentProgress(
        'complete',
        `Configuration deployed successfully in ${(deploymentTime / 1000).toFixed(2)}s`,
        { 
          deviceName: device.name,
          deploymentTime,
          deploymentTimeSeconds: (deploymentTime / 1000).toFixed(2)
        }
      );
      
      // Clean up SSH session after deployment
      console.log(`🧹 Cleaning up SSH session after deployment...`);
      sshService.disconnect(device._id);
      
      // STEP 2: Update configuration status with timestamp
      configuration.status = 'deployed';
      configuration.deployed_config = configToApply;
      configuration.deployed_at = Date.now();
      configuration.deployment_time = deploymentTime;
      await configuration.save();
      
      // Trigger post-deployment backup schedules
      try {
        console.log(`🚀 Triggering post-deployment backup schedules for device ${device._id}...`);
        notificationService.emitBackupProgress(
          'schedule',
          'in-progress',
          `Checking for post-deployment schedules...`,
          { deviceName: device.name }
        );
        
        const scheduleResult = await backupScheduler.triggerPostDeploySchedules([device._id.toString()]);
        
        if (scheduleResult.success && scheduleResult.devices_backed_up > 0) {
          notificationService.emitPostDeployScheduleResults(
            scheduleResult.results || [],
            {
              total_schedules: scheduleResult.results?.length || 0,
              total_devices_backed_up: scheduleResult.devices_backed_up || 0,
              success: true
            }
          );
        }
      } catch (scheduleError) {
        console.warn(`⚠️ Failed to trigger post-deployment schedules: ${scheduleError.message}`);
        notificationService.emitError(
          'schedule_trigger_failed',
          `Failed to trigger post-deployment schedules: ${scheduleError.message}`,
          { deviceName: device.name }
        );
      }
      
      res.json({
        success: true,
        message: 'Configuration deployed successfully',
        deployment_time: deploymentTime,
        deployment_time_ms: deploymentTime,
        deployment_time_seconds: (deploymentTime / 1000).toFixed(2),
        output: sshResult.output,
        session_reused: sshResult.sessionReused || false
      });
      
    } catch (sshError) {
      const deploymentTime = Date.now() - (Date.now() - 1000); // Approximate time
      console.error(`❌ Deployment failed after ${deploymentTime}ms: ${sshError.message}`);
      
      // Update configuration status to failed with better error categorization
      configuration.status = 'failed';
      configuration.error_message = sshError.message;
      configuration.deployment_time = deploymentTime;
      await configuration.save();
      
      // Determine error type for better user feedback
      let errorType = 'deployment_error';
      if (sshError.message.includes('timeout') || sshError.message.includes('unreachable')) {
        errorType = 'connection_timeout';
      } else if (sshError.message.includes('authentication') || sshError.message.includes('login')) {
        errorType = 'authentication_failed';
      }
      
      res.status(500).json({
        success: false,
        message: getErrorMessage(errorType),
        error: sshError.message,
        errorType,
        deploymentTime
      });
    }
    
  } catch (error) {
    console.error('❌ Error applying configuration:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to apply configuration',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET /api/configurations/history/:device_id - Get configuration history for device
router.get('/history/:device_id', async (req, res) => {
  try {
    const { device_id } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    // Verify user owns the device
    const device = await Device.findOne({ _id: device_id, userId: req.userId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    const configurations = await ConfigurationHistory.find({ device_id, userId: req.userId })
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();
    
    // Get device info for each configuration
    const enhancedConfigurations = configurations.map(config => ({
      ...config,
      id: config._id, // Add id for compatibility
      device_name: device.name,
      device_type: device.type
    }));
    
    res.json({
      success: true,
      configurations: enhancedConfigurations
    });
    
  } catch (error) {
    console.error('Error fetching configuration history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch configuration history'
    });
  }
});

// GET /api/configurations/history - Get all configuration history (simplified for raw AI)
router.get('/history', async (req, res) => {
  try {
    const { limit = 50, offset = 0, status } = req.query;
    
    // Build filter with userId
    const filter = { userId: req.userId };
    if (status) filter.status = status;
    
    // Get configurations with pagination
    const configurations = await ConfigurationHistory.find(filter)
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();
    
    // Get total count for user
    const total = await ConfigurationHistory.countDocuments(filter);
    
    // Get user's devices for lookup
    const userDevices = await Device.find({ userId: req.userId }).select('name type ip_address').lean();
    const deviceMap = new Map(userDevices.map(d => [d._id.toString(), d]));
    
    // Enhance configurations with device info
    const enhancedConfigurations = configurations.map(config => {
      const device = deviceMap.get(config.device_id?.toString());
      return {
        ...config,
        id: config._id, // Add id for compatibility
        device_name: device?.name,
        device_type: device?.type,
        ip_address: device?.ip_address
      };
    });
    
    res.json({
      success: true,
      configurations: enhancedConfigurations,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
  } catch (error) {
    console.error('Error fetching configuration history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch configuration history'
    });
  }
});

// GET /api/configurations/:id - Get specific configuration (simplified for raw AI)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const configuration = await ConfigurationHistory.findOne({ _id: id, userId: req.userId }).lean();
    
    if (!configuration) {
      return res.status(404).json({
        success: false,
        message: 'Configuration not found'
      });
    }
    
    // Get device info
    const device = await Device.findOne({ _id: configuration.device_id, userId: req.userId }).select('name type ip_address').lean();
    
    const enhancedConfiguration = {
      ...configuration,
      id: configuration._id, // Add id for compatibility
      device_name: device?.name,
      device_type: device?.type,
      ip_address: device?.ip_address
    };
    
    // Get explanation if needed
    if (req.query.explain === 'true') {
      const explanation = await llmService.explainConfiguration(configuration.generated_config);
      enhancedConfiguration.explanation = explanation;
    }
    
    res.json({
      success: true,
      configuration: enhancedConfiguration
    });
    
  } catch (error) {
    console.error('Error fetching configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch configuration'
    });
  }
});

// DELETE /api/configurations/:id - Delete configuration
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const configuration = await ConfigurationHistory.findOneAndDelete({ _id: id, userId: req.userId });
    
    if (!configuration) {
      return res.status(404).json({
        success: false,
        message: 'Configuration not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Configuration deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete configuration'
    });
  }
});

// 🆕 POST /api/configurations/apply-multi - Apply multiple configurations
router.post('/apply-multi', async (req, res) => {
  try {
    const { configuration_ids } = req.body;
    
    if (!configuration_ids || !Array.isArray(configuration_ids) || configuration_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'configuration_ids array is required'
      });
    }
    
    console.log(`📡 Applying configurations to ${configuration_ids.length} devices`);
    
    const results = [];
    const deployedDeviceIds = [];
    
    for (const configId of configuration_ids) {
      try {
        // Get configuration and device (filter by userId)
        const configuration = await ConfigurationHistory.findOne({
          _id: configId,
          userId: req.userId,
          status: 'generated'
        });
        
        if (!configuration) {
          results.push({
            configuration_id: configId,
            success: false,
            error: 'Configuration not found or already deployed'
          });
          continue;
        }
        
        const device = await Device.findOne({ _id: configuration.device_id, userId: req.userId });
        
        if (!device) {
          results.push({
            configuration_id: configId,
            device_name: 'Unknown',
            success: false,
            error: 'Device not found'
          });
          continue;
        }
        
        // Apply configuration via SSH using deployment config (no comments)
        const configToApply = configuration.deployment_config || configuration.generated_config;
        console.log(`📡 Deploying to ${device.name}: clean config (${configToApply.split('\n').length} lines, no comments)`);
        
        const sshResult = await sshService.sendConfigCommands(device, configToApply);
        
        // Update configuration status
        configuration.status = 'deployed';
        configuration.deployed_config = configToApply;
        configuration.deployed_at = Date.now();
        await configuration.save();
        
        deployedDeviceIds.push(device._id.toString());
        
        results.push({
          configuration_id: configId,
          device_name: device.name,
          success: true,
          output: sshResult.output
        });
        
      } catch (error) {
        console.error(`Failed to apply configuration ${configId}:`, error);
        
        // Update configuration status to failed (only if user owns it)
        try {
          await ConfigurationHistory.findOneAndUpdate(
            { _id: configId, userId: req.userId },
            { status: 'failed', error_message: error.message }
          );
        } catch (updateError) {
          console.error('Failed to update configuration status:', updateError);
        }
        
        results.push({
          configuration_id: configId,
          success: false,
          error: error.message
        });
      }
    }
    
    // Trigger post-deployment backup schedules for all successfully deployed devices
    if (deployedDeviceIds.length > 0) {
      try {
        console.log(`🚀 Triggering post-deployment backup schedules for ${deployedDeviceIds.length} devices...`);
        await backupScheduler.triggerPostDeploySchedules(deployedDeviceIds);
      } catch (scheduleError) {
        console.warn(`⚠️ Failed to trigger post-deployment schedules: ${scheduleError.message}`);
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    console.log(`✅ Multi-device apply completed: ${successCount}/${configuration_ids.length} successful`);
    
    res.json({
      success: successCount > 0,
      message: `Deployed configurations to ${successCount}/${configuration_ids.length} devices`,
      results: results,
      summary: {
        total: configuration_ids.length,
        successful: successCount,
        failed: configuration_ids.length - successCount
      }
    });
    
  } catch (error) {
    console.error('Multi-device apply error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during multi-device application',
      error: error.message
    });
  }
});

// ========================
// NETCONF/YANG ROUTES
// ========================

import netconfService from '../services/netconfService.js';
import YangModel from '../models/YangModel.js';

// POST /api/configurations/netconf/generate - Generate NETCONF/YANG configuration
router.post('/netconf/generate', async (req, res) => {
  try {
    console.log('🌐 NETCONF configuration generation request received');
    
    const { error, value } = generateConfigSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
      });
    }
    
    const { device_id, prompt, yang_model_ids } = value;
    
    // Get device details (filter by userId)
    let device;
    try {
      device = await Device.findOne({ _id: device_id, userId: req.userId });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: 'Invalid device ID format'
      });
    }
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Fetch YANG models - either specific ones selected or all active for device type
    let customYangModels = [];
    try {
      let yangModels;
      
      if (yang_model_ids && yang_model_ids.length > 0) {
        // Use specific YANG models selected by user
        console.log(`📚 Using ${yang_model_ids.length} user-selected YANG models`);
        yangModels = await YangModel.find({
          _id: { $in: yang_model_ids },
          userId: req.userId,
          is_active: true
        }).select('name namespace prefix description xml_templates config_paths content');
      } else {
        // Fall back to all active YANG models for device type
        yangModels = await YangModel.find({
          userId: req.userId,
          is_active: true,
          device_type: { $in: [device.type, 'all'] }
        }).select('name namespace prefix description xml_templates config_paths content');
      }
      
      customYangModels = yangModels.map(model => ({
        name: model.name,
        namespace: model.namespace,
        prefix: model.prefix,
        description: model.description,
        templates: model.xml_templates,
        paths: model.config_paths,
        content: model.content // Include full YANG content for accurate generation
      }));
      
      console.log(`📚 Loaded ${customYangModels.length} YANG models for ${device.type}`);
    } catch (yangError) {
      console.warn('⚠️ Could not load custom YANG models:', yangError.message);
    }
    
    // Generate NETCONF/YANG configuration with custom YANG models
    const startTime = Date.now();
    const aiResult = await llmService.generateNetconfConfig(prompt, device.type, {
      name: device.name,
      model: device.model,
      location: device.location
    }, customYangModels);
    const executionTime = Date.now() - startTime;
    
    if (!aiResult.success) {
      return res.status(400).json({
        success: false,
        message: 'NETCONF configuration generation failed',
        error: aiResult.error,
        executionTime
      });
    }
    
    // Generate explanation
    const explanationResult = await llmService.generateExplanation(
      aiResult.displayConfig,
      device.type,
      prompt
    );
    
    // Save to configuration history with userId
    const currentTimestamp = Date.now();
    const configuration = new ConfigurationHistory({
      device_id,
      userId: req.userId,
      prompt,
      generated_config: aiResult.configuration,
      deployment_config: aiResult.deploymentConfig,
      ai_model: 'qwen2.5-coder:7b', // Display name (same as CLI)
      execution_time: executionTime,
      status: 'generated',
      created_at: currentTimestamp,
      config_type: 'netconf-yang' // Mark as NETCONF config
    });
    
    await configuration.save();
    
    res.json({
      success: true,
      configuration: {
        ...configuration.toObject(),
        id: configuration._id,
        device_name: device.name,
        device_type: device.type,
        config_type: 'netconf-yang',
        validation: aiResult.validation,
        confidenceScore: aiResult.confidenceScore,
        recommendations: aiResult.recommendations,
        explanation: explanationResult.success ? explanationResult.explanation : 'Explanation unavailable'
      }
    });
    
  } catch (error) {
    console.error('NETCONF generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate NETCONF configuration',
      error: error.message
    });
  }
});

// POST /api/configurations/netconf/apply - Apply NETCONF configuration to device
router.post('/netconf/apply', async (req, res) => {
  try {
    const { configuration_id, validate_before_apply = true } = req.body;
    
    console.log('📥 NETCONF Apply request:', { configuration_id, validate_before_apply });
    
    if (!configuration_id) {
      return res.status(400).json({
        success: false,
        message: 'Configuration ID is required'
      });
    }
    
    // Get configuration (filter by userId)
    const configuration = await ConfigurationHistory.findOne({
      _id: configuration_id,
      userId: req.userId,
      status: 'generated'
    });
    
    console.log('📋 Configuration lookup result:', configuration ? `Found (status: ${configuration.status})` : 'Not found');
    
    if (!configuration) {
      // Check if it exists but with different status
      const anyConfig = await ConfigurationHistory.findOne({
        _id: configuration_id,
        userId: req.userId
      });
      
      if (anyConfig) {
        return res.status(400).json({
          success: false,
          message: `Configuration already ${anyConfig.status}. Generate a new configuration to apply.`,
          current_status: anyConfig.status
        });
      }
      
      return res.status(404).json({
        success: false,
        message: 'Configuration not found or already deployed'
      });
    }
    
    // Get device (filter by userId)
    const device = await Device.findOne({ _id: configuration.device_id, userId: req.userId });
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    console.log(`🌐 NETCONF: Applying configuration to ${device.name} (${device.ip_address})`);
    if (validate_before_apply) {
      console.log(`🔍 NETCONF: Validation enabled before apply`);
    }
    
    const deploymentStart = Date.now();
    
    try {
      // Connect via NETCONF
      const connectResult = await netconfService.connect(device);
      
      if (!connectResult.success) {
        throw new Error('Failed to establish NETCONF connection');
      }
      
      const deviceId = device._id.toString();
      const configToApply = configuration.deployment_config || configuration.generated_config;
      
      // Validate before apply if enabled
      if (validate_before_apply) {
        console.log(`🔍 NETCONF: Validating configuration...`);
        const validateResult = await netconfService.validate(deviceId, configToApply);
        
        if (!validateResult.success) {
          // Close session on validation failure
          await netconfService.closeSession(deviceId);
          
          return res.status(400).json({
            success: false,
            message: 'Configuration validation failed',
            validation_error: validateResult.error || 'Unknown validation error',
            validated: true
          });
        }
        console.log(`✅ NETCONF: Validation passed`);
      }
      
      // Apply configuration
      const applyResult = await netconfService.applyNxosConfig(
        deviceId,
        configToApply,
        'merge'
      );
      
      const deploymentTime = Date.now() - deploymentStart;
      
      // Close NETCONF session
      await netconfService.closeSession(deviceId);
      
      // Update configuration status
      configuration.status = 'deployed';
      configuration.deployed_at = Date.now();
      configuration.deployment_time = deploymentTime;
      await configuration.save();
      
      res.json({
        success: true,
        message: 'NETCONF configuration deployed successfully',
        deployment_time: deploymentTime,
        deployment_time_seconds: (deploymentTime / 1000).toFixed(2),
        netconf: true,
        response: applyResult.response
      });
      
    } catch (netconfError) {
      const deploymentTime = Date.now() - deploymentStart;
      
      configuration.status = 'failed';
      configuration.error_message = netconfError.message;
      configuration.deployment_time = deploymentTime;
      await configuration.save();
      
      // Try to close session on error
      try {
        await netconfService.closeSession(device._id.toString());
      } catch (closeErr) {
        // Ignore
      }
      
      res.status(500).json({
        success: false,
        message: `NETCONF deployment failed: ${netconfError.message}`,
        error: netconfError.message,
        troubleshooting: [
          'Verify NETCONF is enabled on device (feature netconf)',
          'Check port 830 is accessible',
          'Ensure device supports NX-OS YANG models',
          'Verify XML syntax is correct'
        ]
      });
    }
    
  } catch (error) {
    console.error('NETCONF apply error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during NETCONF configuration',
      error: error.message
    });
  }
});

// POST /api/configurations/netconf/test - Test NETCONF connectivity
router.post('/netconf/test', async (req, res) => {
  try {
    const { device_id } = req.body;
    
    if (!device_id) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required'
      });
    }
    
    const device = await Device.findOne({ _id: device_id, userId: req.userId });
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    console.log(`🧪 Testing NETCONF connectivity to ${device.name} (${device.ip_address})`);
    
    const result = await netconfService.testConnection(device);
    
    res.json(result);
    
  } catch (error) {
    console.error('NETCONF test error:', error);
    res.status(500).json({
      success: false,
      message: 'NETCONF connectivity test failed',
      error: error.message
    });
  }
});

// GET /api/configurations/netconf/session/:device_id - Get NETCONF session status
router.get('/netconf/session/:device_id', async (req, res) => {
  try {
    const { device_id } = req.params;
    
    // Verify user owns the device
    const device = await Device.findOne({ _id: device_id, userId: req.userId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    const status = netconfService.getSessionStatus(device_id);
    
    res.json({
      success: true,
      session: status
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get NETCONF session status',
      error: error.message
    });
  }
});

// DELETE /api/configurations/netconf/session/:device_id - Close NETCONF session
router.delete('/netconf/session/:device_id', async (req, res) => {
  try {
    const { device_id } = req.params;
    
    // Verify user owns the device
    const device = await Device.findOne({ _id: device_id, userId: req.userId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    const result = await netconfService.closeSession(device_id);
    
    res.json(result);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to close NETCONF session',
      error: error.message
    });
  }
});

// GET /api/configurations/netconf/sessions - Get all active NETCONF sessions
router.get('/netconf/sessions', async (req, res) => {
  try {
    const allSessions = netconfService.getActiveSessions();
    
    // Filter to only show sessions for user's devices
    const userDevices = await Device.find({ userId: req.userId }).select('_id');
    const userDeviceIds = userDevices.map(d => d._id.toString());
    
    const sessions = allSessions.filter(session => 
      userDeviceIds.includes(session.deviceId)
    );
    
    res.json({
      success: true,
      sessions: sessions,
      count: sessions.length
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get active NETCONF sessions',
      error: error.message
    });
  }
});

// ========================
// ROLLBACK ROUTES
// ========================

// POST /api/configurations/:id/rollback - Rollback to a previous configuration
router.post('/:id/rollback', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    console.log(`🔄 Rolling back to configuration ${id}`);
    
    // Get the target configuration to rollback to (must be user owned and deployed)
    const targetConfig = await ConfigurationHistory.findOne({
      _id: id,
      userId: req.userId,
      status: 'deployed'
    });
    
    if (!targetConfig) {
      return res.status(404).json({
        success: false,
        message: 'Configuration not found or not in deployed status'
      });
    }
    
    // Get the device
    const device = await Device.findOne({
      _id: targetConfig.device_id,
      userId: req.userId
    });
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Find the current deployed configuration for this device (most recent deployed)
    const currentConfig = await ConfigurationHistory.findOne({
      device_id: device._id,
      userId: req.userId,
      status: 'deployed',
      _id: { $ne: targetConfig._id }
    }).sort({ deployed_at: -1 });
    
    if (!currentConfig) {
      return res.status(400).json({
        success: false,
        message: 'No current deployed configuration found to rollback from'
      });
    }
    
    // Cannot rollback to itself
    if (currentConfig._id.toString() === targetConfig._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot rollback to the same configuration'
      });
    }
    
    // Get the configuration content to deploy
    const configToApply = targetConfig.deployed_config || targetConfig.deployment_config || targetConfig.generated_config;
    
    if (!configToApply) {
      return res.status(400).json({
        success: false,
        message: 'No configuration content found to rollback'
      });
    }
    
    console.log(`📡 Rolling back ${device.name} from config ${currentConfig._id} to ${targetConfig._id}`);
    
    // Deploy the target configuration via SSH
    const sshResult = await sshService.sendConfigCommands(device, configToApply);
    
    // Mark the current configuration as rolled_back
    currentConfig.status = 'rolled_back';
    currentConfig.rolled_back_at = Date.now();
    currentConfig.rolled_back_by = targetConfig._id;
    currentConfig.rollback_reason = reason || 'User initiated rollback';
    await currentConfig.save();
    
    // Update target config to track it was restored
    targetConfig.restored_from = currentConfig._id;
    targetConfig.restored_from_config = currentConfig.deployed_config || currentConfig.deployment_config || currentConfig.generated_config;
    targetConfig.deployed_at = Date.now(); // Update deployed time
    await targetConfig.save();
    
    console.log(`✅ Rollback successful: ${device.name}`);
    
    // Trigger post-deployment backup schedules
    try {
      console.log(`🚀 Triggering post-deployment backup schedules for rollback...`);
      await backupScheduler.triggerPostDeploySchedules([device._id.toString()]);
    } catch (scheduleError) {
      console.warn(`⚠️ Failed to trigger post-deployment schedules: ${scheduleError.message}`);
    }
    
    res.json({
      success: true,
      message: `Successfully rolled back ${device.name} to previous configuration`,
      data: {
        rolled_back_config_id: currentConfig._id,
        restored_config_id: targetConfig._id,
        device_name: device.name,
        rollback_reason: reason || 'User initiated rollback',
        ssh_output: sshResult.output
      }
    });
    
  } catch (error) {
    console.error('Rollback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to rollback configuration',
      error: error.message
    });
  }
});

// GET /api/configurations/:id/rollback-info - Get rollback information for a configuration
router.get('/:id/rollback-info', async (req, res) => {
  try {
    const { id } = req.params;
    
    const config = await ConfigurationHistory.findOne({
      _id: id,
      userId: req.userId
    });
    
    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Configuration not found'
      });
    }
    
    let rollbackInfo = {
      config_id: config._id,
      status: config.status,
      can_rollback_to: config.status === 'deployed',
      was_rolled_back: config.status === 'rolled_back'
    };
    
    // If this config was rolled back, include info about what replaced it
    if (config.status === 'rolled_back') {
      const replacedBy = config.rolled_back_by 
        ? await ConfigurationHistory.findById(config.rolled_back_by).select('_id prompt deployed_at')
        : null;
      
      rollbackInfo.rolled_back_at = config.rolled_back_at;
      rollbackInfo.rollback_reason = config.rollback_reason;
      rollbackInfo.replaced_by = replacedBy ? {
        id: replacedBy._id,
        prompt: replacedBy.prompt,
        deployed_at: replacedBy.deployed_at
      } : null;
    }
    
    // If this config was restored from another, include that info
    if (config.restored_from) {
      const restoredFrom = await ConfigurationHistory.findById(config.restored_from).select('_id prompt deployed_at');
      
      rollbackInfo.restored_from = restoredFrom ? {
        id: restoredFrom._id,
        prompt: restoredFrom.prompt,
        deployed_at: restoredFrom.deployed_at
      } : null;
    }
    
    res.json({
      success: true,
      data: rollbackInfo
    });
    
  } catch (error) {
    console.error('Error getting rollback info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get rollback information',
      error: error.message
    });
  }
});

export default router;

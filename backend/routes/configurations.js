import express from 'express';
import Joi from 'joi';
import crypto from 'crypto';
import Device from '../models/Device.js';
import ConfigurationHistory from '../models/ConfigurationHistory.js';
import ConfigurationBackup from '../models/ConfigurationBackup.js';
import llmService from '../services/llmService.js';
import sshService from '../services/sshService.js';
import backupScheduler from '../services/backupScheduler.js';

const router = express.Router();

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
  prompt: Joi.string().min(10).max(2000).required()
});

const applyConfigSchema = Joi.object({
  configuration_id: Joi.string().required()
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
        { $match: { created_at: { $gte: dateThreshold } } },
        {
          $group: {
            _id: null,
            avg_execution_time: { $avg: '$execution_time' },
            min_execution_time: { $min: '$execution_time' },
            max_execution_time: { $max: '$execution_time' },
            total_generations: { $sum: 1 },
            successful_applications: {
              $sum: { $cond: [{ $eq: ['$status', 'applied'] }, 1, 0] }
            }
          }
        }
      ]),
      
      // Device type performance
      ConfigurationHistory.aggregate([
        { $match: { created_at: { $gte: dateThreshold } } },
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
            applied_count: {
              $sum: { $cond: [{ $eq: ['$status', 'applied'] }, 1, 0] }
            }
          }
        },
        { $sort: { generation_count: -1 } },
        {
          $project: {
            device_type: '$_id',
            generation_count: 1,
            avg_execution_time: 1,
            applied_count: 1,
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
      device = await Device.findById(device_id);
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
          'Ensure Ollama is running on your system',
          'Check if the model is downloaded: ollama list',
          'Verify Ollama is accessible at http://localhost:11434'
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
    
    // Save to configuration history with timestamp
    const currentTimestamp = Date.now();
    const configuration = new ConfigurationHistory({
      device_id,
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
    
    // Update configuration with simple rating
    const configuration = await ConfigurationHistory.findByIdAndUpdate(
      configuration_id,
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
    
    const configuration = await ConfigurationHistory.findById(configuration_id).populate('device');
    
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
    
    console.log(`🔗 Session-based deployment to ${configuration.device.name} (${configuration.device.ip_address})...`);
    
    try {
      // Create pre-deployment backup using session
      console.log(`💾 Creating pre-deployment backup...`);
      let preBackupId = null;
      try {
        const preBackup = await sshService.optimizedBackup(configuration.device, 'running-config');
        if (preBackup.success) {
          const backup = new ConfigurationBackup({
            device_id: configuration.device._id,
            backup_name: `Pre-Deploy (Session) - ${new Date().toISOString()}`,
            description: `Auto backup before session deployment: ${configuration.prompt}`,
            running_config: preBackup.runningConfig,
            backup_type: 'scheduled',
            config_type: 'running-config',
            file_size: preBackup.runningConfigSize,
            config_hash: crypto.createHash('sha256').update(preBackup.runningConfig).digest('hex'),
            created_by: 'auto-deploy',
            is_restore_point: true,
            tags: ['pre-deployment', 'auto-backup', 'session']
          });
          await backup.save();
          preBackupId = backup._id;
          console.log(`✅ Pre-deployment backup created`);
        }
      } catch (err) {
        console.warn(`⚠️ Pre-deployment backup failed: ${err.message}`);
      }
      
      const deploymentStart = Date.now();
      const deployResult = await sshService.fastDeployWithSession(
        configuration.device,
        configuration.deployment_config
      );
      const deploymentTime = Date.now() - deploymentStart;
      
      if (deployResult.success) {
        // Create post-deployment backup
        let postBackupId = null;
        try {
          const postBackup = await sshService.optimizedBackup(configuration.device, 'running-config');
          if (postBackup.success) {
            const backup = new ConfigurationBackup({
              device_id: configuration.device._id,
              backup_name: `Post-Deploy (Session) - ${new Date().toISOString()}`,
              description: `Auto backup after session deployment: ${configuration.prompt}`,
              running_config: postBackup.runningConfig,
              backup_type: 'scheduled',
              config_type: 'running-config',
              file_size: postBackup.runningConfigSize,
              config_hash: crypto.createHash('sha256').update(postBackup.runningConfig).digest('hex'),
              created_by: 'auto-deploy',
              tags: ['post-deployment', 'auto-backup', 'session']
            });
            await backup.save();
            postBackupId = backup._id;
            console.log(`✅ Post-deployment backup created`);
          }
        } catch (err) {
          console.warn(`⚠️ Post-deployment backup failed: ${err.message}`);
        }
        
        // Delete pre-deployment backup (keeping only post-deployment)
        if (preBackupId) {
          try {
            await ConfigurationBackup.findByIdAndDelete(preBackupId);
            console.log(`🗑️ Pre-deployment backup deleted`);
          } catch (deleteError) {
            console.warn(`⚠️ Failed to delete pre-deployment backup: ${deleteError.message}`);
          }
        }
        
        configuration.status = 'applied';
        configuration.applied_at = Date.now();
        configuration.deployment_time = deploymentTime;
        await configuration.save();
        
        // Trigger post-deployment backup schedules
        try {
          console.log(`🚀 Triggering post-deployment backup schedules for device ${configuration.device._id}...`);
          await backupScheduler.triggerPostDeploySchedules([configuration.device._id.toString()]);
        } catch (scheduleError) {
          console.warn(`⚠️ Failed to trigger post-deployment schedules: ${scheduleError.message}`);
        }
        
        res.json({
          success: true,
          message: 'Configuration applied successfully using existing SSH session with auto-backups (no enable needed)',
          deployment_time: deploymentTime,
          deployment_time_ms: deploymentTime,
          deployment_time_seconds: (deploymentTime / 1000).toFixed(2),
          output: deployResult.output,
          session_reused: true,
          use_count: deployResult.useCount,
          command_count: deployResult.commandCount,
          auto_backups: {
            pre_deployment_backup_id: null, // Deleted after successful deployment
            post_deployment_backup_id: postBackupId,
            pre_deployment_deleted: !!preBackupId,
            post_deployment_created: !!postBackupId
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
    
    const configuration = await ConfigurationHistory.findById(configuration_id).populate('device');
    
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
    
    console.log(`⚡ Fast applying configuration to ${configuration.device.name} (${configuration.device.ip_address})...`);
    
    try {
      // Create pre-deployment backup
      console.log(`💾 Creating pre-deployment backup...`);
      let preBackupId = null;
      try {
        const preBackup = await sshService.fastBackup(configuration.device);
        if (preBackup.success) {
          const backup = new ConfigurationBackup({
            device_id: configuration.device._id,
            backup_name: `Pre-Deploy (Fast) - ${new Date().toISOString()}`,
            description: `Auto backup before fast deployment: ${configuration.prompt}`,
            running_config: preBackup.runningConfig,
            backup_type: 'scheduled',
            config_type: 'running-config',
            file_size: preBackup.runningConfigSize,
            config_hash: crypto.createHash('sha256').update(preBackup.runningConfig).digest('hex'),
            created_by: 'auto-deploy',
            is_restore_point: true,
            tags: ['pre-deployment', 'auto-backup', 'fast']
          });
          await backup.save();
          preBackupId = backup._id;
          console.log(`✅ Pre-deployment backup created`);
        }
      } catch (err) {
        console.warn(`⚠️ Pre-deployment backup failed: ${err.message}`);
      }
      
      const deploymentStart = Date.now();
      const deployResult = await sshService.fastDeploy(
        configuration.device,
        configuration.deployment_config
      );
      const deploymentTime = Date.now() - deploymentStart;
      
      if (deployResult.success) {
        // Create post-deployment backup
        let postBackupId = null;
        try {
          const postBackup = await sshService.fastBackup(configuration.device);
          if (postBackup.success) {
            const backup = new ConfigurationBackup({
              device_id: configuration.device._id,
              backup_name: `Post-Deploy (Fast) - ${new Date().toISOString()}`,
              description: `Auto backup after fast deployment: ${configuration.prompt}`,
              running_config: postBackup.runningConfig,
              backup_type: 'scheduled',
              config_type: 'running-config',
              file_size: postBackup.runningConfigSize,
              config_hash: crypto.createHash('sha256').update(postBackup.runningConfig).digest('hex'),
              created_by: 'auto-deploy',
              tags: ['post-deployment', 'auto-backup', 'fast']
            });
            await backup.save();
            postBackupId = backup._id;
            console.log(`✅ Post-deployment backup created`);
          }
        } catch (err) {
          console.warn(`⚠️ Post-deployment backup failed: ${err.message}`);
        }
        
        // Delete pre-deployment backup (keeping only post-deployment)
        if (preBackupId) {
          try {
            await ConfigurationBackup.findByIdAndDelete(preBackupId);
            console.log(`🗑️ Pre-deployment backup deleted`);
          } catch (deleteError) {
            console.warn(`⚠️ Failed to delete pre-deployment backup: ${deleteError.message}`);
          }
        }
        
        configuration.status = 'applied';
        configuration.applied_at = Date.now();
        configuration.deployment_time = deploymentTime;
        await configuration.save();
        
        // Trigger post-deployment backup schedules
        try {
          console.log(`🚀 Triggering post-deployment backup schedules for device ${configuration.device._id}...`);
          await backupScheduler.triggerPostDeploySchedules([configuration.device._id.toString()]);
        } catch (scheduleError) {
          console.warn(`⚠️ Failed to trigger post-deployment schedules: ${scheduleError.message}`);
        }
        
        res.json({
          success: true,
          message: 'Configuration applied successfully using persistent session with auto-backups',
          deployment_time: deploymentTime,
          deployment_time_ms: deploymentTime,
          deployment_time_seconds: (deploymentTime / 1000).toFixed(2),
          output: deployResult.output,
          session_reused: deployResult.sessionReused,
          command_count: deployResult.commandCount,
          auto_backups: {
            pre_deployment_backup_id: null, // Deleted after successful deployment
            post_deployment_backup_id: postBackupId,
            pre_deployment_deleted: !!preBackupId,
            post_deployment_created: !!postBackupId
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
      status: 'generated'
    });
    
    if (!configuration) {
      return res.status(404).json({
        success: false,
        message: 'Configuration not found or already applied'
      });
    }
    
    const device = await Device.findById(configuration.device_id);
    
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
      
      // STEP 1: Create pre-deployment backup checkpoint
      console.log(`💾 Creating pre-deployment backup checkpoint...`);
      let preDeploymentBackupId = null;
      try {
        const preBackupResult = await sshService.createFullBackup(device);
        if (preBackupResult.success) {
          const preBackupHash = crypto
            .createHash('sha256')
            .update(preBackupResult.runningConfig || '')
            .digest('hex');
          
          const preDeploymentBackup = new ConfigurationBackup({
            device_id: device._id,
            backup_name: `Pre-Deploy Checkpoint - ${new Date().toISOString()}`,
            description: `Automatic backup before deploying: ${configuration.prompt}`,
            running_config: preBackupResult.runningConfig,
            startup_config: preBackupResult.startupConfig,
            backup_type: 'scheduled', // Using 'scheduled' to indicate auto-backup
            config_type: 'running-config',
            file_size: (preBackupResult.runningConfigSize || 0) + (preBackupResult.startupConfigSize || 0),
            config_hash: preBackupHash,
            created_by: 'auto-deploy',
            is_restore_point: true,
            tags: ['pre-deployment', 'auto-backup', 'checkpoint']
          });
          
          await preDeploymentBackup.save();
          preDeploymentBackupId = preDeploymentBackup._id;
          console.log(`✅ Pre-deployment backup created: ${preDeploymentBackupId}`);
        }
      } catch (preBackupError) {
        console.warn(`⚠️ Pre-deployment backup failed (continuing with deployment): ${preBackupError.message}`);
      }
      
      // STEP 2: Deploy configuration
      const deploymentStart = Date.now();
      const sshResult = await sshService.sendConfigCommands(device, configToApply);
      const deploymentTime = Date.now() - deploymentStart;
      console.log(`✅ Configuration deployed successfully in ${deploymentTime}ms`);
      
      // STEP 3: Create post-deployment backup
      console.log(`💾 Creating post-deployment backup...`);
      let postDeploymentBackupId = null;
      try {
        const postBackupResult = await sshService.createFullBackup(device);
        if (postBackupResult.success) {
          const postBackupHash = crypto
            .createHash('sha256')
            .update(postBackupResult.runningConfig || '')
            .digest('hex');
          
          const postDeploymentBackup = new ConfigurationBackup({
            device_id: device._id,
            backup_name: `Post-Deploy Backup - ${new Date().toISOString()}`,
            description: `Automatic backup after deploying: ${configuration.prompt}`,
            running_config: postBackupResult.runningConfig,
            startup_config: postBackupResult.startupConfig,
            backup_type: 'scheduled',
            config_type: 'running-config',
            file_size: (postBackupResult.runningConfigSize || 0) + (postBackupResult.startupConfigSize || 0),
            config_hash: postBackupHash,
            created_by: 'auto-deploy',
            tags: ['post-deployment', 'auto-backup']
          });
          
          await postDeploymentBackup.save();
          postDeploymentBackupId = postDeploymentBackup._id;
          console.log(`✅ Post-deployment backup created: ${postDeploymentBackupId}`);
        }
      } catch (postBackupError) {
        console.warn(`⚠️ Post-deployment backup failed: ${postBackupError.message}`);
      }
      
      // STEP 4: Delete pre-deployment backup (we only keep post-deployment for scheduled backups)
      if (preDeploymentBackupId) {
        try {
          await ConfigurationBackup.findByIdAndDelete(preDeploymentBackupId);
          console.log(`🗑️ Pre-deployment backup deleted (keeping only post-deployment backup)`);
        } catch (deleteError) {
          console.warn(`⚠️ Failed to delete pre-deployment backup: ${deleteError.message}`);
        }
      }
      
      // STEP 5: Update configuration status with timestamp
      configuration.status = 'applied';
      configuration.applied_config = configToApply;
      configuration.applied_at = Date.now();
      configuration.deployment_time = deploymentTime;
      await configuration.save();
      
      // Trigger post-deployment backup schedules
      try {
        console.log(`🚀 Triggering post-deployment backup schedules for device ${device._id}...`);
        await backupScheduler.triggerPostDeploySchedules([device._id.toString()]);
      } catch (scheduleError) {
        console.warn(`⚠️ Failed to trigger post-deployment schedules: ${scheduleError.message}`);
      }
      
      res.json({
        success: true,
        message: 'Configuration applied successfully with automatic backups',
        deployment_time: deploymentTime,
        deployment_time_ms: deploymentTime,
        deployment_time_seconds: (deploymentTime / 1000).toFixed(2),
        output: sshResult.output,
        auto_backups: {
          pre_deployment_backup_id: null, // Deleted after successful deployment
          post_deployment_backup_id: postDeploymentBackupId,
          pre_deployment_deleted: !!preDeploymentBackupId,
          post_deployment_created: !!postDeploymentBackupId
        }
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
    console.error('Error applying configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to apply configuration'
    });
  }
});

// GET /api/configurations/history/:device_id - Get configuration history for device
router.get('/history/:device_id', async (req, res) => {
  try {
    const { device_id } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    const configurations = await ConfigurationHistory.find({ device_id })
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();
    
    // Get device info for each configuration
    const enhancedConfigurations = await Promise.all(
      configurations.map(async (config) => {
        const device = await Device.findById(config.device_id).select('name type').lean();
        return {
          ...config,
          id: config._id, // Add id for compatibility
          device_name: device?.name,
          device_type: device?.type
        };
      })
    );
    
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
    
    // Build filter
    const filter = {};
    if (status) filter.status = status;
    
    // Get configurations with pagination
    const configurations = await ConfigurationHistory.find(filter)
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();
    
    // Get total count
    const total = await ConfigurationHistory.countDocuments(filter);
    
    // Enhance configurations with device info
    const enhancedConfigurations = await Promise.all(
      configurations.map(async (config) => {
        const device = await Device.findById(config.device_id).select('name type ip_address').lean();
        return {
          ...config,
          id: config._id, // Add id for compatibility
          device_name: device?.name,
          device_type: device?.type,
          ip_address: device?.ip_address
        };
      })
    );
    
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
    
    const configuration = await ConfigurationHistory.findById(id).lean();
    
    if (!configuration) {
      return res.status(404).json({
        success: false,
        message: 'Configuration not found'
      });
    }
    
    // Get device info
    const device = await Device.findById(configuration.device_id).select('name type ip_address').lean();
    
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
    
    const configuration = await ConfigurationHistory.findByIdAndDelete(id);
    
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
        // Get configuration and device
        const configuration = await ConfigurationHistory.findOne({
          _id: configId,
          status: 'generated'
        });
        
        if (!configuration) {
          results.push({
            configuration_id: configId,
            success: false,
            error: 'Configuration not found or already applied'
          });
          continue;
        }
        
        const device = await Device.findById(configuration.device_id);
        
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
        configuration.status = 'applied';
        configuration.applied_config = configToApply;
        configuration.applied_at = Date.now();
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
        
        // Update configuration status to failed
        try {
          await ConfigurationHistory.findByIdAndUpdate(configId, {
            status: 'failed',
            error_message: error.message
          });
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
      message: `Applied configurations to ${successCount}/${configuration_ids.length} devices`,
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

export default router;

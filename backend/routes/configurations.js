import express from 'express';
import Joi from 'joi';
import Device from '../models/Device.js';
import ConfigurationHistory from '../models/ConfigurationHistory.js';
import aiService from '../services/aiService.js';
import sshService from '../services/sshService.js';

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
    const status = await aiService.getServiceStatus();
    res.json({
      success: true,
      aiService: status
    });
  } catch (error) {
    console.error('Error getting AI status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get AI status',
      aiService: { 
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
      aiResult = await aiService.generateConfiguration(prompt, device.type, {
        name: device.name,
        model: device.model,
        ios_version: device.ios_version,
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
    
    // Save to configuration history with timestamp
    const currentTimestamp = Date.now();
    const configuration = new ConfigurationHistory({
      device_id,
      prompt,
      generated_config: aiResult.configuration, // Clean version for output panel
      deployment_config: aiResult.deploymentConfig, // Clean version for device
      ai_model: aiResult.model,
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
      explanation: aiResult.validation?.explanation || [],
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
      
      // Add deployment start time for timeout tracking
      const deploymentStart = Date.now();
      
      const sshResult = await sshService.sendConfigCommands(device, configToApply);
      
      const deploymentTime = Date.now() - deploymentStart;
      console.log(`✅ Configuration deployed successfully in ${deploymentTime}ms`);
      
      // Update configuration status with timestamp
      configuration.status = 'applied';
      configuration.applied_config = configToApply;
      configuration.applied_at = Date.now();
      configuration.deployment_time = deploymentTime;
      await configuration.save();
      
      res.json({
        success: true,
        message: 'Configuration applied successfully',
        deploymentTime,
        output: sshResult.output
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
      const explanation = await aiService.explainConfiguration(configuration.generated_config);
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

// 🆕 POST /api/configurations/generate-multi - Generate configurations for multiple devices
router.post('/generate-multi', async (req, res) => {
  try {
    const { device_ids, prompt, topology_hints } = req.body;
    
    // Validation
    if (!device_ids || !Array.isArray(device_ids) || device_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'device_ids array is required'
      });
    }
    
    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Prompt is required'
      });
    }
    
    if (device_ids.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 10 devices allowed per request'
      });
    }
    
    console.log(`🤖 Mistral 7B multi-device generation request for ${device_ids.length} devices: "${prompt}"`);
    
    // Get all devices
    const devices = await Device.find({ _id: { $in: device_ids } });
    
    if (devices.length !== device_ids.length) {
      return res.status(404).json({
        success: false,
        message: 'One or more devices not found'
      });
    }
    
    // Check AI service status
    const aiStatus = await aiService.getServiceStatus();
    if (aiStatus.status === "disconnected") {
      return res.status(503).json({
        success: false,
        message: 'AI service is not available. Please check if Ollama is running.',
        aiStatus: aiStatus
      });
    }
    
    console.log(`🎯 Using model: ${aiStatus.model} with optimized settings`);
    
    // Generate multi-device configuration with proper device context
    const deviceContexts = devices.map(device => ({
      id: device._id,
      name: device.name,
      type: device.type,
      model: device.model,
      ios_version: device.ios_version,
      location: device.location,
      vendor: device.vendor
    }));
    
    const result = await aiService.generateMultiDeviceConfiguration(
      deviceContexts, 
      prompt, 
      topology_hints || {}
    );
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error || 'Failed to generate multi-device configuration',
        results: result.results || []
      });
    }
    
    // Save successful configurations to database
    const savedConfigurations = [];
    
    for (const deviceResult of result.results) {
      if (deviceResult.success) {
        try {
          const configuration = new ConfigurationHistory({
            device_id: deviceResult.device_id,
            prompt: prompt,
            generated_config: deviceResult.configuration, // Clean version for output panel
            deployment_config: deviceResult.deploymentConfig, // Clean version for device
            ai_model: result.model || aiStatus.model,
            method: result.method || 'mistral_7b_multi',
            status: 'generated',
            validation_result: deviceResult.validation,
            multi_device_session: true,
            execution_time: result.executionTime
          });
          
          await configuration.save();
          savedConfigurations.push({
            ...deviceResult,
            configuration_id: configuration._id,
            explanation: deviceResult.validation?.explanation || []
          });
        } catch (saveError) {
          console.error(`Failed to save configuration for device ${deviceResult.device_name}:`, saveError);
          savedConfigurations.push({
            ...deviceResult,
            success: false,
            error: 'Failed to save configuration'
          });
        }
      } else {
        savedConfigurations.push(deviceResult);
      }
    }
    
    console.log(`✅ Multi-device generation completed: ${result.summary.successfulDevices}/${result.summary.totalDevices} devices`);
    
    res.json({
      success: true,
      message: `Generated configurations for ${result.summary.successfulDevices}/${result.summary.totalDevices} devices`,
      results: savedConfigurations,
      execution_time: result.executionTime,
      summary: result.summary,
      method: result.method,
      model: result.model,
      ai_status: aiStatus
    });
    
  } catch (error) {
    console.error('Multi-device generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during multi-device generation',
      error: error.message
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
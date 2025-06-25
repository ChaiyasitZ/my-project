import express from 'express';
import Joi from 'joi';
import { query } from '../lib/database.js';
import aiService from '../services/aiService.js';
import sshService from '../services/sshService.js';

const router = express.Router();

// Validation schemas
const generateConfigSchema = Joi.object({
  device_id: Joi.number().integer().required(),
  prompt: Joi.string().required().min(10).max(2000)
});

const applyConfigSchema = Joi.object({
  configuration_id: Joi.number().integer().required()
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
    console.error('Error getting AI service status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get AI service status',
      error: error.message
    });
  }
});

// POST /api/configurations/generate - Generate configuration using AI
router.post('/generate', async (req, res) => {
  try {
    const { error, value } = generateConfigSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
      });
    }
    
    const { device_id, prompt } = value;
    
    // Get device details
    const deviceResult = await query('SELECT * FROM devices WHERE id = $1', [device_id]);
    
    if (deviceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    const device = deviceResult.rows[0];
    
    // Generate configuration using AI
    const startTime = Date.now();
    const aiResult = await aiService.generateConfiguration(
      prompt, 
      device.type, 
      {
        model: device.model,
        ios_version: device.ios_version,
        location: device.location
      }
    );
    const executionTime = Date.now() - startTime;
    
    if (!aiResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Failed to generate valid configuration',
        error: aiResult.error,
        debugInfo: aiResult.debugInfo,
        suggestions: 'Try using more specific Cisco IOS command syntax in your prompt'
      });
    }
    
    // Save to configuration history
    const configResult = await query(`
      INSERT INTO configuration_history (device_id, prompt, generated_config, ai_model, execution_time, status)
      VALUES ($1, $2, $3, $4, $5, 'generated')
      RETURNING *
    `, [device_id, prompt, aiResult.configuration, aiResult.model, executionTime]);
    
    const configuration = configResult.rows[0];
    
    // Validate the generated configuration
    const validation = await aiService.validateConfiguration(aiResult.configuration, device.type);
    
    res.json({
      success: true,
      configuration: {
        ...configuration,
        device_name: device.name,
        device_type: device.type,
        validation
      },
      tokensUsed: aiResult.tokensUsed
    });
    
  } catch (error) {
    console.error('Error generating configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate configuration'
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
    const configResult = await query(`
      SELECT ch.*, d.* 
      FROM configuration_history ch
      JOIN devices d ON ch.device_id = d.id
      WHERE ch.id = $1 AND ch.status = 'generated'
    `, [configuration_id]);
    
    if (configResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Configuration not found or already applied'
      });
    }
    
    const config = configResult.rows[0];
    
    try {
      // Apply configuration via SSH
      const sshResult = await sshService.sendConfigCommands(config, config.generated_config);
      
      // Update configuration status
      await query(`
        UPDATE configuration_history 
        SET status = 'applied', applied_config = $1, applied_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [config.generated_config, configuration_id]);
      
      res.json({
        success: true,
        message: 'Configuration applied successfully',
        output: sshResult.output
      });
      
    } catch (sshError) {
      // Update configuration status to failed
      await query(`
        UPDATE configuration_history 
        SET status = 'failed', error_message = $1
        WHERE id = $2
      `, [sshError.message, configuration_id]);
      
      res.status(500).json({
        success: false,
        message: 'Failed to apply configuration',
        error: sshError.message
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
    
    const result = await query(`
      SELECT ch.*, d.name as device_name, d.type as device_type
      FROM configuration_history ch
      JOIN devices d ON ch.device_id = d.id
      WHERE ch.device_id = $1
      ORDER BY ch.created_at DESC
      LIMIT $2 OFFSET $3
    `, [device_id, limit, offset]);
    
    res.json({
      success: true,
      configurations: result.rows
    });
    
  } catch (error) {
    console.error('Error fetching configuration history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch configuration history'
    });
  }
});

// GET /api/configurations/history - Get all configuration history
router.get('/history', async (req, res) => {
  try {
    const { limit = 50, offset = 0, status } = req.query;
    
    let queryText = `
      SELECT ch.*, d.name as device_name, d.type as device_type, d.ip_address
      FROM configuration_history ch
      JOIN devices d ON ch.device_id = d.id
    `;
    let countQueryText = `
      SELECT COUNT(*) as total
      FROM configuration_history ch
      JOIN devices d ON ch.device_id = d.id
    `;
    const queryParams = [];
    const countParams = [];
    
    if (status) {
      queryParams.push(status);
      countParams.push(status);
      queryText += ` WHERE ch.status = $${queryParams.length}`;
      countQueryText += ` WHERE ch.status = $${countParams.length}`;
    }
    
    queryParams.push(limit, offset);
    queryText += ` ORDER BY ch.created_at DESC LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`;
    
    const [result, countResult] = await Promise.all([
      query(queryText, queryParams),
      query(countQueryText, countParams)
    ]);
    
    res.json({
      success: true,
      configurations: result.rows,
      total: parseInt(countResult.rows[0].total),
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

// GET /api/configurations/:id - Get specific configuration
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(`
      SELECT ch.*, d.name as device_name, d.type as device_type, d.ip_address
      FROM configuration_history ch
      JOIN devices d ON ch.device_id = d.id
      WHERE ch.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Configuration not found'
      });
    }
    
    const configuration = result.rows[0];
    
    // Get explanation if needed
    if (req.query.explain === 'true') {
      const explanation = await aiService.explainConfiguration(configuration.generated_config);
      configuration.explanation = explanation;
    }
    
    res.json({
      success: true,
      configuration
    });
    
  } catch (error) {
    console.error('Error fetching configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch configuration'
    });
  }
});

// POST /api/configurations/:id/validate - Validate configuration with detailed accuracy metrics
router.post('/:id/validate', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(`
      SELECT ch.*, d.type as device_type
      FROM configuration_history ch
      JOIN devices d ON ch.device_id = d.id
      WHERE ch.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Configuration not found'
      });
    }
    
    const configuration = result.rows[0];
    const validation = await aiService.validateConfiguration(
      configuration.generated_config, 
      configuration.device_type
    );
    
    res.json({
      success: true,
      validation,
      accuracy_metrics: {
        overall_accuracy: validation.accuracy,
        confidence_score: validation.confidence,
        valid_commands: validation.validCommands,
        total_commands: validation.totalCommands,
        accuracy_percentage: `${(validation.accuracy * 100).toFixed(1)}%`,
        quality_rating: validation.accuracy >= 0.95 ? 'Excellent' : 
                       validation.accuracy >= 0.90 ? 'Good' : 
                       validation.accuracy >= 0.80 ? 'Fair' : 'Poor'
      }
    });
    
  } catch (error) {
    console.error('Error validating configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate configuration'
    });
  }
});

// POST /api/configurations/test-accuracy - Test configuration accuracy in real-time
router.post('/test-accuracy', async (req, res) => {
  try {
    const { configuration, device_type } = req.body;
    
    if (!configuration || !device_type) {
      return res.status(400).json({
        success: false,
        message: 'Configuration and device_type are required'
      });
    }

    if (!['router', 'switch'].includes(device_type)) {
      return res.status(400).json({
        success: false,
        message: 'device_type must be either "router" or "switch"'
      });
    }

    console.log(`🧪 Testing configuration accuracy for ${device_type}`);
    
    const startTime = Date.now();
    const validation = await aiService.validateConfiguration(configuration, device_type);
    const testTime = Date.now() - startTime;
    
    // Generate improvement suggestions if accuracy is below 100%
    let improvements = [];
    if (validation.accuracy < 1.0) {
      if (validation.exhaustiveValidation?.issues?.length > 0) {
        improvements = validation.exhaustiveValidation.issues.slice(0, 5);
      }
    }
    
    res.json({
      success: true,
      test_results: {
        accuracy: validation.accuracy,
        confidence: validation.confidence,
        is_valid: validation.isValid,
        quality_rating: validation.accuracy >= 0.95 ? 'Production Ready' : 
                       validation.accuracy >= 0.90 ? 'Minor Issues' : 
                       validation.accuracy >= 0.80 ? 'Needs Improvement' : 'Major Issues',
        accuracy_percentage: `${(validation.accuracy * 100).toFixed(1)}%`,
        valid_commands: validation.validCommands,
        total_commands: validation.totalCommands,
        test_time_ms: testTime,
        improvements: improvements,
        detailed_feedback: validation.feedback
      },
      validation: validation
    });
    
  } catch (error) {
    console.error('Error testing configuration accuracy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test configuration accuracy'
    });
  }
});

// DELETE /api/configurations/:id - Delete configuration
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query('DELETE FROM configuration_history WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
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

// GET /api/configurations/suggestions - Get configuration suggestions
router.get('/suggestions', async (req, res) => {
  try {
    const { device_type, scenario = 'basic' } = req.query;
    
    if (!device_type) {
      return res.status(400).json({
        success: false,
        message: 'device_type parameter is required'
      });
    }

    if (!['router', 'switch'].includes(device_type)) {
      return res.status(400).json({
        success: false,
        message: 'device_type must be either "router" or "switch"'
      });
    }

    const suggestions = await aiService.getConfigurationSuggestions(device_type, scenario);
    
    res.json({
      success: true,
      ...suggestions
    });
    
  } catch (error) {
    console.error('Error getting configuration suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get configuration suggestions'
    });
  }
});

// GET /api/configurations/template - Generate configuration template
router.get('/template', async (req, res) => {
  try {
    const { device_type, scenario = 'basic' } = req.query;
    
    if (!device_type) {
      return res.status(400).json({
        success: false,
        message: 'device_type parameter is required'
      });
    }

    if (!['router', 'switch'].includes(device_type)) {
      return res.status(400).json({
        success: false,
        message: 'device_type must be either "router" or "switch"'
      });
    }

    // Extract optional device context from query parameters
    const deviceContext = {};
    if (req.query.hostname) deviceContext.hostname = req.query.hostname;
    if (req.query.domain) deviceContext.domain = req.query.domain;
    if (req.query.mgmt_ip) deviceContext.mgmtIP = req.query.mgmt_ip;
    if (req.query.mgmt_mask) deviceContext.mgmtMask = req.query.mgmt_mask;
    if (req.query.gateway) deviceContext.gateway = req.query.gateway;
    if (req.query.loopback_ip) deviceContext.loopbackIP = req.query.loopback_ip;
    if (req.query.mgmt_network) deviceContext.mgmtNetwork = req.query.mgmt_network;

    const template = await aiService.generateConfigurationTemplate(device_type, scenario, deviceContext);
    
    res.json({
      success: true,
      ...template
    });
    
  } catch (error) {
    console.error('Error generating configuration template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate configuration template'
    });
  }
});

// GET /api/configurations/templates - Get configuration templates (legacy endpoint)
router.get('/templates', async (req, res) => {
  try {
    const { device_type, category } = req.query;
    
    let queryText = 'SELECT * FROM configuration_templates WHERE 1=1';
    const queryParams = [];
    
    if (device_type) {
      queryParams.push(device_type);
      queryText += ` AND (device_type = $${queryParams.length} OR device_type = 'both')`;
    }
    
    if (category) {
      queryParams.push(category);
      queryText += ` AND category = $${queryParams.length}`;
    }
    
    queryText += ' ORDER BY category, name';
    
    const result = await query(queryText, queryParams);
    
    res.json({
      success: true,
      templates: result.rows
    });
    
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch templates'
    });
  }
});

export default router; 
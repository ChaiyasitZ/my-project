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

// POST /api/configurations/generate - Generate configuration using Raw AI
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
    
    // Generate configuration using Raw AI
    const startTime = Date.now();
    const aiResult = await aiService.generateConfiguration(prompt, device.type);
    const executionTime = Date.now() - startTime;
    
    if (!aiResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Failed to generate configuration',
        error: aiResult.error
      });
    }
    
    // Save to configuration history
    const configResult = await query(`
      INSERT INTO configuration_history (device_id, prompt, generated_config, ai_model, execution_time, status)
      VALUES ($1, $2, $3, $4, $5, 'generated')
      RETURNING *
    `, [device_id, prompt, aiResult.configuration, aiResult.model, executionTime]);
    
    const configuration = configResult.rows[0];
    
    res.json({
      success: true,
      configuration: {
        ...configuration,
        device_name: device.name,
        device_type: device.type
      }
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

export default router; 
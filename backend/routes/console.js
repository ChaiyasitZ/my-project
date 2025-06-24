import express from 'express';
import Joi from 'joi';
import { query } from '../lib/database.js';
import consoleService from '../services/consoleService.js';

const router = express.Router();

// Validation schemas
const consoleConnectionSchema = Joi.object({
  deviceId: Joi.string().required(),
  portPath: Joi.string().required(),
  baudRate: Joi.number().valid(300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200).default(9600),
  dataBits: Joi.number().valid(5, 6, 7, 8).default(8),
  parity: Joi.string().valid('none', 'even', 'odd', 'mark', 'space').default('none'),
  stopBits: Joi.number().valid(1, 1.5, 2).default(1)
});

const initialConfigSchema = Joi.object({
  deviceId: Joi.string().required(),
  configCommands: Joi.string().required().min(1),
  deviceInfo: Joi.object({
    hostname: Joi.string(),
    managementIp: Joi.string().ip(),
    managementMask: Joi.string(),
    defaultGateway: Joi.string().ip(),
    domain: Joi.string(),
    username: Joi.string(),
    password: Joi.string(),
    enablePassword: Joi.string()
  }).optional()
});

const consoleCommandSchema = Joi.object({
  deviceId: Joi.string().required(),
  command: Joi.string().required().min(1),
  waitForPrompt: Joi.boolean().default(true)
});

// GET /api/console/ports - Get available serial ports
router.get('/ports', async (req, res) => {
  try {
    console.log('🔌 Fetching available serial ports');
    const result = await consoleService.getAvailablePorts();
    
    res.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching serial ports:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch serial ports',
      error: error.message
    });
  }
});

// POST /api/console/connect - Connect to device via console
router.post('/connect', async (req, res) => {
  try {
    const { error, value } = consoleConnectionSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
      });
    }

    console.log(`🔌 Console connection request for port ${value.portPath}`);
    const result = await consoleService.connectConsole(value);
    
    res.json({
      success: true,
      message: 'Console connected successfully',
      connection: result
    });
  } catch (error) {
    console.error('Console connection error:', error);
    res.status(500).json({
      success: false,
      message: 'Console connection failed',
      error: error.message
    });
  }
});

// POST /api/console/disconnect - Disconnect console
router.post('/disconnect', async (req, res) => {
  try {
    const { deviceId } = req.body;
    
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required'
      });
    }

    await consoleService.disconnectConsole(deviceId);
    
    res.json({
      success: true,
      message: 'Console disconnected successfully'
    });
  } catch (error) {
    console.error('Console disconnect error:', error);
    res.status(500).json({
      success: false,
      message: 'Console disconnect failed',
      error: error.message
    });
  }
});

// POST /api/console/test - Test console connection
router.post('/test', async (req, res) => {
  try {
    const { error, value } = consoleConnectionSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
      });
    }

    console.log(`🧪 Testing console connection for port ${value.portPath}`);
    const result = await consoleService.testConsoleConnection(value);
    
    res.json({
      success: true,
      test: result
    });
  } catch (error) {
    console.error('Console test error:', error);
    res.status(500).json({
      success: false,
      message: 'Console test failed',
      error: error.message
    });
  }
});

// POST /api/console/command - Send command via console
router.post('/command', async (req, res) => {
  try {
    const { error, value } = consoleCommandSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
      });
    }

    const { deviceId, command, waitForPrompt } = value;
    console.log(`📝 Sending console command to device ${deviceId}: ${command}`);
    
    const result = await consoleService.sendConsoleCommand(deviceId, command, waitForPrompt);
    
    res.json({
      success: true,
      message: 'Command sent successfully',
      result
    });
  } catch (error) {
    console.error('Console command error:', error);
    res.status(500).json({
      success: false,
      message: 'Console command failed',
      error: error.message
    });
  }
});

// POST /api/console/initial-config - Send initial configuration
router.post('/initial-config', async (req, res) => {
  try {
    const { error, value } = initialConfigSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
      });
    }

    const { deviceId, configCommands, deviceInfo } = value;
    console.log(`🔧 Starting initial configuration for device ${deviceId}`);
    
    const result = await consoleService.sendInitialConfig(deviceId, configCommands, deviceInfo);
    
    // Save configuration to database if successful
    if (result.success) {
      try {
        await query(`
          INSERT INTO configuration_history 
          (device_id, prompt, generated_config, applied_config, status, ai_model, execution_time, created_at, applied_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
          deviceId,
          'Initial console configuration',
          configCommands,
          result.fullOutput,
          result.summary.failed > 0 ? 'partial' : 'applied',
          'console',
          0
        ]);
      } catch (dbError) {
        console.error('⚠️ Failed to save configuration to database:', dbError.message);
      }
    }
    
    res.json({
      success: true,
      message: 'Initial configuration completed',
      configuration: result
    });
  } catch (error) {
    console.error('Initial configuration error:', error);
    res.status(500).json({
      success: false,
      message: 'Initial configuration failed',
      error: error.message
    });
  }
});

// GET /api/console/status/:deviceId - Get console connection status
router.get('/status/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const status = consoleService.getConsoleStatus(deviceId);
    
    res.json({
      success: true,
      deviceId,
      status
    });
  } catch (error) {
    console.error('Console status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get console status',
      error: error.message
    });
  }
});

// GET /api/console/templates - Get initial configuration templates
router.get('/templates', async (req, res) => {
  try {
    const templates = consoleService.getInitialConfigTemplates();
    
    res.json({
      success: true,
      templates,
      count: Object.keys(templates).length
    });
  } catch (error) {
    console.error('Templates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get templates',
      error: error.message
    });
  }
});

// POST /api/console/templates/apply - Apply template with variables
router.post('/templates/apply', async (req, res) => {
  try {
    const { templateKey, variables, deviceId } = req.body;
    
    if (!templateKey || !deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Template key and device ID are required'
      });
    }

    const templates = consoleService.getInitialConfigTemplates();
    const template = templates[templateKey];
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // Replace template variables
    let config = template.config;
    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        const placeholder = `{{${key}}}`;
        config = config.replace(new RegExp(placeholder, 'g'), value);
      });
    }

    // Send the configuration
    const result = await consoleService.sendInitialConfig(deviceId, config, variables);
    
    res.json({
      success: true,
      message: 'Template applied successfully',
      template: {
        name: template.name,
        key: templateKey
      },
      configuration: result
    });
    
  } catch (error) {
    console.error('Template application error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to apply template',
      error: error.message
    });
  }
});

export default router; 
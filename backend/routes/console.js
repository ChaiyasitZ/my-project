import express from 'express';
import Joi from 'joi';
import mongoose from 'mongoose';
import ConfigurationHistory from '../models/ConfigurationHistory.js';
import Device from '../models/Device.js';
import consoleService from '../services/consoleService.js';
import agentRelay from '../services/agentRelay.js';
import AgentHeartbeat from '../models/AgentHeartbeat.js';
import { authenticateToken } from '../middleware/auth.js';

// Helper to verify device ownership when a MongoDB ObjectId is provided
async function verifyDeviceOwnership(deviceId, userId) {
  // Only check ownership if it looks like a MongoDB ObjectId
  if (mongoose.Types.ObjectId.isValid(deviceId)) {
    const device = await Device.findOne({ _id: deviceId, userId });
    if (!device) {
      return { valid: false, error: 'Device not found or access denied' };
    }
    return { valid: true, device };
  }
  // For port-based IDs (e.g., port_COM3), allow access
  return { valid: true };
}

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Validation schemas
const consoleConnectionSchema = Joi.object({
  deviceId: Joi.string().allow('').default(''),
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
    let result;
    
    // On serverless (Vercel), serialport is not available — go directly to agent
    if (!consoleService.serialPortAvailable) {
      console.log('🔄 serialport not available (serverless), trying agent...');
      
      // Strategy 1: Check agent heartbeat for cached ports (instant, no relay needed)
      try {
        const agentInfo = await AgentHeartbeat.findOne({ userId: req.userId });
        if (agentInfo && agentInfo.isOnline() && agentInfo.capabilities?.serialPorts?.length > 0) {
          console.log('✅ Got ports from agent heartbeat cache:', agentInfo.capabilities.serialPorts.length);
          return res.json({
            success: true,
            ports: agentInfo.capabilities.serialPorts,
            count: agentInfo.capabilities.serialPorts.length,
            source: 'heartbeat-cache',
            timestamp: new Date().toISOString()
          });
        }
      } catch (hbErr) {
        console.log('⚠️ Heartbeat cache check failed:', hbErr.message);
      }
      
      // Strategy 2: Relay command to agent (slower, requires round-trip)
      console.log('🔄 No cached ports, relaying command to agent...');
      try {
        result = await agentRelay.sendToAgent(req.userId, 'agent:console:list-ports', {}, 15000);
      } catch (relayErr) {
        console.error('❌ Agent relay failed:', relayErr.message);
        return res.status(503).json({
          success: false,
          message: relayErr.message,
          ports: []
        });
      }
    } else {
      // serialport available (local/desktop mode) — try local first
      try {
        result = await consoleService.getAvailablePorts();
      } catch (localErr) {
        console.log('🔄 serialport error, relaying to agent...');
        result = await agentRelay.sendToAgent(req.userId, 'agent:console:list-ports', {}, 15000);
      }

      // If local serialport returned 0 ports, also check agent (it may have ports on a different machine)
      if (result && result.ports && result.ports.length === 0) {
        console.log('🔄 No local ports found, checking agent...');
        try {
          const agentInfo = await AgentHeartbeat.findOne({ userId: req.userId });
          if (agentInfo && agentInfo.isOnline() && agentInfo.capabilities?.serialPorts?.length > 0) {
            result = {
              success: true,
              ports: agentInfo.capabilities.serialPorts,
              count: agentInfo.capabilities.serialPorts.length
            };
          }
        } catch (hbErr) {
          // Ignore — use empty local result
        }
      }
    }

    // Handle pending / timeout responses from agent relay
    if (result && result.pending) {
      return res.status(504).json({
        success: false,
        message: 'Agent did not respond in time. Please ensure the NetConfig Agent is running and try clicking Refresh.',
        ports: []
      });
    }
    
    console.log('🔌 Returning ports:', result?.ports?.length || 0);
    res.json({
      success: true,
      ports: result?.ports || [],
      count: result?.count || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching serial ports:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch serial ports',
      error: error.message,
      ports: []
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

    // Use portPath as device ID if not provided
    if (!value.deviceId || value.deviceId.trim() === '') {
      value.deviceId = `port_${value.portPath.replace(/[^a-zA-Z0-9]/g, '_')}`;
    }

    // Verify device ownership if a database device ID is provided
    const ownership = await verifyDeviceOwnership(value.deviceId, req.userId);
    if (!ownership.valid) {
      return res.status(404).json({ success: false, message: ownership.error });
    }

    console.log(`🔌 Console connection request for port ${value.portPath} (Device ID: ${value.deviceId})`);
    let result;
    if (!consoleService.serialPortAvailable) {
      console.log('🔄 Relaying console connect to agent...');
      result = await agentRelay.sendToAgent(req.userId, 'agent:console:connect', value, 15000);
    } else {
      try {
        result = await consoleService.connectConsole(value);
      } catch (localErr) {
        console.log('🔄 Relaying console connect to agent...');
        result = await agentRelay.sendToAgent(req.userId, 'agent:console:connect', value, 15000);
      }
    }

    if (result && result.pending) {
      return res.status(504).json({
        success: false,
        message: 'Agent did not respond in time. Please ensure the NetConfig Agent is running.'
      });
    }
    
    res.json({
      success: true,
      message: 'Console connected successfully',
      connection: result,
      deviceId: value.deviceId
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
    const { deviceId, portPath } = req.body;
    
    // Accept either deviceId or portPath
    let finalDeviceId = deviceId;
    if (!finalDeviceId && portPath) {
      finalDeviceId = `port_${portPath.replace(/[^a-zA-Z0-9]/g, '_')}`;
    }
    
    if (!finalDeviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID or Port Path is required'
      });
    }

    // Verify device ownership if a database device ID is provided
    const ownership = await verifyDeviceOwnership(finalDeviceId, req.userId);
    if (!ownership.valid) {
      return res.status(404).json({ success: false, message: ownership.error });
    }

    try {
      if (!consoleService.serialPortAvailable) {
        console.log('🔄 Relaying console disconnect to agent...');
        await agentRelay.sendToAgent(req.userId, 'agent:console:disconnect', { deviceId: finalDeviceId });
      } else {
        await consoleService.disconnectConsole(finalDeviceId);
      }
    } catch (localErr) {
      console.log('🔄 Relaying console disconnect to agent...');
      await agentRelay.sendToAgent(req.userId, 'agent:console:disconnect', { deviceId: finalDeviceId });
    }
    
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

    // Use portPath as device ID if not provided
    if (!value.deviceId || value.deviceId.trim() === '') {
      value.deviceId = `test_${value.portPath.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
    }

    console.log(`🧪 Testing console connection for port ${value.portPath} (Device ID: ${value.deviceId})`);
    let result;
    if (!consoleService.serialPortAvailable) {
      console.log('🔄 Relaying console test to agent...');
      result = await agentRelay.sendToAgent(req.userId, 'agent:console:test', value, 15000);
    } else {
      try {
        result = await consoleService.testConsoleConnection(value);
      } catch (localErr) {
        console.log('🔄 Relaying console test to agent...');
        result = await agentRelay.sendToAgent(req.userId, 'agent:console:test', value, 15000);
      }
    }

    if (result && result.pending) {
      return res.status(504).json({
        success: false,
        message: 'Agent did not respond in time. Please ensure the NetConfig Agent is running.'
      });
    }
    
    res.json({
      success: true,
      test: result,
      deviceId: value.deviceId
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

    // Verify device ownership if a database device ID is provided
    const ownership = await verifyDeviceOwnership(deviceId, req.userId);
    if (!ownership.valid) {
      return res.status(404).json({ success: false, message: ownership.error });
    }

    console.log(`📝 Sending console command to device ${deviceId}: ${command}`);
    
    let result;
    if (!consoleService.serialPortAvailable) {
      console.log('🔄 Relaying console command to agent...');
      result = await agentRelay.sendToAgent(req.userId, 'agent:console:command', { deviceId, command, waitForPrompt }, 15000);
    } else {
      try {
        result = await consoleService.sendConsoleCommand(deviceId, command, waitForPrompt);
      } catch (localErr) {
        console.log('🔄 Relaying console command to agent...');
        result = await agentRelay.sendToAgent(req.userId, 'agent:console:command', { deviceId, command, waitForPrompt }, 15000);
      }
    }

    if (result && result.pending) {
      return res.status(504).json({
        success: false,
        message: 'Agent did not respond in time. Please ensure the NetConfig Agent is running.'
      });
    }
    
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

    // Verify device ownership if a database device ID is provided
    const ownership = await verifyDeviceOwnership(deviceId, req.userId);
    if (!ownership.valid) {
      return res.status(404).json({ success: false, message: ownership.error });
    }

    console.log(`🔧 Starting initial configuration for device ${deviceId}`);
    
    let result;
    if (!consoleService.serialPortAvailable) {
      console.log('🔄 Relaying initial config to agent...');
      result = await agentRelay.sendToAgent(req.userId, 'agent:console:initial-config', { deviceId, configCommands }, 30000);
    } else {
      try {
        result = await consoleService.sendInitialConfig(deviceId, configCommands, deviceInfo);
      } catch (localErr) {
        console.log('🔄 Relaying initial config to agent...');
        result = await agentRelay.sendToAgent(req.userId, 'agent:console:initial-config', { deviceId, configCommands }, 30000);
      }
    }

    if (result && result.pending) {
      return res.status(504).json({
        success: false,
        message: 'Agent did not respond in time. Initial configuration may still be in progress.'
      });
    }
    
    // Save configuration to database if successful
    if (result.success) {
      try {
        const configHistory = new ConfigurationHistory({
          device_id: deviceId,
          userId: req.userId,
          prompt: 'Initial console configuration',
          generated_config: configCommands,
          deployed_config: result.fullOutput,
          status: result.summary.failed > 0 ? 'partial' : 'deployed',
          ai_model: 'console',
          execution_time: 0,
                      deployed_at: Date.now()
        });
        
        await configHistory.save();
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

    // Verify device ownership if a database device ID is provided
    const ownership = await verifyDeviceOwnership(deviceId, req.userId);
    if (!ownership.valid) {
      return res.status(404).json({ success: false, message: ownership.error });
    }

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

    // Verify device ownership if a database device ID is provided
    const ownership = await verifyDeviceOwnership(deviceId, req.userId);
    if (!ownership.valid) {
      return res.status(404).json({ success: false, message: ownership.error });
    }

    const templates = consoleService.getInitialConfigTemplates();
    const template = templates[templateKey];
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // Use the new method to process template with IP configuration
    let config;
    try {
      config = consoleService.processTemplateWithIPConfig(templateKey, variables || {});
    } catch (error) {
      config = template.config;
      // Fallback to simple variable replacement if new method fails
      if (variables) {
        Object.entries(variables).forEach(([key, value]) => {
          const placeholder = `{{${key}}}`;
          config = config.replace(new RegExp(placeholder, 'g'), value);
        });
      }
    }

    // Send the configuration
    let result;
    try {
      result = await consoleService.sendInitialConfig(deviceId, config, variables);
    } catch (localErr) {
      console.log('🔄 Relaying template apply to agent...');
      result = await agentRelay.sendToAgent(req.userId, 'agent:console:initial-config', { deviceId, configCommands: config }, 30000);
    }
    
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
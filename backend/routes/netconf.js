import express from 'express';
import Device from '../models/Device.js';
import YangModel from '../models/YangModel.js';
import ConfigurationHistory from '../models/ConfigurationHistory.js';
import netconfService from '../services/netconfService.js';
import mockNetconfService from '../services/mockNetconfService.js';
import aiService from '../services/aiService.js';

const router = express.Router();

// Helper function to determine if mock mode should be used
const shouldUseMock = (req) => {
  return req.query.mock === 'true' || req.body?.mock === true;
};

// Test NETCONF connection (with mock support)
router.post('/test-connection', async (req, res) => {
  try {
    const { device_id, mock } = req.body;

    if (!device_id) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required'
      });
    }

    const device = await Device.findById(device_id);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    let result;
    if (mock || shouldUseMock(req)) {
      // Use mock service
      result = await mockNetconfService.mockConnect({
        ip_address: device.ip_address,
        username: device.username,
        password: device.password,
        netconf_port: device.netconf_port
      });
    } else {
      if (!device.netconf_enabled) {
        return res.status(400).json({
          success: false,
          message: 'NETCONF is not enabled for this device'
        });
      }

      result = await netconfService.connect({
        ip_address: device.ip_address,
        username: device.username,
        password: device.password,
        netconf_port: device.netconf_port
      });
    }

    // Update device capabilities if connection successful
    if (result.success && result.capabilities) {
      device.netconf_capabilities = result.capabilities;
      device.last_connection = {
        type: 'netconf',
        timestamp: new Date(),
        status: 'success',
        session_id: result.sessionId
      };
      await device.save();
    }

    res.json({
      success: true,
      message: `${result.isMock ? 'Mock ' : ''}NETCONF connection test successful`,
      data: {
        sessionId: result.sessionId,
        capabilities: result.capabilities || [],
        device: device.device_summary,
        isMock: result.isMock || false
      }
    });

  } catch (error) {
    console.error('❌ NETCONF connection test error:', error);
    res.status(500).json({
      success: false,
      message: 'NETCONF connection test failed',
      error: error.message
    });
  }
});

// Connect to device via NETCONF (with mock support)
router.post('/connect/:device_id', async (req, res) => {
  try {
    const { device_id } = req.params;
    const { mock } = req.body;

    const device = await Device.findById(device_id);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    let result;
    if (mock || shouldUseMock(req)) {
      // Use mock service
      result = await mockNetconfService.mockConnect({
        ip_address: device.ip_address,
        username: device.username,
        password: device.password,
        netconf_port: device.netconf_port
      });
    } else {
      if (!device.netconf_enabled) {
        return res.status(400).json({
          success: false,
          message: 'NETCONF is not enabled for this device'
        });
      }

      result = await netconfService.connect({
        ip_address: device.ip_address,
        username: device.username,
        password: device.password,
        netconf_port: device.netconf_port
      });
    }

    if (result.success) {
      // Update device with capabilities
      if (result.capabilities) {
        device.netconf_capabilities = result.capabilities;
      }
      device.last_connection = {
        type: 'netconf',
        timestamp: new Date(),
        status: 'success',
        session_id: result.sessionId
      };
      await device.save();
    }

    res.json({
      success: true,
      message: `${result.isMock ? 'Mock ' : ''}NETCONF session established with ${device.name}`,
      data: {
        sessionId: result.sessionId,
        capabilities: result.capabilities || device.netconf_capabilities,
        device: device.device_summary,
        isMock: result.isMock || false
      }
    });

  } catch (error) {
    console.error('❌ NETCONF connection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to establish NETCONF connection',
      error: error.message
    });
  }
});

// Disconnect NETCONF session (with mock support)
router.post('/disconnect/:session_id', async (req, res) => {
  try {
    const { session_id } = req.params;

    let result;
    if (session_id.startsWith('mock_')) {
      result = await mockNetconfService.mockDisconnect(session_id);
    } else {
      result = await netconfService.disconnect(session_id);
    }

    res.json({
      success: true,
      message: `${result.isMock ? 'Mock ' : ''}NETCONF session disconnected`,
      data: result
    });

  } catch (error) {
    console.error('❌ NETCONF disconnect error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect NETCONF session',
      error: error.message
    });
  }
});

// Get device configuration via NETCONF (with mock support)
router.get('/config/:session_id', async (req, res) => {
  try {
    const { session_id } = req.params;
    const { datastore = 'running', filter } = req.query;

    let result;
    if (session_id.startsWith('mock_')) {
      result = await mockNetconfService.mockGetConfig(session_id, datastore, filter);
    } else {
      result = await netconfService.getConfig(session_id, datastore, filter);
    }

    res.json({
      success: true,
      message: `${result.isMock ? 'Mock ' : ''}Configuration retrieved successfully`,
      data: {
        datastore,
        config: result.data,
        operation: result.operation,
        messageId: result.messageId,
        isMock: result.isMock || false
      }
    });

  } catch (error) {
    console.error('❌ NETCONF get-config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve configuration',
      error: error.message
    });
  }
});

// Get operational data via NETCONF (with mock support)
router.get('/operational/:session_id', async (req, res) => {
  try {
    const { session_id } = req.params;
    const { filter } = req.query;

    let result;
    if (session_id.startsWith('mock_')) {
      result = await mockNetconfService.mockGet(session_id, filter);
    } else {
      result = await netconfService.get(session_id, filter);
    }

    res.json({
      success: true,
      message: `${result.isMock ? 'Mock ' : ''}Operational data retrieved successfully`,
      data: {
        operationalData: result.data,
        operation: result.operation,
        messageId: result.messageId,
        isMock: result.isMock || false
      }
    });

  } catch (error) {
    console.error('❌ NETCONF get error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve operational data',
      error: error.message
    });
  }
});

// Edit configuration via NETCONF (with mock support)
router.post('/edit-config/:session_id', async (req, res) => {
  try {
    const { session_id } = req.params;
    const { datastore = 'running', config, default_operation = 'merge', device_id } = req.body;

    if (!config) {
      return res.status(400).json({
        success: false,
        message: 'Configuration data is required'
      });
    }

    let result;
    if (session_id.startsWith('mock_')) {
      result = await mockNetconfService.mockEditConfig(session_id, datastore, config, default_operation);
    } else {
      result = await netconfService.editConfig(session_id, datastore, config, default_operation);
    }

    // Save configuration history
    if (device_id) {
      const device = await Device.findById(device_id);
      if (device) {
        const configHistory = new ConfigurationHistory({
          device_id: device._id,
          configuration: typeof config === 'string' ? config : JSON.stringify(config),
          status: result.success ? 'applied' : 'failed',
          deployment_method: result.isMock ? 'netconf-mock' : 'netconf',
          deployment_target: datastore,
          applied_by: 'netconf-api',
          applied_at: new Date(),
          metadata: {
            session_id,
            operation: 'edit-config',
            default_operation,
            message_id: result.messageId,
            is_mock: result.isMock || false
          }
        });
        await configHistory.save();
      }
    }

    res.json({
      success: true,
      message: `${result.isMock ? 'Mock ' : ''}Configuration applied successfully via NETCONF`,
      data: {
        datastore,
        operation: result.operation,
        messageId: result.messageId,
        response: result.data,
        isMock: result.isMock || false
      }
    });

  } catch (error) {
    console.error('❌ NETCONF edit-config error:', error);
    
    // Save failed configuration history
    if (req.body.device_id) {
      try {
        const configHistory = new ConfigurationHistory({
          device_id: req.body.device_id,
          configuration: typeof req.body.config === 'string' ? req.body.config : JSON.stringify(req.body.config),
          status: 'failed',
          deployment_method: req.params.session_id.startsWith('mock_') ? 'netconf-mock' : 'netconf',
          applied_by: 'netconf-api',
          applied_at: new Date(),
          error_message: error.message,
          metadata: {
            session_id: req.params.session_id,
            operation: 'edit-config'
          }
        });
        await configHistory.save();
      } catch (historyError) {
        console.error('❌ Failed to save error history:', historyError);
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to apply configuration',
      error: error.message
    });
  }
});

// Commit configuration (with mock support)
router.post('/commit/:session_id', async (req, res) => {
  try {
    const { session_id } = req.params;

    let result;
    if (session_id.startsWith('mock_')) {
      result = await mockNetconfService.mockCommit(session_id);
    } else {
      result = await netconfService.commit(session_id);
    }

    res.json({
      success: true,
      message: `${result.isMock ? 'Mock ' : ''}Configuration committed successfully`,
      data: {
        operation: result.operation,
        messageId: result.messageId,
        response: result.data,
        isMock: result.isMock || false
      }
    });

  } catch (error) {
    console.error('❌ NETCONF commit error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to commit configuration',
      error: error.message
    });
  }
});

// Discard changes (with mock support)
router.post('/discard-changes/:session_id', async (req, res) => {
  try {
    const { session_id } = req.params;

    let result;
    if (session_id.startsWith('mock_')) {
      // Mock service doesn't have discard-changes, simulate with success
      result = {
        success: true,
        operation: 'discard-changes',
        messageId: Date.now(),
        data: { ok: {} },
        isMock: true
      };
    } else {
      result = await netconfService.discardChanges(session_id);
    }

    res.json({
      success: true,
      message: `${result.isMock ? 'Mock ' : ''}Changes discarded successfully`,
      data: {
        operation: result.operation,
        messageId: result.messageId,
        response: result.data,
        isMock: result.isMock || false
      }
    });

  } catch (error) {
    console.error('❌ NETCONF discard-changes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to discard changes',
      error: error.message
    });
  }
});

// Validate configuration (with mock support)
router.post('/validate/:session_id', async (req, res) => {
  try {
    const { session_id } = req.params;
    const { datastore = 'candidate' } = req.body;

    let result;
    if (session_id.startsWith('mock_')) {
      result = await mockNetconfService.mockValidate(session_id, datastore);
    } else {
      result = await netconfService.validate(session_id, datastore);
    }

    res.json({
      success: true,
      message: `${result.isMock ? 'Mock ' : ''}Configuration validation completed`,
      data: {
        datastore,
        operation: result.operation,
        messageId: result.messageId,
        response: result.data,
        isMock: result.isMock || false
      }
    });

  } catch (error) {
    console.error('❌ NETCONF validate error:', error);
    res.status(500).json({
      success: false,
      message: 'Configuration validation failed',
      error: error.message
    });
  }
});

// Generate NETCONF XML using LLM
router.post('/generate-xml', async (req, res) => {
  try {
    const { prompt, device_id, yang_model } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: 'Prompt is required'
      });
    }

    let device = null;
    if (device_id) {
      device = await Device.findById(device_id);
    }

    // Enhanced prompt for NETCONF XML generation
    const netconfPrompt = `Generate NETCONF XML configuration for the following request:

Request: ${prompt}

Requirements:
- Generate valid NETCONF edit-config XML
- Use appropriate YANG model structure: ${yang_model || 'cisco-nx-os-device'}
- Include proper namespaces and XML structure
- Target datastore: running
- Default operation: merge
${device ? `- Target device: ${device.vendor} ${device.model} (${device.ios_version})` : ''}

Generate only the XML configuration without explanations.`;

    const result = await aiService.generateConfiguration(netconfPrompt, device);

    res.json({
      success: true,
      message: 'NETCONF XML generated successfully',
      data: {
        prompt,
        generated_xml: result.configuration,
        yang_model: yang_model || 'cisco-nx-os-device',
        device: device?.device_summary || null,
        metadata: {
          model: result.model,
          generated_at: new Date(),
          type: 'netconf-xml'
        }
      }
    });

  } catch (error) {
    console.error('❌ NETCONF XML generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate NETCONF XML',
      error: error.message
    });
  }
});

// Get active NETCONF sessions (including mock sessions)
router.get('/sessions', async (req, res) => {
  try {
    const realSessions = netconfService.getActiveSessions();
    const mockSessions = mockNetconfService.getMockActiveSessions();
    
    const allSessions = [...realSessions, ...mockSessions];

    res.json({
      success: true,
      message: 'Active NETCONF sessions retrieved',
      data: {
        total_sessions: allSessions.length,
        real_sessions: realSessions.length,
        mock_sessions: mockSessions.length,
        sessions: allSessions
      }
    });

  } catch (error) {
    console.error('❌ Get NETCONF sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve NETCONF sessions',
      error: error.message
    });
  }
});

// Get YANG models
router.get('/yang-models', async (req, res) => {
  try {
    const { vendor, category, device_id } = req.query;
    let query = { status: 'active' };

    if (vendor) {
      query.vendor = vendor.toLowerCase();
    }

    if (category) {
      query.category = category;
    }

    let models = await YangModel.find(query).sort({ name: 1, revision: -1 });

    // If device_id provided, filter for compatible models
    if (device_id) {
      const device = await Device.findById(device_id);
      if (device) {
        const compatibleModels = await YangModel.findCompatibleModels(
          device.vendor, device.model, device.ios_version
        );
        models = compatibleModels;
      }
    }

    res.json({
      success: true,
      message: 'YANG models retrieved successfully',
      data: {
        total_models: models.length,
        models: models.map(model => model.model_summary)
      }
    });

  } catch (error) {
    console.error('❌ Get YANG models error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve YANG models',
      error: error.message
    });
  }
});

// Get YANG model details
router.get('/yang-models/:model_id', async (req, res) => {
  try {
    const { model_id } = req.params;

    const model = await YangModel.findById(model_id);
    if (!model) {
      return res.status(404).json({
        success: false,
        message: 'YANG model not found'
      });
    }

    res.json({
      success: true,
      message: 'YANG model details retrieved',
      data: {
        model: {
          ...model.toObject(),
          root_containers: model.getRootContainers()
        }
      }
    });

  } catch (error) {
    console.error('❌ Get YANG model details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve YANG model details',
      error: error.message
    });
  }
});

// Mock-specific endpoints

// Get mock XML examples
router.get('/mock/xml-examples', async (req, res) => {
  try {
    const examples = mockNetconfService.generateMockXmlExamples();

    res.json({
      success: true,
      message: 'Mock NETCONF XML examples retrieved',
      data: {
        examples,
        total_examples: Object.keys(examples).length
      }
    });

  } catch (error) {
    console.error('❌ Get mock XML examples error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve mock XML examples',
      error: error.message
    });
  }
});

// Create demo mock session
router.post('/mock/demo-session', async (req, res) => {
  try {
    const demoDevice = {
      ip_address: '192.168.1.100',
      username: 'admin',
      password: 'demo',
      netconf_port: 830
    };

    const result = await mockNetconfService.mockConnect(demoDevice);

    res.json({
      success: true,
      message: 'Demo mock NETCONF session created',
      data: {
        ...result,
        note: 'This is a demo session for testing purposes'
      }
    });

  } catch (error) {
    console.error('❌ Create demo session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create demo session',
      error: error.message
    });
  }
});

// Cleanup all mock sessions
router.post('/mock/cleanup', async (req, res) => {
  try {
    const result = await mockNetconfService.mockCleanup();

    res.json({
      success: true,
      message: 'Mock NETCONF sessions cleaned up',
      data: result
    });

  } catch (error) {
    console.error('❌ Mock cleanup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup mock sessions',
      error: error.message
    });
  }
});

export default router; 
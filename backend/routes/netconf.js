import express from 'express';
import crypto from 'crypto';
import xml2js from 'xml2js';
import Device from '../models/Device.js';
import YangModel from '../models/YangModel.js';
import ConfigurationHistory from '../models/ConfigurationHistory.js';
import netconfService from '../services/netconfService.js';
import aiService from '../services/aiService.js';
import yangService from '../services/yangService.js';

const router = express.Router();

// Get active NETCONF sessions
router.get('/sessions', async (req, res) => {
  try {
    const sessions = netconfService.getActiveSessions();
    
    res.json({
      success: true,
      message: 'Active NETCONF sessions retrieved',
      data: {
        sessions: sessions.map(session => ({
          sessionId: session.sessionId,
          ip_address: session.ip_address,
          connected_at: session.connected_at,
          capabilities: session.capabilities || [],
          status: session.status || 'connected'
        })),
        total_sessions: sessions.length
      }
    });

  } catch (error) {
    console.error('❌ Get sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve active sessions',
      error: error.message
    });
  }
});

// Test NETCONF connection
router.post('/test-connection', async (req, res) => {
  try {
    const { device_id } = req.body;

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

    if (!device.netconf_enabled) {
      return res.status(400).json({
        success: false,
        message: 'NETCONF is not enabled for this device'
      });
    }

    const result = await netconfService.testConnection({
      ip_address: device.ip_address,
      username: device.username,
      password: device.password,
      netconf_port: device.netconf_port
    });

    // Update device capabilities and connection status
    if (result.success && result.capabilities) {
      device.netconf_capabilities = result.capabilities;
      device.last_connection = {
        type: 'netconf',
        timestamp: new Date(),
        status: 'success'
      };
      await device.save();
    } else {
      device.last_connection = {
        type: 'netconf',
        timestamp: new Date(),
        status: 'failed'
      };
      await device.save();
    }

    res.json({
      success: result.success,
      message: result.message,
      data: {
        capabilities: result.capabilities || [],
        device: device.device_summary,
        connectionTime: result.connectionTime,
        error: result.error
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

// Connect to device via NETCONF
router.post('/connect/:device_id', async (req, res) => {
  try {
    const { device_id } = req.params;

    const device = await Device.findById(device_id);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    if (!device.netconf_enabled) {
      return res.status(400).json({
        success: false,
        message: 'NETCONF is not enabled for this device'
      });
    }

    const result = await netconfService.connect({
      ip_address: device.ip_address,
      username: device.username,
      password: device.password,
      netconf_port: device.netconf_port
    });

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
      message: `NETCONF session established with ${device.name}`,
      data: {
        sessionId: result.sessionId,
        capabilities: result.capabilities || device.netconf_capabilities,
        device: device.device_summary
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

// Disconnect NETCONF session
router.post('/disconnect/:session_id', async (req, res) => {
  try {
    const { session_id } = req.params;

    const result = await netconfService.disconnect(session_id);

    res.json({
      success: true,
      message: 'NETCONF session disconnected',
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

// Get device configuration via NETCONF
router.get('/config/:session_id', async (req, res) => {
  try {
    const { session_id } = req.params;
    const { datastore = 'running', filter } = req.query;

    const result = await netconfService.getConfig(session_id, datastore, filter);

    res.json({
      success: true,
      message: 'Configuration retrieved successfully',
      data: {
        datastore,
        config: result.data,
        operation: result.operation,
        messageId: result.messageId
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

// Get operational data via NETCONF
router.get('/operational/:session_id', async (req, res) => {
  try {
    const { session_id } = req.params;
    const { filter } = req.query;

    const result = await netconfService.get(session_id, filter);

    res.json({
      success: true,
      message: 'Operational data retrieved successfully',
      data: {
        operationalData: result.data,
        operation: result.operation,
        messageId: result.messageId
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

// Edit configuration via NETCONF
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

    const result = await netconfService.editConfig(session_id, datastore, config, default_operation);

    // Save configuration history
    if (device_id) {
      const device = await Device.findById(device_id);
      if (device) {
        const configHistory = new ConfigurationHistory({
          device_id: device._id,
          configuration: typeof config === 'string' ? config : JSON.stringify(config),
          status: result.success ? 'applied' : 'failed',
          deployment_method: 'netconf',
          deployment_target: datastore,
          applied_by: 'netconf-api',
          applied_at: Date.now(),
          metadata: {
            session_id,
            operation: 'edit-config',
            default_operation,
            message_id: result.messageId
          }
        });
        await configHistory.save();
      }
    }

    res.json({
      success: true,
      message: 'Configuration applied successfully via NETCONF',
      data: {
        datastore,
        operation: result.operation,
        messageId: result.messageId,
        response: result.data
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
          deployment_method: 'netconf',
          applied_by: 'netconf-api',
          applied_at: Date.now(),
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

// Commit configuration
router.post('/commit/:session_id', async (req, res) => {
  try {
    const { session_id } = req.params;

    const result = await netconfService.commit(session_id);

    res.json({
      success: true,
      message: 'Configuration committed successfully',
      data: {
        operation: result.operation,
        messageId: result.messageId,
        response: result.data
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

// Discard changes
router.post('/discard-changes/:session_id', async (req, res) => {
  try {
    const { session_id } = req.params;

    const result = await netconfService.discardChanges(session_id);

    res.json({
      success: true,
      message: 'Changes discarded successfully',
      data: {
        operation: result.operation,
        messageId: result.messageId,
        response: result.data
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

// Validate configuration
router.post('/validate/:session_id', async (req, res) => {
  try {
    const { session_id } = req.params;
    const { datastore = 'candidate' } = req.body;

    const result = await netconfService.validate(session_id, datastore);

    res.json({
      success: true,
      message: 'Configuration validation completed',
      data: {
        datastore,
        operation: result.operation,
        messageId: result.messageId,
        response: result.data
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

// Validate XML configuration
router.post('/validate-config', async (req, res) => {
  try {
    const { session_id, xml_config } = req.body;

    if (!session_id || !xml_config) {
      return res.status(400).json({
        success: false,
        message: 'Session ID and XML configuration are required'
      });
    }

    // First validate the XML structure
    try {
      // Basic XML validation using xml2js
      const parser = new xml2js.Parser();
      await parser.parseStringPromise(xml_config);
    } catch (xmlError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid XML format',
        error: xmlError.message
      });
    }

    // Validate against NETCONF session
    const result = await netconfService.validateXmlConfig(session_id, xml_config);

    res.json({
      success: true,
      message: 'XML configuration validation completed',
      data: {
        valid: result.valid,
        session_id,
        validation_result: result.validation_result,
        warnings: result.warnings || [],
        errors: result.errors || []
      }
    });

  } catch (error) {
    console.error('❌ XML config validation error:', error);
    res.status(500).json({
      success: false,
      message: 'XML configuration validation failed',
      error: error.message
    });
  }
});

// Deploy XML configuration
router.post('/deploy-config', async (req, res) => {
  try {
    const { session_id, xml_config, datastore = 'running', validate = true, commit = true } = req.body;

    if (!session_id || !xml_config) {
      return res.status(400).json({
        success: false,
        message: 'Session ID and XML configuration are required'
      });
    }

    // Validate XML first if requested
    if (validate) {
      try {
        const parser = new xml2js.Parser();
        await parser.parseStringPromise(xml_config);
      } catch (xmlError) {
        return res.status(400).json({
          success: false,
          message: 'XML validation failed',
          error: xmlError.message
        });
      }
    }

    // Deploy the configuration
    const result = await netconfService.deployXmlConfig(session_id, xml_config, {
      datastore,
      validate,
      commit
    });

    res.json({
      success: true,
      message: 'Configuration deployed successfully',
      data: {
        session_id,
        datastore,
        deployment_result: result,
        validated: validate,
        committed: commit
      }
    });

  } catch (error) {
    console.error('❌ XML config deployment error:', error);
    res.status(500).json({
      success: false,
      message: 'Configuration deployment failed',
      error: error.message
    });
  }
});

// Generate NETCONF XML using Enhanced AI
router.post('/generate-xml', async (req, res) => {
  try {
    const { prompt, device_id, yang_model_id, output_format = 'netconf_xml' } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: 'Prompt is required'
      });
    }

    let device = null;
    let yangModel = null;

    // Get device information
    if (device_id) {
      device = await Device.findById(device_id);
      if (!device) {
        return res.status(404).json({
          success: false,
          message: 'Device not found'
        });
      }
    }

    // Get YANG model information
    if (yang_model_id) {
      yangModel = await yangService.getModelDetails(yang_model_id);
      if (!yangModel) {
        return res.status(404).json({
          success: false,
          message: 'YANG model not found'
        });
      }
    }

    const deviceContext = device ? {
      name: device.name,
      model: device.model,
      ios_version: device.ios_version,
      location: device.location,
      vendor: device.vendor
    } : {};

    let result;

    // Choose generation method based on output format
    if (output_format === 'netconf_xml') {
      result = await aiService.generateNetconfXml(
        prompt, 
        device?.type || 'switch', 
        deviceContext, 
        yangModel
      );
    } else {
      // Default to CLI generation
      result = await aiService.generateConfiguration(
        prompt, 
        device?.type || 'switch', 
        deviceContext
      );
    }

    // Save to configuration history
    if (device && result.success) {
      const configHistory = new ConfigurationHistory({
        device_id: device._id,
        prompt: prompt,
        generated_config: result.configuration,
        ai_model: result.model,
        execution_time: result.executionTime,
        status: 'generated',
        created_at: Date.now(),
        metadata: {
          generation_method: result.method,
          output_format: result.outputFormat || output_format,
          yang_model: yangModel?.name || null,
          confidence_score: result.confidenceScore,
          validation: result.validation
        }
      });
      await configHistory.save();
    }

    res.json({
      success: true,
      message: `${output_format.toUpperCase()} configuration generated successfully`,
      data: {
        prompt,
        generated_xml: result.configuration,
        generated_config: result.configuration,
        output_format: result.outputFormat || output_format,
        execution_time: result.executionTime,
        confidence_score: result.confidenceScore,
        validation: result.validation,
        yang_model: yangModel?.name || null,
        device: device?.device_summary || null,
        recommendations: result.recommendations || [],
        metadata: {
          model: result.model,
          method: result.method,
          generated_at: new Date(),
          type: result.outputFormat || output_format
        }
      }
    });

  } catch (error) {
    console.error('❌ Enhanced XML generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate configuration',
      error: error.message
    });
  }
});

// Get active NETCONF sessions
router.get('/sessions', async (req, res) => {
  try {
    const sessions = netconfService.getActiveSessions();

    res.json({
      success: true,
      message: 'Active NETCONF sessions retrieved',
      data: {
        total_sessions: sessions.length,
        sessions: sessions
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



// YANG Management Routes

// Parse YANG model content
router.post('/yang/parse', async (req, res) => {
  try {
    const { yang_content, model_name } = req.body;

    if (!yang_content) {
      return res.status(400).json({
        success: false,
        message: 'YANG content is required'
      });
    }

    const parsedTree = yangService.parseYangToTree(yang_content);

    res.json({
      success: true,
      message: 'YANG model parsed successfully',
      data: {
        model_name: model_name || 'unnamed',
        parsed_tree: parsedTree,
        total_containers: Object.keys(parsedTree.containers || {}).length,
        total_leaves: Object.keys(parsedTree.leaves || {}).length,
        modules: Object.keys(parsedTree.modules || {})
      }
    });

  } catch (error) {
    console.error('❌ YANG parsing error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to parse YANG model',
      error: error.message
    });
  }
});

// Validate NETCONF XML against YANG model
router.post('/yang/validate-xml', async (req, res) => {
  try {
    const { xml_content, yang_model_id } = req.body;

    if (!xml_content || !yang_model_id) {
      return res.status(400).json({
        success: false,
        message: 'XML content and YANG model ID are required'
      });
    }

    const yangModel = await yangService.getModelDetails(yang_model_id);
    if (!yangModel) {
      return res.status(404).json({
        success: false,
        message: 'YANG model not found'
      });
    }

    const validation = yangService.validateXmlAgainstYang(xml_content, yangModel);

    res.json({
      success: true,
      message: 'XML validation completed',
      data: {
        validation: validation,
        yang_model: yangModel.name,
        xml_valid: validation.isValid,
        error_count: validation.errors.length,
        warning_count: validation.warnings.length
      }
    });

  } catch (error) {
    console.error('❌ XML validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate XML',
      error: error.message
    });
  }
});

// Generate XML template from YANG model
router.post('/yang/generate-template/:model_id', async (req, res) => {
  try {
    const { model_id } = req.params;
    const { operation = 'edit-config' } = req.body;

    const yangModel = await yangService.getModelDetails(model_id);
    if (!yangModel) {
      return res.status(404).json({
        success: false,
        message: 'YANG model not found'
      });
    }

    const template = yangService.generateXmlTemplate(yangModel, operation);

    res.json({
      success: true,
      message: 'XML template generated successfully',
      data: {
        yang_model: yangModel.name,
        operation: operation,
        template: template,
        example_count: Object.keys(template.examples || {}).length
      }
    });

  } catch (error) {
    console.error('❌ Template generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate XML template',
      error: error.message
    });
  }
});

// Search YANG models
router.get('/yang/search', async (req, res) => {
  try {
    const { q, vendor, category, limit = 20 } = req.query;

    const filters = {};
    if (vendor) filters.vendor = vendor;
    if (category) filters.category = category;

    const results = await yangService.searchModels(q, filters);
    const limitedResults = results.slice(0, parseInt(limit));

    res.json({
      success: true,
      message: 'YANG models search completed',
      data: {
        query: q || '',
        filters: filters,
        total_results: results.length,
        returned_results: limitedResults.length,
        models: limitedResults
      }
    });

  } catch (error) {
    console.error('❌ YANG search error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search YANG models',
      error: error.message
    });
  }
});

// Get YANG statistics
router.get('/yang/statistics', async (req, res) => {
  try {
    const stats = await yangService.getYangStatistics();

    res.json({
      success: true,
      message: 'YANG statistics retrieved',
      data: {
        statistics: stats,
        last_updated: new Date()
      }
    });

  } catch (error) {
    console.error('❌ YANG statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve YANG statistics',
      error: error.message
    });
  }
});

// Get YANG models by vendor
router.get('/yang/vendor/:vendor', async (req, res) => {
  try {
    const { vendor } = req.params;
    const models = await yangService.getModelsByVendor(vendor);

    res.json({
      success: true,
      message: `YANG models for vendor '${vendor}' retrieved`,
      data: {
        vendor: vendor,
        total_models: models.length,
        models: models
      }
    });

  } catch (error) {
    console.error('❌ Get models by vendor error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve models by vendor',
      error: error.message
    });
  }
});

// Add/Upload new YANG model
router.post('/yang-models', async (req, res) => {
  try {
    const {
      name,
      namespace,
      prefix,
      revision,
      description,
      organization,
      contact,
      yang_content,
      vendor = 'custom',
      category = 'other',
      supported_devices = []
    } = req.body;

    // Validate required fields
    if (!name || !namespace || !prefix || !yang_content) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, namespace, prefix, yang_content'
      });
    }

    // Check if model with same name already exists
    const existingModel = await YangModel.findOne({ name, namespace });
    if (existingModel) {
      return res.status(409).json({
        success: false,
        message: `YANG model '${name}' with namespace '${namespace}' already exists`
      });
    }

    // Parse YANG content to extract structure (basic parsing)
    let parsed_structure = {};
    try {
      // Simple parsing - in production you'd use a proper YANG parser
      parsed_structure = parseBasicYangStructure(yang_content);
    } catch (parseError) {
      console.warn('⚠️ Failed to parse YANG structure:', parseError.message);
      parsed_structure = { containers: {}, leaves: {}, note: 'Structure parsing failed' };
    }

    // Create new YANG model
    const yangModel = new YangModel({
      name,
      namespace,
      prefix,
      revision,
      description,
      organization,
      contact,
      yang_content,
      parsed_structure,
      vendor: vendor.toLowerCase(),
      category,
      status: 'active',
      supported_devices,
      file_size: yang_content.length,
      checksum: crypto.createHash('sha256').update(yang_content).digest('hex')
    });

    await yangModel.save();

    res.status(201).json({
      success: true,
      message: 'YANG model uploaded successfully',
      data: {
        model: yangModel.model_summary,
        parsed_containers: Object.keys(parsed_structure.containers || {}).length,
        parsed_leaves: Object.keys(parsed_structure.leaves || {}).length
      }
    });

  } catch (error) {
    console.error('❌ Upload YANG model error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload YANG model',
      error: error.message
    });
  }
});

// Update existing YANG model
router.put('/yang-models/:model_id', async (req, res) => {
  try {
    const { model_id } = req.params;
    const updateData = { ...req.body };
    
    // Remove fields that shouldn't be updated
    delete updateData._id;
    delete updateData.__v;
    delete updateData.createdAt;

    const model = await YangModel.findById(model_id);
    if (!model) {
      return res.status(404).json({
        success: false,
        message: 'YANG model not found'
      });
    }

    // If yang_content is updated, reparse structure
    if (updateData.yang_content && updateData.yang_content !== model.yang_content) {
      try {
        updateData.parsed_structure = parseBasicYangStructure(updateData.yang_content);
        updateData.file_size = updateData.yang_content.length;
        updateData.checksum = crypto.createHash('sha256').update(updateData.yang_content).digest('hex');
      } catch (parseError) {
        console.warn('⚠️ Failed to parse updated YANG structure:', parseError.message);
      }
    }

    Object.assign(model, updateData);
    await model.save();

    res.json({
      success: true,
      message: 'YANG model updated successfully',
      data: {
        model: model.model_summary
      }
    });

  } catch (error) {
    console.error('❌ Update YANG model error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update YANG model',
      error: error.message
    });
  }
});

// Delete YANG model
router.delete('/yang-models/:model_id', async (req, res) => {
  try {
    const { model_id } = req.params;
    
    console.log(`🗑️ Attempting to delete YANG model with ID: ${model_id}`);

    // Validate model_id format
    if (!model_id || model_id.length !== 24) {
      return res.status(400).json({
        success: false,
        message: 'Invalid model ID format'
      });
    }

    // Find the model first
    const model = await YangModel.findById(model_id);
    if (!model) {
      console.log(`❌ YANG model not found: ${model_id}`);
      return res.status(404).json({
        success: false,
        message: 'YANG model not found'
      });
    }

    console.log(`📋 Found model to delete: ${model.name} (${model.vendor})`);

    // Check if model is being used by any active sessions or configurations
    // This is a placeholder - you might want to check for actual dependencies
    const isModelInUse = false; // You can implement this check based on your business logic
    
    if (isModelInUse) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete YANG model '${model.name}' because it is currently in use`,
        details: 'Model is referenced by active configurations or sessions'
      });
    }

    // Perform the deletion
    const deletedModel = await YangModel.findByIdAndDelete(model_id);
    
    if (!deletedModel) {
      console.error(`❌ Failed to delete model: ${model_id} - Model not found during deletion`);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete YANG model - model not found during deletion'
      });
    }

    console.log(`✅ Successfully deleted YANG model: ${model.name}`);

    res.json({
      success: true,
      message: `YANG model '${model.name}' deleted successfully`,
      data: {
        deleted_model: {
          id: deletedModel._id,
          name: deletedModel.name,
          vendor: deletedModel.vendor,
          category: deletedModel.category
        }
      }
    });

  } catch (error) {
    console.error('❌ Delete YANG model error:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to delete YANG model';
    let statusCode = 500;
    
    if (error.name === 'CastError') {
      errorMessage = 'Invalid model ID format';
      statusCode = 400;
    } else if (error.name === 'ValidationError') {
      errorMessage = 'Validation error during deletion';
      statusCode = 400;
    } else if (error.code === 11000) {
      errorMessage = 'Database constraint violation';
      statusCode = 409;
    }
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: error.message,
      details: {
        error_type: error.name,
        error_code: error.code,
        model_id: req.params.model_id
      }
    });
  }
});

// Helper function for basic YANG parsing
function parseBasicYangStructure(yangContent) {
  const structure = {
    containers: {},
    leaves: {},
    lists: {},
    modules: {}
  };

  try {
    const lines = yangContent.split('\n');
    let currentContainer = null;
    let currentList = null;

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Parse containers
      if (trimmed.startsWith('container ')) {
        const containerName = trimmed.split(' ')[1].replace('{', '').trim();
        currentContainer = containerName;
        structure.containers[containerName] = {
          type: 'container',
          leaves: [],
          lists: {},
          description: ''
        };
      }
      
      // Parse lists
      else if (trimmed.startsWith('list ')) {
        const listName = trimmed.split(' ')[1].replace('{', '').trim();
        currentList = listName;
        if (currentContainer) {
          structure.containers[currentContainer].lists[listName] = {
            type: 'list',
            leaves: [],
            key: ''
          };
        } else {
          structure.lists[listName] = {
            type: 'list',
            leaves: [],
            key: ''
          };
        }
      }
      
      // Parse leaves
      else if (trimmed.startsWith('leaf ')) {
        const leafName = trimmed.split(' ')[1].replace('{', '').trim();
        const leafInfo = {
          name: leafName,
          type: 'string', // Default type
          mandatory: false,
          description: ''
        };
        
        if (currentList && currentContainer) {
          structure.containers[currentContainer].lists[currentList].leaves.push(leafInfo);
        } else if (currentContainer) {
          structure.containers[currentContainer].leaves.push(leafInfo);
        } else {
          structure.leaves[leafName] = leafInfo;
        }
      }
      
      // Parse key
      else if (trimmed.startsWith('key ')) {
        const keyValue = trimmed.replace('key', '').replace(/[";]/g, '').trim();
        if (currentList && currentContainer) {
          structure.containers[currentContainer].lists[currentList].key = keyValue;
        }
      }
      
      // Parse type
      else if (trimmed.startsWith('type ')) {
        const typeValue = trimmed.replace('type', '').replace(/[";]/g, '').trim();
        // Update the last leaf's type (simplified approach)
        // In production, you'd use a proper YANG parser
      }
      
      // Parse description
      else if (trimmed.startsWith('description ')) {
        const descValue = trimmed.replace('description', '').replace(/[";]/g, '').trim();
        // Update description for current context
      }
      
      // Reset context when closing braces
      else if (trimmed === '}') {
        // Simple context reset - in production use proper parsing
        if (currentList) {
          currentList = null;
        } else if (currentContainer) {
          currentContainer = null;
        }
      }
    }
  } catch (error) {
    console.warn('Basic YANG parsing failed:', error.message);
  }

  return structure;
}

export default router; 
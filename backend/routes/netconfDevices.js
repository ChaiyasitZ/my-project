import express from 'express';
import Joi from 'joi';
import NetconfDevice from '../models/NetconfDevice.js';
import netconfService from '../services/netconfService.js';

const router = express.Router();

// Helper function to validate ObjectId format
const validateObjectId = (id) => {
  if (!id || id === 'undefined' || !id.match(/^[0-9a-fA-F]{24}$/)) {
    return false;
  }
  return true;
};

// Validation schema for NETCONF device
const netconfDeviceSchema = Joi.object({
  name: Joi.string().required().max(255).trim(),
  description: Joi.string().allow('').max(1000).trim(),
  ip_address: Joi.string().ip().required(),
  hostname: Joi.string().allow('').max(255).trim(),
  location: Joi.string().allow('').max(255).trim(),
  
  device_type: Joi.string().valid('cisco_ios', 'cisco_nxos', 'cisco_iosxr', 'juniper_junos', 'huawei_vrp', 'arista_eos', 'other').default('cisco_ios'),
  platform: Joi.string().allow('').max(255).trim(),
  model: Joi.string().allow('').max(255).trim(),
  os_version: Joi.string().allow('').max(255).trim(),
  vendor: Joi.string().valid('cisco', 'juniper', 'huawei', 'arista', 'other').default('cisco'),
  
  ssh_port: Joi.number().integer().min(1).max(65535).default(22),
  username: Joi.string().required().max(255).trim(),
  password: Joi.string().required().max(255),
  
  netconf_port: Joi.number().integer().min(1).max(65535).default(830),
  netconf_enabled: Joi.boolean().default(true),
  netconf_capabilities: Joi.array().items(Joi.string().trim()).default([]),
  
  connection_timeout: Joi.number().integer().min(5000).max(120000).default(30000),
  keepalive_interval: Joi.number().integer().min(1000).max(30000).default(5000),
  max_retries: Joi.number().integer().min(1).max(10).default(3),
  
  yang_models: Joi.array().items(Joi.object({
    model_id: Joi.string().allow(''),
    model_name: Joi.string().required().trim(),
    namespace: Joi.string().required().trim(),
    revision: Joi.string().allow('').trim(),
    supported: Joi.boolean().default(true),
    device_capabilities: Joi.array().items(Joi.string()).default([])
  })).default([]),
  
  status: Joi.string().valid('active', 'inactive', 'maintenance', 'error', 'testing').default('inactive'),
  
  supported_datastores: Joi.array().items(Joi.string().valid('running', 'candidate', 'startup')).default(['running']),
  default_datastore: Joi.string().valid('running', 'candidate', 'startup').default('running'),
  supports_validation: Joi.boolean().default(false),
  supports_rollback: Joi.boolean().default(false),
  
  access_groups: Joi.array().items(Joi.string().trim()).default([]),
  tags: Joi.array().items(Joi.string().trim().lowercase()).default([]),
  
  monitoring_enabled: Joi.boolean().default(true),
  alert_threshold: Joi.object({
    response_time_ms: Joi.number().integer().min(1000).default(5000),
    failure_rate_percent: Joi.number().min(1).max(100).default(20)
  }).default(),
  
  created_by: Joi.string().allow('').trim(),
  notes: Joi.string().allow('').max(2000).trim()
});

// GET /api/netconf-devices - List all NETCONF devices
router.get('/', async (req, res) => {
  try {
    const { 
      status, 
      connection_status, 
      device_type, 
      vendor, 
      yang_model,
      tags,
      limit = 50, 
      offset = 0,
      sort_by = 'name',
      sort_order = 'asc'
    } = req.query;

    // Build query filters
    const query = { netconf_enabled: true };
    
    if (status) query.status = status;
    if (connection_status) query.connection_status = connection_status;
    if (device_type) query.device_type = device_type;
    if (vendor) query.vendor = vendor;
    if (yang_model) query['yang_models.model_name'] = yang_model;
    if (tags) {
      const tagList = Array.isArray(tags) ? tags : [tags];
      query.tags = { $in: tagList };
    }

    // Build sort object
    const sortOrder = sort_order === 'desc' ? -1 : 1;
    const sortObj = { [sort_by]: sortOrder };

    const [devices, total] = await Promise.all([
      NetconfDevice.find(query)
        .populate('yang_models.model_id', 'name namespace revision')
        .sort(sortObj)
        .limit(parseInt(limit))
        .skip(parseInt(offset))
        .lean(),
      NetconfDevice.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        devices,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching NETCONF devices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch NETCONF devices',
      error: error.message
    });
  }
});

// GET /api/netconf-devices/stats - Get NETCONF device statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await NetconfDevice.aggregate([
      { $match: { netconf_enabled: true } },
      {
        $group: {
          _id: null,
          total_devices: { $sum: 1 },
          active_devices: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          connected_devices: { $sum: { $cond: [{ $eq: ['$connection_status', 'connected'] }, 1, 0] } },
          avg_health_score: { $avg: '$performance_metrics.success_rate' },
          total_sessions: { $sum: '$performance_metrics.total_sessions' },
          successful_sessions: { $sum: '$performance_metrics.successful_sessions' }
        }
      }
    ]);

    const devicesByType = await NetconfDevice.aggregate([
      { $match: { netconf_enabled: true } },
      { $group: { _id: '$device_type', count: { $sum: 1 } } }
    ]);

    const devicesByVendor = await NetconfDevice.aggregate([
      { $match: { netconf_enabled: true } },
      { $group: { _id: '$vendor', count: { $sum: 1 } } }
    ]);

    const connectionStatusStats = await NetconfDevice.aggregate([
      { $match: { netconf_enabled: true } },
      { $group: { _id: '$connection_status', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0] || {
          total_devices: 0,
          active_devices: 0,
          connected_devices: 0,
          avg_health_score: 0,
          total_sessions: 0,
          successful_sessions: 0
        },
        by_device_type: devicesByType,
        by_vendor: devicesByVendor,
        by_connection_status: connectionStatusStats
      }
    });
  } catch (error) {
    console.error('Error fetching NETCONF device stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
});

// GET /api/netconf-devices/:id - Get specific NETCONF device
router.get('/:id', async (req, res) => {
  try {
    if (!validateObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid device ID format'
      });
    }
    
    const device = await NetconfDevice.findById(req.params.id)
      .populate('yang_models.model_id', 'name namespace revision description');

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'NETCONF device not found'
      });
    }

    // Include virtual fields
    const deviceData = device.toObject({ virtuals: true });

    res.json({
      success: true,
      data: { device: deviceData }
    });
  } catch (error) {
    console.error('Error fetching NETCONF device:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch NETCONF device',
      error: error.message
    });
  }
});

// POST /api/netconf-devices - Create new NETCONF device
router.post('/', async (req, res) => {
  try {
    const { error, value } = netconfDeviceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    // Check for duplicate IP address
    const existingDevice = await NetconfDevice.findOne({ 
      ip_address: value.ip_address 
    });
    
    if (existingDevice) {
      return res.status(409).json({
        success: false,
        message: 'Device with this IP address already exists'
      });
    }

    const device = new NetconfDevice(value);
    await device.save();

    console.log(`✅ NETCONF device created: ${device.name} (${device.ip_address})`);

    res.status(201).json({
      success: true,
      message: 'NETCONF device created successfully',
      data: { device: device.toObject({ virtuals: true }) }
    });
  } catch (error) {
    console.error('Error creating NETCONF device:', error);
    
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Device with this name or IP address already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create NETCONF device',
      error: error.message
    });
  }
});

// PUT /api/netconf-devices/:id - Update NETCONF device
router.put('/:id', async (req, res) => {
  try {
    const { error, value } = netconfDeviceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const device = await NetconfDevice.findById(req.params.id);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'NETCONF device not found'
      });
    }

    // Check for duplicate IP address (excluding current device)
    if (value.ip_address !== device.ip_address) {
      const existingDevice = await NetconfDevice.findOne({ 
        ip_address: value.ip_address,
        _id: { $ne: req.params.id }
      });
      
      if (existingDevice) {
        return res.status(409).json({
          success: false,
          message: 'Another device with this IP address already exists'
        });
      }
    }

    // Update device
    Object.assign(device, value);
    device.updated_by = req.body.updated_by || 'system';
    await device.save();

    console.log(`✅ NETCONF device updated: ${device.name} (${device.ip_address})`);

    res.json({
      success: true,
      message: 'NETCONF device updated successfully',
      data: { device: device.toObject({ virtuals: true }) }
    });
  } catch (error) {
    console.error('Error updating NETCONF device:', error);
    
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Device with this name already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update NETCONF device',
      error: error.message
    });
  }
});

// DELETE /api/netconf-devices/:id - Delete NETCONF device
router.delete('/:id', async (req, res) => {
  try {
    const device = await NetconfDevice.findById(req.params.id);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'NETCONF device not found'
      });
    }

    // Disconnect any active sessions
    const sessionId = `${device.ip_address}:${device.netconf_port}`;
    try {
      await netconfService.disconnect(sessionId);
      console.log(`🔌 Disconnected NETCONF session for ${device.name} before deletion`);
    } catch (disconnectError) {
      console.warn(`⚠️ Could not disconnect session for ${device.name}:`, disconnectError.message);
    }

    await NetconfDevice.findByIdAndDelete(req.params.id);

    console.log(`✅ NETCONF device deleted: ${device.name} (${device.ip_address})`);

    res.json({
      success: true,
      message: 'NETCONF device deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting NETCONF device:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete NETCONF device',
      error: error.message
    });
  }
});

// POST /api/netconf-devices/:id/test-connection - Test NETCONF connection
router.post('/:id/test-connection', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!validateObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid device ID format'
      });
    }
    
    const device = await NetconfDevice.findById(id);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'NETCONF device not found'
      });
    }

    console.log(`🧪 Testing NETCONF connection for: ${device.name} (${device.ip_address})`);

    const result = await netconfService.testConnection({
      name: device.name,
      type: device.device_type,
      ip_address: device.ip_address,
      username: device.username,
      password: device.password,
      netconf_port: device.netconf_port
    });

    // Update device connection status based on test result
    await device.updateConnectionStatus(
      result.success ? 'disconnected' : 'error',
      {
        success: result.success,
        sessionId: result.sessionId,
        capabilities: result.capabilities,
        connectionTime: result.performanceMetrics?.totalTestTime,
        error: result.error
      }
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error testing NETCONF connection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test NETCONF connection',
      error: error.message
    });
  }
});

// POST /api/netconf-devices/:id/connect - Connect to NETCONF device
router.post('/:id/connect', async (req, res) => {
  try {
    const device = await NetconfDevice.findById(req.params.id);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'NETCONF device not found'
      });
    }

    console.log(`🔗 Connecting to NETCONF device: ${device.name} (${device.ip_address})`);

    // Update status to connecting
    await device.updateConnectionStatus('connecting');

    const session = await netconfService.connect({
      name: device.name,
      type: device.device_type,
      ip_address: device.ip_address,
      username: device.username,
      password: device.password,
      netconf_port: device.netconf_port
    });

    // Update device with connection info
    await device.updateConnectionStatus('connected', {
      success: true,
      sessionId: session.sessionId,
      capabilities: session.capabilities
    });

    // Update device capabilities if received
    if (session.capabilities && session.capabilities.length > 0) {
      device.netconf_capabilities = session.capabilities;
      await device.save();
    }

    res.json({
      success: true,
      message: 'Successfully connected to NETCONF device',
      data: {
        session_id: session.sessionId,
        capabilities: session.capabilities,
        device_name: device.name
      }
    });
  } catch (error) {
    console.error('Error connecting to NETCONF device:', error);
    
    // Update device status to error
    const device = await NetconfDevice.findById(req.params.id);
    if (device) {
      await device.updateConnectionStatus('error', {
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to connect to NETCONF device',
      error: error.message
    });
  }
});

// POST /api/netconf-devices/:id/disconnect - Disconnect from NETCONF device
router.post('/:id/disconnect', async (req, res) => {
  try {
    const device = await NetconfDevice.findById(req.params.id);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'NETCONF device not found'
      });
    }

    const sessionId = `${device.ip_address}:${device.netconf_port}`;

    console.log(`🔌 Disconnecting NETCONF device: ${device.name} (${sessionId})`);

    await netconfService.disconnect(sessionId);

    // Update device status
    await device.updateConnectionStatus('disconnected');

    res.json({
      success: true,
      message: 'Successfully disconnected from NETCONF device'
    });
  } catch (error) {
    console.error('Error disconnecting from NETCONF device:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect from NETCONF device',
      error: error.message
    });
  }
});

// GET /api/netconf-devices/healthy - Get healthy NETCONF devices
router.get('/filter/healthy', async (req, res) => {
  try {
    const devices = await NetconfDevice.getHealthyDevices();
    
    res.json({
      success: true,
      data: { 
        devices,
        count: devices.length
      }
    });
  } catch (error) {
    console.error('Error fetching healthy NETCONF devices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch healthy NETCONF devices',
      error: error.message
    });
  }
});

// GET /api/netconf-devices/by-yang-model/:modelName - Get devices supporting specific YANG model
router.get('/filter/yang-model/:modelName', async (req, res) => {
  try {
    const { modelName } = req.params;
    const devices = await NetconfDevice.findByYangModel(modelName);
    
    res.json({
      success: true,
      data: { 
        devices,
        model_name: modelName,
        count: devices.length
      }
    });
  } catch (error) {
    console.error('Error fetching devices by YANG model:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch devices by YANG model',
      error: error.message
    });
  }
});

export default router; 
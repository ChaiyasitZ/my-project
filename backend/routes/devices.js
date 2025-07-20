import express from 'express';
import Joi from 'joi';
import Device from '../models/Device.js';
import ConfigurationHistory from '../models/ConfigurationHistory.js';
import sshService from '../services/sshService.js';

const router = express.Router();

// Validation schemas
const deviceSchema = Joi.object({
  name: Joi.string().required().max(255),
  type: Joi.string().valid('router', 'switch').required(),
  ip_address: Joi.string().ip().required(),
  ssh_port: Joi.number().integer().min(1).max(65535).default(22),
  username: Joi.string().required().max(255),
  password: Joi.string().required().max(255),
  description: Joi.string().allow('').max(1000),
  location: Joi.string().allow('').max(255),
  model: Joi.string().allow('').max(255),
  status: Joi.string().valid('active', 'inactive', 'maintenance', 'error').default('active'),
  // NETCONF fields
  netconf_enabled: Joi.boolean().default(false),
  netconf_port: Joi.number().integer().min(1).max(65535).default(830),
  netconf_capabilities: Joi.array().items(Joi.string()).default([]),
  yang_models: Joi.array().default([]),
  preferred_connection: Joi.string().valid('netconf', 'ssh', 'console').default('ssh')
});

const deviceUpdateSchema = Joi.object({
  name: Joi.string().max(255),
  type: Joi.string().valid('router', 'switch'),
  ip_address: Joi.string().ip(),
  ssh_port: Joi.number().integer().min(1).max(65535),
  username: Joi.string().max(255),
  password: Joi.string().max(255).allow(''), // Allow empty string for updates (keep existing password)
  description: Joi.string().allow('').max(1000),
  location: Joi.string().allow('').max(255),
  model: Joi.string().allow('').max(255),
  status: Joi.string().valid('active', 'inactive', 'maintenance', 'error'),
  // NETCONF fields
  netconf_enabled: Joi.boolean(),
  netconf_port: Joi.number().integer().min(1).max(65535),
  netconf_capabilities: Joi.array().items(Joi.string()),
  yang_models: Joi.array(),
  preferred_connection: Joi.string().valid('netconf', 'ssh', 'console')
});

// GET /api/devices - Get all devices
router.get('/', async (req, res) => {
  try {
    const { status, type, limit = 50, offset = 0 } = req.query;
    
    // Build query filter
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    
    // Get devices with pagination
    const devices = await Device.find(filter)
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();
    
    // Get total count for pagination
    const total = await Device.countDocuments(filter);
    
    // Enhance devices with configuration stats
    const enhancedDevices = await Promise.all(
      devices.map(async (device) => {
        const configStats = await ConfigurationHistory.aggregate([
          { $match: { device_id: device._id } },
          {
            $group: {
              _id: null,
              total_configs: { $sum: 1 },
              applied_configs: {
                $sum: { $cond: [{ $eq: ['$status', 'applied'] }, 1, 0] }
              },
              last_config_date: { $max: '$created_at' }
            }
          }
        ]);
        
        const stats = configStats[0] || {
          total_configs: 0,
          applied_configs: 0,
          last_config_date: null
        };
        
        return {
          ...device,
          id: device._id, // Add id for compatibility
          total_configs: stats.total_configs,
          applied_configs: stats.applied_configs,
          last_config_date: stats.last_config_date
        };
      })
    );
    
    res.json({
      success: true,
      devices: enhancedDevices,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch devices'
    });
  }
});

// GET /api/devices/:id - Get single device
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const device = await Device.findById(id).lean();
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Add id field for compatibility and exclude password
    const deviceWithId = {
      ...device,
      id: device._id,
      password: undefined
    };
    
    res.json({
      success: true,
      device: deviceWithId
    });
    
  } catch (error) {
    console.error('Error fetching device:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch device'
    });
  }
});

// POST /api/devices - Create new device
router.post('/', async (req, res) => {
  try {
    const { error, value } = deviceSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
      });
    }
    
    // Check for duplicate IP address
    const existingDevice = await Device.findOne({ ip_address: value.ip_address });
    if (existingDevice) {
      return res.status(400).json({
        success: false,
        message: 'Device with this IP address already exists'
      });
    }
    
    // Check for duplicate name
    const existingName = await Device.findOne({ name: value.name });
    if (existingName) {
      return res.status(400).json({
        success: false,
        message: 'Device with this name already exists'
      });
    }
    
    const device = new Device(value);
    await device.save();
    
    // Return device without password
    const deviceResponse = {
      ...device.toObject(),
      id: device._id,
      password: undefined
    };
    
    res.status(201).json({
      success: true,
      device: deviceResponse,
      message: 'Device created successfully'
    });
    
  } catch (error) {
    console.error('Error creating device:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create device'
    });
  }
});

// PUT /api/devices/:id - Update device
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = deviceUpdateSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
      });
    }
    
    // Remove empty password field (keep existing password)
    if (value.password === '') {
      delete value.password;
    }
    
    // Check for duplicate IP address (excluding current device)
    if (value.ip_address) {
      const existingDevice = await Device.findOne({ 
        ip_address: value.ip_address,
        _id: { $ne: id }
      });
      if (existingDevice) {
        return res.status(400).json({
          success: false,
          message: 'Device with this IP address already exists'
        });
      }
    }
    
    // Check for duplicate name (excluding current device)
    if (value.name) {
      const existingName = await Device.findOne({ 
        name: value.name,
        _id: { $ne: id }
      });
      if (existingName) {
        return res.status(400).json({
          success: false,
          message: 'Device with this name already exists'
        });
      }
    }
    
    const device = await Device.findByIdAndUpdate(
      id, 
      { ...value, updatedAt: new Date() }, 
      { new: true, runValidators: true }
    );
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Return device without password
    const deviceResponse = {
      ...device.toObject(),
      id: device._id,
      password: undefined
    };
    
    res.json({
      success: true,
      device: deviceResponse,
      message: 'Device updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating device:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update device'
    });
  }
});

// DELETE /api/devices/:id - Delete device
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const device = await Device.findByIdAndDelete(id);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Device deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting device:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete device'
    });
  }
});

// GET /api/devices/:id/status - Get device status
router.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    
    const device = await Device.findById(id).select('_id name type ip_address status').lean();
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    res.json({
      success: true,
      device: {
        ...device,
        id: device._id, // Add id for compatibility
        last_checked: new Date().toISOString(),
        connection_status: device.status
      }
    });
    
  } catch (error) {
    console.error('Error checking device status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check device status'
    });
  }
});

// GET /api/devices/stats/summary - Get devices summary statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await Device.aggregate([
      {
        $group: {
          _id: null,
          total_devices: { $sum: 1 },
          active_devices: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          inactive_devices: {
            $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] }
          },
          maintenance_devices: {
            $sum: { $cond: [{ $eq: ['$status', 'maintenance'] }, 1, 0] }
          },
          error_devices: {
            $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] }
          },
          routers: {
            $sum: { $cond: [{ $eq: ['$type', 'router'] }, 1, 0] }
          },
          switches: {
            $sum: { $cond: [{ $eq: ['$type', 'switch'] }, 1, 0] }
          },
          firewalls: {
            $sum: { $cond: [{ $eq: ['$type', 'firewall'] }, 1, 0] }
          }
        }
      }
    ]);
    
    res.json({
      success: true,
      stats: stats[0] || {
        total_devices: 0,
        active_devices: 0,
        inactive_devices: 0,
        maintenance_devices: 0,
        error_devices: 0,
        routers: 0,
        switches: 0,
        firewalls: 0
      }
    });
    
  } catch (error) {
    console.error('Error fetching device stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch device statistics'
    });
  }
});

// POST /api/devices/:id/test - Test SSH connection to device
router.post('/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get device from database
    const device = await Device.findById(id);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Test SSH connection
    let testResult;
    try {
      testResult = await sshService.testConnection(device);
    } catch (error) {
      testResult = {
        success: false,
        message: error.message
      };
    }
    
    // Handle case where testResult might be undefined or malformed
    if (!testResult || typeof testResult !== 'object') {
      testResult = {
        success: false,
        message: 'SSH service returned invalid response'
      };
    }
    
    // Ensure success property exists
    if (testResult.success === undefined) {
      testResult.success = false;
    }
    
    // Update device status based on test result
    const newStatus = testResult.success ? 'active' : 'error';
    try {
      await Device.findByIdAndUpdate(id, { 
        status: newStatus,
        updated_at: new Date()
      });
    } catch (updateError) {
      console.warn('Failed to update device status:', updateError.message);
    }
    
    res.json({
      success: testResult.success,
      message: testResult.success ? 'SSH connection test successful' : 'SSH connection test failed',
      connectionTest: testResult,
      deviceStatus: newStatus
    });
    
  } catch (error) {
    console.error('Error testing device connection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test device connection',
      error: error.message
    });
  }
});

export default router; 
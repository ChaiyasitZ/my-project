import express from 'express';
import Joi from 'joi';
import Device from '../models/Device.js';
import ConfigurationHistory from '../models/ConfigurationHistory.js';
import sshService from '../services/sshService.js';
import netconfService from '../services/netconfService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Validation schemas
const deviceSchema = Joi.object({
  name: Joi.string().required().max(255),
  type: Joi.string().valid('router', 'switch', 'nexus').required(),
  layer: Joi.string().valid('layer-2', 'layer-3').optional().allow('', null), // Optional for all types, only used for switches
  ip_address: Joi.string().ip().required(),
  ssh_port: Joi.number().integer().min(1).max(65535).default(22),
  netconf_port: Joi.number().integer().min(1).max(65535).default(830),
  netconf_enabled: Joi.boolean().default(false),
  username: Joi.string().required().max(255),
  password: Joi.string().required().max(255),
  enable_password: Joi.string().allow('').max(255).optional(), // Allow but ignore
  description: Joi.string().allow('').max(1000),
  location: Joi.string().allow('').max(255),
  model: Joi.string().allow('').max(255),
  status: Joi.string().valid('active', 'inactive', 'maintenance', 'error').default('active')
}).options({ stripUnknown: true });

const deviceUpdateSchema = Joi.object({
  name: Joi.string().max(255),
  type: Joi.string().valid('router', 'switch', 'nexus'),
  layer: Joi.string().valid('layer-2', 'layer-3').optional().allow('', null), // Optional for all types
  ip_address: Joi.string().ip(),
  ssh_port: Joi.number().integer().min(1).max(65535),
  netconf_port: Joi.number().integer().min(1).max(65535),
  netconf_enabled: Joi.boolean(),
  username: Joi.string().max(255),
  password: Joi.string().max(255).allow(''), // Allow empty string for updates (keep existing password)
  enable_password: Joi.string().allow('').max(255).optional(), // Allow but ignore
  description: Joi.string().allow('').max(1000),
  location: Joi.string().allow('').max(255),
  model: Joi.string().allow('').max(255),
  status: Joi.string().valid('active', 'inactive', 'maintenance', 'error')
}).options({ stripUnknown: true });

// GET /api/devices - Get all devices
router.get('/', async (req, res) => {
  try {
    const { status, type, limit = 50, offset = 0 } = req.query;
    
    // Build query filter - include userId to filter by user
    const filter = { userId: req.userId };
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

// GET /api/devices/sessions/stats - Get SSH session statistics
router.get('/sessions/stats', async (req, res) => {
  try {
    const stats = sshService.getSessionStats();
    
    res.json({
      success: true,
      message: 'SSH session statistics retrieved',
      stats: {
        activePersistentSessions: stats.activePersistentSessions,
        pooledSessions: stats.pooledSessions,
        sessions: stats.sessions
      }
    });
    
  } catch (error) {
    console.error('Error fetching session stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch session statistics'
    });
  }
});

// GET /api/devices/:id - Get single device
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const device = await Device.findOne({ _id: id, userId: req.userId }).lean();
    
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
    console.log('📥 Create device request body:', JSON.stringify(req.body, null, 2));
    
    const { error, value } = deviceSchema.validate(req.body);
    
    if (error) {
      console.error('❌ Device validation error:', error.details);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details,
        validationMessage: error.details.map(d => d.message).join(', ')
      });
    }
    
    // Check for duplicate IP address (within user's devices)
    const existingDevice = await Device.findOne({ ip_address: value.ip_address, userId: req.userId });
    if (existingDevice) {
      return res.status(400).json({
        success: false,
        message: 'Device with this IP address already exists'
      });
    }
    
    // Check for duplicate name (within user's devices)
    const existingName = await Device.findOne({ name: value.name, userId: req.userId });
    if (existingName) {
      return res.status(400).json({
        success: false,
        message: 'Device with this name already exists'
      });
    }
    
    // Add userId to device
    const device = new Device({ ...value, userId: req.userId });
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
    
    // Check for duplicate IP address (excluding current device, within user's devices)
    if (value.ip_address) {
      const existingDevice = await Device.findOne({ 
        ip_address: value.ip_address,
        userId: req.userId,
        _id: { $ne: id }
      });
      if (existingDevice) {
        return res.status(400).json({
          success: false,
          message: 'Device with this IP address already exists'
        });
      }
    }
    
    // Check for duplicate name (excluding current device, within user's devices)
    if (value.name) {
      const existingName = await Device.findOne({ 
        name: value.name,
        userId: req.userId,
        _id: { $ne: id }
      });
      if (existingName) {
        return res.status(400).json({
          success: false,
          message: 'Device with this name already exists'
        });
      }
    }
    
    const device = await Device.findOneAndUpdate(
      { _id: id, userId: req.userId }, 
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
    
    const device = await Device.findOneAndDelete({ _id: id, userId: req.userId });
    
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
    
    const device = await Device.findOne({ _id: id, userId: req.userId }).select('_id name type ip_address status').lean();
    
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
      { $match: { userId: req.userId } },
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
    const device = await Device.findOne({ _id: id, userId: req.userId });
    
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
      await Device.findOneAndUpdate(
        { _id: id, userId: req.userId },
        { status: newStatus, updated_at: new Date() }
      );
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

// POST /api/devices/:id/ssh/connect - Connect SSH session
router.post('/:id/ssh/connect', async (req, res) => {
  try {
    const { id } = req.params;
    
    const device = await Device.findOne({ _id: id, userId: req.userId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    console.log(`🔌 Connecting persistent SSH session to ${device.name} (${device.ip_address})`);
    
    try {
      // Update status to connecting
      device.ssh_status = 'connecting';
      await device.save();
      
      // Create persistent session
      const session = await sshService.getOrCreatePersistentSession(device);
      
      // Update device status to active on successful connection
      device.status = 'active';
      device.ssh_status = 'connected';
      device.ssh_connected_at = new Date();
      device.ssh_session_id = session.sessionKey;
      await device.save();
      
      res.json({
        success: true,
        message: `SSH session connected to ${device.name}`,
        session: {
          session_id: session.sessionKey,
          device_name: device.name,
          device_ip: device.ip_address,
          is_privileged: session.isPrivileged,
          connected_at: new Date(session.createdAt).toISOString(),
          use_count: session.useCount
        }
      });
      
    } catch (connectionError) {
      // Update device status to reflect connection failure
      device.status = 'error';
      device.ssh_status = 'error';
      await device.save();
      
      res.status(500).json({
        success: false,
        message: `Failed to connect SSH session: ${connectionError.message}`,
        error: connectionError.message
      });
    }
    
  } catch (error) {
    console.error('Error connecting SSH session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to connect SSH session'
    });
  }
});

// POST /api/devices/:id/ssh/disconnect - Disconnect SSH session  
router.post('/:id/ssh/disconnect', async (req, res) => {
  try {
    const { id } = req.params;
    
    const device = await Device.findOne({ _id: id, userId: req.userId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    console.log(`🔌 Disconnecting SSH session from ${device.name} (${device.ip_address})`);
    
    // Find and disconnect persistent session
    const sessionKey = `${id}_persistent`;
    const session = sshService.persistentSessions.get(sessionKey);
    
    if (session) {
      if (session.connection) {
        session.connection.end();
      }
      sshService.persistentSessions.delete(sessionKey);
      console.log(`✅ SSH session disconnected from ${device.name}`);
    }
    
    // Update device status
    device.status = 'inactive';
    device.ssh_status = 'disconnected';
    device.ssh_connected_at = null;
    device.ssh_session_id = null;
    await device.save();
    
    res.json({
      success: true,
      message: `SSH session disconnected from ${device.name}`
    });
    
  } catch (error) {
    console.error('Error disconnecting SSH session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect SSH session'
    });
  }
});

// GET /api/devices/ssh/status-all - Get SSH status for all devices
router.get('/ssh/status-all', async (req, res) => {
  try {
    const devices = await Device.find({ userId: req.userId });
    
    const statusList = devices.map(device => {
      const sessionKey = `${device.id}_persistent`;
      const session = sshService.persistentSessions.get(sessionKey);
      const isConnected = session && sshService.isSessionValid(session);
      
      return {
        device_id: device.id,
        device_name: device.name,
        ssh_status: device.ssh_status,
        is_connected: isConnected,
        connected_at: device.ssh_connected_at,
        session_id: device.ssh_session_id
      };
    });
    
    res.json({
      success: true,
      devices: statusList
    });
    
  } catch (error) {
    console.error('Error getting SSH status for all devices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get SSH status'
    });
  }
});

// GET /api/devices/:id/ssh/status - Get SSH session status with performance metrics
router.get('/:id/ssh/status', async (req, res) => {
  try {
    const { id } = req.params;
    
    const device = await Device.findOne({ _id: id, userId: req.userId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    const sessionKey = `${id}_persistent`;
    const session = sshService.persistentSessions.get(sessionKey);
    
    // Also check optimized session pool
    const deviceSessions = sshService.sessionPool.get(id) || [];
    const poolSessions = deviceSessions.filter(s => sshService.isSessionValid(s));
    
    const isConnected = session && sshService.isSessionValid(session);
    
    res.json({
      success: true,
      device: {
        name: device.name,
        ip_address: device.ip_address,
        status: device.status
      },
      ssh_session: {
        is_connected: isConnected,
        session_id: session?.sessionKey || null,
        connected_at: session ? new Date(session.createdAt).toISOString() : null,
        last_used: session ? new Date(session.lastUsed).toISOString() : null,
        use_count: session?.useCount || 0,
        is_privileged: session?.isPrivileged || false,
        user_mode_only: session?.userModeOnly || false,
        is_busy: session?.busy || false,
        connection_age: session ? Math.round((Date.now() - session.createdAt) / 1000) : 0,
        performance: session?.performance || null,
        recent_commands: session?.commandHistory?.slice(-3) || []
      },
      session_pool: {
        total_sessions: poolSessions.length,
        available_sessions: poolSessions.filter(s => !s.busy).length,
        busy_sessions: poolSessions.filter(s => s.busy).length
      }
    });
    
  } catch (error) {
    console.error('Error getting SSH session status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get SSH session status'
    });
  }
});

// POST /api/devices/:id/netconf/test - Test NETCONF connection to device
router.post('/:id/netconf/test', async (req, res) => {
  try {
    const { id } = req.params;
    
    const device = await Device.findOne({ _id: id, userId: req.userId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    console.log(`🌐 Testing NETCONF connection to ${device.name} (${device.ip_address}:${device.netconf_port || 830})`);
    
    // Test NETCONF connection
    const testResult = await netconfService.testConnection(device);
    
    res.json({
      success: testResult.success,
      message: testResult.success 
        ? `NETCONF connection to ${device.name} successful` 
        : `NETCONF connection failed: ${testResult.error}`,
      connectionTest: {
        success: testResult.success,
        message: testResult.message,
        capabilities: testResult.capabilities || [],
        response_time: testResult.response_time
      }
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

// GET /api/devices/:id/netconf/capabilities - Get device NETCONF capabilities
router.get('/:id/netconf/capabilities', async (req, res) => {
  try {
    const { id } = req.params;
    
    const device = await Device.findOne({ _id: id, userId: req.userId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Check if there's an active session with capabilities
    const sessionStatus = netconfService.getSessionStatus(id);
    
    if (sessionStatus && sessionStatus.isConnected) {
      const capabilities = netconfService.getCapabilities(id);
      return res.json({
        success: true,
        device_name: device.name,
        is_connected: true,
        capabilities: capabilities || []
      });
    }
    
    // Need to connect to get capabilities
    res.json({
      success: true,
      device_name: device.name,
      is_connected: false,
      capabilities: [],
      message: 'Connect NETCONF session to view capabilities'
    });
    
  } catch (error) {
    console.error('Error getting NETCONF capabilities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get NETCONF capabilities'
    });
  }
});

// GET /api/devices/netconf/sessions - Get all active NETCONF sessions
router.get('/netconf/sessions', async (req, res) => {
  try {
    const activeSessions = netconfService.getActiveSessions();
    
    // Enhance with device names - only show sessions for user's devices
    const userDevices = await Device.find({ userId: req.userId }).select('_id name ip_address');
    const userDeviceIds = userDevices.map(d => d._id.toString());
    
    const enhancedSessions = activeSessions
      .filter(session => userDeviceIds.includes(session.deviceId))
      .map(session => {
        const device = userDevices.find(d => d._id.toString() === session.deviceId);
        return {
          ...session,
          device_name: device?.name || 'Unknown',
          device_ip: device?.ip_address || 'Unknown'
        };
      });
    
    res.json({
      success: true,
      sessions: enhancedSessions,
      total: enhancedSessions.length
    });
    
  } catch (error) {
    console.error('Error getting NETCONF sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get NETCONF sessions'
    });
  }
});

// POST /api/devices/:id/netconf/connect - Connect to device via NETCONF
router.post('/:id/netconf/connect', async (req, res) => {
  try {
    const { id } = req.params;
    
    const device = await Device.findOne({ _id: id, userId: req.userId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    console.log(`🌐 Connecting NETCONF to ${device.name} (${device.ip_address})`);
    
    // Check if already connected
    const existingSession = netconfService.getSessionStatus(id);
    if (existingSession?.isConnected) {
      return res.json({
        success: true,
        message: `Already connected to ${device.name}`,
        capabilities: existingSession.capabilities || 0,
        alreadyConnected: true
      });
    }
    
    // Connect via NETCONF
    const result = await netconfService.connect(device);
    
    if (result.success) {
      res.json({
        success: true,
        message: `NETCONF connected to ${device.name}`,
        capabilities: result.capabilities?.length || 0,
        deviceId: id
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'NETCONF connection failed'
      });
    }
    
  } catch (error) {
    console.error('Error connecting NETCONF:', error);
    res.status(500).json({
      success: false,
      message: `NETCONF connection failed: ${error.message}`,
      troubleshooting: [
        'Ensure NETCONF is enabled on device (feature netconf)',
        'Check port 830 is accessible',
        'Verify credentials are correct',
        'Check NX-OS/IOS-XE version supports NETCONF'
      ]
    });
  }
});

// POST /api/devices/:id/netconf/disconnect - Disconnect NETCONF session
router.post('/:id/netconf/disconnect', async (req, res) => {
  try {
    const { id } = req.params;
    
    const device = await Device.findOne({ _id: id, userId: req.userId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    console.log(`🌐 Disconnecting NETCONF session from ${device.name}`);
    
    await netconfService.closeSession(id);
    
    res.json({
      success: true,
      message: `NETCONF session disconnected from ${device.name}`
    });
    
  } catch (error) {
    console.error('Error disconnecting NETCONF session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect NETCONF session'
    });
  }
});

// POST /api/devices/:id/netconf/get - Execute NETCONF <get> operation
router.post('/:id/netconf/get', async (req, res) => {
  try {
    const { id } = req.params;
    const { filter, filter_type = 'subtree' } = req.body;
    
    const device = await Device.findOne({ _id: id, userId: req.userId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Ensure NETCONF session is active
    const sessionStatus = netconfService.getSessionStatus(id);
    if (!sessionStatus?.isConnected) {
      // Try to connect
      await netconfService.connect(device);
    }
    
    console.log(`📡 NETCONF GET on ${device.name}`);
    
    // Build filter XML
    let filterXml = '';
    if (filter) {
      filterXml = `
  <filter type="${filter_type}">
    ${filter}
  </filter>`;
    }
    
    const rpcContent = `  <get>${filterXml}
  </get>`;
    
    const startTime = Date.now();
    const result = await netconfService.sendRpc(id, rpcContent);
    const executionTime = Date.now() - startTime;
    
    res.json({
      success: true,
      device_name: device.name,
      operation: 'get',
      execution_time_ms: executionTime,
      response: result.response
    });
    
  } catch (error) {
    console.error('Error executing NETCONF get:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to execute NETCONF get operation'
    });
  }
});

// POST /api/devices/:id/netconf/get-config - Execute NETCONF <get-config> operation
router.post('/:id/netconf/get-config', async (req, res) => {
  try {
    const { id } = req.params;
    const { source = 'running', filter, filter_type = 'subtree' } = req.body;
    
    const device = await Device.findOne({ _id: id, userId: req.userId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Ensure NETCONF session is active
    const sessionStatus = netconfService.getSessionStatus(id);
    if (!sessionStatus?.isConnected) {
      await netconfService.connect(device);
    }
    
    console.log(`📡 NETCONF GET-CONFIG (${source}) on ${device.name}`);
    
    const startTime = Date.now();
    const result = await netconfService.getRunningConfig(id, filter);
    const executionTime = Date.now() - startTime;
    
    res.json({
      success: true,
      device_name: device.name,
      operation: 'get-config',
      source,
      execution_time_ms: executionTime,
      response: result.response
    });
    
  } catch (error) {
    console.error('Error executing NETCONF get-config:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to execute NETCONF get-config operation'
    });
  }
});

// POST /api/devices/:id/netconf/rpc - Execute custom NETCONF RPC
router.post('/:id/netconf/rpc', async (req, res) => {
  try {
    const { id } = req.params;
    const { rpc_content } = req.body;
    
    if (!rpc_content) {
      return res.status(400).json({
        success: false,
        message: 'RPC content is required'
      });
    }
    
    const device = await Device.findOne({ _id: id, userId: req.userId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Ensure NETCONF session is active
    const sessionStatus = netconfService.getSessionStatus(id);
    if (!sessionStatus?.isConnected) {
      await netconfService.connect(device);
    }
    
    console.log(`📡 NETCONF Custom RPC on ${device.name}`);
    
    const startTime = Date.now();
    const result = await netconfService.sendRpc(id, rpc_content);
    const executionTime = Date.now() - startTime;
    
    res.json({
      success: true,
      device_name: device.name,
      operation: 'custom-rpc',
      execution_time_ms: executionTime,
      response: result.response
    });
    
  } catch (error) {
    console.error('Error executing NETCONF RPC:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to execute NETCONF RPC'
    });
  }
});

export default router; 
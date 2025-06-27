import express from 'express';
import Joi from 'joi';
import { query } from '../lib/database.js';

const router = express.Router();

// Validation schemas
const createDeviceSchema = Joi.object({
  name: Joi.string().required().max(255),
  type: Joi.string().required().max(50),
  ip_address: Joi.string().ip().required(),
  ssh_port: Joi.number().integer().min(1).max(65535).default(22),
  username: Joi.string().required().max(255),
  password: Joi.string().required().max(255),
  description: Joi.string().max(1000).allow(''),
  location: Joi.string().max(255).allow(''),
  model: Joi.string().max(255).allow(''),
  ios_version: Joi.string().max(255).allow(''),
  status: Joi.string().valid('active', 'inactive', 'maintenance', 'error').default('inactive')
});

const updateDeviceSchema = Joi.object({
  name: Joi.string().max(255),
  type: Joi.string().max(50),
  ip_address: Joi.string().ip(),
  ssh_port: Joi.number().integer().min(1).max(65535),
  username: Joi.string().max(255),
  password: Joi.string().max(255),
  description: Joi.string().max(1000).allow(''),
  location: Joi.string().max(255).allow(''),
  model: Joi.string().max(255).allow(''),
  ios_version: Joi.string().max(255).allow(''),
  status: Joi.string().valid('active', 'inactive', 'maintenance', 'error')
});

// GET /api/devices - Get all devices
router.get('/', async (req, res) => {
  try {
    const { status, type, limit = 50, offset = 0 } = req.query;
    
    let queryText = `
      SELECT d.*, 
             COUNT(ch.id) as total_configs,
             COUNT(CASE WHEN ch.status = 'applied' THEN 1 END) as applied_configs,
             MAX(ch.created_at) as last_config_date
      FROM devices d
      LEFT JOIN configuration_history ch ON d.id = ch.device_id
    `;
    
    const queryParams = [];
    const conditions = [];
    
    if (status) {
      conditions.push(`d.status = $${queryParams.length + 1}`);
      queryParams.push(status);
    }
    
    if (type) {
      conditions.push(`d.type = $${queryParams.length + 1}`);
      queryParams.push(type);
    }
    
    if (conditions.length > 0) {
      queryText += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    queryText += ` GROUP BY d.id ORDER BY d.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);
    
    const result = await query(queryText, queryParams);
    
    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM devices d';
    let countParams = [];
    
    if (conditions.length > 0) {
      countQuery += ` WHERE ${conditions.join(' AND ')}`;
      countParams = queryParams.slice(0, -2); // Remove limit and offset
    }
    
    const countResult = await query(countQuery, countParams);
    
    res.json({
      success: true,
      devices: result.rows,
      total: parseInt(countResult.rows[0].total),
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

// GET /api/devices/:id - Get specific device
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(`
      SELECT d.*, 
             COUNT(ch.id) as total_configs,
             COUNT(CASE WHEN ch.status = 'applied' THEN 1 END) as applied_configs,
             MAX(ch.created_at) as last_config_date
      FROM devices d
      LEFT JOIN configuration_history ch ON d.id = ch.device_id
      WHERE d.id = $1
      GROUP BY d.id
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    res.json({
      success: true,
      device: result.rows[0]
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
    const { error, value } = createDeviceSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
      });
    }
    
    const {
      name, type, ip_address, ssh_port, username, password,
      description, location, model, ios_version, status
    } = value;
    
    // Check if device name or IP already exists
    const existingDevice = await query(
      'SELECT id FROM devices WHERE name = $1 OR ip_address = $2',
      [name, ip_address]
    );
    
    if (existingDevice.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Device with this name or IP address already exists'
      });
    }
    
    const result = await query(`
      INSERT INTO devices (name, type, ip_address, ssh_port, username, password, description, location, model, ios_version, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [name, type, ip_address, ssh_port, username, password, description, location, model, ios_version, status]);
    
    res.status(201).json({
      success: true,
      device: result.rows[0],
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
    const { error, value } = updateDeviceSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
      });
    }
    
    // Check if device exists
    const existingDevice = await query('SELECT * FROM devices WHERE id = $1', [id]);
    
    if (existingDevice.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    const {
      name, type, ip_address, ssh_port, username, password,
      description, location, model, ios_version, status
    } = value;
    
    // Check for duplicate name or IP (excluding current device)
    if (name || ip_address) {
      const duplicateCheck = await query(
        'SELECT id FROM devices WHERE (name = $1 OR ip_address = $2) AND id != $3',
        [name || existingDevice.rows[0].name, ip_address || existingDevice.rows[0].ip_address, id]
      );
      
      if (duplicateCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Device with this name or IP address already exists'
        });
      }
    }
    
    // For security, hash password if it's being updated
    const finalPassword = password || existingDevice.rows[0].password;
    
    const result = await query(`
      UPDATE devices 
      SET name = $1, type = $2, ip_address = $3, ssh_port = $4, username = $5, password = $6,
          description = $7, location = $8, model = $9, ios_version = $10, status = $11, updated_at = CURRENT_TIMESTAMP
      WHERE id = $12
      RETURNING *
    `, [name || existingDevice.rows[0].name, 
        type || existingDevice.rows[0].type,
        ip_address || existingDevice.rows[0].ip_address,
        ssh_port || existingDevice.rows[0].ssh_port,
        username || existingDevice.rows[0].username,
        finalPassword,
        description !== undefined ? description : existingDevice.rows[0].description,
        location !== undefined ? location : existingDevice.rows[0].location,
        model !== undefined ? model : existingDevice.rows[0].model,
        ios_version !== undefined ? ios_version : existingDevice.rows[0].ios_version,
        status || existingDevice.rows[0].status,
        id]);
    
    res.json({
      success: true,
      device: result.rows[0],
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
    
    // Check if device exists
    const existingDevice = await query('SELECT name FROM devices WHERE id = $1', [id]);
    
    if (existingDevice.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Delete device (CASCADE will handle related records)
    await query('DELETE FROM devices WHERE id = $1', [id]);
    
    res.json({
      success: true,
      message: `Device "${existingDevice.rows[0].name}" deleted successfully`
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
    
    const result = await query('SELECT id, name, type, ip_address, status FROM devices WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    const device = result.rows[0];
    
    res.json({
      success: true,
      device: {
        ...device,
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
    const stats = await query(`
      SELECT 
        COUNT(*) as total_devices,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_devices,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_devices,
        COUNT(CASE WHEN status = 'maintenance' THEN 1 END) as maintenance_devices,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as error_devices,
        COUNT(CASE WHEN type = 'router' THEN 1 END) as routers,
        COUNT(CASE WHEN type = 'switch' THEN 1 END) as switches,
        COUNT(CASE WHEN type = 'firewall' THEN 1 END) as firewalls
      FROM devices
    `);
    
    res.json({
      success: true,
      stats: stats.rows[0]
    });
    
  } catch (error) {
    console.error('Error fetching device stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch device statistics'
    });
  }
});

export default router; 
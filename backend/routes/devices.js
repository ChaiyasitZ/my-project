import express from 'express';
import Joi from 'joi';
import { query } from '../lib/database.js';
import sshService from '../services/sshService.js';

const router = express.Router();

// Validation schemas
const deviceCreateSchema = Joi.object({
  name: Joi.string().required().min(1).max(255),
  type: Joi.string().valid('switch', 'router').required(),
  ip_address: Joi.string().ip().required(),
  ssh_port: Joi.number().integer().min(1).max(65535).default(22),
  username: Joi.string().required().min(1).max(255),
  password: Joi.string().required().min(1),
  description: Joi.string().max(1000).allow(''),
  location: Joi.string().max(255).allow(''),
  model: Joi.string().max(255).allow(''),
  ios_version: Joi.string().max(255).allow(''),
  status: Joi.string().valid('active', 'inactive', 'maintenance').default('active')
});

const deviceUpdateSchema = Joi.object({
  name: Joi.string().required().min(1).max(255),
  type: Joi.string().valid('switch', 'router').required(),
  ip_address: Joi.string().ip().required(),
  ssh_port: Joi.number().integer().min(1).max(65535).default(22),
  username: Joi.string().required().min(1).max(255),
  password: Joi.string().allow('').optional(), // Allow empty password for updates
  description: Joi.string().max(1000).allow(''),
  location: Joi.string().max(255).allow(''),
  model: Joi.string().max(255).allow(''),
  ios_version: Joi.string().max(255).allow(''),
  status: Joi.string().valid('active', 'inactive', 'maintenance').default('active')
});

// GET /api/devices - Get all devices
router.get('/', async (req, res) => {
  try {
    const { type, status } = req.query;
    
    let queryText = 'SELECT * FROM devices WHERE 1=1';
    const queryParams = [];
    
    if (type) {
      queryParams.push(type);
      queryText += ` AND type = $${queryParams.length}`;
    }
    
    if (status) {
      queryParams.push(status);
      queryText += ` AND status = $${queryParams.length}`;
    }
    
    queryText += ' ORDER BY created_at DESC';
    
    const result = await query(queryText, queryParams);
    
    // Remove sensitive password data
    const devices = result.rows.map(device => ({
      ...device,
      password: undefined
    }));
    
    res.json({
      success: true,
      devices,
      count: devices.length
    });
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch devices'
    });
  }
});

// GET /api/devices/:id - Get device by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query('SELECT * FROM devices WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    const device = { ...result.rows[0], password: undefined };
    
    res.json({
      success: true,
      device
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
    const { error, value } = deviceCreateSchema.validate(req.body);
    
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
    
    // Check if IP address already exists
    const existingDevice = await query('SELECT id FROM devices WHERE ip_address = $1', [ip_address]);
    
    if (existingDevice.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Device with this IP address already exists'
      });
    }
    
    const result = await query(`
      INSERT INTO devices (name, type, ip_address, ssh_port, username, password, description, location, model, ios_version, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [name, type, ip_address, ssh_port, username, password, description, location, model, ios_version, status]);
    
    const device = { ...result.rows[0], password: undefined };
    
    res.status(201).json({
      success: true,
      message: 'Device created successfully',
      device
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
    
    const {
      name, type, ip_address, ssh_port, username, password,
      description, location, model, ios_version, status
    } = value;
    
    // Check if device exists and get current password
    const existingDeviceResult = await query('SELECT password FROM devices WHERE id = $1', [id]);
    
    if (existingDeviceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Use existing password if new password is empty
    const finalPassword = password && password.trim() !== '' ? password : existingDeviceResult.rows[0].password;
    
    // Check if IP address conflicts with other devices
    const conflictingDevice = await query('SELECT id FROM devices WHERE ip_address = $1 AND id != $2', [ip_address, id]);
    
    if (conflictingDevice.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Another device with this IP address already exists'
      });
    }
    
    const result = await query(`
      UPDATE devices 
      SET name = $1, type = $2, ip_address = $3, ssh_port = $4, username = $5, password = $6,
          description = $7, location = $8, model = $9, ios_version = $10, status = $11, updated_at = CURRENT_TIMESTAMP
      WHERE id = $12
      RETURNING *
    `, [name, type, ip_address, ssh_port, username, finalPassword, description, location, model, ios_version, status, id]);
    
    const device = { ...result.rows[0], password: undefined };
    
    res.json({
      success: true,
      message: 'Device updated successfully',
      device
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
    
    const result = await query('DELETE FROM devices WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
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

// POST /api/devices/:id/test - Test SSH connection
router.post('/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query('SELECT * FROM devices WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    const device = result.rows[0];
    const testResult = await sshService.testConnection(device);
    
    res.json({
      success: true,
      connectionTest: testResult
    });
  } catch (error) {
    console.error('Error testing connection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test connection'
    });
  }
});

// POST /api/devices/:id/debug - Debug SSH connection with detailed logging
router.post('/:id/debug', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query('SELECT * FROM devices WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    const device = result.rows[0];
    
    // Enable debug mode temporarily
    const originalDebug = process.env.SSH_DEBUG;
    process.env.SSH_DEBUG = 'true';
    
    console.log('🔍 Debug mode enabled for SSH connection test');
    console.log(`📋 Device config: ${JSON.stringify({
      ip: device.ip_address,
      port: device.ssh_port,
      username: device.username,
      // Don't log password
    })}`);
    
    const testResult = await sshService.testConnection(device);
    
    // Restore original debug setting
    process.env.SSH_DEBUG = originalDebug;
    
    res.json({
      success: true,
      connectionTest: testResult,
      debugInfo: {
        ip: device.ip_address,
        port: device.ssh_port,
        username: device.username,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    // Restore original debug setting
    process.env.SSH_DEBUG = process.env.SSH_DEBUG || 'false';
    
    console.error('Error in debug connection test:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to debug connection',
      error: error.message
    });
  }
});

export default router; 
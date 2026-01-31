import express from 'express';
import Joi from 'joi';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Device from '../models/Device.js';
import ConfigurationBackup from '../models/ConfigurationBackup.js';
import ConfigurationHistory from '../models/ConfigurationHistory.js';
import BackupSchedule from '../models/BackupSchedule.js';
import sshService from '../services/sshService.js';
import backupScheduler from '../services/backupScheduler.js';
import { authenticateToken } from '../middleware/auth.js';
import { getOrSetCache, invalidateCache, CacheKeys } from '../lib/cache.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Validation schemas
const createBackupSchema = Joi.object({
  device_id: Joi.string().required(),
  backup_name: Joi.string().required().min(1).max(255),
  description: Joi.string().max(1000).allow(''),
  backup_type: Joi.string().valid('manual', 'scheduled').default('manual'),
  config_type: Joi.string().valid('running-config', 'startup-config', 'both').default('running-config'),
  created_by: Joi.string().max(255).allow('').default('system'),
  tags: Joi.array().items(Joi.string()).optional()
});

const restoreBackupSchema = Joi.object({
  restore_type: Joi.string().valid('running', 'startup', 'both').default('running'),
  create_checkpoint: Joi.boolean().default(true)
});

// GET /api/backups - Get all backups with filters
router.get('/', async (req, res) => {
  try {
    const { 
      device_id, 
      backup_type, 
      limit = 50, 
      offset = 0,
      sort_by = 'created_at',
      sort_order = 'desc',
      noCache
    } = req.query;
    
    // Create cache key based on query parameters
    const cacheKey = `backups:${req.userId}:${device_id || 'all'}:${backup_type || 'all'}:${limit}:${offset}:${sort_by}:${sort_order}`;
    
    // Check if client wants fresh data
    if (noCache !== 'true') {
      const cachedData = await getOrSetCache(cacheKey, async () => {
        return await fetchBackupsData(req.userId, device_id, backup_type, limit, offset, sort_by, sort_order);
      }, 30); // 30 second TTL for backups
      
      if (cachedData) {
        return res.json(cachedData);
      }
    }
    
    // Fetch fresh data if cache miss or noCache requested
    const result = await fetchBackupsData(req.userId, device_id, backup_type, limit, offset, sort_by, sort_order);
    res.json(result);
    
  } catch (error) {
    console.error('Error fetching backups:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch backups'
    });
  }
});

// Helper function to fetch backups data
async function fetchBackupsData(userId, device_id, backup_type, limit, offset, sort_by, sort_order) {
  // Get user's device IDs first
  const userDevices = await Device.find({ userId }).select('_id').lean();
  const userDeviceIds = userDevices.map(d => d._id);
  
  // Build filter - only show backups for user's devices
  const filter = { device_id: { $in: userDeviceIds } };
  if (device_id) {
    // Verify user owns the specified device
    if (userDeviceIds.some(id => id.toString() === device_id)) {
      filter.device_id = new mongoose.Types.ObjectId(device_id);
    } else {
      return {
        success: true,
        backups: [],
        pagination: { total: 0, limit: parseInt(limit), offset: parseInt(offset) }
      };
    }
  }
  if (backup_type) filter.backup_type = backup_type;
  
  // Build sort object
  const allowedSortFields = ['created_at', 'backup_name', 'file_size'];
  const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
  const sortDirection = sort_order.toLowerCase() === 'asc' ? 1 : -1;
  const sortObj = { [sortField]: sortDirection };
  
  // Use aggregation to join with devices in a single query (eliminates N+1)
  const [backups, countResult] = await Promise.all([
    ConfigurationBackup.aggregate([
      { $match: filter },
      { $sort: sortObj },
      { $skip: parseInt(offset) },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: 'devices',
          localField: 'device_id',
          foreignField: '_id',
          as: 'device',
          pipeline: [{ $project: { name: 1, type: 1, ip_address: 1 } }]
        }
      },
      { $unwind: { path: '$device', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          device_id: 1,
          backup_name: 1,
          description: 1,
          backup_type: 1,
          config_type: 1,
          file_size: 1,
          config_hash: 1,
          created_by: 1,
          is_restore_point: 1,
          tags: 1,
          createdAt: 1,
          updatedAt: 1,
          device_name: '$device.name',
          device_type: '$device.type',
          ip_address: '$device.ip_address'
        }
      }
    ]),
    ConfigurationBackup.countDocuments(filter)
  ]);
  
  // Add id alias for compatibility
  const enhancedBackups = backups.map(b => ({ ...b, id: b._id }));
  
  return {
    success: true,
    backups: enhancedBackups,
    pagination: {
      total: countResult,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: parseInt(offset) + parseInt(limit) < countResult
    }
  };
}

// ============================================
// SCHEDULE ROUTES - Must be defined BEFORE /:id routes
// ============================================

// GET /api/backups/schedules - Get all backup schedules
router.get('/schedules', async (req, res) => {
  try {
    const ObjectId = mongoose.Types.ObjectId;
    
    // Use aggregation for efficient device lookup, filtered by userId
    const schedules = await BackupSchedule.aggregate([
      { $match: { userId: new ObjectId(req.userId) } },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'devices',
          localField: 'device_ids',
          foreignField: '_id',
          as: 'devices',
          pipeline: [{ $project: { name: 1, type: 1, ip_address: 1 } }]
        }
      },
      {
        $addFields: {
          id: '$_id',
          device_count: { $size: '$device_ids' }
        }
      }
    ]);

    res.json({
      success: true,
      schedules
    });

  } catch (error) {
    console.error('Error fetching backup schedules:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch backup schedules'
    });
  }
});

// GET /api/backups/:id/preview - Preview backup configuration content
// NOTE: Must check for special routes that start with non-ObjectId strings
router.get('/:id/preview', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid backup ID format'
      });
    }
    
    // Get backup details
    const backup = await ConfigurationBackup.findById(id);
    
    if (!backup) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }
    
    // Verify the device belongs to the user
    const device = await Device.findOne({ _id: backup.device_id, userId: req.userId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }
    
    // Return backup configuration content with metadata
    const response = {
      success: true,
      backup: {
        id: backup._id,
        backup_name: backup.backup_name,
        device_name: backup.device_name,
        device_type: backup.device_type,
        backup_type: backup.backup_type,
        file_size: backup.file_size,
        created_at: backup.createdAt,
        created_by: backup.created_by,
        description: backup.description,
        is_restore_point: backup.is_restore_point
      },
      content: {
        running_config: backup.running_config || 'No running configuration available',
        startup_config: backup.startup_config || 'No startup configuration available',
        has_running_config: !!backup.running_config,
        has_startup_config: !!backup.startup_config
      },
      preview: {
        running_config_lines: backup.running_config ? backup.running_config.split('\n').length : 0,
        startup_config_lines: backup.startup_config ? backup.startup_config.split('\n').length : 0,
        running_config_preview: backup.running_config ? backup.running_config.substring(0, 500) + (backup.running_config.length > 500 ? '...' : '') : '',
        startup_config_preview: backup.startup_config ? backup.startup_config.substring(0, 500) + (backup.startup_config.length > 500 ? '...' : '') : ''
      }
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('Error previewing backup:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// GET /api/backups/:id - Get specific backup
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid backup ID format'
      });
    }
    
    const { include_config = 'false' } = req.query;
    
    // Only fetch config fields if explicitly requested
    const projection = include_config === 'true' 
      ? {} 
      : { running_config: 0, startup_config: 0 };
    
    const backup = await ConfigurationBackup.findById(id, projection).lean();
    
    if (!backup) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }
    
    // Get device info and verify ownership
    const device = await Device.findOne({ _id: backup.device_id, userId: req.userId })
      .select('name type ip_address')
      .lean();
    
    // If device not found or doesn't belong to user, return not found
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }
    
    res.json({
      success: true,
      backup: {
        ...backup,
        id: backup._id,
        device_name: device?.name,
        device_type: device?.type,
        ip_address: device?.ip_address
      }
    });
    
  } catch (error) {
    console.error('Error fetching backup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch backup'
    });
  }
});

// POST /api/backups/session - Create backup using existing SSH session (no enable needed)
router.post('/session', async (req, res) => {
  try {
    const { error, value } = createBackupSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
      });
    }
    
    const { device_id, backup_name, description, backup_type, config_type, created_by, tags } = value;
    
    // Get device details and verify ownership
    const device = await Device.findOne({ _id: device_id, userId: req.userId });
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    console.log(`💾 Creating session-based backup for ${device.name}`);
    
    try {
      // Use existing session backup method (no enable command)
      const backupResult = await sshService.optimizedBackup(device, config_type);
      
      if (!backupResult.success) {
        throw new Error('Failed to create session-based backup');
      }
      
      // Calculate hash for duplicate detection
      const configHash = crypto
        .createHash('sha256')
        .update(backupResult.runningConfig)
        .digest('hex');
      
      // Save backup to database
      const backup = new ConfigurationBackup({
        device_id,
        backup_name,
        description,
        running_config: backupResult.runningConfig,
        startup_config: backupResult.startupConfig,
        backup_type,
        config_type: backupResult.configType,
        file_size: backupResult.runningConfigSize + backupResult.startupConfigSize,
        config_hash: configHash,
        created_by: created_by || 'system',
        tags: tags || [],
        userId: req.userId
      });
      
      await backup.save();
      
      res.status(201).json({
        success: true,
        message: 'Session-based backup created successfully (no enable needed)',
        backup: {
          id: backup._id,
          backup_name: backup.backup_name,
          device_name: device.name,
          device_type: device.type,
          device_ip: device.ip_address,
          file_size: backup.file_size,
          session_reused: true,
          use_count: backupResult.useCount,
          config_type: backupResult.configType,
          backup_type: backup_type,
          created_at: backup.createdAt
        }
      });
      
    } catch (backupError) {
      console.error('Session-based backup error:', backupError.message);
      
      let statusCode = 500;
      let userMessage = `Session-based backup failed: ${backupError.message}`;
      
      if (backupError.message.includes('No active SSH session')) {
        userMessage = `No SSH session connected to ${device.name}. Please connect SSH session first from Device Management.`;
        statusCode = 400;
      }
      
      res.status(statusCode).json({
        success: false,
        message: userMessage,
        error: backupError.message,
        device: {
          name: device.name,
          ip_address: device.ip_address
        },
        suggestion: 'Connect SSH session from Device Management page first'
      });
    }
    
  } catch (error) {
    console.error('Error creating session-based backup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create session-based backup'
    });
  }
});

// POST /api/backups/fast - Create fast backup using persistent sessions
router.post('/fast', async (req, res) => {
  try {
    const { error, value } = createBackupSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
      });
    }
    
    const { device_id, backup_name, description, backup_type, created_by, tags } = value;
    
    // Get device details and verify ownership
    const device = await Device.findOne({ _id: device_id, userId: req.userId });
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    console.log(`💾 Creating fast backup for ${device.name}`);
    
    try {
      // Use fast backup method with persistent sessions
      const backupResult = await sshService.fastBackup(device);
      
      if (!backupResult.success) {
        throw new Error('Failed to create fast backup');
      }
      
      // Calculate hash for duplicate detection
      const configHash = crypto
        .createHash('sha256')
        .update(backupResult.runningConfig)
        .digest('hex');
      
      // Save backup to database
      const backup = new ConfigurationBackup({
        device_id,
        backup_name,
        description,
        running_config: backupResult.runningConfig,
        backup_type,
        config_type: 'running-config',
        file_size: backupResult.runningConfigSize,
        config_hash: configHash,
        created_by: created_by || 'system',
        tags: tags || [],
        userId: req.userId
      });
      
      await backup.save();
      
      res.status(201).json({
        success: true,
        message: 'Fast backup created successfully',
        backup: {
          id: backup._id,
          backup_name: backup.backup_name,
          device_name: device.name,
          device_type: device.type,
          device_ip: device.ip_address,
          file_size: backupResult.runningConfigSize,
          session_reused: backupResult.sessionReused,
          backup_type: backup_type,
          created_at: backup.createdAt
        }
      });
      
    } catch (backupError) {
      console.error('Fast backup error:', backupError.message);
      res.status(500).json({
        success: false,
        message: `Fast backup failed: ${backupError.message}`,
        error: backupError.message
      });
    }
    
  } catch (error) {
    console.error('Error creating fast backup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create fast backup'
    });
  }
});

// POST /api/backups - Create new backup
router.post('/', async (req, res) => {
  try {
    const { error, value } = createBackupSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
      });
    }
    
    const { device_id, backup_name, description, backup_type, config_type, created_by, tags } = value;
    
    // Get device details and verify ownership
    const device = await Device.findOne({ _id: device_id, userId: req.userId });
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Create backup using SSH service
    console.log(`💾 Creating backup for ${device.name} (${device.ip_address})`);
    const backupStartTime = Date.now();
    
    try {
      // Check if device has an active SSH session first
      const deviceId = device._id || device.id;
      const sessionKey = `${deviceId}_persistent`;
      const existingSession = sshService.persistentSessions.get(sessionKey);
      const hasActiveSession = existingSession && sshService.isSessionValid(existingSession);
      
      console.log(`⏱️ [TIMING] Session check: ${Date.now() - backupStartTime}ms, hasActiveSession: ${hasActiveSession}`);
      
      let backupResult;
      const sshStartTime = Date.now();
      
      if (hasActiveSession) {
        console.log(`⚡ Using optimized backup (active session)`);
        backupResult = await sshService.optimizedBackup(device, config_type);
      } else {
        console.log(`🐢 Using full backup (no active session)`);
        backupResult = await sshService.createFullBackup(device, { config_type });
      }
      
      console.log(`⏱️ [TIMING] SSH backup completed in ${Date.now() - sshStartTime}ms`)
      
      if (!backupResult.success) {
        throw new Error(`Backup creation failed: ${backupResult.runningError || backupResult.startupError || 'Unknown error'}`);
      }
      
      // Calculate hash for duplicate detection
      const configForHash = backupResult.runningConfig || backupResult.startupConfig || '';
      const configHash = crypto
        .createHash('sha256')
        .update(configForHash)
        .digest('hex');
      
      // Check for duplicate backups
      const dupCheckStart = Date.now();
      const duplicateBackup = await ConfigurationBackup.findOne({
        device_id,
        config_hash: configHash
      });
      console.log(`⏱️ [TIMING] Duplicate check: ${Date.now() - dupCheckStart}ms`);
      
      if (duplicateBackup) {
        return res.status(409).json({
          success: false,
          message: `Duplicate backup detected. Same configuration already exists in backup: ${duplicateBackup.backup_name}`,
          duplicate_backup_id: duplicateBackup._id
        });
      }
      
      // Save backup to database
      const saveStartTime = Date.now();
      const backup = new ConfigurationBackup({
        device_id,
        backup_name,
        description,
        running_config: backupResult.runningConfig,
        startup_config: backupResult.startupConfig,
        backup_type,
        config_type,
        file_size: (backupResult.runningConfigSize || 0) + (backupResult.startupConfigSize || 0),
        config_hash: configHash,
        created_by: created_by || 'system',
        tags: tags || [],
        userId: req.userId
      });
      
      await backup.save();
      console.log(`⏱️ [TIMING] Database save: ${Date.now() - saveStartTime}ms`);
      console.log(`⏱️ [TIMING] Total backup time: ${Date.now() - backupStartTime}ms`);
      
      // Invalidate backup cache for this user
      invalidateCache(CacheKeys.backups(req.userId));
      
      // Don't include the actual config in the response for performance
      const { running_config, startup_config, ...backupResponse } = backup.toObject();
      
      res.status(201).json({
        success: true,
        message: 'Backup created successfully',
        backup: {
          ...backupResponse,
          id: backup._id, // Add id for compatibility
          device_name: device.name,
          device_type: device.type,
          device_ip: device.ip_address,
          config_summary: {
            running_config_size: backupResult.runningConfigSize,
            startup_config_size: backupResult.startupConfigSize,
            has_startup_config: !!backupResult.startupConfig
          }
        }
      });
      
    } catch (backupError) {
      console.error('SSH backup error:', backupError.message);
      
      // Provide more specific error messages based on error type
      let userMessage = 'Failed to create backup';
      let statusCode = 500;
      
      if (backupError.message.includes('timeout')) {
        userMessage = `Backup timeout - device ${device.ip_address} is not responding. Please check device connectivity.`;
        statusCode = 504;
      } else if (backupError.message.includes('Authentication failed') || backupError.message.includes('auth')) {
        userMessage = `Authentication failed for device ${device.name}. Please check username and password.`;
        statusCode = 401;
      } else if (backupError.message.includes('Connection refused') || backupError.message.includes('ECONNREFUSED')) {
        userMessage = `Cannot connect to device ${device.name} at ${device.ip_address}. Device may be offline or SSH is disabled.`;
        statusCode = 503;
      } else if (backupError.message.includes('Host unreachable') || backupError.message.includes('EHOSTUNREACH')) {
        userMessage = `Device ${device.name} at ${device.ip_address} is unreachable. Please check network connectivity.`;
        statusCode = 503;
      } else if (backupError.message.includes('No password set') || backupError.message.includes('Device configuration prevents enable')) {
        userMessage = `Device ${device.name} has no enable password configured. Attempting backup with limited user mode access.`;
        statusCode = 422; // Unprocessable Entity - device config issue
      }
      
      res.status(statusCode).json({
        success: false,
        message: userMessage,
        error: backupError.message,
        device: {
          name: device.name,
          ip_address: device.ip_address,
          type: device.type
        },
        troubleshooting: [
          'Check device connectivity and SSH access',
          'Verify device credentials are correct', 
          'Ensure device is not overloaded or unresponsive',
          'Try using the "Test Backup Connection" button first',
          ...(backupError.message.includes('No password set') ? [
            'DEVICE CONFIGURATION OPTIONS:',
            'Option 1 - Set Enable Password:',
            '  1. SSH manually: ssh admin@' + device.ip_address,
            '  2. configure terminal',
            '  3. enable secret YOUR_PASSWORD',
            '  4. write memory',
            'Option 2 - Allow No Password Enable:',
            '  1. configure terminal', 
            '  2. no enable password',
            '  3. privilege exec level 15 username ' + device.username,
            '  4. write memory'
          ] : [])
        ]
      });
    }
    
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create backup'
    });
  }
});

// POST /api/backups/:id/restore - Restore from backup
router.post('/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    const { restore_type = 'running', create_checkpoint = true } = req.body;
    
    // Validate restore_type
    if (!['running', 'startup', 'both'].includes(restore_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid restore_type. Must be: running, startup, or both',
        valid_options: ['running', 'startup', 'both']
      });
    }
    
    // Get backup and device details
    const backup = await ConfigurationBackup.findById(id);
    
    if (!backup) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }
    
    // Get device and verify ownership
    const device = await Device.findOne({ _id: backup.device_id, userId: req.userId });
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }
    
    try {
      // Create a pre-restore checkpoint if requested
      let checkpointId = null;
      if (create_checkpoint) {
        try {
          const checkpointResult = await sshService.createFullBackup(device);
          if (checkpointResult.success) {
            const checkpointHash = crypto
              .createHash('sha256')
              .update(checkpointResult.runningConfig)
              .digest('hex');
            
            const checkpoint = new ConfigurationBackup({
              device_id: device._id,
              backup_name: `Pre-restore checkpoint - ${new Date().toISOString()}`,
              description: `Automatic checkpoint before restoring backup: ${backup.backup_name}`,
              running_config: checkpointResult.runningConfig,
              startup_config: checkpointResult.startupConfig,
              backup_type: 'manual',
              file_size: checkpointResult.runningConfigSize + checkpointResult.startupConfigSize,
              config_hash: checkpointHash,
              created_by: 'system',
              is_restore_point: true,
              userId: req.userId
            });
            
            await checkpoint.save();
            checkpointId = checkpoint._id;
          }
        } catch (checkpointError) {
          // Non-fatal: continue with restore even if checkpoint fails
        }
      }
      
      // Determine which configuration to restore based on restore_type
      let configToRestore = '';
      let configSource = '';
      
      if (restore_type === 'startup') {
        if (!backup.startup_config) {
          return res.status(400).json({
            success: false,
            message: 'Startup configuration not available in this backup'
          });
        }
        configToRestore = backup.startup_config;
        configSource = 'startup';
      } else if (restore_type === 'running') {
        if (!backup.running_config) {
          return res.status(400).json({
            success: false,
            message: 'Running configuration not available in this backup'
          });
        }
        configToRestore = backup.running_config;
        configSource = 'running';
      } else if (restore_type === 'both') {
        // For both, prioritize running config, fallback to startup
        if (backup.running_config) {
          configToRestore = backup.running_config;
          configSource = 'running';
        } else if (backup.startup_config) {
          configToRestore = backup.startup_config;
          configSource = 'startup';
        } else {
          return res.status(400).json({
            success: false,
            message: 'No configuration available in this backup'
          });
        }
      }
      
      const restoreResult = await sshService.applyConfigurationFromBackup(device, configToRestore);
      
      if (!restoreResult.success) {
        throw new Error('Failed to restore configuration');
      }
      
      // Find and mark the last deployed configuration as rolled_back
      const lastDeployedConfig = await ConfigurationHistory.findOne({
        device_id: device._id,
        status: 'deployed'
      }).sort({ deployed_at: -1 });
      
      // Record the restore operation in configuration history
      const configHistory = new ConfigurationHistory({
        device_id: device._id,
        userId: req.userId,
        prompt: `Configuration restored from backup: ${backup.backup_name}`,
        generated_config: configToRestore,
        deployed_config: restoreResult.output,
        status: 'deployed',
        ai_model: 'backup_restore',
        execution_time: 0,
        deployed_at: Date.now(),
        restored_from: backup._id, // Track which backup this was restored from
        restored_from_config: lastDeployedConfig?._id // Track which config was rolled back
      });
      
      await configHistory.save();
      
      // Mark the previous configuration as rolled_back (if exists)
      if (lastDeployedConfig) {
        lastDeployedConfig.status = 'rolled_back';
        lastDeployedConfig.rolled_back_at = Date.now();
        lastDeployedConfig.rolled_back_by = configHistory._id;
        lastDeployedConfig.rollback_reason = `Rolled back by restoring backup: ${backup.backup_name}`;
        await lastDeployedConfig.save();
        console.log(`📜 Marked previous config ${lastDeployedConfig._id} as rolled_back`);
      }
      
      console.log(`✅ Configuration restored from backup: ${backup.backup_name}`);
      
      res.json({
        success: true,
        message: `Configuration restored successfully from ${configSource} backup`,
        restore_details: {
          backup_name: backup.backup_name,
          restore_type: restore_type,
          config_source: configSource,
          config_size: configToRestore.length,
          checkpoint_created: !!checkpointId,
          checkpoint_id: checkpointId,
          device_name: device.name,
          device_ip: device.ip_address,
          restored_at: new Date().toISOString(),
          session_reused: restoreResult.sessionReused || false,
          command_count: restoreResult.commandCount || 0,
          rolled_back_config_id: lastDeployedConfig?._id || null,
          new_config_id: configHistory._id
        },
        output: restoreResult.output
      });
      
    } catch (restoreError) {
      console.error('Configuration restore error:', restoreError.message);
      
      // Provide specific error messages based on error type
      let userMessage = 'Failed to restore configuration';
      let statusCode = 500;
      
      if (restoreError.message.includes('No active SSH session')) {
        userMessage = `No SSH session connected to ${device.name}. Please connect SSH session first from Device Management.`;
        statusCode = 400;
      } else if (restoreError.message.includes('timeout')) {
        userMessage = `Restore timeout - device ${device.ip_address} is not responding during configuration restore.`;
        statusCode = 504;
      } else if (restoreError.message.includes('Authentication failed')) {
        userMessage = `Authentication failed during restore to device ${device.name}. Please check credentials.`;
        statusCode = 401;
      } else if (restoreError.message.includes('Connection refused')) {
        userMessage = `Cannot connect to device ${device.name} for restore. Device may be offline.`;
        statusCode = 503;
      }
      
      res.status(statusCode).json({
        success: false,
        message: userMessage,
        error: restoreError.message,
        device: {
          name: device.name,
          ip_address: device.ip_address,
          type: device.type
        },
        troubleshooting: [
          'Ensure SSH session is connected to the device',
          'Check device connectivity and SSH access',
          'Verify device is not in configuration mode',
          'Try connecting SSH session from Device Management first'
        ]
      });
    }
    
  } catch (error) {
    console.error('Error restoring backup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restore backup'
    });
  }
});

// DELETE /api/backups/:id - Delete backup
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if backup exists and is not a restore point
    const backup = await ConfigurationBackup.findById(id).select('backup_name is_restore_point device_id');
    
    if (!backup) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }
    
    // Verify the device belongs to the user
    const device = await Device.findOne({ _id: backup.device_id, userId: req.userId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }
    
    if (backup.is_restore_point) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete restore point backups'
      });
    }
    
    await ConfigurationBackup.findByIdAndDelete(id);
    
    // Invalidate backup cache for this user
    invalidateCache(CacheKeys.backups(req.userId));
    
    res.json({
      success: true,
      message: 'Backup deleted successfully',
      deleted_backup: backup.backup_name
    });
    
  } catch (error) {
    console.error('Error deleting backup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete backup'
    });
  }
});

// GET /api/backups/device/:device_id - Get backups for specific device
router.get('/device/:device_id', async (req, res) => {
  try {
    const { device_id } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    // Verify device belongs to user
    const device = await Device.findOne({ _id: device_id, userId: req.userId }).select('name type').lean();
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Get backups for the device
    const backups = await ConfigurationBackup.find({ device_id })
      .select('-running_config -startup_config') // Exclude large fields
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();
    
    const enhancedBackups = backups.map(backup => ({
      ...backup,
      id: backup._id,
      device_name: device?.name,
      device_type: device?.type
    }));
    
    res.json({
      success: true,
      backups: enhancedBackups
    });
    
  } catch (error) {
    console.error('Error fetching device backups:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch device backups'
    });
  }
});

// POST /api/backups/:id/set-restore-point - Mark backup as restore point
router.post('/:id/set-restore-point', async (req, res) => {
  try {
    const { id } = req.params;
    
    // First get the backup to verify ownership
    const existingBackup = await ConfigurationBackup.findById(id).select('device_id');
    
    if (!existingBackup) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }
    
    // Verify the device belongs to the user
    const device = await Device.findOne({ _id: existingBackup.device_id, userId: req.userId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }
    
    const backup = await ConfigurationBackup.findByIdAndUpdate(
      id,
      { is_restore_point: true },
      { new: true }
    ).select('backup_name');
    
    if (!backup) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Backup marked as restore point',
      backup_name: backup.backup_name
    });
    
  } catch (error) {
    console.error('Error setting restore point:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set restore point'
    });
  }
});

// GET /api/backups/enable-test/:device_id - Test enable command specifically
router.get('/enable-test/:device_id', async (req, res) => {
  try {
    const { device_id } = req.params;
    
    // Get device details and verify ownership
    const device = await Device.findOne({ _id: device_id, userId: req.userId });
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    console.log(`🔍 Testing enable command for ${device.name}`);
    
    try {
      // Test just the enable command
      const enableResult = await sshService.executeCommand(device, 'show privilege');
      
      res.json({
        success: true,
        device: {
          name: device.name,
          ip_address: device.ip_address,
          has_enable_password: !!device.enable_password
        },
        enable_test: {
          success: enableResult.success,
          output: enableResult.output,
          privilege_level: enableResult.output.match(/Current privilege level is (\d+)/)?.[1] || 'unknown'
        },
        troubleshooting: [
          'If privilege level is 1, enable command failed',
          'If privilege level is 15, enable command succeeded',
          'Check if enable password is set on device',
          'Verify enable password in device configuration'
        ]
      });
      
    } catch (enableError) {
      res.status(500).json({
        success: false,
        message: 'Enable test failed',
        error: enableError.message,
        device: {
          name: device.name,
          ip_address: device.ip_address
        }
      });
    }
    
  } catch (error) {
    console.error('Enable test error:', error);
    res.status(500).json({
      success: false,
      message: 'Enable test failed',
      error: error.message
    });
  }
});

// GET /api/backups/ssh-debug/:device_id - Debug SSH connection issues
router.get('/ssh-debug/:device_id', async (req, res) => {
  try {
    const { device_id } = req.params;
    
    // Get device details and verify ownership
    const device = await Device.findOne({ _id: device_id, userId: req.userId });
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    console.log(`🔍 SSH Debug for ${device.name}`);
    
    // Test connection with detailed logging
    const connectionResult = await sshService.testConnection(device);
    
    // If full test fails, try basic connection
    let basicConnectionResult = null;
    if (!connectionResult.success) {
      basicConnectionResult = await sshService.testBasicConnection(device);
    }
    
    res.json({
      success: true,
      device: {
        name: device.name,
        ip_address: device.ip_address,
        type: device.type,
        ssh_port: device.ssh_port || 22
      },
      connection_test: connectionResult,
      basic_connection_test: basicConnectionResult,
      ssh_config: {
        supported_algorithms: {
          kex: [
            'diffie-hellman-group1-sha1',
            'diffie-hellman-group14-sha1', 
            'diffie-hellman-group-exchange-sha1',
            'diffie-hellman-group-exchange-sha256',
            'diffie-hellman-group14-sha256'
          ],
          cipher: ['aes128-ctr', 'aes128-cbc', 'aes256-cbc', '3des-cbc'],
          hmac: ['hmac-sha1', 'hmac-sha2-256', 'hmac-md5'],
          serverHostKey: ['ssh-rsa', 'ssh-dss']
        }
      },
      troubleshooting: [
        'If connection fails with "no matching key exchange algorithm":',
        '1. Device may be using very old SSH algorithms',
        '2. Try enabling SSH version 2 on the device: "ip ssh version 2"',
        '3. Check if SSH is enabled: "ip ssh"',
        '4. Verify management IP is reachable',
        '5. Check if device supports newer algorithms'
      ]
    });
    
  } catch (error) {
    console.error('SSH debug error:', error);
    res.status(500).json({
      success: false,
      message: 'SSH debug failed',
      error: error.message
    });
  }
});

// GET /api/backups/test/:device_id - Test backup configuration retrieval
router.get('/test/:device_id', async (req, res) => {
  try {
    const { device_id } = req.params;
    
    // Get device details and verify ownership
    const device = await Device.findOne({ _id: device_id, userId: req.userId });
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    console.log(`🧪 Testing backup for ${device.name}`);
    
    try {
      // Test connection first
      const connectionTest = await sshService.testConnection(device);
      
      if (!connectionTest.success) {
        return res.json({
          success: false,
          message: 'Connection test failed',
          error: connectionTest.message,
          device_name: device.name,
          device_ip: device.ip_address
        });
      }
      
      // Test running config retrieval
      const runningConfigResult = await sshService.getRunningConfig(device);
      
      // Test startup config retrieval (optional, might fail on some devices)
      let startupConfigResult = null;
      try {
        startupConfigResult = await sshService.getStartupConfig(device);
      } catch (startupError) {
        startupConfigResult = { 
          success: false, 
          error: startupError.message,
          config: null,
          size: 0 
        };
      }
      
      res.json({
        success: true,
        message: 'Backup test completed successfully',
        test_results: {
          connection: {
            success: true,
            message: connectionTest.message,
            device_type: connectionTest.deviceType,
            requires_enable: connectionTest.requiresEnable || false
          },
          running_config: {
            success: runningConfigResult.success,
            size: runningConfigResult.size,
            length: runningConfigResult.config.length,
            preview: runningConfigResult.config.substring(0, 300) + '...',
            has_version: runningConfigResult.config.includes('version'),
            has_hostname: runningConfigResult.config.includes('hostname'),
            has_interfaces: runningConfigResult.config.includes('interface'),
            line_count: runningConfigResult.config.split('\n').length
          },
          startup_config: startupConfigResult ? {
            success: startupConfigResult.success,
            size: startupConfigResult.size || 0,
            length: startupConfigResult.config ? startupConfigResult.config.length : 0,
            preview: startupConfigResult.config ? 
              startupConfigResult.config.substring(0, 300) + '...' : 
              'Not available',
            error: startupConfigResult.error || null
          } : null
        },
        device_info: {
          name: device.name,
          type: device.type,
          ip_address: device.ip_address,
          model: device.model
        },
        summary: {
          total_config_size: runningConfigResult.size + (startupConfigResult?.size || 0),
          running_config_lines: runningConfigResult.config.split('\n').length,
          startup_available: startupConfigResult?.success || false
        }
      });
      
    } catch (backupError) {
      console.error('Backup test error:', backupError.message);
      res.status(500).json({
        success: false,
        message: 'Backup test failed',
        error: backupError.message,
        device_name: device.name,
        device_ip: device.ip_address
      });
    }
    
  } catch (error) {
    console.error('Error running backup test:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run backup test'
    });
  }
});

// ============================================
// BACKUP SCHEDULE MANAGEMENT ROUTES
// ============================================

// POST /api/backups/schedules - Create new backup schedule (and run immediate backup)
router.post('/schedules', async (req, res) => {
  try {
    const {
      name,
      description,
      device_ids,
      schedule_type = 'manual',
      backup_type = 'running-config',
      enabled = true
    } = req.body;

    if (!name || !device_ids || device_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Schedule name and at least one device are required'
      });
    }

    // Verify all devices belong to the user
    const userDevices = await Device.find({ _id: { $in: device_ids }, userId: req.userId }).select('_id');
    const userDeviceIds = userDevices.map(d => d._id.toString());
    const invalidDevices = device_ids.filter(id => !userDeviceIds.includes(id.toString()));
    
    if (invalidDevices.length > 0) {
      return res.status(404).json({
        success: false,
        message: 'One or more devices not found'
      });
    }

    // Create schedule
    const schedule = new BackupSchedule({
      name,
      description,
      device_ids,
      schedule_type,
      backup_type,
      enabled,
      created_by: 'user',
      userId: req.userId
    });

    await schedule.save();
    console.log(`📅 Backup schedule created: ${name}`);

    // Run immediate backup for all devices in schedule
    console.log(`⚡ Running immediate backup for ${device_ids.length} device(s)...`);
    const backupResults = [];

    for (const device_id of device_ids) {
      try {
        const device = await Device.findById(device_id);
        if (!device) {
          console.warn(`⚠️ Device ${device_id} not found, skipping...`);
          continue;
        }

        console.log(`💾 Backing up ${device.name}...`);
        const backupResult = await sshService.createFullBackup(device);

        if (backupResult.success) {
          const configHash = crypto
            .createHash('sha256')
            .update(backupResult.runningConfig || '')
            .digest('hex');

          const backup = new ConfigurationBackup({
            device_id: device._id,
            backup_name: `${name} - Initial - ${device.name}`,
            description: description || `Initial backup for schedule: ${name}`,
            running_config: backupResult.runningConfig,
            startup_config: backupResult.startupConfig,
            backup_type: 'scheduled',
            config_type: backup_type,
            file_size: (backupResult.runningConfigSize || 0) + (backupResult.startupConfigSize || 0),
            config_hash: configHash,
            created_by: 'schedule',
            tags: ['scheduled', 'initial', schedule._id.toString()],
            userId: req.userId
          });

          await backup.save();
          backupResults.push({
            device_id: device._id,
            device_name: device.name,
            backup_id: backup._id,
            success: true
          });

          // Update schedule with last backup info
          schedule.last_run = new Date();
          schedule.last_status = 'success';
          schedule.last_backup_id = backup._id;
        } else {
          backupResults.push({
            device_id: device._id,
            device_name: device.name,
            success: false,
            error: backupResult.error || 'Backup failed'
          });
        }
      } catch (deviceError) {
        console.error(`❌ Backup failed for device ${device_id}:`, deviceError.message);
        backupResults.push({
          device_id,
          success: false,
          error: deviceError.message
        });
      }
    }

    await schedule.save();

    const successCount = backupResults.filter(r => r.success).length;
    const failCount = backupResults.length - successCount;

    res.status(201).json({
      success: true,
      message: `Schedule created and immediate backup completed (${successCount} success, ${failCount} failed)`,
      schedule: {
        id: schedule._id,
        name: schedule.name,
        description: schedule.description,
        device_count: device_ids.length,
        schedule_type: schedule.schedule_type,
        backup_type: schedule.backup_type,
        enabled: schedule.enabled,
        last_run: schedule.last_run,
        last_status: schedule.last_status
      },
      backup_results: backupResults
    });

  } catch (error) {
    console.error('Error creating backup schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create backup schedule',
      error: error.message
    });
  }
});

// DELETE /api/backups/schedules/:id - Delete backup schedule
router.delete('/schedules/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Only delete if schedule belongs to user
    const schedule = await BackupSchedule.findOneAndDelete({ _id: id, userId: req.userId });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Backup schedule not found'
      });
    }

    res.json({
      success: true,
      message: 'Backup schedule deleted successfully',
      deleted_schedule: schedule.name
    });

  } catch (error) {
    console.error('Error deleting backup schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete backup schedule'
    });
  }
});

// POST /api/backups/schedules/:id/trigger - Manually trigger a scheduled backup
router.post('/schedules/:id/trigger', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify schedule belongs to user before triggering
    const schedule = await BackupSchedule.findOne({ _id: id, userId: req.userId });
    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Backup schedule not found'
      });
    }

    const result = await backupScheduler.triggerSchedule(id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Error triggering backup schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger backup schedule',
      error: error.message
    });
  }
});

// POST /api/backups/custom - Create backup with custom name and description (for post-deploy popup)
router.post('/custom', async (req, res) => {
  try {
    const {
      device_id,
      backup_name,
      description,
      backup_type = 'running-config'
    } = req.body;

    if (!device_id || !backup_name) {
      return res.status(400).json({
        success: false,
        message: 'Device ID and backup name are required'
      });
    }

    // Get device and verify ownership
    const device = await Device.findOne({ _id: device_id, userId: req.userId });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    console.log(`💾 Creating custom backup "${backup_name}" for ${device.name}...`);

    const backupResult = await sshService.createFullBackup(device);

    if (!backupResult.success) {
      throw new Error('Failed to create backup');
    }

    const configHash = crypto
      .createHash('sha256')
      .update(backupResult.runningConfig || '')
      .digest('hex');

    const backup = new ConfigurationBackup({
      device_id: device._id,
      backup_name,
      description: description || '',
      running_config: backupResult.runningConfig,
      startup_config: backup_type === 'both' ? backupResult.startupConfig : null,
      backup_type: 'manual',
      config_type: backup_type,
      file_size: (backupResult.runningConfigSize || 0) + (backup_type === 'both' ? backupResult.startupConfigSize || 0 : 0),
      config_hash: configHash,
      created_by: 'user',
      tags: ['post-deploy', 'custom'],
      userId: req.userId
    });

    await backup.save();

    res.status(201).json({
      success: true,
      message: 'Custom backup created successfully',
      backup: {
        id: backup._id,
        backup_name: backup.backup_name,
        description: backup.description,
        device_name: device.name,
        device_type: device.type,
        file_size: backup.file_size,
        backup_type: backup.backup_type,
        config_type: backup.config_type,
        created_at: backup.createdAt
      }
    });

  } catch (error) {
    console.error('Error creating custom backup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create custom backup',
      error: error.message
    });
  }
});

// POST /api/backups/post-deploy-schedule - Create post-deployment backup schedule with device selection
// This creates a subscription for auto-backup after config deployment
router.post('/post-deploy-schedule', async (req, res) => {
  try {
    const {
      name,
      description,
      device_ids,
      backup_type = 'running-config',
      enabled = true,
      create_initial_backup = true  // New: option to create first backup immediately
    } = req.body;

    if (!name || !device_ids || device_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Schedule name and at least one device are required'
      });
    }

    // Validate all device IDs belong to the user
    const devices = await Device.find({ _id: { $in: device_ids }, userId: req.userId })
      .select('_id name type ip_address username password enable_password ssh_port')
      .lean();
    
    if (devices.length !== device_ids.length) {
      return res.status(404).json({
        success: false,
        message: 'One or more devices not found'
      });
    }

    // Create post-deployment backup schedule (subscription)
    const schedule = new BackupSchedule({
      name,
      description: description || `Auto-backup subscription: ${name}`,
      device_ids,
      schedule_type: 'post-deploy',
      backup_type,
      enabled,
      created_by: 'user',
      trigger_on_deploy: true,  // Always true for post-deploy schedules
      userId: req.userId
    });

    await schedule.save();
    console.log(`📅 Post-deployment subscription created: ${name}`);

    // Create initial backup for all devices if requested
    const backupResults = [];
    
    if (create_initial_backup) {
      console.log(`⚡ Creating initial backup for ${devices.length} subscribed device(s)...`);
      
      for (const device of devices) {
        try {
          console.log(`💾 Initial backup for ${device.name}...`);
          const backupResult = await sshService.createFullBackup(device);

          if (backupResult.success) {
            const configHash = crypto
              .createHash('sha256')
              .update(backupResult.runningConfig || '')
              .digest('hex');

            const backup = new ConfigurationBackup({
              device_id: device._id,
              backup_name: `${name} - Initial Backup - ${device.name}`,
              description: `Initial backup when subscribing to: ${name}`,
              running_config: backupResult.runningConfig,
              startup_config: backupResult.startupConfig,
              backup_type: 'scheduled',
              config_type: backup_type,
              file_size: (backupResult.runningConfigSize || 0) + (backupResult.startupConfigSize || 0),
              config_hash: configHash,
              created_by: 'subscription',
              tags: ['subscription', 'initial', 'auto-backup', schedule._id.toString()],
              userId: req.userId
            });

            await backup.save();
            backupResults.push({
              device_id: device._id,
              device_name: device.name,
              backup_id: backup._id,
              success: true
            });

            console.log(`✅ Initial backup created for ${device.name}`);
          } else {
            backupResults.push({
              device_id: device._id,
              device_name: device.name,
              success: false,
              error: backupResult.error || 'Backup failed'
            });
            console.log(`❌ Initial backup failed for ${device.name}: ${backupResult.error}`);
          }
        } catch (deviceError) {
          console.error(`❌ Initial backup failed for ${device.name}:`, deviceError.message);
          backupResults.push({
            device_id: device._id,
            device_name: device.name,
            success: false,
            error: deviceError.message
          });
        }
      }

      // Update schedule status based on initial backup results
      const successCount = backupResults.filter(r => r.success).length;
      if (successCount > 0) {
        const lastSuccessful = backupResults.find(r => r.success);
        schedule.last_run = new Date();
        schedule.last_status = successCount === devices.length ? 'success' : 'pending';
        schedule.last_backup_id = lastSuccessful?.backup_id;
        await schedule.save();
      }
    }

    const successCount = backupResults.filter(r => r.success).length;
    const failCount = backupResults.length - successCount;

    res.status(201).json({
      success: true,
      message: create_initial_backup 
        ? `Subscription created with initial backup (${successCount} success, ${failCount} failed)`
        : `Subscription created for ${device_ids.length} devices`,
      schedule: {
        id: schedule._id,
        name: schedule.name,
        description: schedule.description,
        device_count: device_ids.length,
        devices: devices.map(d => ({
          id: d._id,
          name: d.name,
          type: d.type,
          ip_address: d.ip_address
        })),
        schedule_type: schedule.schedule_type,
        backup_type: schedule.backup_type,
        enabled: schedule.enabled,
        trigger_on_deploy: schedule.trigger_on_deploy,
        last_run: schedule.last_run,
        last_status: schedule.last_status,
        created_at: schedule.createdAt
      },
      initial_backup_results: create_initial_backup ? backupResults : null,
      summary: create_initial_backup ? {
        total: devices.length,
        successful: successCount,
        failed: failCount
      } : null
    });

  } catch (error) {
    console.error('Error creating post-deployment subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create backup subscription',
      error: error.message
    });
  }
});

export default router;

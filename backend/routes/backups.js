import express from 'express';
import Joi from 'joi';
import crypto from 'crypto';
import Device from '../models/Device.js';
import ConfigurationBackup from '../models/ConfigurationBackup.js';
import ConfigurationHistory from '../models/ConfigurationHistory.js';
import sshService from '../services/sshService.js';

const router = express.Router();

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
      sort_order = 'desc'
    } = req.query;
    
    // Build filter
    const filter = {};
    if (device_id) filter.device_id = device_id;
    if (backup_type) filter.backup_type = backup_type;
    
    // Build sort object
    const allowedSortFields = ['created_at', 'backup_name', 'file_size'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_order.toLowerCase() === 'asc' ? 1 : -1;
    const sortObj = { [sortField]: sortDirection };
    
    // Get backups with pagination
    const backups = await ConfigurationBackup.find(filter)
      .sort(sortObj)
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();
    
    // Get total count for pagination
    const total = await ConfigurationBackup.countDocuments(filter);
    
    // Enhance backups with device info
    const enhancedBackups = await Promise.all(
      backups.map(async (backup) => {
        const device = await Device.findById(backup.device_id).select('name type ip_address').lean();
        return {
          ...backup,
          id: backup._id, // Add id for compatibility
          device_name: device?.name,
          device_type: device?.type,
          ip_address: device?.ip_address
        };
      })
    );
    
    res.json({
      success: true,
      backups: enhancedBackups,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total
      }
    });
    
  } catch (error) {
    console.error('Error fetching backups:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch backups'
    });
  }
});

// GET /api/backups/:id/preview - Preview backup configuration content
router.get('/:id/preview', async (req, res) => {
  try {
    console.log('🔍 PREVIEW ENDPOINT HIT - Route params:', req.params);
    console.log('🔍 PREVIEW ENDPOINT HIT - Full URL:', req.url);
    
    const { id } = req.params;
    
    console.log(`🔍 Previewing backup configuration: ${id}`);
    
    // Get backup details
    const backup = await ConfigurationBackup.findById(id);
    
    if (!backup) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }
    
    console.log(`📋 Found backup: ${backup.backup_name} (${backup.file_size} bytes)`);
    
    try {
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
      
      console.log(`✅ Preview generated successfully - Running: ${response.preview.running_config_lines} lines, Startup: ${response.preview.startup_config_lines} lines`);
      
      res.json(response);
      
    } catch (configError) {
      console.error('❌ Error reading backup configuration:', configError);
      res.status(500).json({
        success: false,
        message: 'Failed to read backup configuration',
        error: configError.message
      });
    }
    
  } catch (error) {
    console.error('❌ Error previewing backup:', error);
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
    const { include_config = 'false' } = req.query;
    
    const backup = await ConfigurationBackup.findById(id).lean();
    
    if (!backup) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }
    
    // Get device info
    const device = await Device.findById(backup.device_id).select('name type ip_address').lean();
    
    const backupResponse = {
      ...backup,
      id: backup._id, // Add id for compatibility
      device_name: device?.name,
      device_type: device?.type,
      ip_address: device?.ip_address
    };
    
    // Remove config data if not requested
    if (include_config !== 'true') {
      delete backupResponse.running_config;
      delete backupResponse.startup_config;
    }
    
    res.json({
      success: true,
      backup: backupResponse
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
    
    const { device_id, backup_name, description, backup_type, created_by, tags } = value;
    
    // Get device details
    const device = await Device.findById(device_id);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    console.log(`🔗 Starting session-based backup for device ${device.name} (${device.ip_address})`);
    
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
        tags: tags || []
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
    
    // Get device details
    const device = await Device.findById(device_id);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    console.log(`⚡ Starting fast backup for device ${device.name} (${device.ip_address})`);
    
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
        tags: tags || []
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
    
    // Get device details
    const device = await Device.findById(device_id);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Create backup using SSH service
    console.log(`🚀 Starting backup creation for device ${device.name} (${device.ip_address})`);
    
    try {
      // Check if device has an active SSH session first
      const deviceId = device._id || device.id;
      const sessionKey = `${deviceId}_persistent`;
      const existingSession = sshService.persistentSessions.get(sessionKey);
      const hasActiveSession = existingSession && sshService.isSessionValid(existingSession);
      
      let backupResult;
      
      if (hasActiveSession) {
        console.log(`🔗 Using existing SSH session for backup (no enable needed)`);
        backupResult = await sshService.optimizedBackup(device, config_type);
      } else {
        console.log(`🔄 No active session found, using traditional backup method`);
        backupResult = await sshService.createFullBackup(device, { config_type });
      }
      
      if (!backupResult.success) {
        console.error(`❌ Backup creation failed for ${device.name}:`, {
          runningError: backupResult.runningError,
          startupError: backupResult.startupError,
          device: device.name,
          ip: device.ip_address,
          sessionUsed: hasActiveSession
        });
        throw new Error(`Backup creation failed: ${backupResult.runningError || backupResult.startupError || 'Unknown error'}`);
      }
      
      // Calculate hash for duplicate detection
      const configForHash = backupResult.runningConfig || backupResult.startupConfig || '';
      const configHash = crypto
        .createHash('sha256')
        .update(configForHash)
        .digest('hex');
      
      // Check for duplicate backups
      const duplicateBackup = await ConfigurationBackup.findOne({
        device_id,
        config_hash: configHash
      });
      
      if (duplicateBackup) {
        return res.status(409).json({
          success: false,
          message: `Duplicate backup detected. Same configuration already exists in backup: ${duplicateBackup.backup_name}`,
          duplicate_backup_id: duplicateBackup._id
        });
      }
      
      // Save backup to database
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
        tags: tags || []
      });
      
      await backup.save();
      
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
    
    console.log(`🔄 Restore request received:`, {
      backup_id: id,
      body: req.body,
      restore_type: req.body.restore_type,
      create_checkpoint: req.body.create_checkpoint
    });
    
    const { error, value } = restoreBackupSchema.validate(req.body);
    
    if (error) {
      console.error('❌ Restore validation error:', error.details);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details,
        received_data: req.body
      });
    }
    
    const { restore_type, create_checkpoint } = value;
    
    // Get backup and device details
    const backup = await ConfigurationBackup.findById(id);
    
    if (!backup) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }
    
    const device = await Device.findById(backup.device_id);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
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
              is_restore_point: true
            });
            
            await checkpoint.save();
            checkpointId = checkpoint._id;
            console.log(`✅ Pre-restore checkpoint created with ID: ${checkpointId}`);
          }
        } catch (checkpointError) {
          console.warn('⚠️ Failed to create pre-restore checkpoint:', checkpointError.message);
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
      
      console.log(`🔄 Restoring ${configSource} configuration (${configToRestore.length} chars) to ${device.name}`);
      
      const restoreResult = await sshService.applyConfigurationFromBackup(device, configToRestore);
      
      if (!restoreResult.success) {
        throw new Error('Failed to restore configuration');
      }
      
      // Record the restore operation in configuration history
      const configHistory = new ConfigurationHistory({
        device_id: device._id,
        prompt: `Configuration restored from backup: ${backup.backup_name}`,
        generated_config: configToRestore,
        applied_config: restoreResult.output,
        status: 'applied',
        ai_model: 'backup_restore',
        execution_time: 0,
                  applied_at: Date.now()
      });
      
      await configHistory.save();
      
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
          command_count: restoreResult.commandCount || 0
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
    const backup = await ConfigurationBackup.findById(id).select('backup_name is_restore_point');
    
    if (!backup) {
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
    
    const backups = await ConfigurationBackup.find({ device_id })
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();
    
    // Get device info
    const device = await Device.findById(device_id).select('name type').lean();
    
    const enhancedBackups = backups.map(backup => ({
      ...backup,
      id: backup._id, // Add id for compatibility
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
    
    // Get device details
    const device = await Device.findById(device_id);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    console.log(`🔍 Testing enable command for ${device.name} (${device.ip_address})`);
    
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
    
    // Get device details
    const device = await Device.findById(device_id);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    console.log(`🔍 SSH Debug for ${device.name} (${device.ip_address})`);
    
    // Test connection with detailed logging
    const connectionResult = await sshService.testConnection(device);
    
    // If full test fails, try basic connection
    let basicConnectionResult = null;
    if (!connectionResult.success) {
      console.log(`🔄 Full test failed, trying basic connection...`);
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
    
    // Get device details
    const device = await Device.findById(device_id);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    console.log(`🧪 Testing backup configuration retrieval for ${device.name} (${device.ip_address})`);
    
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
        console.warn(`⚠️ Startup config retrieval failed (this is normal for some devices): ${startupError.message}`);
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
          model: device.model,
          ios_version: device.ios_version
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

export default router; 
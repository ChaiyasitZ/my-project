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
  backup_type: Joi.string().valid('manual', 'scheduled', 'pre_change').default('manual'),
  created_by: Joi.string().max(255).allow(''),
  tags: Joi.array().items(Joi.string()).optional()
});

const restoreBackupSchema = Joi.object({
  backup_id: Joi.string().required(),
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
    
    const { device_id, backup_name, description, backup_type, created_by, tags } = value;
    
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
      const backupResult = await sshService.createFullBackup(device);
      
      if (!backupResult.success) {
        throw new Error('Failed to create backup');
      }
      
      // Calculate hash for duplicate detection
      const configHash = crypto
        .createHash('sha256')
        .update(backupResult.runningConfig)
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
        file_size: backupResult.runningConfigSize + backupResult.startupConfigSize,
        config_hash: configHash,
        created_by,
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
      res.status(500).json({
        success: false,
        message: 'Failed to create backup',
        error: backupError.message
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
    const { error, value } = restoreBackupSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
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
              backup_type: 'pre_change',
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
      
      // Apply the backup configuration
      const configToRestore = restore_type === 'startup' ? backup.startup_config : backup.running_config;
      
      if (!configToRestore) {
        return res.status(400).json({
          success: false,
          message: `${restore_type} configuration not available in this backup`
        });
      }
      
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
        applied_at: new Date()
      });
      
      await configHistory.save();
      
      res.json({
        success: true,
        message: 'Configuration restored successfully',
        restore_details: {
          backup_name: backup.backup_name,
          restore_type: restore_type,
          checkpoint_created: !!checkpointId,
          checkpoint_id: checkpointId,
          device_name: device.name,
          device_ip: device.ip_address,
          restored_at: new Date().toISOString()
        },
        output: restoreResult.output
      });
      
    } catch (restoreError) {
      console.error('Configuration restore error:', restoreError.message);
      res.status(500).json({
        success: false,
        message: 'Failed to restore configuration',
        error: restoreError.message
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

export default router; 
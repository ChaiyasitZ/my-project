import express from 'express';
import Joi from 'joi';
import crypto from 'crypto';
import { query } from '../lib/database.js';
import sshService from '../services/sshService.js';

const router = express.Router();

// Validation schemas
const createBackupSchema = Joi.object({
  device_id: Joi.number().integer().required(),
  backup_name: Joi.string().required().min(1).max(255),
  description: Joi.string().max(1000).allow(''),
  backup_type: Joi.string().valid('manual', 'scheduled', 'pre_change').default('manual'),
  created_by: Joi.string().max(255).allow(''),
  tags: Joi.array().items(Joi.string()).optional()
});

const restoreBackupSchema = Joi.object({
  backup_id: Joi.number().integer().required(),
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
    
    let queryText = `
      SELECT cb.*, d.name as device_name, d.type as device_type, d.ip_address
      FROM configuration_backups cb
      JOIN devices d ON cb.device_id = d.id
      WHERE 1=1
    `;
    const queryParams = [];
    
    if (device_id) {
      queryParams.push(device_id);
      queryText += ` AND cb.device_id = $${queryParams.length}`;
    }
    
    if (backup_type) {
      queryParams.push(backup_type);
      queryText += ` AND cb.backup_type = $${queryParams.length}`;
    }
    
    // Add sorting
    const allowedSortFields = ['created_at', 'backup_name', 'file_size'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    queryParams.push(limit, offset);
    queryText += ` ORDER BY cb.${sortField} ${sortDirection} LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`;
    
    const result = await query(queryText, queryParams);
    
    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM configuration_backups cb
      JOIN devices d ON cb.device_id = d.id
      WHERE 1=1
    `;
    const countParams = [];
    
    if (device_id) {
      countParams.push(device_id);
      countQuery += ` AND cb.device_id = $${countParams.length}`;
    }
    
    if (backup_type) {
      countParams.push(backup_type);
      countQuery += ` AND cb.backup_type = $${countParams.length}`;
    }
    
    const countResult = await query(countQuery, countParams);
    
    res.json({
      success: true,
      backups: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < parseInt(countResult.rows[0].total)
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
    
    let selectFields = `
      cb.id, cb.device_id, cb.backup_name, cb.description, cb.backup_type,
      cb.file_size, cb.config_hash, cb.created_by, cb.created_at, cb.is_restore_point, cb.tags,
      d.name as device_name, d.type as device_type, d.ip_address
    `;
    
    if (include_config === 'true') {
      selectFields += ', cb.running_config, cb.startup_config';
    }
    
    const result = await query(`
      SELECT ${selectFields}
      FROM configuration_backups cb
      JOIN devices d ON cb.device_id = d.id
      WHERE cb.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }
    
    res.json({
      success: true,
      backup: result.rows[0]
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
    const deviceResult = await query('SELECT * FROM devices WHERE id = $1', [device_id]);
    
    if (deviceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    const device = deviceResult.rows[0];
    
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
      const duplicateCheck = await query(
        'SELECT id, backup_name FROM configuration_backups WHERE device_id = $1 AND config_hash = $2',
        [device_id, configHash]
      );
      
      if (duplicateCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: `Duplicate backup detected. Same configuration already exists in backup: ${duplicateCheck.rows[0].backup_name}`,
          duplicate_backup_id: duplicateCheck.rows[0].id
        });
      }
      
      // Save backup to database
      const insertResult = await query(`
        INSERT INTO configuration_backups 
        (device_id, backup_name, description, running_config, startup_config, backup_type, 
         file_size, config_hash, created_by, tags)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        device_id,
        backup_name,
        description,
        backupResult.runningConfig,
        backupResult.startupConfig,
        backup_type,
        backupResult.runningConfigSize + backupResult.startupConfigSize,
        configHash,
        created_by,
        JSON.stringify(tags || [])
      ]);
      
      const backup = insertResult.rows[0];
      
      // Don't include the actual config in the response for performance
      const { running_config, startup_config, ...backupResponse } = backup;
      
      res.status(201).json({
        success: true,
        message: 'Backup created successfully',
        backup: {
          ...backupResponse,
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
    const backupResult = await query(`
      SELECT cb.*, d.*
      FROM configuration_backups cb
      JOIN devices d ON cb.device_id = d.id
      WHERE cb.id = $1
    `, [id]);
    
    if (backupResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }
    
    const backup = backupResult.rows[0];
    const device = backup;
    
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
            
            const checkpointInsert = await query(`
              INSERT INTO configuration_backups 
              (device_id, backup_name, description, running_config, startup_config, backup_type, 
               file_size, config_hash, created_by, is_restore_point)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              RETURNING id
            `, [
              device.id,
              `Pre-restore checkpoint - ${new Date().toISOString()}`,
              `Automatic checkpoint before restoring backup: ${backup.backup_name}`,
              checkpointResult.runningConfig,
              checkpointResult.startupConfig,
              'pre_change',
              checkpointResult.runningConfigSize + checkpointResult.startupConfigSize,
              checkpointHash,
              'system',
              true
            ]);
            
            checkpointId = checkpointInsert.rows[0].id;
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
      await query(`
        INSERT INTO configuration_history 
        (device_id, prompt, generated_config, applied_config, status, ai_model, execution_time, created_at, applied_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        device.id,
        `Configuration restored from backup: ${backup.backup_name}`,
        configToRestore,
        restoreResult.output,
        'applied',
        'backup_restore',
        0
      ]);
      
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
    const backupCheck = await query(
      'SELECT backup_name, is_restore_point FROM configuration_backups WHERE id = $1',
      [id]
    );
    
    if (backupCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }
    
    const backup = backupCheck.rows[0];
    
    if (backup.is_restore_point) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete restore point backups'
      });
    }
    
    const result = await query('DELETE FROM configuration_backups WHERE id = $1 RETURNING *', [id]);
    
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
    
    const result = await query(`
      SELECT cb.*, d.name as device_name, d.type as device_type
      FROM configuration_backups cb
      JOIN devices d ON cb.device_id = d.id
      WHERE cb.device_id = $1
      ORDER BY cb.created_at DESC
      LIMIT $2 OFFSET $3
    `, [device_id, limit, offset]);
    
    res.json({
      success: true,
      backups: result.rows
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
    
    const result = await query(`
      UPDATE configuration_backups 
      SET is_restore_point = TRUE
      WHERE id = $1
      RETURNING backup_name
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Backup marked as restore point',
      backup_name: result.rows[0].backup_name
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
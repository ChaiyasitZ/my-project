import cron from 'node-cron';
import BackupSchedule from '../models/BackupSchedule.js';
import ConfigurationBackup from '../models/ConfigurationBackup.js';
import Device from '../models/Device.js';
import sshService from './sshService.js';
import crypto from 'crypto';

class BackupScheduler {
  constructor() {
    this.scheduledJobs = new Map(); // Store active cron jobs
    this.isInitialized = false;
  }

  // Initialize scheduler
  async initialize() {
    if (this.isInitialized) {
      console.log('📅 Backup scheduler already initialized');
      return;
    }

    console.log('📅 Initializing backup scheduler...');
    
    // Load existing schedules from database
    await this.loadSchedules();
    
    // Set up a cron job to check for schedule changes every minute
    cron.schedule('* * * * *', async () => {
      await this.refreshSchedules();
    });
    
    this.isInitialized = true;
    console.log('✅ Backup scheduler initialized successfully');
  }

  // Load all active schedules from database
  async loadSchedules() {
    try {
      const schedules = await BackupSchedule.find({ enabled: true })
        .populate('device_ids', 'name type ip_address')
        .lean();

      console.log(`📋 Loading ${schedules.length} active backup schedules`);

      for (const schedule of schedules) {
        await this.scheduleBackup(schedule);
      }
    } catch (error) {
      console.error('❌ Error loading backup schedules:', error);
    }
  }

  // Refresh schedules (check for changes)
  async refreshSchedules() {
    try {
      const schedules = await BackupSchedule.find({ enabled: true })
        .populate('device_ids', 'name type ip_address')
        .lean();

      const currentScheduleIds = new Set(schedules.map(s => s._id.toString()));
      const activeJobIds = new Set(this.scheduledJobs.keys());

      // Remove schedules that are no longer enabled
      for (const jobId of activeJobIds) {
        if (!currentScheduleIds.has(jobId)) {
          this.removeSchedule(jobId);
        }
      }

      // Add or update schedules
      for (const schedule of schedules) {
        await this.scheduleBackup(schedule);
      }
    } catch (error) {
      console.error('❌ Error refreshing backup schedules:', error);
    }
  }

  // Schedule a backup job
  async scheduleBackup(schedule) {
    const scheduleId = schedule._id.toString();
    
    // Remove existing job if it exists
    if (this.scheduledJobs.has(scheduleId)) {
      this.scheduledJobs.get(scheduleId).stop();
      this.scheduledJobs.delete(scheduleId);
    }

    // Create cron expression based on schedule type
    let cronExpression;
    
    switch (schedule.schedule_type) {
      case 'daily':
        cronExpression = this.createDailyCron(schedule.schedule_config?.time || '02:00');
        break;
      case 'weekly':
        cronExpression = this.createWeeklyCron(
          schedule.schedule_config?.day_of_week || 0,
          schedule.schedule_config?.time || '02:00'
        );
        break;
      case 'monthly':
        cronExpression = this.createMonthlyCron(
          schedule.schedule_config?.day_of_month || 1,
          schedule.schedule_config?.time || '02:00'
        );
        break;
      case 'immediate':
        // Run once immediately
        cronExpression = null;
        setTimeout(() => this.executeScheduledBackup(schedule), 5000);
        break;
      case 'post-deploy':
        // Post-deployment schedules are triggered manually, not by cron
        console.log(`📋 Post-deployment schedule "${schedule.name}" loaded (triggered on deployment)`);
        return;
      default:
        console.log(`⚠️ Unsupported schedule type: ${schedule.schedule_type} for schedule: ${schedule.name}`);
        return;
    }

    if (cronExpression) {
      try {
        const job = cron.schedule(cronExpression, () => {
          this.executeScheduledBackup(schedule);
        }, {
          scheduled: false,
          timezone: 'UTC'
        });

        job.start();
        this.scheduledJobs.set(scheduleId, job);
        
        console.log(`📅 Scheduled backup "${schedule.name}" with cron: ${cronExpression}`);
      } catch (error) {
        console.error(`❌ Error scheduling backup "${schedule.name}":`, error);
      }
    }
  }

  // Create daily cron expression
  createDailyCron(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return `${minutes} ${hours} * * *`;
  }

  // Create weekly cron expression
  createWeeklyCron(dayOfWeek, time) {
    const [hours, minutes] = time.split(':').map(Number);
    return `${minutes} ${hours} * * ${dayOfWeek}`;
  }

  // Create monthly cron expression
  createMonthlyCron(dayOfMonth, time) {
    const [hours, minutes] = time.split(':').map(Number);
    return `${minutes} ${hours} ${dayOfMonth} * *`;
  }

  // Execute scheduled backup
  async executeScheduledBackup(schedule) {
    const scheduleId = schedule._id.toString();
    console.log(`🚀 Executing scheduled backup: ${schedule.name}`);

    try {
      const scheduleDoc = await BackupSchedule.findById(scheduleId);
      if (!scheduleDoc || !scheduleDoc.enabled) {
        console.log(`⚠️ Schedule ${schedule.name} is disabled or deleted, skipping execution`);
        return;
      }

      const backupResults = [];
      const devices = schedule.device_ids;

      for (const device of devices) {
        try {
          console.log(`💾 Backing up ${device.name} (${device.ip_address})...`);
          
          const backupResult = await sshService.createFullBackup(device);

          if (backupResult.success) {
            const configHash = crypto
              .createHash('sha256')
              .update(backupResult.runningConfig || '')
              .digest('hex');

            const backup = new ConfigurationBackup({
              device_id: device._id,
              backup_name: `${schedule.name} - ${device.name} - ${new Date().toISOString().split('T')[0]}`,
              description: `Scheduled backup: ${schedule.name}`,
              running_config: backupResult.runningConfig,
              startup_config: backupResult.startupConfig,
              backup_type: 'scheduled',
              config_type: schedule.backup_type,
              file_size: (backupResult.runningConfigSize || 0) + (backupResult.startupConfigSize || 0),
              config_hash: configHash,
              created_by: 'schedule',
              tags: ['scheduled', 'auto', scheduleId]
            });

            await backup.save();
            backupResults.push({
              device_id: device._id,
              device_name: device.name,
              backup_id: backup._id,
              success: true
            });

            console.log(`✅ Backup successful for ${device.name}`);
          } else {
            backupResults.push({
              device_id: device._id,
              device_name: device.name,
              success: false,
              error: backupResult.error || 'Backup failed'
            });
            console.log(`❌ Backup failed for ${device.name}: ${backupResult.error}`);
          }
        } catch (deviceError) {
          console.error(`❌ Backup failed for device ${device.name}:`, deviceError.message);
          backupResults.push({
            device_id: device._id,
            device_name: device.name,
            success: false,
            error: deviceError.message
          });
        }
      }

      // Update schedule status
      const successCount = backupResults.filter(r => r.success).length;
      const failCount = backupResults.length - successCount;

      scheduleDoc.last_run = new Date();
      scheduleDoc.last_status = successCount > 0 ? 'success' : 'failed';
      
      if (successCount > 0) {
        const lastSuccessfulBackup = backupResults.find(r => r.success);
        scheduleDoc.last_backup_id = lastSuccessfulBackup.backup_id;
      }

      await scheduleDoc.save();

      console.log(`📊 Scheduled backup "${schedule.name}" completed: ${successCount} success, ${failCount} failed`);

    } catch (error) {
      console.error(`❌ Error executing scheduled backup "${schedule.name}":`, error);
      
      // Update schedule with failed status
      try {
        const scheduleDoc = await BackupSchedule.findById(scheduleId);
        if (scheduleDoc) {
          scheduleDoc.last_run = new Date();
          scheduleDoc.last_status = 'failed';
          await scheduleDoc.save();
        }
      } catch (updateError) {
        console.error('❌ Error updating schedule status:', updateError);
      }
    }
  }

  // Execute post-deployment backup for specific devices
  async executePostDeployBackup(deviceIds, scheduleName = 'Post-Deployment Backup') {
    console.log(`🚀 Executing post-deployment backup for ${deviceIds.length} devices`);

    try {
      const devices = await Device.find({ _id: { $in: deviceIds } })
        .select('name type ip_address username password enable_password ssh_port')
        .lean();

      if (!devices || devices.length === 0) {
        throw new Error('No valid devices found for post-deployment backup');
      }

      const backupResults = [];

      for (const device of devices) {
        try {
          console.log(`💾 Post-deployment backup for ${device.name} (${device.ip_address})...`);
          
          const backupResult = await sshService.createFullBackup(device);

          if (backupResult.success) {
            const configHash = crypto
              .createHash('sha256')
              .update(backupResult.runningConfig || '')
              .digest('hex');

            const backup = new ConfigurationBackup({
              device_id: device._id,
              backup_name: `${scheduleName} - ${device.name} - ${new Date().toISOString().split('T')[0]}`,
              description: `Post-deployment backup: ${scheduleName}`,
              running_config: backupResult.runningConfig,
              startup_config: backupResult.startupConfig,
              backup_type: 'scheduled',
              config_type: 'running-config',
              file_size: (backupResult.runningConfigSize || 0) + (backupResult.startupConfigSize || 0),
              config_hash: configHash,
              created_by: 'post-deploy',
              tags: ['post-deploy', 'auto', 'deployment-triggered']
            });

            await backup.save();
            backupResults.push({
              device_id: device._id,
              device_name: device.name,
              backup_id: backup._id,
              success: true
            });

            console.log(`✅ Post-deployment backup successful for ${device.name}`);
          } else {
            backupResults.push({
              device_id: device._id,
              device_name: device.name,
              success: false,
              error: backupResult.error || 'Post-deployment backup failed'
            });
            console.log(`❌ Post-deployment backup failed for ${device.name}: ${backupResult.error}`);
          }
        } catch (deviceError) {
          console.error(`❌ Post-deployment backup failed for device ${device.name}:`, deviceError.message);
          backupResults.push({
            device_id: device._id,
            device_name: device.name,
            success: false,
            error: deviceError.message
          });
        }
      }

      const successCount = backupResults.filter(r => r.success).length;
      const failCount = backupResults.length - successCount;

      console.log(`📊 Post-deployment backup completed: ${successCount} success, ${failCount} failed`);

      return {
        success: successCount > 0,
        message: `Post-deployment backup completed: ${successCount} success, ${failCount} failed`,
        results: backupResults,
        summary: {
          total: deviceIds.length,
          successful: successCount,
          failed: failCount
        }
      };

    } catch (error) {
      console.error(`❌ Error executing post-deployment backup:`, error);
      return {
        success: false,
        message: `Post-deployment backup failed: ${error.message}`,
        error: error.message
      };
    }
  }

  // Trigger post-deployment backups for all schedules with trigger_on_deploy enabled
  async triggerPostDeploySchedules(deviceIds = null) {
    try {
      const schedules = await BackupSchedule.find({ 
        enabled: true, 
        schedule_type: 'post-deploy',
        trigger_on_deploy: true 
      })
      .populate('device_ids', 'name type ip_address')
      .lean();

      console.log(`📋 Found ${schedules.length} post-deployment schedules to trigger`);

      const results = [];

      for (const schedule of schedules) {
        const targetDeviceIds = deviceIds || schedule.device_ids.map(d => d._id.toString());
        
        console.log(`🚀 Triggering post-deployment schedule: ${schedule.name}`);
        
        const result = await this.executePostDeployBackup(
          targetDeviceIds, 
          schedule.name
        );
        
        results.push({
          schedule_id: schedule._id,
          schedule_name: schedule.name,
          result: result
        });

        // Update schedule status
        try {
          await BackupSchedule.findByIdAndUpdate(schedule._id, {
            last_run: new Date(),
            last_status: result.success ? 'success' : 'failed'
          });
        } catch (updateError) {
          console.error(`❌ Error updating schedule ${schedule.name} status:`, updateError);
        }
      }

      const totalSuccess = results.filter(r => r.result.success).length;
      
      return {
        success: totalSuccess > 0,
        message: `Triggered ${schedules.length} post-deployment schedules: ${totalSuccess} successful`,
        results: results
      };

    } catch (error) {
      console.error(`❌ Error triggering post-deployment schedules:`, error);
      return {
        success: false,
        message: `Failed to trigger post-deployment schedules: ${error.message}`,
        error: error.message
      };
    }
  }

  // Remove a scheduled job
  removeSchedule(scheduleId) {
    if (this.scheduledJobs.has(scheduleId)) {
      const job = this.scheduledJobs.get(scheduleId);
      job.stop();
      this.scheduledJobs.delete(scheduleId);
      console.log(`🗑️ Removed scheduled job: ${scheduleId}`);
    }
  }

  // Get all active scheduled jobs
  getActiveSchedules() {
    return Array.from(this.scheduledJobs.keys());
  }

  // Manually trigger a schedule
  async triggerSchedule(scheduleId) {
    try {
      const schedule = await BackupSchedule.findById(scheduleId)
        .populate('device_ids', 'name type ip_address')
        .lean();

      if (!schedule) {
        throw new Error('Schedule not found');
      }

      await this.executeScheduledBackup(schedule);
      console.log(`⚡ Manually triggered schedule: ${schedule.name}`);
      
      return {
        success: true,
        message: `Schedule "${schedule.name}" triggered successfully`
      };
    } catch (error) {
      console.error(`❌ Error triggering schedule ${scheduleId}:`, error);
      return {
        success: false,
        message: `Failed to trigger schedule: ${error.message}`
      };
    }
  }

  // Stop all scheduled jobs
  stopAll() {
    for (const [scheduleId, job] of this.scheduledJobs) {
      job.stop();
    }
    this.scheduledJobs.clear();
    console.log('🛑 Stopped all scheduled backup jobs');
  }
}

export default new BackupScheduler();

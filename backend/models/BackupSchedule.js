import mongoose from 'mongoose';

const backupScheduleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  device_ids: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: true
  }],
  schedule_type: {
    type: String,
    enum: ['immediate', 'daily', 'weekly', 'monthly', 'manual'],
    default: 'manual'
  },
  schedule_config: {
    time: String,          // "02:00" for 2 AM
    day_of_week: Number,   // 0-6 for weekly
    day_of_month: Number,  // 1-31 for monthly
    enabled: {
      type: Boolean,
      default: true
    }
  },
  backup_type: {
    type: String,
    enum: ['running-config', 'startup-config', 'both'],
    default: 'running-config'
  },
  retention_policy: {
    keep_last: {
      type: Number,
      default: 10
    },
    auto_delete_old: {
      type: Boolean,
      default: false
    }
  },
  last_run: Date,
  last_status: {
    type: String,
    enum: ['success', 'failed', 'pending', 'never-run'],
    default: 'never-run'
  },
  last_backup_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ConfigurationBackup'
  },
  created_by: {
    type: String,
    default: 'user'
  },
  enabled: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster queries
backupScheduleSchema.index({ device_ids: 1 });
backupScheduleSchema.index({ enabled: 1, schedule_type: 1 });
backupScheduleSchema.index({ last_run: 1 });

const BackupSchedule = mongoose.model('BackupSchedule', backupScheduleSchema);

export default BackupSchedule;

import mongoose from 'mongoose';

const configurationBackupSchema = new mongoose.Schema({
  device_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: true
  },
  backup_name: {
    type: String,
    required: true,
    maxlength: 255
  },
  description: String,
  running_config: String,
  startup_config: String,
  backup_type: {
    type: String,
    enum: ['manual', 'scheduled'],
    default: 'manual'
  },
  config_type: {
    type: String,
    enum: ['running-config', 'startup-config', 'both'],
    default: 'running-config'
  },
  file_size: {
    type: Number,
    min: 0 // in bytes
  },
  config_hash: {
    type: String,
    maxlength: 64 // SHA-256 hash
  },
  created_by: {
    type: String,
    required: false,
    default: 'system'
  },
  is_restore_point: {
    type: Boolean,
    default: false
  },
  tags: [String] // Array of tags
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Compound unique index - device + backup name must be unique
configurationBackupSchema.index({ device_id: 1, backup_name: 1 }, { unique: true });

// Indexes for common query patterns
configurationBackupSchema.index({ device_id: 1, createdAt: -1 }); // Device backups sorted by date
configurationBackupSchema.index({ config_hash: 1 }); // Duplicate detection
configurationBackupSchema.index({ backup_type: 1, createdAt: -1 }); // Filter by type
configurationBackupSchema.index({ tags: 1 }); // Tag-based queries
configurationBackupSchema.index({ is_restore_point: 1 });

// Virtual to get device info
configurationBackupSchema.virtual('device', {
  ref: 'Device',
  localField: 'device_id',
  foreignField: '_id',
  justOne: true
});

// Pre-save middleware to validate at least one config exists
configurationBackupSchema.pre('save', function(next) {
  if (!this.running_config && !this.startup_config) {
    next(new Error('Either running_config or startup_config must be provided'));
  } else {
    next();
  }
});

export default mongoose.model('ConfigurationBackup', configurationBackupSchema); 
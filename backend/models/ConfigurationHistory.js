import mongoose from 'mongoose';

const configurationHistorySchema = new mongoose.Schema({
  device_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: true
  },
  prompt: {
    type: String,
    required: true,
    minlength: 10
  },
  generated_config: String, // Display version with comments for UI
  deployment_config: String, // Clean version for device deployment
  applied_config: String,
  status: {
    type: String,
    enum: ['generated', 'applied', 'failed', 'rolled_back'],
    default: 'generated'
  },
  ai_model: {
    type: String,
    default: 'openrouter'
  },
  config_type: {
    type: String,
    enum: ['cli', 'netconf-yang'],
    default: 'cli'
  },
  execution_time: {
    type: Number,
    min: 0 // in milliseconds
  },
  error_message: String,
  user_rating: {
    type: Number,
    min: 1,
    max: 5
  },
  feedback_text: String,
  created_at: {
    type: Number,
    default: () => Date.now()
  },
  updated_at: {
    type: Number,
    default: () => Date.now()
  },
  applied_at: {
    type: Number
  }
}, {
  timestamps: false // Disable automatic timestamps since we're using custom ones
});

// Update the updated_at field before saving
configurationHistorySchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

// Indexes for performance
configurationHistorySchema.index({ device_id: 1, created_at: -1 }); // Device history sorted
configurationHistorySchema.index({ status: 1, created_at: -1 }); // Filter by status
configurationHistorySchema.index({ device_id: 1, status: 1, created_at: -1 }); // Combined filter

// Virtual to get device info
configurationHistorySchema.virtual('device', {
  ref: 'Device',
  localField: 'device_id',
  foreignField: '_id',
  justOne: true
});

export default mongoose.model('ConfigurationHistory', configurationHistorySchema); 
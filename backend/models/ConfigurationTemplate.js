import mongoose from 'mongoose';

const configurationTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    maxlength: 255
  },
  description: String,
  device_type: {
    type: String,
    required: true,
    enum: ['router', 'switch', 'firewall', 'general'],
    maxlength: 50
  },
  template_config: {
    type: String,
    required: true
  },
  variables: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  category: {
    type: String,
    default: 'general',
    maxlength: 100
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Indexes for performance
configurationTemplateSchema.index({ device_type: 1 });
configurationTemplateSchema.index({ category: 1 });
configurationTemplateSchema.index({ device_type: 1, category: 1 });

// Static method to get templates by device type
configurationTemplateSchema.statics.getByDeviceType = function(deviceType) {
  return this.find({ device_type: { $in: [deviceType, 'general'] } });
};

// Static method to get templates by category
configurationTemplateSchema.statics.getByCategory = function(category) {
  return this.find({ category: category });
};

export default mongoose.model('ConfigurationTemplate', configurationTemplateSchema); 
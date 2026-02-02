import mongoose from 'mongoose';

const yangModelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  namespace: {
    type: String,
    trim: true,
    default: ''
  },
  prefix: {
    type: String,
    trim: true
  },
  version: {
    type: String,
    default: '1.0.0'
  },
  device_type: {
    type: String,
    enum: ['nexus', 'ios', 'ios-xe', 'ios-xr', 'all'],
    default: 'nexus'
  },
  category: {
    type: String,
    enum: ['interface', 'routing', 'switching', 'security', 'qos', 'system', 'other'],
    default: 'other'
  },
  description: {
    type: String,
    trim: true
  },
  // The actual YANG model content
  yang_content: {
    type: String,
    required: true
  },
  // XML template examples for LLM reference
  xml_templates: [{
    name: String,
    description: String,
    template: String
  }],
  // Key paths for configuration
  config_paths: [{
    path: String,
    description: String,
    data_type: String,
    required: Boolean
  }],
  // Status
  is_active: {
    type: Boolean,
    default: true
  },
  // Custom model flag (user-created vs uploaded)
  is_custom: {
    type: Boolean,
    default: false
  },
  // User who uploaded this model
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Metadata
  uploaded_by: {
    type: String,
    default: 'system'
  },
  created_at: {
    type: Number,
    default: () => Date.now()
  },
  updated_at: {
    type: Number,
    default: () => Date.now()
  }
});

// Compound indexes - unique per user
yangModelSchema.index({ userId: 1, name: 1 }, { unique: true });
yangModelSchema.index({ userId: 1, device_type: 1, category: 1 });
yangModelSchema.index({ userId: 1, namespace: 1 }, { sparse: true });

// Update timestamp on save
yangModelSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

// Virtual for id
yangModelSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

yangModelSchema.set('toJSON', { virtuals: true });
yangModelSchema.set('toObject', { virtuals: true });

const YangModel = mongoose.model('YangModel', yangModelSchema);

export default YangModel;

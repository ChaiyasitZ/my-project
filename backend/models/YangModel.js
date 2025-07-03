import mongoose from 'mongoose';

const yangModelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    maxlength: 255
  },
  namespace: {
    type: String,
    required: true,
    maxlength: 255
  },
  prefix: {
    type: String,
    required: true,
    maxlength: 50
  },
  revision: {
    type: String,
    maxlength: 10 // YYYY-MM-DD format
  },
  description: {
    type: String,
    maxlength: 1000
  },
  organization: {
    type: String,
    maxlength: 255
  },
  contact: {
    type: String,
    maxlength: 500
  },
  yang_content: {
    type: String,
    required: true
  },
  parsed_structure: {
    type: mongoose.Schema.Types.Mixed, // JSON structure of parsed YANG
    default: {}
  },
  imports: [{
    module: String,
    prefix: String,
    revision: String
  }],
  includes: [{
    module: String,
    revision: String
  }],
  vendor: {
    type: String,
    enum: ['ietf', 'cisco', 'juniper', 'huawei', 'custom'],
    default: 'ietf'
  },
  category: {
    type: String,
    enum: ['interface', 'routing', 'system', 'security', 'qos', 'other'],
    default: 'other'
  },
  status: {
    type: String,
    enum: ['active', 'deprecated', 'obsolete'],
    default: 'active'
  },
  supported_devices: [{
    vendor: String,
    model: String,
    os_version: String
  }],
  file_path: {
    type: String,
    maxlength: 500
  },
  file_size: {
    type: Number,
    min: 0
  },
  checksum: {
    type: String,
    maxlength: 64 // SHA-256 hash
  }
}, {
  timestamps: true
});

// Indexes for performance
yangModelSchema.index({ vendor: 1, category: 1 });
yangModelSchema.index({ name: 1, revision: -1 });
yangModelSchema.index({ namespace: 1 });
yangModelSchema.index({ status: 1 });

// Virtual for model summary
yangModelSchema.virtual('model_summary').get(function() {
  return {
    id: this._id,
    name: this.name,
    namespace: this.namespace,
    prefix: this.prefix,
    revision: this.revision,
    vendor: this.vendor,
    category: this.category,
    status: this.status
  };
});

// Method to get root containers
yangModelSchema.methods.getRootContainers = function() {
  if (!this.parsed_structure.containers) return [];
  return Object.keys(this.parsed_structure.containers);
};

// Method to get all leaves in a container
yangModelSchema.methods.getContainerLeaves = function(containerName) {
  if (!this.parsed_structure.containers || !this.parsed_structure.containers[containerName]) {
    return [];
  }
  return this.parsed_structure.containers[containerName].leaves || [];
};

// Static method to find models by vendor
yangModelSchema.statics.findByVendor = function(vendor) {
  return this.find({ vendor, status: 'active' });
};

// Static method to find compatible models for device
yangModelSchema.statics.findCompatibleModels = function(deviceVendor, deviceModel, osVersion) {
  return this.find({
    $or: [
      { vendor: 'ietf' }, // IETF models are generally compatible
      { 
        vendor: deviceVendor.toLowerCase(),
        'supported_devices': {
          $elemMatch: {
            vendor: deviceVendor,
            $or: [
              { model: deviceModel },
              { model: { $regex: new RegExp(deviceModel, 'i') } }
            ]
          }
        }
      }
    ],
    status: 'active'
  });
};

export default mongoose.model('YangModel', yangModelSchema); 
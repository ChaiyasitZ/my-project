import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    maxlength: 255
  },
  type: {
    type: String,
    required: true,
    enum: ['router', 'switch', 'firewall'],
    maxlength: 50
  },
  ip_address: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function(v) {
        return /^(\d{1,3}\.){3}\d{1,3}$/.test(v);
      },
      message: 'Invalid IP address format'
    }
  },
  ssh_port: {
    type: Number,
    default: 22,
    min: 1,
    max: 65535
  },
  username: {
    type: String,
    required: true,
    maxlength: 255
  },
  password: {
    type: String,
    required: true,
    maxlength: 255
  },
  description: String,
  location: {
    type: String,
    maxlength: 255
  },
  model: {
    type: String,
    maxlength: 255
  },
  ios_version: {
    type: String,
    maxlength: 255
  },
  vendor: {
    type: String,
    enum: ['cisco', 'juniper', 'huawei', 'arista', 'other'],
    default: 'cisco'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'error'],
    default: 'inactive'
  },
  // NETCONF Configuration
  netconf_enabled: {
    type: Boolean,
    default: false
  },
  netconf_port: {
    type: Number,
    default: 830,
    min: 1,
    max: 65535
  },
  netconf_capabilities: [{
    type: String
  }],
  yang_models: [{
    model_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'YangModel'
    },
    model_name: String,
    namespace: String,
    revision: String,
    supported: {
      type: Boolean,
      default: true
    }
  }],
  // Connection preferences
  preferred_connection: {
    type: String,
    enum: ['ssh', 'netconf', 'console'],
    default: 'ssh'
  },
  // Last connection info
  last_connection: {
    type: {
      type: String,
      enum: ['ssh', 'netconf', 'console']
    },
    timestamp: Date,
    status: {
      type: String,
      enum: ['success', 'failed', 'timeout']
    },
    session_id: String
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

// Indexes for performance (MongoDB will create these automatically)
deviceSchema.index({ status: 1 });
deviceSchema.index({ type: 1 });
deviceSchema.index({ vendor: 1 });
deviceSchema.index({ netconf_enabled: 1 });
deviceSchema.index({ preferred_connection: 1 });
// Note: ip_address index created by unique: true above

// Virtual for device summary
deviceSchema.virtual('device_summary').get(function() {
  return {
    id: this._id,
    name: this.name,
    type: this.type,
    ip_address: this.ip_address,
    status: this.status,
    vendor: this.vendor,
    netconf_enabled: this.netconf_enabled,
    preferred_connection: this.preferred_connection
  };
});

// Method to check if device supports NETCONF
deviceSchema.methods.supportsNetconf = function() {
  return this.netconf_enabled && this.netconf_capabilities.length > 0;
};

// Method to get supported YANG models
deviceSchema.methods.getSupportedYangModels = function() {
  return this.yang_models.filter(model => model.supported);
};

// Method to add YANG model support
deviceSchema.methods.addYangModel = function(modelId, modelName, namespace, revision) {
  const existingModel = this.yang_models.find(
    model => model.model_name === modelName && model.revision === revision
  );
  
  if (!existingModel) {
    this.yang_models.push({
      model_id: modelId,
      model_name: modelName,
      namespace: namespace,
      revision: revision,
      supported: true
    });
  }
  
  return this.save();
};

// Static method to find NETCONF-enabled devices
deviceSchema.statics.findNetconfEnabled = function() {
  return this.find({ netconf_enabled: true, status: { $ne: 'inactive' } });
};

// Static method to find devices by vendor
deviceSchema.statics.findByVendor = function(vendor) {
  return this.find({ vendor: vendor.toLowerCase() });
};

export default mongoose.model('Device', deviceSchema); 
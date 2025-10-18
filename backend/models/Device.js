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
    enum: ['router', 'switch', 'nexus'],
    maxlength: 50
  },
  layer: {
    type: String,
    enum: ['layer-2', 'layer-3'],
    default: function() {
      return this.type === 'switch' ? 'layer-2' : undefined;
    },
    validate: {
      validator: function(value) {
        // Nexus switches don't need layer specification
        if (this.type === 'nexus') {
          return value === undefined || value === null;
        }
        // Switches require layer specification
        if (this.type === 'switch') {
          return value !== undefined && value !== null;
        }
        // Routers don't have layers
        return value === undefined || value === null;
      },
      message: 'Layer specification is only for switch devices, not nexus or router'
    }
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
  enable_password: {
    type: String,
    maxlength: 255,
    required: false // Optional, defaults to using the same as login password
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

export default mongoose.model('Device', deviceSchema); 
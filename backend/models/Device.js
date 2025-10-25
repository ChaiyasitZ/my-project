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
    enum: ['router', 'switch'],
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
        // Switches require layer specification
        if (this.type === 'switch') {
          return value !== undefined && value !== null;
        }
        // Routers don't have layers
        return value === undefined || value === null;
      },
      message: 'Layer specification is only for switch devices, not router'
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
  ssh_status: {
    type: String,
    enum: ['connected', 'disconnected', 'connecting', 'error'],
    default: 'disconnected'
  },
  ssh_connected_at: {
    type: Date
  },
  ssh_session_id: {
    type: String
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

// Indexes for performance (MongoDB will create these automatically)
deviceSchema.index({ status: 1 });
deviceSchema.index({ type: 1 });
deviceSchema.index({ vendor: 1 });
// Note: ip_address index created by unique: true above

export default mongoose.model('Device', deviceSchema); 
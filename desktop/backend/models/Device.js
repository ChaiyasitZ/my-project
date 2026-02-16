import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Optional for backward compatibility
    index: true
  },
  name: {
    type: String,
    required: true,
    // unique: true - Removed, using compound index with userId instead
    maxlength: 255
  },
  type: {
    type: String,
    required: true,
    enum: ['router', 'switch', 'nexus', 'ios-xe'],
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
        // Routers, Nexus, and IOS-XE don't have layers
        return value === undefined || value === null;
      },
      message: 'Layer specification is only for switch devices'
    }
  },
  ip_address: {
    type: String,
    required: true,
    // unique: true - Removed, using compound index with userId instead
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
  netconf_port: {
    type: Number,
    default: 830,
    min: 1,
    max: 65535
  },
  netconf_enabled: {
    type: Boolean,
    default: function() {
      // Enable NETCONF by default for Nexus and IOS-XE devices
      return this.type === 'nexus' || this.type === 'ios-xe';
    }
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
// Compound unique indexes - unique per user, not globally
deviceSchema.index({ userId: 1, ip_address: 1 }, { unique: true });
deviceSchema.index({ userId: 1, name: 1 }, { unique: true });

export default mongoose.model('Device', deviceSchema); 
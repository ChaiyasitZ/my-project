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
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'error'],
    default: 'inactive'
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

// Indexes for performance (MongoDB will create these automatically)
deviceSchema.index({ status: 1 });
deviceSchema.index({ type: 1 });
deviceSchema.index({ ip_address: 1 });

// Virtual for device summary
deviceSchema.virtual('device_summary').get(function() {
  return {
    id: this._id,
    name: this.name,
    type: this.type,
    ip_address: this.ip_address,
    status: this.status
  };
});

export default mongoose.model('Device', deviceSchema); 
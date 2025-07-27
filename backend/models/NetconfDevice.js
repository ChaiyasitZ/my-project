import mongoose from 'mongoose';

const netconfDeviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    maxlength: 255,
    trim: true
  },
  description: {
    type: String,
    maxlength: 1000,
    trim: true
  },
  // Network Information
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
  hostname: {
    type: String,
    maxlength: 255,
    trim: true
  },
  location: {
    type: String,
    maxlength: 255,
    trim: true
  },
  
  // Device Information
  device_type: {
    type: String,
    required: true,
    enum: ['cisco_ios', 'cisco_nxos', 'cisco_iosxr', 'juniper_junos', 'huawei_vrp', 'arista_eos', 'other'],
    default: 'cisco_ios'
  },
  platform: {
    type: String,
    maxlength: 255,
    trim: true // e.g., "Cisco Nexus 9300", "Cisco ISR 4000"
  },
  model: {
    type: String,
    maxlength: 255,
    trim: true
  },
  os_version: {
    type: String,
    maxlength: 255,
    trim: true
  },
  vendor: {
    type: String,
    enum: ['cisco', 'juniper', 'huawei', 'arista', 'other'],
    default: 'cisco'
  },
  
  // SSH Connection (required for NETCONF)
  ssh_port: {
    type: Number,
    default: 22,
    min: 1,
    max: 65535
  },
  username: {
    type: String,
    required: true,
    maxlength: 255,
    trim: true
  },
  password: {
    type: String,
    required: true,
    maxlength: 255
  },
  
  // NETCONF Specific Configuration
  netconf_port: {
    type: Number,
    default: 830,
    min: 1,
    max: 65535
  },
  netconf_enabled: {
    type: Boolean,
    default: true,
    required: true
  },
  netconf_capabilities: [{
    type: String,
    trim: true
  }],
  
  // NETCONF Session Configuration
  connection_timeout: {
    type: Number,
    default: 30000, // 30 seconds
    min: 5000,
    max: 120000
  },
  keepalive_interval: {
    type: Number,
    default: 5000, // 5 seconds
    min: 1000,
    max: 30000
  },
  max_retries: {
    type: Number,
    default: 3,
    min: 1,
    max: 10
  },
  
  // YANG Models
  yang_models: [{
    model_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'YangModel'
    },
    model_name: {
      type: String,
      required: true,
      trim: true
    },
    namespace: {
      type: String,
      required: true,
      trim: true
    },
    revision: {
      type: String,
      trim: true
    },
    supported: {
      type: Boolean,
      default: true
    },
    // Capabilities advertised by device for this model
    device_capabilities: [String]
  }],
  
  // Device Status and Health
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'error', 'testing'],
    default: 'inactive'
  },
  connection_status: {
    type: String,
    enum: ['connected', 'disconnected', 'connecting', 'error'],
    default: 'disconnected'
  },
  
  // Last Connection Information
  last_connection: {
    timestamp: {
      type: Date
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'timeout']
    },
    session_id: {
      type: String,
      trim: true
    },
    capabilities_count: {
      type: Number,
      min: 0
    },
    connection_time_ms: {
      type: Number,
      min: 0
    },
    error_message: {
      type: String,
      trim: true
    }
  },
  
  // Performance Metrics
  performance_metrics: {
    avg_response_time: {
      type: Number,
      min: 0
    },
    success_rate: {
      type: Number,
      min: 0,
      max: 100
    },
    total_sessions: {
      type: Number,
      default: 0,
      min: 0
    },
    successful_sessions: {
      type: Number,
      default: 0,
      min: 0
    },
    failed_sessions: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // Configuration Management
  supported_datastores: [{
    type: String,
    enum: ['running', 'candidate', 'startup'],
    default: 'running'
  }],
  default_datastore: {
    type: String,
    enum: ['running', 'candidate', 'startup'],
    default: 'running'
  },
  supports_validation: {
    type: Boolean,
    default: false
  },
  supports_rollback: {
    type: Boolean,
    default: false
  },
  
  // Security and Access Control
  access_groups: [{
    type: String,
    trim: true
  }],
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  
  // Monitoring and Alerts
  monitoring_enabled: {
    type: Boolean,
    default: true
  },
  alert_threshold: {
    response_time_ms: {
      type: Number,
      default: 5000,
      min: 1000
    },
    failure_rate_percent: {
      type: Number,
      default: 20,
      min: 1,
      max: 100
    }
  },
  
  // Metadata
  created_by: {
    type: String,
    trim: true
  },
  updated_by: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    maxlength: 2000,
    trim: true
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

// Indexes for performance
netconfDeviceSchema.index({ ip_address: 1 });
netconfDeviceSchema.index({ status: 1 });
netconfDeviceSchema.index({ connection_status: 1 });
netconfDeviceSchema.index({ device_type: 1 });
netconfDeviceSchema.index({ vendor: 1 });
netconfDeviceSchema.index({ netconf_enabled: 1 });
netconfDeviceSchema.index({ tags: 1 });
netconfDeviceSchema.index({ 'yang_models.model_name': 1 });

// Compound indexes
netconfDeviceSchema.index({ status: 1, connection_status: 1 });
netconfDeviceSchema.index({ vendor: 1, device_type: 1 });

// Virtual for session ID generation
netconfDeviceSchema.virtual('session_id').get(function() {
  return `${this.ip_address}:${this.netconf_port}`;
});

// Virtual for connection health score
netconfDeviceSchema.virtual('health_score').get(function() {
  if (!this.performance_metrics) return 0;
  
  const successRate = this.performance_metrics.success_rate || 0;
  const responseTime = this.performance_metrics.avg_response_time || 10000;
  
  // Calculate health score (0-100)
  let score = successRate * 0.7; // 70% weight for success rate
  
  // Response time factor (0-30 points)
  if (responseTime < 1000) score += 30;
  else if (responseTime < 3000) score += 20;
  else if (responseTime < 5000) score += 10;
  
  return Math.round(Math.min(score, 100));
});

// Pre-save middleware
netconfDeviceSchema.pre('save', function(next) {
  // Ensure supported_datastores includes default_datastore
  if (this.default_datastore && !this.supported_datastores.includes(this.default_datastore)) {
    this.supported_datastores.push(this.default_datastore);
  }
  
  // Update performance metrics
  if (this.performance_metrics && this.performance_metrics.total_sessions > 0) {
    const successRate = (this.performance_metrics.successful_sessions / this.performance_metrics.total_sessions) * 100;
    this.performance_metrics.success_rate = Math.round(successRate * 100) / 100;
  }
  
  next();
});

// Static methods
netconfDeviceSchema.statics.findByConnectionStatus = function(status) {
  return this.find({ connection_status: status, netconf_enabled: true });
};

netconfDeviceSchema.statics.findByDeviceType = function(deviceType) {
  return this.find({ device_type: deviceType, netconf_enabled: true });
};

netconfDeviceSchema.statics.findByYangModel = function(modelName) {
  return this.find({ 
    'yang_models.model_name': modelName,
    'yang_models.supported': true,
    netconf_enabled: true 
  });
};

netconfDeviceSchema.statics.getHealthyDevices = function() {
  return this.find({
    status: 'active',
    connection_status: { $in: ['connected', 'disconnected'] },
    netconf_enabled: true
  });
};

// Instance methods
netconfDeviceSchema.methods.updateConnectionStatus = function(status, sessionInfo = {}) {
  this.connection_status = status;
  
  if (sessionInfo) {
    this.last_connection = {
      timestamp: new Date(),
      status: sessionInfo.success ? 'success' : 'failed',
      session_id: sessionInfo.sessionId,
      capabilities_count: sessionInfo.capabilities?.length || 0,
      connection_time_ms: sessionInfo.connectionTime,
      error_message: sessionInfo.error
    };
    
    // Update performance metrics
    if (!this.performance_metrics) {
      this.performance_metrics = {
        total_sessions: 0,
        successful_sessions: 0,
        failed_sessions: 0
      };
    }
    
    this.performance_metrics.total_sessions += 1;
    if (sessionInfo.success) {
      this.performance_metrics.successful_sessions += 1;
      if (sessionInfo.connectionTime) {
        const currentAvg = this.performance_metrics.avg_response_time || 0;
        const totalSuccessful = this.performance_metrics.successful_sessions;
        this.performance_metrics.avg_response_time = 
          Math.round(((currentAvg * (totalSuccessful - 1)) + sessionInfo.connectionTime) / totalSuccessful);
      }
    } else {
      this.performance_metrics.failed_sessions += 1;
    }
  }
  
  return this.save();
};

netconfDeviceSchema.methods.addYangModel = function(yangModelInfo) {
  const existingModel = this.yang_models.find(m => m.model_name === yangModelInfo.model_name);
  
  if (existingModel) {
    // Update existing model
    Object.assign(existingModel, yangModelInfo);
  } else {
    // Add new model
    this.yang_models.push(yangModelInfo);
  }
  
  return this.save();
};

netconfDeviceSchema.methods.removeYangModel = function(modelName) {
  this.yang_models = this.yang_models.filter(m => m.model_name !== modelName);
  return this.save();
};

const NetconfDevice = mongoose.model('NetconfDevice', netconfDeviceSchema);

export default NetconfDevice; 
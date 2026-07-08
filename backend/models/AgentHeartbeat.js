/**
 * AgentHeartbeat Model - Tracks agent online status via polling
 * 
 * Agent sends heartbeat every few seconds.
 * If no heartbeat received within 15 seconds, agent is considered offline.
 */

import mongoose from 'mongoose';

const agentHeartbeatSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  agentName: {
    type: String,
    default: 'Unknown'
  },
  agentVersion: {
    type: String,
    default: '0.0.0'
  },
  platform: {
    type: String,
    default: 'unknown'
  },
  hostname: {
    type: String,
    default: 'unknown'
  },
  lastHeartbeat: {
    type: Date,
    default: Date.now
  },
  connectedAt: {
    type: Date,
    default: Date.now
  },
  capabilities: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // System resource snapshot reported by the agent each heartbeat:
  // { ramTotalMB, ramFreeMB, gpu: { name, vramTotalMB, vramUsedMB } | null }
  systemInfo: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
});

// Check if agent is online (heartbeat within last 15 seconds)
agentHeartbeatSchema.methods.isOnline = function () {
  const TIMEOUT_MS = 15000; // 15 seconds
  return (Date.now() - this.lastHeartbeat.getTime()) < TIMEOUT_MS;
};

// Static: get online agent info for a user
agentHeartbeatSchema.statics.getOnlineAgent = async function (userId) {
  const heartbeat = await this.findOne({ userId });
  if (!heartbeat || !heartbeat.isOnline()) return null;
  return {
    online: true,
    name: heartbeat.agentName,
    version: heartbeat.agentVersion,
    platform: heartbeat.platform,
    hostname: heartbeat.hostname,
    connectedAt: heartbeat.connectedAt,
    lastHeartbeat: heartbeat.lastHeartbeat,
    capabilities: heartbeat.capabilities || {},
    systemInfo: heartbeat.systemInfo || {}
  };
};

const AgentHeartbeat = mongoose.model('AgentHeartbeat', agentHeartbeatSchema);
export default AgentHeartbeat;

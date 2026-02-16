/**
 * AgentCommand Model - Command queue for agent polling
 * 
 * Flow:
 * 1. Web app creates a command (status: 'pending')
 * 2. Agent polls and picks it up (status: 'processing')
 * 3. Agent executes and posts result (status: 'completed' or 'failed')
 * 4. Web app polls for result
 * 5. TTL auto-deletes old commands after 5 minutes
 */

import mongoose from 'mongoose';

const agentCommandSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  event: {
    type: String,
    required: true  // e.g., 'agent:ssh:connect', 'agent:ssh:exec', 'agent:netconf:get-config'
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  result: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  error: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300  // TTL: auto-delete after 5 minutes
  },
  processedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  }
});

// Compound index for efficient polling
agentCommandSchema.index({ userId: 1, status: 1, createdAt: 1 });

const AgentCommand = mongoose.model('AgentCommand', agentCommandSchema);
export default AgentCommand;

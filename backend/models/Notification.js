/**
 * Notification Model - Stores events for frontend polling
 * 
 * Replaces Socket.IO real-time push with a pull-based approach.
 * Frontend polls /api/notifications?since=<timestamp> to get new events.
 * TTL auto-deletes after 5 minutes.
 */

import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  channel: {
    type: String,
    required: true,
    index: true  // e.g., 'backup-notifications', 'user:<userId>'
  },
  event: {
    type: String,
    required: true  // e.g., 'backup:progress', 'deployment:progress', 'agent:status-changed'
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300  // TTL: auto-delete after 5 minutes
  }
});

// Compound index for efficient polling
notificationSchema.index({ channel: 1, createdAt: 1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;

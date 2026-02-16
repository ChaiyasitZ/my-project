/**
 * ShellSession Model - Buffers interactive shell I/O for polling
 * 
 * Since Vercel serverless can't maintain WebSocket connections,
 * shell input/output is buffered in MongoDB.
 * 
 * Flow:
 * - Frontend sends input → stored in inputBuffer
 * - Agent reads inputBuffer, forwards to shell, stores output in outputChunks
 * - Frontend polls outputChunks with a cursor (lastReadIndex)
 */

import mongoose from 'mongoose';

const shellSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  deviceId: {
    type: String,
    required: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'closed'],
    default: 'active'
  },
  // Output chunks from the device (agent writes, frontend reads)
  outputChunks: [{
    data: String,
    timestamp: { type: Date, default: Date.now }
  }],
  // Input queue from the frontend (frontend writes, agent reads)
  inputQueue: [{
    data: String,
    timestamp: { type: Date, default: Date.now }
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600  // TTL: auto-delete after 1 hour
  }
});

const ShellSession = mongoose.model('ShellSession', shellSessionSchema);
export default ShellSession;

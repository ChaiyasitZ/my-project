/**
 * Agent Routes - Agent polling, token management, shell I/O, notifications
 * 
 * Replaces Socket.IO with HTTP polling for Vercel serverless compatibility.
 */

import express from 'express';
import crypto from 'crypto';
import User from '../models/User.js';
import AgentCommand from '../models/AgentCommand.js';
import AgentHeartbeat from '../models/AgentHeartbeat.js';
import ShellSession from '../models/ShellSession.js';
import Notification from '../models/Notification.js';
import { authenticateToken } from '../middleware/auth.js';
import agentRelay from '../services/agentRelay.js';

const router = express.Router();

// ════════════════════════════════════════
// WEB APP ENDPOINTS (require JWT auth)
// ════════════════════════════════════════

/**
 * GET /api/agent/status - Get agent connection status
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const agentInfo = await agentRelay.getAgentInfo(req.userId);
    const user = await User.findById(req.userId).select('agentToken');
    
    res.json({
      online: !!agentInfo,
      agent: agentInfo,
      hasToken: !!user?.agentToken
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/agent/generate-token - Generate a new agent token
 */
router.post('/generate-token', authenticateToken, async (req, res) => {
  try {
    const token = crypto.randomBytes(32).toString('hex');
    
    await User.findByIdAndUpdate(req.userId, { agentToken: token });
    
    res.json({
      success: true,
      agentToken: token,
      message: 'Use this token in the NetConfig Agent to connect.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/agent/revoke-token - Revoke the agent token
 */
router.delete('/revoke-token', authenticateToken, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.userId, { agentToken: null });
    await AgentHeartbeat.deleteOne({ userId: req.userId });
    
    res.json({ success: true, message: 'Agent token revoked.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/agent/token - Get current agent token
 */
router.get('/token', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('agentToken');
    
    res.json({
      hasToken: !!user.agentToken,
      agentToken: user.agentToken || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/agent/command - Send a command to the agent (via queue)
 * Long-polls for up to 8 seconds for the result.
 */
router.post('/command', authenticateToken, async (req, res) => {
  try {
    const { event, data, timeout } = req.body;
    
    const isOnline = await agentRelay.isAgentOnline(req.userId);
    if (!isOnline) {
      return res.status(503).json({ 
        error: 'Agent not connected. Please start the NetConfig Agent on your computer.',
        agentRequired: true
      });
    }
    
    const result = await agentRelay.sendToAgent(req.userId, event, data, timeout || 8000);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/agent/command/:commandId - Poll for command result (async fallback)
 */
router.get('/command/:commandId', authenticateToken, async (req, res) => {
  try {
    const command = await AgentCommand.findOne({ 
      _id: req.params.commandId, 
      userId: req.userId 
    });
    
    if (!command) {
      return res.status(404).json({ error: 'Command not found' });
    }
    
    res.json({
      status: command.status,
      result: command.result,
      error: command.error
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ════════════════════════════════════════
// SHELL SESSION ENDPOINTS (require JWT auth)
// ════════════════════════════════════════

/**
 * POST /api/agent/shell/input - Send keystrokes to shell session
 */
router.post('/shell/input', authenticateToken, async (req, res) => {
  try {
    const { sessionId, data } = req.body;
    
    await ShellSession.updateOne(
      { sessionId, userId: req.userId, status: 'active' },
      { $push: { inputQueue: { data, timestamp: new Date() } } }
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/agent/shell/output/:sessionId - Poll for shell output
 */
router.get('/shell/output/:sessionId', authenticateToken, async (req, res) => {
  try {
    const since = parseInt(req.query.since) || 0; // Index cursor
    
    const session = await ShellSession.findOne({ 
      sessionId: req.params.sessionId, 
      userId: req.userId 
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Shell session not found' });
    }
    
    // Return output chunks after the cursor
    const newChunks = session.outputChunks.slice(since);
    
    res.json({
      status: session.status,
      chunks: newChunks,
      nextCursor: session.outputChunks.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ════════════════════════════════════════
// NOTIFICATION POLLING (require JWT auth)
// ════════════════════════════════════════

/**
 * GET /api/agent/notifications - Poll for real-time notifications
 * Replaces Socket.IO event subscription.
 */
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const since = req.query.since ? new Date(req.query.since) : new Date(Date.now() - 30000);
    
    const notifications = await Notification.find({
      channel: { $in: ['backup-notifications', `user:${req.userId}`] },
      createdAt: { $gt: since }
    }).sort({ createdAt: 1 }).limit(50);
    
    res.json({
      notifications: notifications.map(n => ({
        event: n.event,
        data: n.data,
        timestamp: n.createdAt
      })),
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ════════════════════════════════════════
// OLLAMA / LLM ENDPOINTS (require JWT auth)
// Route LLM requests through the user's agent to local Ollama
// ════════════════════════════════════════

/**
 * GET /api/agent/ollama/status - Get Ollama status from user's agent
 */
router.get('/ollama/status', authenticateToken, async (req, res) => {
  try {
    const isOnline = await agentRelay.isAgentOnline(req.userId);
    if (!isOnline) {
      return res.json({
        agentOnline: false,
        ollama: { available: false, error: 'Agent not connected' }
      });
    }

    const result = await agentRelay.sendToAgent(req.userId, 'agent:ollama:status', {});
    res.json({
      agentOnline: true,
      ollama: result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/agent/ollama/models - List available Ollama models
 */
router.get('/ollama/models', authenticateToken, async (req, res) => {
  try {
    const result = await agentRelay.sendToAgent(req.userId, 'agent:ollama:models', {});
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/agent/ollama/model - Set the active Ollama model
 */
router.post('/ollama/model', authenticateToken, async (req, res) => {
  try {
    const { model } = req.body;
    if (!model) return res.status(400).json({ error: 'model is required' });

    const result = await agentRelay.sendToAgent(req.userId, 'agent:ollama:set-model', { model });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/agent/ollama/chat - Send a chat completion request through agent to Ollama
 * Returns commandId for async polling since LLM generation can be slow.
 */
router.post('/ollama/chat', authenticateToken, async (req, res) => {
  try {
    const { messages, model, temperature, max_tokens, top_p, frequency_penalty, presence_penalty, stop } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const isOnline = await agentRelay.isAgentOnline(req.userId);
    if (!isOnline) {
      return res.status(503).json({
        error: 'Agent not connected. Please start the NetConfig Agent.',
        agentRequired: true
      });
    }

    // Use async send since LLM generation can take 30-120 seconds
    const commandId = await agentRelay.sendToAgentAsync(req.userId, 'agent:ollama:chat', {
      messages, model, temperature, max_tokens, top_p, frequency_penalty, presence_penalty, stop
    });

    res.json({ 
      success: true, 
      commandId,
      message: 'Chat request sent to Ollama via agent. Poll for result.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/agent/ollama/result/:commandId - Poll for Ollama command result
 */
router.get('/ollama/result/:commandId', authenticateToken, async (req, res) => {
  try {
    const command = await AgentCommand.findOne({
      _id: req.params.commandId,
      userId: req.userId
    });

    if (!command) {
      return res.status(404).json({ error: 'Command not found' });
    }

    if (command.status === 'completed') {
      return res.json({ status: 'completed', result: command.result });
    }
    if (command.status === 'failed') {
      return res.json({ status: 'failed', error: command.error });
    }

    // Still pending or processing
    res.json({ status: command.status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ════════════════════════════════════════
// AGENT POLLING ENDPOINTS (require agent token)
// ════════════════════════════════════════

/**
 * Middleware: Authenticate agent by token header
 */
async function authenticateAgent(req, res, next) {
  try {
    const token = req.headers['x-agent-token'];
    if (!token) {
      return res.status(401).json({ error: 'Agent token required' });
    }

    const user = await User.findOne({ agentToken: token, isActive: true });
    if (!user) {
      return res.status(401).json({ error: 'Invalid agent token' });
    }

    req.userId = user._id.toString();
    req.agentUser = user;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * POST /api/agent/poll/heartbeat - Agent heartbeat (call every 5s)
 */
router.post('/poll/heartbeat', authenticateAgent, async (req, res) => {
  try {
    const { agentName, agentVersion, platform, hostname } = req.body;
    
    await AgentHeartbeat.findOneAndUpdate(
      { userId: req.userId },
      {
        userId: req.userId,
        agentName: agentName || 'Unknown',
        agentVersion: agentVersion || '0.0.0',
        platform: platform || 'unknown',
        hostname: hostname || 'unknown',
        lastHeartbeat: new Date()
      },
      { upsert: true, new: true }
    );
    
    res.json({ success: true, serverTime: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/agent/poll/commands - Agent polls for pending commands
 */
router.get('/poll/commands', authenticateAgent, async (req, res) => {
  try {
    // Find and claim pending commands (atomic findOneAndUpdate)
    const commands = await AgentCommand.find({
      userId: req.userId,
      status: 'pending'
    }).sort({ createdAt: 1 }).limit(10);

    // Mark them as processing
    const commandIds = commands.map(c => c._id);
    if (commandIds.length > 0) {
      await AgentCommand.updateMany(
        { _id: { $in: commandIds } },
        { status: 'processing', processedAt: new Date() }
      );
    }

    res.json({
      commands: commands.map(c => ({
        commandId: c._id.toString(),
        event: c.event,
        data: c.data
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/agent/poll/result/:commandId - Agent posts command result
 */
router.post('/poll/result/:commandId', authenticateAgent, async (req, res) => {
  try {
    const { success, error: errorMsg, ...resultData } = req.body;
    
    await AgentCommand.findOneAndUpdate(
      { _id: req.params.commandId, userId: req.userId },
      {
        status: success ? 'completed' : 'failed',
        result: success ? { success: true, ...resultData } : null,
        error: errorMsg || null,
        completedAt: new Date()
      }
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/agent/poll/shell-output - Agent pushes shell output chunks
 */
router.post('/poll/shell-output', authenticateAgent, async (req, res) => {
  try {
    const { sessionId, data } = req.body;
    
    await ShellSession.updateOne(
      { sessionId, userId: req.userId, status: 'active' },
      { $push: { outputChunks: { data, timestamp: new Date() } } }
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/agent/poll/shell-input/:sessionId - Agent reads pending input
 */
router.get('/poll/shell-input/:sessionId', authenticateAgent, async (req, res) => {
  try {
    const session = await ShellSession.findOne({
      sessionId: req.params.sessionId,
      userId: req.userId,
      status: 'active'
    });
    
    if (!session) {
      return res.json({ inputs: [], closed: true });
    }
    
    // Get and clear input queue atomically
    const inputs = session.inputQueue.map(i => i.data);
    if (inputs.length > 0) {
      await ShellSession.updateOne(
        { sessionId: req.params.sessionId },
        { $set: { inputQueue: [] } }
      );
    }
    
    res.json({ inputs, closed: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/agent/poll/shell-closed - Agent notifies shell is closed
 */
router.post('/poll/shell-closed', authenticateAgent, async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    await ShellSession.updateOne(
      { sessionId, userId: req.userId },
      { status: 'closed' }
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/agent/poll/shell-create - Agent creates a new shell session record
 */
router.post('/poll/shell-create', authenticateAgent, async (req, res) => {
  try {
    const { sessionId, deviceId } = req.body;
    
    await ShellSession.create({
      userId: req.userId,
      deviceId,
      sessionId,
      status: 'active'
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

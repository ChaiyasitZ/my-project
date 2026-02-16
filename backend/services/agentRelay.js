/**
 * Agent Relay Service (HTTP Polling Version)
 * 
 * Replaces Socket.IO with a MongoDB command queue for Vercel serverless.
 * 
 * Architecture:
 *   [Web Browser] → [Vercel API] → [MongoDB Queue] ← [Agent polls via HTTP]
 *   [Agent] → [MongoDB Result] → [Vercel API] → [Web Browser polls]
 */

import AgentCommand from '../models/AgentCommand.js';
import AgentHeartbeat from '../models/AgentHeartbeat.js';
import Notification from '../models/Notification.js';

class AgentRelay {
  constructor() {
    // No Socket.IO — everything goes through MongoDB
  }

  /**
   * Initialize (no-op for polling version, kept for API compatibility)
   */
  initialize() {
    console.log('🤖 Agent relay initialized (HTTP polling mode)');
  }

  /**
   * Send a command to a user's agent via the command queue.
   * Waits up to `timeoutMs` for the agent to respond.
   */
  async sendToAgent(userId, event, data, timeoutMs = 8000) {
    // Check if agent is online first
    const online = await this.isAgentOnline(userId);
    if (!online) {
      throw new Error('No agent connected. Please start the NetConfig Agent on your computer.');
    }

    // Create command in queue
    const command = await AgentCommand.create({
      userId,
      event,
      data,
      status: 'pending'
    });

    // Long-poll: wait for result (up to timeoutMs, leave 2s buffer for Vercel)
    const maxWait = Math.min(timeoutMs, 8000);
    const pollInterval = 300; // Check every 300ms
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const updated = await AgentCommand.findById(command._id);
      
      if (updated.status === 'completed') {
        return updated.result || { success: true };
      }
      
      if (updated.status === 'failed') {
        throw new Error(updated.error || 'Agent command failed');
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    // Timeout — return the command ID for async polling
    return { 
      success: false, 
      pending: true, 
      commandId: command._id.toString(),
      message: 'Command sent to agent. Poll for result.' 
    };
  }

  /**
   * Send data to agent without waiting (fire-and-forget via queue)
   */
  async sendToAgentNoWait(userId, event, data) {
    const online = await this.isAgentOnline(userId);
    if (!online) return false;

    await AgentCommand.create({
      userId,
      event,
      data,
      status: 'pending'
    });
    return true;
  }

  /**
   * Send a command to the agent and return the command ID immediately.
   * Used for long-running operations (e.g., Ollama LLM generation).
   * Caller should poll for the result via AgentCommand.findById.
   */
  async sendToAgentAsync(userId, event, data) {
    const online = await this.isAgentOnline(userId);
    if (!online) {
      throw new Error('No agent connected. Please start the NetConfig Agent on your computer.');
    }

    const command = await AgentCommand.create({
      userId,
      event,
      data,
      status: 'pending'
    });

    return command._id.toString();
  }

  /**
   * Broadcast to user's web clients via notification store
   */
  async broadcastToUser(userId, event, data) {
    await Notification.create({
      channel: `user:${userId}`,
      event,
      data
    });
  }

  /**
   * Check if user has an agent connected (heartbeat within last 15s)
   */
  async isAgentOnline(userId) {
    const agent = await AgentHeartbeat.getOnlineAgent(userId.toString());
    return !!agent;
  }

  /**
   * Get agent info for a user
   */
  async getAgentInfo(userId) {
    return await AgentHeartbeat.getOnlineAgent(userId.toString());
  }

  /**
   * Get all connected agents (admin view)
   */
  async getAllAgents() {
    const cutoff = new Date(Date.now() - 15000);
    const agents = await AgentHeartbeat.find({ lastHeartbeat: { $gte: cutoff } });
    return agents.map(a => ({
      userId: a.userId,
      name: a.agentName,
      version: a.agentVersion,
      platform: a.platform,
      hostname: a.hostname,
      connectedAt: a.connectedAt,
      lastHeartbeat: a.lastHeartbeat
    }));
  }

  // Compatibility stubs (no-op in polling mode)
  setMainIo() {}
}

// Singleton
const agentRelay = new AgentRelay();
export default agentRelay;

/**
 * Model Comparison Service - private research logging only.
 *
 * Queues a real Ollama call (same prompt, run through the user's agent) purely
 * so its output can be compared later against the OpenRouter result that was
 * actually delivered. Never shown in the UI, never used as a generated
 * configuration, and never affects the response the user gets — if the agent
 * isn't online this silently does nothing.
 *
 * Why this doesn't touch the request/response cycle at all:
 * on Vercel serverless there's no guarantee a "fire and forget" async task
 * keeps running after the HTTP response is sent. Instead this just queues an
 * AgentCommand (a single fast DB write) and stashes the comparison context in
 * that command's `data`. The agent picks it up on its own polling loop later,
 * and when it posts the result back to POST /api/agent/poll/result/:commandId
 * (a separate request initiated by the agent, not this one), that route
 * detects the `comparisonLog` flag and writes the ModelComparisonLog entry.
 */
import agentRelay from './agentRelay.js';
import llmService from './llmService.js';

const COMPARISON_MODEL = 'qwen2.5-coder:7b';

export async function queueComparison({ userId, deviceId, deviceType, deviceContext, prompt, templateName, openrouter }) {
  try {
    if (!userId || !prompt) return;

    const online = await agentRelay.isAgentOnline(userId);
    if (!online) return;

    // Check Ollama is actually reachable on the agent's machine (not just
    // that the agent itself is connected) before queuing anything. If it's
    // not running, skip quietly — server-side log only, nothing surfaced to
    // the user, and no attempt made to start it from here (that only happens
    // once at agent startup, never in response to a prompt).
    let statusResult;
    try {
      statusResult = await agentRelay.sendToAgent(userId, 'agent:ollama:status', {}, 4000);
    } catch (err) {
      console.log(`Model comparison skipped (Ollama status check failed): ${err.message}`);
      return;
    }
    if (statusResult?.pending || !statusResult?.available) {
      console.log('Model comparison skipped: Ollama not running on agent.');
      return;
    }

    const messages = llmService.getComparisonMessages(prompt, deviceType, deviceContext, templateName);

    await agentRelay.sendToAgentAsync(userId, 'agent:ollama:chat', {
      messages,
      model: COMPARISON_MODEL,
      temperature: 0.3,
      max_tokens: 1500,
      // Metadata only used by POST /poll/result/:commandId once the agent
      // responds — the agent itself ignores these extra fields.
      comparisonLog: true,
      comparisonContext: {
        deviceId: deviceId || null,
        deviceType: deviceType || null,
        prompt,
        openrouter: openrouter || null
      }
    });
  } catch (error) {
    // Best-effort only; never let this affect the real generation request.
    console.warn('Model comparison queue failed (non-fatal):', error.message);
  }
}

export default { queueComparison };

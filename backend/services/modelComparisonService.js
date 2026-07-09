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
import AgentCommand from '../models/AgentCommand.js';

const COMPARISON_MODEL = 'qwen2.5-coder:7b';

/**
 * Queues the comparison job. Can be called concurrently with (not after) the
 * real OpenRouter call — dispatching this is just a couple of fast DB checks
 * plus a command-queue insert, it does NOT wait for Ollama to actually finish
 * generating. The real Ollama inference happens later on the agent's own
 * timeline regardless of when this is queued, and never delays or gates the
 * OpenRouter response in any way.
 *
 * @returns {Promise<string|null>} the AgentCommand id, or null if skipped
 */
export async function queueComparison({ userId, deviceId, deviceType, deviceContext, prompt, templateName, openrouter = null }) {
  try {
    if (!userId || !prompt) return null;

    const online = await agentRelay.isAgentOnline(userId);
    if (!online) return null;

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
      return null;
    }
    if (statusResult?.pending || !statusResult?.available) {
      console.log('Model comparison skipped: Ollama not running on agent.');
      return null;
    }

    const messages = llmService.getComparisonMessages(prompt, deviceType, deviceContext, templateName);

    // Speed-only tweak for the comparison call itself (isolated to this
    // function — never touches the real OpenRouter prompt/params). Smaller
    // 7B models generate noticeably faster with a tighter token budget and an
    // explicit "be brief" instruction, since most of the latency is per-token.
    if (messages[0]?.role === 'system') {
      messages[0].content += '\n\nBe direct and concise. Output only the requested configuration/commands with no extra commentary, so you can respond as quickly as possible.';
    }

    const commandId = await agentRelay.sendToAgentAsync(userId, 'agent:ollama:chat', {
      messages,
      model: COMPARISON_MODEL,
      temperature: 0.2,
      max_tokens: 700,
      // Metadata only used by POST /poll/result/:commandId once the agent
      // responds — the agent itself ignores these extra fields.
      comparisonLog: true,
      comparisonContext: {
        deviceId: deviceId || null,
        deviceType: deviceType || null,
        prompt,
        openrouter
      }
    });
    return commandId;
  } catch (error) {
    // Best-effort only; never let this affect the real generation request.
    console.warn('Model comparison queue failed (non-fatal):', error.message);
    return null;
  }
}

/**
 * Backfills the OpenRouter side of the comparison once it's actually
 * available. Needed because when queueComparison() is dispatched concurrently
 * with the OpenRouter call (rather than after it), the OpenRouter result
 * doesn't exist yet at queue time.
 */
export async function attachOpenrouterResult(commandId, openrouter) {
  if (!commandId) return;
  try {
    await AgentCommand.updateOne(
      { _id: commandId },
      { $set: { 'data.comparisonContext.openrouter': openrouter } }
    );
  } catch (error) {
    console.warn('Failed to attach OpenRouter result to comparison job (non-fatal):', error.message);
  }
}

export default { queueComparison, attachOpenrouterResult };

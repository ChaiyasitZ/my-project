/**
 * Device Reconciliation - keeps device SSH status in sync with agent availability.
 *
 * Devices connected via the desktop agent live only as long as the agent process
 * does. If the agent goes offline (quit, crash, lost network) the SSH session
 * inside it is gone, but the device's `ssh_status` in the database doesn't know
 * that until something reconciles it. This is called from two places:
 *
 *  - Immediately, when an agent announces it's going offline on purpose
 *    (see POST /api/agent/poll/offline) — covers quit/manual-disconnect/uninstall.
 *  - On read paths already polled by the frontend (GET /devices, GET /devices/ssh/status-all)
 *    — covers crashes/network loss, bounded by how often those are polled.
 */
import Device from '../models/Device.js';
import agentRelay from './agentRelay.js';
import { invalidateCache, CacheKeys } from '../lib/cache.js';

export async function reconcileAgentDevices(userId) {
  try {
    const online = await agentRelay.isAgentOnline(userId);
    if (online) return 0;

    const result = await Device.updateMany(
      { userId, ssh_status: 'connected', ssh_session_id: { $regex: '^agent-' } },
      {
        $set: {
          ssh_status: 'disconnected',
          status: 'inactive',
          ssh_session_id: null,
          ssh_connected_at: null
        }
      }
    );

    const disconnectedCount = result.modifiedCount || 0;
    if (disconnectedCount > 0) {
      invalidateCache(CacheKeys.devices(userId));
      console.log(`⚠️ Agent offline: auto-disconnected ${disconnectedCount} device(s) for user ${userId}`);
    }
    return disconnectedCount;
  } catch (error) {
    console.warn('Failed to reconcile agent-connected devices:', error.message);
    return 0;
  }
}

export default { reconcileAgentDevices };

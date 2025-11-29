import { io } from '../server.js';

class NotificationService {
  /**
   * Emit backup progress event to all connected clients
   * @param {string} stage - Backup stage (pre-deployment, deployment, post-deployment, schedule)
   * @param {string} status - Status (in-progress, complete, failed)
   * @param {string} message - Human-readable message
   * @param {object} data - Additional data (backupId, deviceName, etc.)
   */
  emitBackupProgress(stage, status, message, data = {}) {
    const event = {
      stage,
      status,
      message,
      timestamp: new Date().toISOString(),
      ...data
    };

    io.to('backup-notifications').emit('backup:progress', event);
    console.log(`📡 Emitted backup:progress - ${stage}: ${message}`);
  }

  /**
   * Emit deployment progress event
   * @param {string} status - Status (started, in-progress, complete, failed)
   * @param {string} message - Human-readable message
   * @param {object} data - Additional deployment data
   */
  emitDeploymentProgress(status, message, data = {}) {
    const event = {
      status,
      message,
      timestamp: new Date().toISOString(),
      ...data
    };

    io.to('backup-notifications').emit('deployment:progress', event);
    console.log(`📡 Emitted deployment:progress - ${status}: ${message}`);
  }

  /**
   * Emit post-deploy schedule results
   * @param {array} schedules - Array of schedule execution results
   * @param {object} summary - Summary statistics
   */
  emitPostDeployScheduleResults(schedules, summary) {
    const event = {
      schedules,
      summary,
      timestamp: new Date().toISOString()
    };

    io.to('backup-notifications').emit('backup:schedule-results', event);
    console.log(`📡 Emitted backup:schedule-results - ${summary.total_schedules} schedules, ${summary.total_devices_backed_up} devices backed up`);
  }

  /**
   * Emit backup completion summary
   * @param {object} summary - Complete backup summary
   */
  emitBackupSummary(summary) {
    const event = {
      ...summary,
      timestamp: new Date().toISOString()
    };

    io.to('backup-notifications').emit('backup:summary', event);
    console.log(`📡 Emitted backup:summary - Deployment complete`);
  }

  /**
   * Emit error notification
   * @param {string} type - Error type
   * @param {string} message - Error message
   * @param {object} details - Error details
   */
  emitError(type, message, details = {}) {
    const event = {
      type,
      message,
      details,
      timestamp: new Date().toISOString()
    };

    io.to('backup-notifications').emit('backup:error', event);
    console.error(`📡 Emitted backup:error - ${type}: ${message}`);
  }
}

const notificationService = new NotificationService();
export default notificationService;

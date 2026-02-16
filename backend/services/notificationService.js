import Notification from '../models/Notification.js';

class NotificationService {
  /**
   * Emit backup progress event — stored in MongoDB for frontend polling
   */
  async emitBackupProgress(stage, status, message, data = {}) {
    const event = {
      stage,
      status,
      message,
      timestamp: new Date().toISOString(),
      ...data
    };

    await Notification.create({
      channel: 'backup-notifications',
      event: 'backup:progress',
      data: event
    });
    console.log(`📡 Stored backup:progress - ${stage}: ${message}`);
  }

  /**
   * Emit deployment progress event
   */
  async emitDeploymentProgress(status, message, data = {}) {
    const event = {
      status,
      message,
      timestamp: new Date().toISOString(),
      ...data
    };

    await Notification.create({
      channel: 'backup-notifications',
      event: 'deployment:progress',
      data: event
    });
    console.log(`📡 Stored deployment:progress - ${status}: ${message}`);
  }

  /**
   * Emit post-deploy schedule results
   */
  async emitPostDeployScheduleResults(schedules, summary) {
    const event = {
      schedules,
      summary,
      timestamp: new Date().toISOString()
    };

    await Notification.create({
      channel: 'backup-notifications',
      event: 'backup:schedule-results',
      data: event
    });
    console.log(`📡 Stored backup:schedule-results - ${summary.total_schedules} schedules, ${summary.total_devices_backed_up} devices backed up`);
  }

  /**
   * Emit backup completion summary
   */
  async emitBackupSummary(summary) {
    const event = {
      ...summary,
      timestamp: new Date().toISOString()
    };

    await Notification.create({
      channel: 'backup-notifications',
      event: 'backup:summary',
      data: event
    });
    console.log(`📡 Stored backup:summary - Deployment complete`);
  }

  /**
   * Emit error notification
   */
  async emitError(type, message, details = {}) {
    const event = {
      type,
      message,
      details,
      timestamp: new Date().toISOString()
    };

    await Notification.create({
      channel: 'backup-notifications',
      event: 'backup:error',
      data: event
    });
    console.error(`📡 Stored backup:error - ${type}: ${message}`);
  }
}

const notificationService = new NotificationService();
export default notificationService;

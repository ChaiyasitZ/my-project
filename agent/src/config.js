/**
 * Agent Configuration Manager
 * Stores settings locally on the user's machine
 */

import Conf from 'conf';
import { randomBytes } from 'crypto';

export class AgentConfig {
  constructor() {
    this.store = new Conf({
      projectName: 'netconfig-agent',
      schema: {
        serverUrl: {
          type: 'string',
          default: ''
        },
        agentToken: {
          type: 'string',
          default: ''
        },
        agentName: {
          type: 'string',
          default: 'Default Agent'
        },
        agentId: {
          type: 'string',
          default: ''
        },
        autoReconnect: {
          type: 'boolean',
          default: true
        },
        reconnectInterval: {
          type: 'number',
          default: 5000
        }
      }
    });

    // Generate unique agent ID if not exists
    if (!this.store.get('agentId')) {
      this.store.set('agentId', randomBytes(16).toString('hex'));
    }
  }

  get(key) {
    return this.store.get(key);
  }

  set(key, value) {
    this.store.set(key, value);
  }

  getAll() {
    return this.store.store;
  }

  clear() {
    this.store.clear();
  }
}

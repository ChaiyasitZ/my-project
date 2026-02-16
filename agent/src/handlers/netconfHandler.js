/**
 * NETCONF Handler - Manages NETCONF connections to local network devices
 */

import { Client } from 'ssh2';

export class NetconfHandler {
  constructor() {
    this.connections = new Map();
    this.defaultPort = 830;
    this.sessionTimeout = 300000;

    this.NETCONF_HELLO = `<?xml version="1.0" encoding="UTF-8"?>
<hello xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <capabilities>
    <capability>urn:ietf:params:netconf:base:1.0</capability>
    <capability>urn:ietf:params:netconf:capability:writable-running:1.0</capability>
    <capability>urn:ietf:params:netconf:capability:candidate:1.0</capability>
  </capabilities>
</hello>]]>]]>`;

    this.MESSAGE_DELIMITER = ']]>]]>';
  }

  /**
   * Connect to device via NETCONF
   */
  async connect(deviceConfig) {
    const { deviceId, ip_address, username, password, netconf_port } = deviceConfig;
    const port = netconf_port || this.defaultPort;

    this.disconnect(deviceId);

    return new Promise((resolve, reject) => {
      const conn = new Client();

      const timeout = setTimeout(() => {
        conn.end();
        reject(new Error('NETCONF connection timeout'));
      }, 30000);

      conn.on('ready', () => {
        clearTimeout(timeout);

        conn.subsys('netconf', (err, stream) => {
          if (err) {
            conn.end();
            return reject(new Error(`NETCONF subsystem error: ${err.message}`));
          }

          let buffer = '';
          let helloReceived = false;
          let serverCapabilities = [];
          let messageId = 1;

          stream.on('data', (data) => {
            buffer += data.toString();

            if (!helloReceived && buffer.includes(this.MESSAGE_DELIMITER)) {
              helloReceived = true;
              // Parse server capabilities
              const helloMatch = buffer.match(/<capability>([^<]+)<\/capability>/g);
              if (helloMatch) {
                serverCapabilities = helloMatch.map(c => c.replace(/<\/?capability>/g, ''));
              }
              buffer = '';
            }
          });

          // Send client hello
          stream.write(this.NETCONF_HELLO);

          this.connections.set(deviceId, {
            connection: conn,
            stream,
            messageId,
            serverCapabilities,
            ip_address,
            createdAt: Date.now(),
            lastUsed: Date.now()
          });

          // Wait for hello exchange
          const helloTimeout = setTimeout(() => {
            if (this.connections.has(deviceId)) {
              resolve({
                success: true,
                deviceId,
                message: `NETCONF connected to ${ip_address}`,
                capabilities: serverCapabilities
              });
            }
          }, 3000);
        });
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`NETCONF SSH error: ${err.message}`));
      });

      conn.connect({
        host: ip_address,
        port,
        username,
        password,
        readyTimeout: 15000,
        algorithms: {
          kex: ['diffie-hellman-group14-sha256', 'diffie-hellman-group14-sha1', 'diffie-hellman-group-exchange-sha256', 'diffie-hellman-group1-sha1'],
          cipher: ['aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'aes128-cbc', 'aes256-cbc'],
        }
      });
    });
  }

  /**
   * Send NETCONF RPC operation
   */
  async sendRPC(deviceId, rpcBody) {
    const entry = this.connections.get(deviceId);
    if (!entry) throw new Error('Device not connected via NETCONF');

    entry.lastUsed = Date.now();
    const msgId = ++entry.messageId;

    const rpc = `<?xml version="1.0" encoding="UTF-8"?>
<rpc message-id="${msgId}" xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
${rpcBody}
</rpc>${this.MESSAGE_DELIMITER}`;

    return new Promise((resolve, reject) => {
      let buffer = '';
      const timeout = setTimeout(() => {
        reject(new Error('NETCONF RPC timeout'));
      }, 30000);

      const onData = (data) => {
        buffer += data.toString();
        if (buffer.includes(this.MESSAGE_DELIMITER)) {
          clearTimeout(timeout);
          entry.stream.removeListener('data', onData);
          const response = buffer.split(this.MESSAGE_DELIMITER)[0];
          resolve({ success: true, response, messageId: msgId });
        }
      };

      entry.stream.on('data', onData);
      entry.stream.write(rpc);
    });
  }

  /**
   * Get running configuration
   */
  async getConfig(deviceId, filter = '') {
    const filterXml = filter ? `<filter type="subtree">${filter}</filter>` : '';
    return this.sendRPC(deviceId, `<get-config><source><running/></source>${filterXml}</get-config>`);
  }

  /**
   * Edit configuration
   */
  async editConfig(deviceId, configXml) {
    return this.sendRPC(deviceId, `<edit-config><target><running/></target><config>${configXml}</config></edit-config>`);
  }

  /**
   * Check if device is connected
   */
  isConnected(deviceId) {
    return this.connections.has(deviceId);
  }

  /**
   * Disconnect from a device
   */
  disconnect(deviceId) {
    const entry = this.connections.get(deviceId);
    if (entry) {
      try { entry.stream.end(); } catch (e) {}
      try { entry.connection.end(); } catch (e) {}
      this.connections.delete(deviceId);
    }
  }

  /**
   * Disconnect all
   */
  async disconnectAll() {
    for (const [deviceId] of this.connections) {
      this.disconnect(deviceId);
    }
  }

  getStatus() {
    const status = {};
    for (const [deviceId, entry] of this.connections) {
      status[deviceId] = {
        connected: true,
        ip_address: entry.ip_address,
        connectedSince: entry.createdAt,
        lastUsed: entry.lastUsed
      };
    }
    return status;
  }
}

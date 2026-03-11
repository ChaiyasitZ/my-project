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
    const { deviceId, host, ip_address, username, password, port, netconf_port } = deviceConfig;
    const connectHost = host || ip_address;
    const connectPort = port || netconf_port || this.defaultPort;

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
          let messageId = 1;

          // Store connection entry with mutable capabilities array
          const entry = {
            connection: conn,
            stream,
            messageId,
            serverCapabilities: [],
            ip_address: connectHost,
            createdAt: Date.now(),
            lastUsed: Date.now()
          };
          this.connections.set(deviceId, entry);

          const helloHandler = (data) => {
            buffer += data.toString();

            if (!helloReceived && buffer.includes(this.MESSAGE_DELIMITER)) {
              helloReceived = true;
              stream.removeListener('data', helloHandler);

              // Parse server capabilities
              const helloMatch = buffer.match(/<capability>([^<]+)<\/capability>/g);
              if (helloMatch) {
                entry.serverCapabilities = helloMatch.map(c => c.replace(/<\/?capability>/g, ''));
              }
              buffer = '';

              // Send client hello
              stream.write(this.NETCONF_HELLO);

              // Resolve after hello exchange completes
              setTimeout(() => {
                resolve({
                  success: true,
                  deviceId,
                  message: `NETCONF connected to ${connectHost}`,
                  capabilities: entry.serverCapabilities
                });
              }, 500);
            }
          };

          stream.on('data', helloHandler);

          // Fallback timeout if hello never arrives
          setTimeout(() => {
            if (!helloReceived) {
              helloReceived = true;
              stream.removeListener('data', helloHandler);
              // Send hello anyway
              stream.write(this.NETCONF_HELLO);
              resolve({
                success: true,
                deviceId,
                message: `NETCONF connected to ${connectHost} (no hello received)`,
                capabilities: entry.serverCapabilities
              });
            }
          }, 5000);

          stream.on('close', () => {
            this.connections.delete(deviceId);
          });
        });
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`NETCONF SSH error: ${err.message}`));
      });

      conn.connect({
        host: connectHost,
        port: connectPort,
        username,
        password,
        readyTimeout: 15000,
        hostVerifier: () => true,
        algorithms: {
          kex: [
            'ecdh-sha2-nistp256',
            'ecdh-sha2-nistp384',
            'ecdh-sha2-nistp521',
            'diffie-hellman-group14-sha256',
            'diffie-hellman-group14-sha1',
            'diffie-hellman-group1-sha1'
          ],
          cipher: [
            'aes128-ctr', 'aes192-ctr', 'aes256-ctr',
            'aes128-gcm', 'aes128-gcm@openssh.com',
            'aes256-gcm', 'aes256-gcm@openssh.com',
            'aes128-cbc', 'aes192-cbc', 'aes256-cbc',
            '3des-cbc'
          ],
          hmac: [
            'hmac-sha2-256', 'hmac-sha2-512', 'hmac-sha1'
          ],
          serverHostKey: [
            'ssh-rsa', 'ssh-dss',
            'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521',
            'ssh-ed25519',
            'rsa-sha2-256', 'rsa-sha2-512'
          ]
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
      }, 60000);

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
   * Edit configuration using proper candidate datastore workflow
   * Both CSR1000v (IOS-XE) and Nexus 9000v (NX-OS) require:
   * lock candidate → edit-config candidate → commit → unlock candidate
   */
  async editConfig(deviceId, configXml) {
    const entry = this.connections.get(deviceId);
    if (!entry) throw new Error('Device not connected via NETCONF');

    const supportCandidate = entry.serverCapabilities.some(c =>
      c.includes('candidate')
    );

    if (!supportCandidate) {
      // Fallback: direct edit to running (legacy devices)
      return this.sendRPC(deviceId, `<edit-config><target><running/></target><config>${configXml}</config></edit-config>`);
    }

    // Step 1: Discard any leftover candidate changes
    try {
      await this.sendRPC(deviceId, `<discard-changes/>`);
    } catch (e) { /* ignore */ }

    // Step 2: Lock candidate datastore
    await this.sendRPC(deviceId, `<lock><target><candidate/></target></lock>`);

    try {
      // Step 3: Edit candidate config
      const editResult = await this.sendRPC(deviceId,
        `<edit-config><target><candidate/></target><default-operation>merge</default-operation><config>${configXml}</config></edit-config>`
      );

      // Check for rpc-error in edit-config response
      if (editResult.response && editResult.response.includes('<rpc-error>')) {
        const errMsg = editResult.response.match(/<error-message[^>]*>([^<]+)<\/error-message>/);
        throw new Error(`edit-config failed: ${errMsg ? errMsg[1] : 'unknown error'}`);
      }

      // Step 4: Commit
      const commitResult = await this.sendRPC(deviceId, `<commit/>`);

      if (commitResult.response && commitResult.response.includes('<rpc-error>')) {
        const errMsg = commitResult.response.match(/<error-message[^>]*>([^<]+)<\/error-message>/);
        throw new Error(`commit failed: ${errMsg ? errMsg[1] : 'unknown error'}`);
      }

      // Step 5: Unlock candidate
      await this.sendRPC(deviceId, `<unlock><target><candidate/></target></unlock>`);

      return {
        success: true,
        response: commitResult.response,
        message: 'Configuration committed successfully'
      };

    } catch (error) {
      // Cleanup on failure: discard + unlock
      try { await this.sendRPC(deviceId, `<discard-changes/>`); } catch (e) { /* ignore */ }
      try { await this.sendRPC(deviceId, `<unlock><target><candidate/></target></unlock>`); } catch (e) { /* ignore */ }
      throw error;
    }
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

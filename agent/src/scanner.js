/**
 * Network Scanner - Discovers devices on LAN
 */

const net = require('net');
const dns = require('dns');
const { EventEmitter } = require('events');

class NetworkScanner extends EventEmitter {
  constructor() {
    super();
    this.timeout = 1000; // 1 second timeout per port
    this.commonPorts = [22, 23, 80, 443, 830, 8080]; // SSH, Telnet, HTTP, HTTPS, NETCONF, Alt-HTTP
  }

  /**
   * Parse IP range string (e.g., "192.168.1.1-254")
   */
  parseRange(rangeStr) {
    const ips = [];
    
    // Handle format: 192.168.1.1-254
    const match = rangeStr.match(/^(\d+\.\d+\.\d+\.)(\d+)-(\d+)$/);
    if (match) {
      const prefix = match[1];
      const start = parseInt(match[2]);
      const end = parseInt(match[3]);
      
      for (let i = start; i <= end; i++) {
        ips.push(`${prefix}${i}`);
      }
      return ips;
    }
    
    // Handle format: 192.168.1.0/24
    const cidrMatch = rangeStr.match(/^(\d+\.\d+\.\d+)\.(\d+)\/(\d+)$/);
    if (cidrMatch) {
      const prefix = cidrMatch[1];
      const hostBits = 32 - parseInt(cidrMatch[3]);
      const numHosts = Math.pow(2, hostBits) - 2;
      
      for (let i = 1; i <= numHosts; i++) {
        ips.push(`${prefix}.${i}`);
      }
      return ips;
    }
    
    // Single IP
    if (/^\d+\.\d+\.\d+\.\d+$/.test(rangeStr)) {
      return [rangeStr];
    }
    
    return ips;
  }

  /**
   * Check if a port is open on an IP
   */
  checkPort(ip, port) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let resolved = false;

      socket.setTimeout(this.timeout);

      socket.on('connect', () => {
        resolved = true;
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(false);
        }
      });

      socket.on('error', () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(false);
        }
      });

      socket.connect(port, ip);
    });
  }

  /**
   * Resolve hostname for an IP
   */
  resolveHostname(ip) {
    return new Promise((resolve) => {
      dns.reverse(ip, (err, hostnames) => {
        if (err || !hostnames || hostnames.length === 0) {
          resolve(null);
        } else {
          resolve(hostnames[0]);
        }
      });
    });
  }

  /**
   * Scan a single IP for open ports
   */
  async scanIP(ip) {
    const openPorts = [];
    
    // Check all common ports in parallel
    const portChecks = this.commonPorts.map(async (port) => {
      const isOpen = await this.checkPort(ip, port);
      if (isOpen) {
        openPorts.push(port);
      }
      return isOpen;
    });
    
    await Promise.all(portChecks);
    
    if (openPorts.length > 0) {
      const hostname = await this.resolveHostname(ip);
      
      return {
        ip,
        hostname,
        ports: openPorts.sort((a, b) => a - b),
        online: true,
        hasSSH: openPorts.includes(22),
        hasNetconf: openPorts.includes(830),
        hasTelnet: openPorts.includes(23),
        hasHTTP: openPorts.includes(80) || openPorts.includes(443) || openPorts.includes(8080),
        discoveredAt: new Date().toISOString()
      };
    }
    
    return null;
  }

  /**
   * Scan the network range
   */
  async scan(rangeStr) {
    const ips = this.parseRange(rangeStr);
    const devices = [];
    
    console.log(`Scanning ${ips.length} IP addresses...`);
    this.emit('scan-start', { total: ips.length });
    
    // Scan in batches of 20 for performance
    const batchSize = 20;
    let scanned = 0;
    
    for (let i = 0; i < ips.length; i += batchSize) {
      const batch = ips.slice(i, i + batchSize);
      
      const results = await Promise.all(
        batch.map(ip => this.scanIP(ip))
      );
      
      results.forEach(device => {
        if (device) {
          devices.push(device);
          this.emit('device-found', device);
        }
      });
      
      scanned += batch.length;
      this.emit('scan-progress', { scanned, total: ips.length });
    }
    
    console.log(`Scan complete. Found ${devices.length} devices.`);
    this.emit('scan-complete', devices);
    
    return devices;
  }

  /**
   * Quick ping check (uses TCP port 22 or 830)
   */
  async quickCheck(ip) {
    const sshOpen = await this.checkPort(ip, 22);
    const netconfOpen = await this.checkPort(ip, 830);
    
    return sshOpen || netconfOpen;
  }
}

module.exports = { NetworkScanner };

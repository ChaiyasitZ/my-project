/**
 * NETCONF Service Unit Tests
 * Tests for the NETCONF over SSH Service - focusing on public API
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// Import NetconfService
const { NetconfService } = await import('../services/netconfService.js');

describe('NetconfService', () => {
  let netconfService;

  beforeEach(() => {
    netconfService = new NetconfService();
  });

  afterEach(() => {
    // Cleanup connections
    netconfService.connections.clear();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with default port 830', () => {
      expect(netconfService.defaultPort).toBe(830);
    });

    test('should initialize empty connections map', () => {
      expect(netconfService.connections.size).toBe(0);
    });

    test('should have NETCONF hello message defined', () => {
      expect(netconfService.NETCONF_HELLO).toContain('urn:ietf:params:netconf:base:1.0');
    });

    test('should have message delimiter defined', () => {
      expect(netconfService.MESSAGE_DELIMITER).toBe(']]>]]>');
    });

    test('should have session timeout configured', () => {
      expect(netconfService.sessionTimeout).toBe(300000); // 5 minutes
    });
  });

  describe('parseCapabilities', () => {
    test('should parse NETCONF capabilities from hello message', () => {
      const helloMessage = `<?xml version="1.0" encoding="UTF-8"?>
<hello xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <capabilities>
    <capability>urn:ietf:params:netconf:base:1.0</capability>
    <capability>urn:ietf:params:netconf:base:1.1</capability>
    <capability>urn:ietf:params:netconf:capability:candidate:1.0</capability>
  </capabilities>
</hello>]]>]]>`;
      
      const capabilities = netconfService.parseCapabilities(helloMessage);
      
      expect(capabilities).toContain('urn:ietf:params:netconf:base:1.0');
      expect(capabilities).toContain('urn:ietf:params:netconf:base:1.1');
      expect(capabilities).toContain('urn:ietf:params:netconf:capability:candidate:1.0');
    });

    test('should return empty array for invalid message', () => {
      const capabilities = netconfService.parseCapabilities('invalid xml');
      
      expect(capabilities).toEqual([]);
    });

    test('should handle empty capabilities', () => {
      const helloMessage = `<?xml version="1.0" encoding="UTF-8"?>
<hello xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <capabilities>
  </capabilities>
</hello>]]>]]>`;
      
      const capabilities = netconfService.parseCapabilities(helloMessage);
      
      expect(Array.isArray(capabilities)).toBe(true);
    });
  });

  describe('disconnect', () => {
    test('should remove connection from map', () => {
      const mockConn = {
        end: jest.fn()
      };
      const mockStream = {
        end: jest.fn()
      };
      
      netconfService.connections.set('test-device', {
        connection: mockConn,
        stream: mockStream,
        capabilities: [],
        createdAt: Date.now(),
        lastUsed: Date.now()
      });
      
      netconfService.disconnect('test-device');
      
      expect(netconfService.connections.has('test-device')).toBe(false);
    });

    test('should handle disconnect of non-existent connection', () => {
      expect(() => {
        netconfService.disconnect('non-existent');
      }).not.toThrow();
    });
  });

  describe('getActiveSessions', () => {
    test('should return empty array when no connections', () => {
      const sessions = netconfService.getActiveSessions();
      
      expect(sessions).toEqual([]);
    });

    test('should return session info for active connections', () => {
      netconfService.connections.set('device-1', {
        connection: {},
        stream: {},
        capabilities: ['cap1', 'cap2'],
        createdAt: Date.now() - 60000,
        lastUsed: Date.now(),
        deviceIp: '192.168.1.1'
      });
      
      const sessions = netconfService.getActiveSessions();
      
      expect(sessions.length).toBe(1);
      expect(sessions[0].deviceId).toBe('device-1');
      expect(sessions[0].deviceIp).toBe('192.168.1.1');
    });
  });

  describe('cleanupExpiredConnections', () => {
    test('should remove expired connections', () => {
      const mockConn = { end: jest.fn() };
      const mockStream = { end: jest.fn() };
      
      // Add expired connection
      netconfService.connections.set('expired-device', {
        connection: mockConn,
        stream: mockStream,
        capabilities: [],
        createdAt: Date.now() - netconfService.sessionTimeout - 1000,
        lastUsed: Date.now() - netconfService.sessionTimeout - 1000
      });
      
      // Add active connection
      netconfService.connections.set('active-device', {
        connection: mockConn,
        stream: mockStream,
        capabilities: [],
        createdAt: Date.now(),
        lastUsed: Date.now()
      });
      
      netconfService.cleanupExpiredConnections();
      
      expect(netconfService.connections.has('expired-device')).toBe(false);
      expect(netconfService.connections.has('active-device')).toBe(true);
    });
  });

  describe('connection management', () => {
    test('should track connection count', () => {
      netconfService.connections.set('device-1', { connection: {}, stream: {} });
      netconfService.connections.set('device-2', { connection: {}, stream: {} });
      
      expect(netconfService.connections.size).toBe(2);
    });

    test('should update lastUsed on activity', () => {
      const initialTime = Date.now() - 10000;
      netconfService.connections.set('device-1', {
        connection: {},
        stream: {},
        createdAt: initialTime,
        lastUsed: initialTime
      });
      
      // Simulate activity update
      const conn = netconfService.connections.get('device-1');
      conn.lastUsed = Date.now();
      
      expect(conn.lastUsed).toBeGreaterThan(initialTime);
    });
  });
});

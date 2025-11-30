/**
 * Utility Functions Tests
 * Simple utility tests that don't require database or external services
 */
import { describe, test, expect } from '@jest/globals';
import Joi from 'joi';

// Device validation schema (same as in routes/devices.js)
const deviceSchema = Joi.object({
  name: Joi.string().required().max(255),
  type: Joi.string().valid('router', 'switch', 'nexus').required(),
  layer: Joi.string().valid('layer-2', 'layer-3').when('type', {
    is: 'switch',
    then: Joi.string().default('layer-2'),
    otherwise: Joi.forbidden()
  }),
  ip_address: Joi.string().ip().required(),
  ssh_port: Joi.number().integer().min(1).max(65535).default(22),
  netconf_port: Joi.number().integer().min(1).max(65535).default(830),
  netconf_enabled: Joi.boolean().default(false),
  username: Joi.string().required().max(255),
  password: Joi.string().required().max(255),
  description: Joi.string().allow('').max(1000),
  location: Joi.string().allow('').max(255),
  model: Joi.string().allow('').max(255),
  status: Joi.string().valid('active', 'inactive', 'maintenance', 'error').default('active')
});

describe('Device Validation Schema', () => {
  describe('valid devices', () => {
    test('should validate a valid router', () => {
      const device = {
        name: 'Test Router',
        type: 'router',
        ip_address: '192.168.1.1',
        username: 'admin',
        password: 'password123'
      };
      
      const { error, value } = deviceSchema.validate(device);
      
      expect(error).toBeUndefined();
      expect(value.name).toBe('Test Router');
      expect(value.type).toBe('router');
      expect(value.ssh_port).toBe(22); // default
      expect(value.status).toBe('active'); // default
    });

    test('should validate a valid switch with layer', () => {
      const device = {
        name: 'Test Switch',
        type: 'switch',
        layer: 'layer-2',
        ip_address: '192.168.1.2',
        username: 'admin',
        password: 'password123'
      };
      
      const { error, value } = deviceSchema.validate(device);
      
      expect(error).toBeUndefined();
      expect(value.layer).toBe('layer-2');
    });

    test('should validate a valid nexus device', () => {
      const device = {
        name: 'Nexus Switch',
        type: 'nexus',
        ip_address: '192.168.1.3',
        netconf_enabled: true,
        netconf_port: 830,
        username: 'admin',
        password: 'password123'
      };
      
      const { error, value } = deviceSchema.validate(device);
      
      expect(error).toBeUndefined();
      expect(value.netconf_enabled).toBe(true);
    });

    test('should accept all valid statuses', () => {
      const statuses = ['active', 'inactive', 'maintenance', 'error'];
      
      for (const status of statuses) {
        const device = {
          name: 'Test Device',
          type: 'router',
          ip_address: '192.168.1.1',
          username: 'admin',
          password: 'pass',
          status
        };
        
        const { error } = deviceSchema.validate(device);
        expect(error).toBeUndefined();
      }
    });
  });

  describe('invalid devices', () => {
    test('should reject device without name', () => {
      const device = {
        type: 'router',
        ip_address: '192.168.1.1',
        username: 'admin',
        password: 'password123'
      };
      
      const { error } = deviceSchema.validate(device);
      
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('name');
    });

    test('should reject device without type', () => {
      const device = {
        name: 'Test Device',
        ip_address: '192.168.1.1',
        username: 'admin',
        password: 'password123'
      };
      
      const { error } = deviceSchema.validate(device);
      
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('type');
    });

    test('should reject device with invalid type', () => {
      const device = {
        name: 'Test Device',
        type: 'invalid-type',
        ip_address: '192.168.1.1',
        username: 'admin',
        password: 'password123'
      };
      
      const { error } = deviceSchema.validate(device);
      
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('type');
    });

    test('should reject device with invalid IP address', () => {
      const device = {
        name: 'Test Device',
        type: 'router',
        ip_address: 'not-an-ip',
        username: 'admin',
        password: 'password123'
      };
      
      const { error } = deviceSchema.validate(device);
      
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('ip_address');
    });

    test('should reject name longer than 255 characters', () => {
      const device = {
        name: 'A'.repeat(256),
        type: 'router',
        ip_address: '192.168.1.1',
        username: 'admin',
        password: 'password123'
      };
      
      const { error } = deviceSchema.validate(device);
      
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('name');
    });

    test('should reject invalid port numbers', () => {
      const device = {
        name: 'Test Device',
        type: 'router',
        ip_address: '192.168.1.1',
        ssh_port: 70000, // Invalid port
        username: 'admin',
        password: 'password123'
      };
      
      const { error } = deviceSchema.validate(device);
      
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('ssh_port');
    });

    test('should reject layer for non-switch types', () => {
      const device = {
        name: 'Test Router',
        type: 'router',
        layer: 'layer-2', // Not allowed for router
        ip_address: '192.168.1.1',
        username: 'admin',
        password: 'password123'
      };
      
      const { error } = deviceSchema.validate(device);
      
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('layer');
    });

    test('should reject invalid status', () => {
      const device = {
        name: 'Test Device',
        type: 'router',
        ip_address: '192.168.1.1',
        username: 'admin',
        password: 'pass',
        status: 'invalid-status'
      };
      
      const { error } = deviceSchema.validate(device);
      
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('status');
    });
  });

  describe('IP address validation', () => {
    test('should accept valid IPv4 addresses', () => {
      const validIPs = [
        '192.168.1.1',
        '10.0.0.1',
        '172.16.0.1',
        '255.255.255.255',
        '0.0.0.0'
      ];
      
      for (const ip of validIPs) {
        const device = {
          name: 'Test',
          type: 'router',
          ip_address: ip,
          username: 'admin',
          password: 'pass'
        };
        
        const { error } = deviceSchema.validate(device);
        expect(error).toBeUndefined();
      }
    });

    test('should reject invalid IP formats', () => {
      const invalidIPs = [
        '256.168.1.1',
        '192.168.1',
        '192.168.1.1.1',
        'not-an-ip',
        '192.168.1.a'
      ];
      
      for (const ip of invalidIPs) {
        const device = {
          name: 'Test',
          type: 'router',
          ip_address: ip,
          username: 'admin',
          password: 'pass'
        };
        
        const { error } = deviceSchema.validate(device);
        expect(error).toBeDefined();
      }
    });
  });

  describe('port validation', () => {
    test('should accept valid port numbers', () => {
      const validPorts = [1, 22, 80, 443, 830, 8080, 65535];
      
      for (const port of validPorts) {
        const device = {
          name: 'Test',
          type: 'router',
          ip_address: '192.168.1.1',
          ssh_port: port,
          username: 'admin',
          password: 'pass'
        };
        
        const { error } = deviceSchema.validate(device);
        expect(error).toBeUndefined();
      }
    });

    test('should reject invalid port numbers', () => {
      const invalidPorts = [0, -1, 65536, 100000];
      
      for (const port of invalidPorts) {
        const device = {
          name: 'Test',
          type: 'router',
          ip_address: '192.168.1.1',
          ssh_port: port,
          username: 'admin',
          password: 'pass'
        };
        
        const { error } = deviceSchema.validate(device);
        expect(error).toBeDefined();
      }
    });
  });
});

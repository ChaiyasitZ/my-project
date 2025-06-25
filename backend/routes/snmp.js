import express from 'express';
import Joi from 'joi';
import { query } from '../lib/database.js';
import snmpService from '../services/snmpService.js';

const router = express.Router();

// Validation schemas
const snmpTestSchema = Joi.object({
  snmp_community: Joi.string().default('public'),
  snmp_version: Joi.number().valid(0, 1, 2).default(0), // 0=v1, 1=v2c, 2=v3
  snmp_port: Joi.number().integer().min(1).max(65535).default(161)
});

// GET /api/snmp/devices/:id/test - Test SNMP connection
router.post('/devices/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = snmpTestSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
      });
    }
    
    // Get device from database
    const deviceResult = await query('SELECT * FROM devices WHERE id = $1', [id]);
    
    if (deviceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    const device = deviceResult.rows[0];
    const deviceConfig = {
      ...device,
      ...value
    };
    
    const testResult = await snmpService.testConnection(deviceConfig);
    
    res.json({
      success: true,
      snmpTest: testResult
    });
  } catch (error) {
    console.error('Error testing SNMP connection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test SNMP connection'
    });
  }
});

// GET /api/snmp/devices/:id/system - Get system information via SNMP
router.get('/devices/:id/system', async (req, res) => {
  try {
    const { id } = req.params;
    const { snmp_community = 'public', snmp_version = 0, snmp_port = 161 } = req.query;
    
    // Get device from database
    const deviceResult = await query('SELECT * FROM devices WHERE id = $1', [id]);
    
    if (deviceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    const device = deviceResult.rows[0];
    const deviceConfig = {
      ...device,
      snmp_community,
      snmp_version: parseInt(snmp_version),
      snmp_port: parseInt(snmp_port)
    };
    
    const systemInfo = await snmpService.getSystemInfo(deviceConfig);
    
    res.json({
      success: true,
      ...systemInfo
    });
  } catch (error) {
    console.error('Error getting system information:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get system information'
    });
  }
});

// GET /api/snmp/devices/:id/interfaces - Get interface status via SNMP
router.get('/devices/:id/interfaces', async (req, res) => {
  try {
    const { id } = req.params;
    const { snmp_community = 'public', snmp_version = 0, snmp_port = 161 } = req.query;
    
    // Get device from database
    const deviceResult = await query('SELECT * FROM devices WHERE id = $1', [id]);
    
    if (deviceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    const device = deviceResult.rows[0];
    const deviceConfig = {
      ...device,
      snmp_community,
      snmp_version: parseInt(snmp_version),
      snmp_port: parseInt(snmp_port)
    };
    
    const interfaceData = await snmpService.getInterfaceStatus(deviceConfig);
    
    res.json({
      success: true,
      ...interfaceData
    });
  } catch (error) {
    console.error('Error getting interface status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get interface status'
    });
  }
});

// GET /api/snmp/devices/:id/ips - Get interface IP addresses via SNMP
router.get('/devices/:id/ips', async (req, res) => {
  try {
    const { id } = req.params;
    const { snmp_community = 'public', snmp_version = 0, snmp_port = 161 } = req.query;
    
    // Get device from database
    const deviceResult = await query('SELECT * FROM devices WHERE id = $1', [id]);
    
    if (deviceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    const device = deviceResult.rows[0];
    const deviceConfig = {
      ...device,
      snmp_community,
      snmp_version: parseInt(snmp_version),
      snmp_port: parseInt(snmp_port)
    };
    
    const ipData = await snmpService.getInterfaceIPs(deviceConfig);
    
    res.json({
      success: true,
      ...ipData
    });
  } catch (error) {
    console.error('Error getting interface IPs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get interface IP addresses'
    });
  }
});

// GET /api/snmp/devices/:id/complete - Get complete interface monitoring data
router.get('/devices/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { snmp_community = 'public', snmp_version = 0, snmp_port = 161 } = req.query;
    
    // Get device from database
    const deviceResult = await query('SELECT * FROM devices WHERE id = $1', [id]);
    
    if (deviceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    const device = deviceResult.rows[0];
    const deviceConfig = {
      ...device,
      snmp_community,
      snmp_version: parseInt(snmp_version),
      snmp_port: parseInt(snmp_port)
    };
    
    const completeData = await snmpService.getCompleteInterfaceData(deviceConfig);
    
    res.json({
      success: true,
      ...completeData
    });
  } catch (error) {
    console.error('Error getting complete interface data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get complete interface data'
    });
  }
});

// GET /api/snmp/devices/:id/oid/:oid - Get specific OID value
router.get('/devices/:id/oid/:oid', async (req, res) => {
  try {
    const { id, oid } = req.params;
    const { snmp_community = 'public', snmp_version = 0, snmp_port = 161 } = req.query;
    
    // Validate OID format (basic validation)
    if (!/^[\d.]+$/.test(oid)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OID format'
      });
    }
    
    // Get device from database
    const deviceResult = await query('SELECT * FROM devices WHERE id = $1', [id]);
    
    if (deviceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    const device = deviceResult.rows[0];
    const deviceConfig = {
      ...device,
      snmp_community,
      snmp_version: parseInt(snmp_version),
      snmp_port: parseInt(snmp_port)
    };
    
    const result = await snmpService.getOID(deviceConfig, oid);
    
    res.json({
      success: true,
      oid: oid,
      value: result?.value,
      type: result?.type,
      retrievedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting OID value:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get OID value',
      error: error.message
    });
  }
});

// POST /api/snmp/devices/:id/walk - Walk OID tree
router.post('/devices/:id/walk', async (req, res) => {
  try {
    const { id } = req.params;
    const { oid, snmp_community = 'public', snmp_version = 0, snmp_port = 161 } = req.body;
    
    if (!oid) {
      return res.status(400).json({
        success: false,
        message: 'OID is required'
      });
    }
    
    // Validate OID format (basic validation)
    if (!/^[\d.]+$/.test(oid)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OID format'
      });
    }
    
    // Get device from database
    const deviceResult = await query('SELECT * FROM devices WHERE id = $1', [id]);
    
    if (deviceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    const device = deviceResult.rows[0];
    const deviceConfig = {
      ...device,
      snmp_community,
      snmp_version: parseInt(snmp_version),
      snmp_port: parseInt(snmp_port)
    };
    
    const results = await snmpService.walkOID(deviceConfig, oid);
    
    res.json({
      success: true,
      oid: oid,
      results: results.map(r => ({
        oid: r.oid,
        value: r.value,
        type: r.type
      })),
      count: results.length,
      retrievedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error walking OID tree:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to walk OID tree',
      error: error.message
    });
  }
});

// GET /api/snmp/oids - Get standard OID reference
router.get('/oids', (req, res) => {
  try {
    const standardOIDs = {
      system: {
        sysDescr: { oid: '1.3.6.1.2.1.1.1.0', description: 'System description' },
        sysObjectID: { oid: '1.3.6.1.2.1.1.2.0', description: 'System object ID' },
        sysUpTime: { oid: '1.3.6.1.2.1.1.3.0', description: 'System uptime' },
        sysContact: { oid: '1.3.6.1.2.1.1.4.0', description: 'System contact' },
        sysName: { oid: '1.3.6.1.2.1.1.5.0', description: 'System name' },
        sysLocation: { oid: '1.3.6.1.2.1.1.6.0', description: 'System location' }
      },
      interfaces: {
        ifIndex: { oid: '1.3.6.1.2.1.2.2.1.1', description: 'Interface index (table)' },
        ifDescr: { oid: '1.3.6.1.2.1.2.2.1.2', description: 'Interface description (table)' },
        ifType: { oid: '1.3.6.1.2.1.2.2.1.3', description: 'Interface type (table)' },
        ifMtu: { oid: '1.3.6.1.2.1.2.2.1.4', description: 'Interface MTU (table)' },
        ifSpeed: { oid: '1.3.6.1.2.1.2.2.1.5', description: 'Interface speed (table)' },
        ifPhysAddress: { oid: '1.3.6.1.2.1.2.2.1.6', description: 'Interface MAC address (table)' },
        ifAdminStatus: { oid: '1.3.6.1.2.1.2.2.1.7', description: 'Interface admin status (table)' },
        ifOperStatus: { oid: '1.3.6.1.2.1.2.2.1.8', description: 'Interface operational status (table)' },
        ifLastChange: { oid: '1.3.6.1.2.1.2.2.1.9', description: 'Interface last change (table)' },
        ifInOctets: { oid: '1.3.6.1.2.1.2.2.1.10', description: 'Interface bytes in (table)' },
        ifOutOctets: { oid: '1.3.6.1.2.1.2.2.1.16', description: 'Interface bytes out (table)' }
      },
      ip: {
        ipAdEntAddr: { oid: '1.3.6.1.2.1.4.20.1.1', description: 'IP address (table)' },
        ipAdEntIfIndex: { oid: '1.3.6.1.2.1.4.20.1.2', description: 'IP interface index (table)' },
        ipAdEntNetMask: { oid: '1.3.6.1.2.1.4.20.1.3', description: 'IP subnet mask (table)' }
      },
      cisco: {
        ciscoMemoryPoolUsed: { oid: '1.3.6.1.4.1.9.9.48.1.1.1.5', description: 'Cisco memory usage' },
        ciscoCPUTotal5min: { oid: '1.3.6.1.4.1.9.9.109.1.1.1.1.8', description: 'Cisco CPU usage 5min' },
        ciscoEnvMonTemperature: { oid: '1.3.6.1.4.1.9.9.13.1.3.1.3', description: 'Cisco temperature' }
      }
    };
    
    res.json({
      success: true,
      oids: standardOIDs,
      statusMappings: {
        interfaceStatus: {
          1: 'up',
          2: 'down',
          3: 'testing',
          4: 'unknown',
          5: 'dormant',
          6: 'notPresent',
          7: 'lowerLayerDown'
        },
        interfaceTypes: {
          6: 'ethernet',
          24: 'loopback',
          131: 'tunnel',
          53: 'propVirtual',
          135: 'l2vlan',
          136: 'l3ipvlan',
          161: 'ieee8023adLag'
        }
      }
    });
  } catch (error) {
    console.error('Error getting OID reference:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get OID reference'
    });
  }
});

// Cleanup handler
process.on('SIGINT', () => {
  console.log('🧹 Cleaning up SNMP sessions...');
  snmpService.closeAllSessions();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🧹 Cleaning up SNMP sessions...');
  snmpService.closeAllSessions();
  process.exit(0);
});

export default router; 
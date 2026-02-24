# Network Automation API Documentation

**Base URL:** `http://localhost:3001/api`

**Version:** 2.0.0

---

## Table of Contents

1. [Health Check](#health-check)
2. [Devices API](#devices-api)
3. [Configurations API](#configurations-api)
4. [Backups API](#backups-api)
5. [Console API](#console-api)
6. [YANG Models API](#yang-models-api)

---

## Health Check

### GET /api/health
Check server health status.

**Response:**
```json
{
  "success": true,
  "message": "Server is healthy",
  "timestamp": "2025-11-30T12:00:00.000Z",
  "version": "2.0.0",
  "environment": "development",
  "database": "MongoDB Atlas"
}
```

---

## Devices API

Base path: `/api/devices`

### GET /api/devices
Get all devices with optional filters.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| status | string | - | Filter by status: `active`, `inactive`, `maintenance`, `error` |
| type | string | - | Filter by type: `router`, `switch`, `nexus` |
| limit | number | 50 | Number of results to return |
| offset | number | 0 | Number of results to skip |

**Response:**
```json
{
  "success": true,
  "devices": [...],
  "total": 10,
  "limit": 50,
  "offset": 0
}
```

---

### GET /api/devices/sessions/stats
Get SSH session statistics.

**Response:**
```json
{
  "success": true,
  "message": "SSH session statistics retrieved",
  "stats": {
    "activePersistentSessions": 3,
    "pooledSessions": 5,
    "sessions": [
      {
        "deviceId": "...",
        "deviceIp": "192.168.1.1",
        "createdAt": 1732968000000,
        "lastUsed": 1732968500000,
        "useCount": 5,
        "isPrivileged": true,
        "isValid": true,
        "ageMinutes": 10,
        "idleMinutes": 2
      }
    ]
  }
}
```

---

### GET /api/devices/:id
Get a single device by ID.

**Response:**
```json
{
  "success": true,
  "device": {
    "_id": "...",
    "name": "Router-1",
    "type": "router",
    "ip_address": "192.168.1.1",
    "ssh_port": 22,
    "netconf_port": 830,
    "netconf_enabled": true,
    "status": "active"
  }
}
```

---

### POST /api/devices
Create a new device.

**Request Body:**
```json
{
  "name": "Router-1",
  "type": "router",
  "ip_address": "192.168.1.1",
  "ssh_port": 22,
  "netconf_port": 830,
  "netconf_enabled": false,
  "username": "admin",
  "password": "secret",
  "description": "Main router",
  "location": "Data Center 1",
  "model": "Cisco ISR 4331"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | ✅ | Device name (max 255 chars) |
| type | string | ✅ | `router`, `switch`, or `nexus` |
| layer | string | ❌ | For switches: `layer-2` or `layer-3` |
| ip_address | string | ✅ | Valid IP address |
| ssh_port | number | ❌ | SSH port (default: 22) |
| netconf_port | number | ❌ | NETCONF port (default: 830) |
| netconf_enabled | boolean | ❌ | Enable NETCONF (default: false) |
| username | string | ✅ | SSH username |
| password | string | ✅ | SSH password |
| description | string | ❌ | Device description |
| location | string | ❌ | Physical location |
| model | string | ❌ | Device model |

---

### PUT /api/devices/:id
Update a device.

**Request Body:** Same as POST (all fields optional)

---

### DELETE /api/devices/:id
Delete a device.

---

### GET /api/devices/:id/status
Get device connection status.

---

### GET /api/devices/stats/summary
Get device statistics summary.

**Response:**
```json
{
  "success": true,
  "summary": {
    "total": 10,
    "active": 8,
    "inactive": 1,
    "maintenance": 1,
    "by_type": {
      "router": 5,
      "switch": 3,
      "nexus": 2
    }
  }
}
```

---

### POST /api/devices/:id/test
Test connection to a device.

**Response:**
```json
{
  "success": true,
  "message": "Connection successful",
  "device": "Router-1",
  "connection_time_ms": 250
}
```

---

### POST /api/devices/:id/ssh/connect
Create persistent SSH session.

**Response:**
```json
{
  "success": true,
  "message": "SSH session connected to Router-1",
  "session": {
    "session_id": "...",
    "device_name": "Router-1",
    "device_ip": "192.168.1.1",
    "is_privileged": true,
    "connected_at": "2025-11-30T12:00:00.000Z",
    "use_count": 1
  }
}
```

---

### POST /api/devices/:id/ssh/disconnect
Disconnect SSH session.

---

### GET /api/devices/ssh/status-all
Get SSH status for all devices.

---

### GET /api/devices/:id/ssh/status
Get SSH status for a specific device.

---

### POST /api/devices/:id/netconf/test
Test NETCONF connection.

---

### GET /api/devices/:id/netconf/capabilities
Get NETCONF capabilities.

---

### GET /api/devices/netconf/sessions
Get all active NETCONF sessions.

---

### POST /api/devices/:id/netconf/disconnect
Disconnect NETCONF session.

---

## Configurations API

Base path: `/api/configurations`

### GET /api/configurations/ai-status
Get AI/LLM service status.

**Response:**
```json
{
  "success": true,
  "llmService": {
    "status": "healthy",
    "provider": "openai",
    "model": "gpt-4",
    "cache_size": 50,
    "total_requests": 100
  }
}
```

---

### GET /api/configurations/analytics
Get configuration analytics.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| days | number | 7 | Number of days to analyze |

---

### POST /api/configurations/generate
Generate configuration using AI.

**Request Body:**
```json
{
  "device_id": "...",
  "prompt": "Configure OSPF area 0 with router-id 1.1.1.1"
}
```

**Response:**
```json
{
  "success": true,
  "configuration": {
    "_id": "...",
    "device_id": "...",
    "prompt": "Configure OSPF...",
    "generated_config": "router ospf 1\n  router-id 1.1.1.1\n  network 0.0.0.0 255.255.255.255 area 0",
    "deployment_config": "router ospf 1\nrouter-id 1.1.1.1\nnetwork 0.0.0.0 255.255.255.255 area 0",
    "status": "pending",
    "execution_time": 1500
  }
}
```

---

### POST /api/configurations/generate-multi
Generate configuration for multiple devices using AI.

**Request Body:**
```json
{
  "device_ids": ["device_id_1", "device_id_2", "device_id_3"],
  "prompt": "Configure OSPF area 0 with router-id 1.1.1.1"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Generated configurations for 3/3 devices",
  "total": 3,
  "succeeded": 3,
  "failed": 0,
  "results": [
    {
      "device_id": "...",
      "device_name": "Router-1",
      "device_type": "router",
      "success": true,
      "configuration": {
        "_id": "...",
        "generated_config": "...",
        "deployment_config": "...",
        "status": "generated",
        "execution_time": 1500
      }
    }
  ]
}
```

---

### POST /api/configurations/apply
Apply configuration to device.

**Request Body:**
```json
{
  "configuration_id": "..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Configuration deployed successfully",
  "deployment_time": 3500,
  "deployment_time_ms": 3500,
  "deployment_time_seconds": "3.50",
  "session_reused": true,
  "output": "..."
}
```

---

### POST /api/configurations/session-apply
Apply configuration using existing SSH session (no enable needed).

**Request Body:**
```json
{
  "configuration_id": "..."
}
```

---

### POST /api/configurations/fast-apply
Fast apply configuration with optimized SSH.

**Request Body:**
```json
{
  "configuration_id": "..."
}
```

---

### POST /api/configurations/apply-multi
Apply multiple configurations to multiple devices.

**Request Body:**
```json
{
  "configurations": [
    { "configuration_id": "..." },
    { "configuration_id": "..." }
  ]
}
```

---

### POST /api/configurations/rate
Rate a generated configuration.

**Request Body:**
```json
{
  "configuration_id": "...",
  "user_rating": 5,
  "feedback_text": "Great configuration!"
}
```

---

### GET /api/configurations/history
Get configuration history (all devices).

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | number | 50 | Number of results |
| offset | number | 0 | Skip results |
| status | string | - | Filter by status |

---

### GET /api/configurations/history/:device_id
Get configuration history for a specific device.

---

### GET /api/configurations/:id
Get a single configuration by ID.

---

### DELETE /api/configurations/:id
Delete a configuration.

---

### POST /api/configurations/netconf/generate
Generate NETCONF/YANG configuration.

**Request Body:**
```json
{
  "device_id": "...",
  "prompt": "Configure interface GigabitEthernet0/0 with IP 10.0.0.1/24",
  "yang_model_id": "..."
}
```

---

### POST /api/configurations/netconf/apply
Apply NETCONF configuration.

**Request Body:**
```json
{
  "configuration_id": "..."
}
```

---

### POST /api/configurations/netconf/test
Test NETCONF configuration (dry-run).

---

### GET /api/configurations/netconf/session/:device_id
Get NETCONF session for device.

---

### DELETE /api/configurations/netconf/session/:device_id
Close NETCONF session.

---

### GET /api/configurations/netconf/sessions
Get all active NETCONF sessions.

---

## Backups API

Base path: `/api/backups`

### GET /api/backups
Get all backups with filters.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| device_id | string | - | Filter by device |
| backup_type | string | - | `manual` |
| limit | number | 50 | Number of results |
| offset | number | 0 | Skip results |
| sort_by | string | created_at | Sort field |
| sort_order | string | desc | `asc` or `desc` |

---

### GET /api/backups/:id
Get a single backup.

---

### GET /api/backups/:id/preview
Preview backup content (truncated).

---

### GET /api/backups/device/:device_id
Get all backups for a device.

---

### POST /api/backups
Create a new backup.

**Request Body:**
```json
{
  "device_id": "...",
  "backup_name": "Daily Backup",
  "description": "Manual backup",
  "backup_type": "manual",
  "config_type": "running-config",
  "created_by": "admin",
  "tags": ["daily", "production"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| device_id | string | ✅ | Device ID |
| backup_name | string | ✅ | Backup name |
| description | string | ❌ | Description |
| backup_type | string | ❌ | `manual` |
| config_type | string | ❌ | `running-config`, `startup-config`, or `both` |
| created_by | string | ❌ | Creator name |
| tags | array | ❌ | Array of tags |

---

### POST /api/backups/session
Create backup using existing SSH session.

**Request Body:**
```json
{
  "device_id": "...",
  "backup_name": "Session Backup",
  "config_type": "both"
}
```

---

### POST /api/backups/fast
Create fast backup with optimized SSH.

**Request Body:**
```json
{
  "device_id": "...",
  "backup_name": "Fast Backup"
}
```

---

### POST /api/backups/custom
Create backup with custom commands.

**Request Body:**
```json
{
  "device_id": "...",
  "backup_name": "Custom Backup",
  "commands": ["show running-config", "show startup-config"]
}
```

---

### POST /api/backups/:id/restore
Restore a backup to device.

**Request Body:**
```json
{
  "restore_type": "running",
  "create_checkpoint": true
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| restore_type | string | running | `running`, `startup`, or `both` |
| create_checkpoint | boolean | true | Create restore point before restoring |

---

### DELETE /api/backups/:id
Delete a backup.

---

### POST /api/backups/:id/set-restore-point
Mark backup as restore point.

---

### GET /api/backups/test/:device_id
Test backup capability for device.

---

### GET /api/backups/enable-test/:device_id
Test enable mode for device.

---

### GET /api/backups/ssh-debug/:device_id
Debug SSH connection for device.

---

## Console API

Base path: `/api/console`

### GET /api/console/ports
Get available serial ports.

**Response:**
```json
{
  "success": true,
  "ports": [
    {
      "path": "COM3",
      "manufacturer": "FTDI",
      "serialNumber": "...",
      "vendorId": "0403",
      "productId": "6001"
    }
  ],
  "timestamp": "2025-11-30T12:00:00.000Z"
}
```

---

### POST /api/console/connect
Connect to device via console port.

**Request Body:**
```json
{
  "deviceId": "device_1",
  "portPath": "COM3",
  "baudRate": 9600,
  "dataBits": 8,
  "parity": "none",
  "stopBits": 1
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| deviceId | string | ❌ | Optional device identifier |
| portPath | string | ✅ | Serial port path (e.g., COM3, /dev/ttyUSB0) |
| baudRate | number | 9600 | 300-115200 |
| dataBits | number | 8 | 5, 6, 7, or 8 |
| parity | string | none | `none`, `even`, `odd`, `mark`, `space` |
| stopBits | number | 1 | 1, 1.5, or 2 |

---

### POST /api/console/disconnect
Disconnect console connection.

**Request Body:**
```json
{
  "deviceId": "device_1",
  "portPath": "COM3"
}
```

---

### POST /api/console/test
Test console connection.

---

### POST /api/console/command
Send command to console.

**Request Body:**
```json
{
  "deviceId": "device_1",
  "command": "show version",
  "waitForPrompt": true
}
```

---

### POST /api/console/initial-config
Apply initial configuration via console.

**Request Body:**
```json
{
  "deviceId": "device_1",
  "configCommands": "hostname Router1\ninterface GigabitEthernet0/0\n  ip address 192.168.1.1 255.255.255.0\n  no shutdown",
  "deviceInfo": {
    "hostname": "Router1",
    "managementIp": "192.168.1.1",
    "managementMask": "255.255.255.0",
    "defaultGateway": "192.168.1.254",
    "domain": "example.com",
    "username": "admin",
    "password": "secret",
    "enablePassword": "enable123"
  }
}
```

---

### GET /api/console/status/:deviceId
Get console connection status.

---

### GET /api/console/templates
Get available configuration templates.

---

### POST /api/console/templates/apply
Apply configuration template.

---

## YANG Models API

Base path: `/api/yang-models`

### GET /api/yang-models
List all YANG models.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| device_type | string | - | Filter by device type |
| category | string | - | Filter by category |
| active_only | boolean | true | Show only active models |

**Response:**
```json
{
  "success": true,
  "count": 10,
  "yangModels": [
    {
      "_id": "...",
      "name": "Cisco-IOS-XE-interfaces",
      "namespace": "http://cisco.com/ns/yang/Cisco-IOS-XE-interfaces",
      "prefix": "ios-if",
      "version": "2023.02.01",
      "device_type": "ios-xe",
      "category": "interface",
      "is_active": true
    }
  ]
}
```

---

### GET /api/yang-models/:id
Get a single YANG model with full content.

---

### POST /api/yang-models
Upload a new YANG model.

**Request Body:**
```json
{
  "name": "Custom-Interface-Model",
  "namespace": "http://example.com/custom/interface",
  "prefix": "cust-if",
  "version": "1.0.0",
  "device_type": "ios-xe",
  "category": "interface",
  "description": "Custom interface configuration model",
  "yang_content": "module Custom-Interface-Model { ... }",
  "xml_templates": [
    {
      "name": "basic-interface",
      "description": "Basic interface configuration",
      "template": "<interface>...</interface>"
    }
  ],
  "config_paths": [
    {
      "path": "/interfaces/interface/name",
      "description": "Interface name",
      "data_type": "string",
      "required": true
    }
  ]
}
```

---

### PUT /api/yang-models/:id
Update a YANG model.

---

### DELETE /api/yang-models/:id
Delete a YANG model.

---

### POST /api/yang-models/:id/templates
Add XML template to YANG model.

**Request Body:**
```json
{
  "name": "new-template",
  "description": "New XML template",
  "template": "<config>...</config>"
}
```

---

### GET /api/yang-models/for-generation/:deviceType
Get YANG models for configuration generation.

---

### POST /api/yang-models/toggle/:id
Toggle YANG model active status.

---

## Error Responses

All endpoints return errors in the following format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

**Common HTTP Status Codes:**
| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 404 | Not Found |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

---

## WebSocket Events

The API uses Socket.IO for real-time updates.

**Connection:** `ws://localhost:3001`

### Events Emitted by Server:

| Event | Description |
|-------|-------------|
| `backup-progress` | Backup operation progress |
| `deployment-progress` | Configuration deployment progress |
| `device-status-change` | Device status update |

### Example:
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

socket.on('backup-progress', (data) => {
  console.log('Backup progress:', data);
});

socket.on('deployment-progress', (data) => {
  console.log('Deployment progress:', data);
});
```

---

## Rate Limiting

- **Window:** 5 minutes
- **Max Requests:** 1000 per IP
- **Excluded Endpoints:** `/console`, `/health`, `/backups`, `/netconf`

---

## Authentication

Currently, the API does not require authentication. For production use, implement:
- API key authentication
- JWT tokens
- OAuth 2.0

---

*Last updated: November 30, 2025*

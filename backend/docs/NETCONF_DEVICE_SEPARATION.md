# 🔄 NETCONF Device Separation

การแยกการจัดการ NETCONF devices ออกจาก regular devices เพื่อให้มีการจัดการที่เฉพาะเจาะจงและมีประสิทธิภาพมากขึ้น

## 📋 สิ่งที่เปลี่ยนแปลง

### 1. **Model ใหม่: NetconfDevice**
- ไฟล์: `backend/models/NetconfDevice.js`
- แยกออกจาก `Device.js` เพื่อการจัดการเฉพาะ NETCONF
- เพิ่ม fields เฉพาะสำหรับ NETCONF เช่น:
  - `device_type`: cisco_ios, cisco_nxos, cisco_iosxr, juniper_junos, etc.
  - `connection_timeout`, `keepalive_interval`, `max_retries`
  - `performance_metrics`: tracking success rate, response time
  - `supported_datastores`, `supports_validation`, `supports_rollback`
  - `alert_threshold` สำหรับ monitoring

### 2. **API Routes ใหม่: `/api/netconf-devices`**
- ไฟล์: `backend/routes/netconfDevices.js`
- Endpoints ใหม่:
  - `GET /api/netconf-devices` - List NETCONF devices
  - `GET /api/netconf-devices/stats` - Statistics
  - `POST /api/netconf-devices` - Create device
  - `PUT /api/netconf-devices/:id` - Update device
  - `DELETE /api/netconf-devices/:id` - Delete device
  - `POST /api/netconf-devices/:id/test-connection` - Test connection
  - `POST /api/netconf-devices/:id/connect` - Connect
  - `POST /api/netconf-devices/:id/disconnect` - Disconnect

### 3. **Frontend Updates**
- อัพเดท `useNetconf.js` hook ให้ใช้ API ใหม่
- อัพเดท `NetconfDeviceManager.jsx` ให้เรียกใช้ endpoints ใหม่
- แยกการจัดการ NETCONF devices ออกจาก regular devices

### 4. **Migration Script**
- ไฟล์: `backend/scripts/migrateNetconfDevices.js`
- ย้ายข้อมูล devices ที่มี `netconf_enabled: true` ไป collection ใหม่

## 🚀 วิธีการ Migration

### Step 1: Backup Database (แนะนำ)
```bash
# สำหรับ MongoDB Atlas
mongodump --uri="mongodb+srv://username:password@cluster.mongodb.net/network_automation"

# สำหรับ Local MongoDB
mongodump --db network_automation
```

### Step 2: รัน Migration Script
```bash
cd backend
npm run migrate-netconf
```

### Step 3: ตรวจสอบผลลัพธ์
Migration script จะแสดงผลลัพธ์:
- จำนวน devices ที่ migrate สำเร็จ
- จำนวน devices ที่ migrate ไม่สำเร็จ
- รายชื่อ devices ที่ migrate แล้ว

### Step 4: อัพเดท Frontend (หากจำเป็น)
Frontend ได้รับการอัพเดทแล้ว แต่หากมี custom components อื่น ๆ อาจต้องอัพเดท endpoints

## 📊 Schema Comparison

### Device Model (เดิม)
```javascript
{
  name: String,
  type: ['router', 'switch', 'nexus'],
  ip_address: String,
  netconf_enabled: Boolean,
  netconf_port: Number,
  // ... basic fields
}
```

### NetconfDevice Model (ใหม่)
```javascript
{
  name: String,
  device_type: ['cisco_ios', 'cisco_nxos', 'cisco_iosxr', 'juniper_junos', ...],
  ip_address: String,
  netconf_enabled: Boolean (always true),
  netconf_port: Number,
  
  // เพิ่มใหม่
  connection_timeout: Number,
  keepalive_interval: Number,
  max_retries: Number,
  performance_metrics: {
    success_rate: Number,
    avg_response_time: Number,
    total_sessions: Number,
    successful_sessions: Number,
    failed_sessions: Number
  },
  supported_datastores: [String],
  default_datastore: String,
  supports_validation: Boolean,
  supports_rollback: Boolean,
  alert_threshold: {
    response_time_ms: Number,
    failure_rate_percent: Number
  }
}
```

## 🔧 การใช้งาน API ใหม่

### สร้าง NETCONF Device ใหม่
```bash
curl -X POST http://localhost:3001/api/netconf-devices \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Core-Switch-01",
    "device_type": "cisco_nxos",
    "ip_address": "192.168.1.10",
    "username": "admin",
    "password": "cisco123",
    "netconf_port": 830,
    "platform": "Cisco Nexus 9300"
  }'
```

### ดูสถิติ NETCONF Devices
```bash
curl http://localhost:3001/api/netconf-devices/stats
```

### ทดสอบการเชื่อมต่อ
```bash
curl -X POST http://localhost:3001/api/netconf-devices/{device_id}/test-connection
```

## 🎯 ประโยชน์ของการแยก

### 1. **Performance**
- Query ไวขึ้นเพราะไม่ต้องกรอง netconf_enabled
- Index เฉพาะสำหรับ NETCONF devices
- Separate collections = Better performance

### 2. **Schema Optimization**
- Fields เฉพาะสำหรับ NETCONF
- ไม่มี fields ที่ไม่จำเป็นสำหรับ SSH/Console devices
- Type safety ดีขึ้น

### 3. **Maintainability**
- แยก logic การจัดการ NETCONF
- API endpoints ที่ชัดเจน
- เพิ่ม features ใหม่ได้ง่ายขึ้น

### 4. **Monitoring & Analytics**
- Performance metrics เฉพาะ NETCONF
- Health scoring system
- Alert thresholds

## ⚠️ สิ่งที่ต้องระวัง

### 1. **Backward Compatibility**
- `/api/netconf` routes ยังคงใช้งานได้
- Support ทั้ง NetconfDevice และ Device (fallback)

### 2. **Data Consistency**
- ตรวจสอบว่า migration เสร็จสิ้น
- อาจต้อง disable netconf_enabled ใน Device collection

### 3. **Frontend Cache**
- Clear browser cache หลัง deploy
- ตรวจสอบการทำงานของ NETCONF management page

## 🧪 Testing

### 1. ทดสอบ Migration
```bash
# ดู devices ก่อน migrate
mongo network_automation --eval "db.devices.find({netconf_enabled: true}).count()"

# รัน migration
npm run migrate-netconf

# ดู NetconfDevices หลัง migrate
mongo network_automation --eval "db.netconfdevices.find().count()"
```

### 2. ทดสอบ API
```bash
# List NETCONF devices
curl http://localhost:3001/api/netconf-devices

# Get stats
curl http://localhost:3001/api/netconf-devices/stats

# Test connection
curl -X POST http://localhost:3001/api/netconf-devices/{id}/test-connection
```

### 3. ทดสอบ Frontend
- เปิด NETCONF Management page
- ตรวจสอบการแสดงผล devices
- ทดสอบการ connect/disconnect
- ทดสอบการสร้าง/แก้ไข devices

## 📝 Next Steps

หลังจาก migration เสร็จแล้ว:

1. **Monitor Performance**
   - ดู response times ของ API ใหม่
   - ตรวจสอบ success rate ของ NETCONF connections

2. **Clean Up (หากต้องการ)**
   - Disable netconf_enabled ใน Device collection
   - หรือลบ devices ที่ migrate แล้ว

3. **Enhancement**
   - เพิ่ม monitoring dashboard สำหรับ NETCONF devices
   - Implement alert system ตาม threshold
   - เพิ่ม bulk operations

## 🐛 Troubleshooting

### Migration ไม่สำเร็จ
```bash
# ตรวจสอบ error logs
npm run migrate-netconf 2>&1 | tee migration.log

# ตรวจสอบ MongoDB connection
mongo --eval "db.runCommand({ping: 1})"
```

### Frontend ไม่แสดง devices
1. ตรวจสอบ API response: `/api/netconf-devices`
2. ตรวจสอบ browser console errors
3. Clear browser cache

### NETCONF connections ไม่ทำงาน
1. ตรวจสอบ device credentials
2. ตรวจสอบ network connectivity
3. ดู server logs สำหรับ NETCONF errors 
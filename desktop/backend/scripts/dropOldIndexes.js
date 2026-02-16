import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function dropOldIndexes() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // Drop old device indexes
    const devicesCollection = db.collection('devices');
    const deviceIndexes = await devicesCollection.indexes();
    console.log('📋 Devices indexes:', deviceIndexes.map(i => i.name));

    const deviceIndexesToDrop = ['ip_address_1', 'name_1'];
    
    for (const indexName of deviceIndexesToDrop) {
      try {
        await devicesCollection.dropIndex(indexName);
        console.log(`✅ Dropped devices.${indexName}`);
      } catch (e) {
        if (e.code === 27) {
          console.log(`⚠️ devices.${indexName} not found`);
        } else {
          console.error(`❌ Error dropping devices.${indexName}:`, e.message);
        }
      }
    }

    // Drop old yangmodels indexes  
    const yangCollection = db.collection('yangmodels');
    try {
      const yangIndexes = await yangCollection.indexes();
      console.log('📋 YangModels indexes:', yangIndexes.map(i => i.name));

      // Drop old indexes that don't include userId (causing duplicate errors across users)
      const yangIndexesToDrop = ['namespace_1', 'name_1', 'device_type_1_category_1', 'name_1_device_type_1'];
      
      for (const indexName of yangIndexesToDrop) {
        try {
          await yangCollection.dropIndex(indexName);
          console.log(`✅ Dropped yangmodels.${indexName}`);
        } catch (e) {
          if (e.code === 27) {
            console.log(`⚠️ yangmodels.${indexName} not found`);
          } else {
            console.error(`❌ Error dropping yangmodels.${indexName}:`, e.message);
          }
        }
      }
    } catch (e) {
      console.log('⚠️ yangmodels collection not found (will be created on first upload)');
    }

    console.log('✅ Done! Now restart the backend to create new compound indexes.');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

dropOldIndexes();

import { SerialPort } from 'serialport';

async function testSerialPort() {
  try {
    console.log('🧪 Testing SerialPort functionality...');
    
    // List available ports
    console.log('\n1. Listing available serial ports:');
    const ports = await SerialPort.list();
    
    if (ports.length === 0) {
      console.log('❌ No serial ports found');
      console.log('💡 Check if:');
      console.log('   - USB-to-serial adapter is connected');
      console.log('   - Drivers are installed');
      console.log('   - Device Manager shows the port');
      return;
    }
    
    console.log(`✅ Found ${ports.length} serial ports:`);
    ports.forEach((port, index) => {
      console.log(`   ${index + 1}. ${port.path}`);
      console.log(`      Manufacturer: ${port.manufacturer || 'Unknown'}`);
      console.log(`      Friendly Name: ${port.friendlyName || 'N/A'}`);
      console.log(`      Vendor ID: ${port.vendorId || 'N/A'}`);
      console.log(`      Product ID: ${port.productId || 'N/A'}`);
      console.log('');
    });
    
    // Test opening a port (without connecting to device)
    if (process.argv[2]) {
      const portPath = process.argv[2];
      console.log(`\n2. Testing port access: ${portPath}`);
      
      const testPort = new SerialPort({
        path: portPath,
        baudRate: 9600,
        autoOpen: false
      });
      
      testPort.open((err) => {
        if (err) {
          console.log(`❌ Cannot open port ${portPath}:`);
          console.log(`   Error: ${err.message}`);
          
          if (err.message.includes('Access is denied') || err.message.includes('EACCES')) {
            console.log('💡 This port may be in use by another application');
            console.log('   - Close PuTTY, TeraTerm, or other terminal programs');
            console.log('   - Try running as Administrator');
          }
        } else {
          console.log(`✅ Successfully opened port ${portPath}`);
          testPort.close();
          console.log(`✅ Port closed successfully`);
        }
      });
    } else {
      console.log('\n💡 To test a specific port, run:');
      console.log(`   node testSerialPort.js COM3`);
      console.log(`   (replace COM3 with your actual port)`);
    }
    
  } catch (error) {
    console.log('❌ SerialPort test failed:');
    console.log(`   Error: ${error.message}`);
    console.log('\n💡 Possible solutions:');
    console.log('   - Install USB-to-serial drivers');
    console.log('   - Run as Administrator');
    console.log('   - Check Windows Device Manager');
  }
}

testSerialPort(); 
import mongoose from 'mongoose';
import { config } from '../config/config.js';

// MongoDB connection configuration
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.database.mongodb_uri, {
      // Modern MongoDB connection options
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ Connected to MongoDB: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Graceful connection handling
mongoose.connection.on('connected', () => {
  console.log('📱 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('📴 Mongoose disconnected');
});

// Export mongoose for direct use in services
export { mongoose };

export default connectDB; 
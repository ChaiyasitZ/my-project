import mongoose from 'mongoose';

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

export default mongoose; 
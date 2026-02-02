import mongoose from 'mongoose';

// MongoDB connection options for better performance
export const mongooseOptions = {
  maxPoolSize: 10,           // Maximum number of connections in the pool
  minPoolSize: 2,            // Minimum number of connections to maintain
  serverSelectionTimeoutMS: 5000,  // Timeout for server selection
  socketTimeoutMS: 45000,    // Socket timeout
  family: 4,                 // Use IPv4, skip trying IPv6
  retryWrites: true,
  w: 'majority'
};

// Graceful connection handling
mongoose.connection.on('connected', () => {
  console.log('📱 Mongoose connected to MongoDB (Pool: min=2, max=10)');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('📴 Mongoose disconnected');
});

// Log pool events in development
if (process.env.NODE_ENV !== 'production') {
  mongoose.connection.on('reconnected', () => {
    console.log('🔄 Mongoose reconnected to MongoDB');
  });
}

export default mongoose; 
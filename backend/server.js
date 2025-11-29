import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config } from './config/config.js';

// Import routes
import devicesRouter from './routes/devices.js';
import configurationsRouter from './routes/configurations.js';
import consoleRouter from './routes/console.js';
import backupsRouter from './routes/backups.js';
import yangModelsRouter from './routes/yangModels.js';
import backupScheduler from './services/backupScheduler.js';


const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO with CORS
const io = new Server(httpServer, {
  cors: {
    origin: config.cors.origin,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Export io for use in other modules
export { io };

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
  crossOriginEmbedderPolicy: false
}));

// Rate limiting - More lenient for development
const limiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  skip: (req) => {
    // Skip rate limiting for console and health endpoints during development
    return req.url.includes('/console') || req.url.includes('/health') || req.url.includes('/backups') || req.url.includes('/netconf');
  }
});

// Enable rate limiting but with lenient settings for development
if (config.server.nodeEnv === 'production') {
  app.use('/api/', limiter);
}

// CORS
app.use(cors(config.cors));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Test MongoDB connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.admin().ping();
    } else {
      throw new Error('MongoDB not connected');
    }
    
    res.json({
      success: true,
      message: 'Server is healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      environment: config.server.nodeEnv,
      database: 'MongoDB Atlas',
      scheduler_active: backupScheduler.isInitialized,
      active_schedules: backupScheduler.getActiveSchedules().length
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Server is unhealthy',
      error: error.message
    });
  }
});

// API routes
app.use('/api/devices', devicesRouter);
app.use('/api/configurations', configurationsRouter);
app.use('/api/console', consoleRouter);
app.use('/api/backups', backupsRouter);
app.use('/api/yang-models', yangModelsRouter);


// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Simple Network Automation API with Raw AI',
    version: '1.0.0',
    database: 'MongoDB Atlas',
    features: [
      '🤖 Raw AI configuration generation',
      '🍃 MongoDB Atlas cloud database',
      '⚡ Fast and lightweight',
      '🎯 Simple and reliable',
      '📝 Configuration validation',
      '💾 Configuration history',
      '🔧 Real-time monitoring',
      '📅 Automated backup scheduling',
      '🌐 NETCONF/YANG support'
    ],
    endpoints: {
      health: '/api/health',
      devices: '/api/devices',
      configurations: '/api/configurations',
      console: '/api/console',
      backups: '/api/backups',
      yangModels: '/api/yang-models'
    },
    protocols: ['SSH', 'Console', 'NETCONF'],
    vendors: ['Cisco']
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: config.server.nodeEnv === 'production' 
      ? 'Internal server error' 
      : err.message,
    ...(config.server.nodeEnv !== 'production' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  
  try {
    // Stop backup scheduler
    backupScheduler.stopAll();
    console.log('✅ Backup scheduler stopped');
    
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  
  try {
    // Stop backup scheduler
    backupScheduler.stopAll();
    console.log('✅ Backup scheduler stopped');
    
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

// Initialize MongoDB connection
async function connectToMongoDB() {
  try {
    await mongoose.connect(config.database.mongodb_uri);
    console.log('🍃 Connected to MongoDB Atlas');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

// Start server (for local development)
const PORT = config.server.port || 3001;

// For Vercel serverless, connect to MongoDB on cold start
let isConnected = false;

async function connectDB() {
  if (isConnected) {
    return;
  }
  try {
    await connectToMongoDB();
    isConnected = true;
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
}

// Local development server
if (!process.env.VERCEL) {
  connectToMongoDB().then(() => {
    httpServer.listen(PORT, async () => {
      console.log(`🚀 Network Automation API server running on port ${PORT}`);
      console.log(`🌍 Environment: ${config.server.nodeEnv}`);
      console.log(`🤖 LLM Provider: ${config.llm.provider}`);
      console.log(`🧠 LLM Model: ${config.llm.model}`);
      console.log(`🔗 Frontend URL: ${config.cors.origin}`);
      console.log(`🔌 WebSocket server ready for real-time notifications`);
      
      // Initialize backup scheduler after server starts
      try {
        await backupScheduler.initialize();
      } catch (error) {
        console.error('❌ Failed to initialize backup scheduler:', error);
      }
    });
  });
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
  
  socket.on('subscribe:backups', (data) => {
    console.log(`📡 Client ${socket.id} subscribed to backup notifications`);
    socket.join('backup-notifications');
  });
});

// Vercel serverless handler - must be at the end for ES module syntax
export default async (req, res) => {
  if (process.env.VERCEL) {
    await connectDB();
  }
  return app(req, res);
};

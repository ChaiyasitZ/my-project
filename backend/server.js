import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { config } from './config/config.js';

// Import routes
import devicesRouter from './routes/devices.js';
import configurationsRouter from './routes/configurations.js';
import consoleRouter from './routes/console.js';
import backupsRouter from './routes/backups.js';
import netconfRouter from './routes/netconf.js';


// Import services for cleanup
import netconfService from './services/netconfService.js';


const app = express();

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

// app.use('/api/', limiter); // Disabled for development

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
    
    // Get NETCONF sessions info
    const netconfSessions = netconfService.getActiveSessions();
    
    res.json({
      success: true,
      message: 'Server is healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      environment: config.server.nodeEnv,
      database: 'MongoDB Atlas',
      services: {
        netconf_sessions: netconfSessions.length
      }
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
app.use('/api/netconf', netconfRouter);


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
      '🔗 NETCONF/YANG support',
      '⚡ Fast and lightweight',
      '🎯 Simple and reliable',
      '📝 Configuration validation',
      '💾 Configuration history',
      '🔧 Real-time monitoring'
    ],
    endpoints: {
      health: '/api/health',
      devices: '/api/devices',
      configurations: '/api/configurations',
      console: '/api/console',
      backups: '/api/backups',
      netconf: '/api/netconf'
    },
    protocols: ['SSH', 'Console', 'NETCONF'],
    yang_support: true,
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
    // Cleanup NETCONF sessions
    await netconfService.cleanup();
    
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
    // Cleanup NETCONF sessions
    await netconfService.cleanup();
    
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

// Start server
const PORT = config.server.port;

// Connect to MongoDB first, then start the server
connectToMongoDB().then(() => {
  app.listen(PORT, async () => {
    console.log(`🚀 Network Automation API server running on port ${PORT}`);
    console.log(`🌍 Environment: ${config.server.nodeEnv}`);
    console.log(`🤖 Ollama Host: ${config.ollama.host}`);
    console.log(`🧠 AI Model: ${config.ollama.model}`);
    console.log(`🔗 Frontend URL: ${config.cors.origin}`);
    console.log(`📡 NETCONF/YANG Support: Enabled`);
  });
});

export default app; 
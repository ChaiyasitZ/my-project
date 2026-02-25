import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import session from 'express-session';
import { config } from './config/config.js';
import { mongooseOptions } from './lib/mongodb.js';

// Performance middleware
import { compressionMiddleware, responseTimeMiddleware } from './middleware/performance.js';

// Import routes
import devicesRouter from './routes/devices.js';
import configurationsRouter from './routes/configurations.js';
import consoleRouter from './routes/console.js';
import backupsRouter from './routes/backups.js';
import yangModelsRouter from './routes/yangModels.js';
import authRouter, { passport } from './routes/auth.js';
import agentRouter from './routes/agent.js';

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

// Enable rate limiting but with lenient settings for development
if (config.server.nodeEnv === 'production') {
  app.use('/api/', limiter);
}

// CORS
app.use(cors(config.cors));

// Response compression for better performance
app.use(compressionMiddleware);

// Response time tracking (adds X-Response-Time header)
app.use(responseTimeMiddleware);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Session configuration (required for Passport)
app.use(session({
  secret: config.auth.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.server.nodeEnv === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

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
      database: 'MongoDB Atlas'
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
app.use('/api/auth', authRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/configurations', configurationsRouter);
app.use('/api/console', consoleRouter);
app.use('/api/backups', backupsRouter);
app.use('/api/yang-models', yangModelsRouter);
app.use('/api/agent', agentRouter);

// API index endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Network Automation API',
    version: '2.0.0',
    documentation: '/api/docs',
    endpoints: {
      health: {
        url: '/api/health',
        description: 'Server health check'
      },
      devices: {
        url: '/api/devices',
        description: 'Device management (CRUD, SSH, NETCONF)'
      },
      configurations: {
        url: '/api/configurations',
        description: 'LLM-powered configuration generation and deployment'
      },
      backups: {
        url: '/api/backups',
        description: 'Configuration backups and restore'
      },
      console: {
        url: '/api/console',
        description: 'Serial console access for initial device setup'
      },
      yangModels: {
        url: '/api/yang-models',
        description: 'YANG model management for NETCONF'
      }
    },
    protocols: ['SSH', 'NETCONF', 'Console'],
    features: [
      'AI Configuration Generation',
      'SSH Session Reuse',
      'Manual Backups',
      'NETCONF/YANG Support',
      'HTTP Polling Agent Relay'
    ]
  });
});

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
    await mongoose.connect(config.database.mongodb_uri, mongooseOptions);
    console.log('🍃 Connected to MongoDB Atlas');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    // Only exit on local development - on serverless, let the request handle the error gracefully
    if (!process.env.VERCEL) {
      process.exit(1);
    }
    throw error;
  }
}

// Start server (for local development)
const PORT = config.server.port || 3001;

// For Vercel serverless, connect to MongoDB on cold start
let isConnected = false;

async function connectDB() {
  // Check ACTUAL connection state, not just cached flag
  // Connection can drop between serverless invocations
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }
  isConnected = false;
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
    app.listen(PORT, async () => {
      console.log(`🚀 Network Automation API server running on port ${PORT}`);
      console.log(`🌍 Environment: ${config.server.nodeEnv}`);
      console.log(`🤖 LLM Provider: ${config.llm.provider}`);
      console.log(`🧠 LLM Model: ${config.llm.model}`);
      console.log(`🔗 Frontend URL: ${config.cors.origin}`);
      console.log(`📡 Agent communication: HTTP polling (serverless compatible)`);
      

    });
  });
}

// Vercel serverless handler
export default async (req, res) => {
  if (process.env.VERCEL) {
    await connectDB();
  }
  return app(req, res);
};

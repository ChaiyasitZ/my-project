import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/config.js';
import { pool } from './lib/database.js';

// Import routes
import devicesRouter from './routes/devices.js';
import configurationsRouter from './routes/configurations.js';

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  }
});

app.use('/api/', limiter);

// CORS
app.use(cors(config.cors));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    await pool.query('SELECT 1');
    
    res.json({
      success: true,
      message: 'Server is healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: config.server.nodeEnv
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

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Network Automation API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      devices: '/api/devices',
      configurations: '/api/configurations'
    }
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
    await pool.end();
    console.log('✅ Database connections closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  
  try {
    await pool.end();
    console.log('✅ Database connections closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

// Start server
const PORT = config.server.port;

app.listen(PORT, () => {
  console.log(`🚀 Network Automation API server running on port ${PORT}`);
  console.log(`🌍 Environment: ${config.server.nodeEnv}`);
  console.log(`🤖 AI Model: ${config.openrouter.model}`);
  console.log(`🔗 Frontend URL: ${config.cors.origin}`);
});

export default app; 
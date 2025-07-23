import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // MongoDB Configuration
  database: {
    mongodb_uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/network_automation'
  },

  // Ollama Local AI Configuration
  ollama: {
    host: process.env.OLLAMA_HOST || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'qwen2.5-coder:3b',
  },

  // Server Configuration
  server: {
    port: process.env.PORT || 3001,
    jwtSecret: process.env.JWT_SECRET || 'network_automation_jwt_secret_2025',
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  // CORS Configuration
  cors: {
    origin: process.env.FRONTEND_URL || ['http://localhost:5173', '9f4b4b4a1b81.ngrok-free.app'],
    credentials: true,
  },
}; 
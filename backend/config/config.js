import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Database Configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME || 'network_automation',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'admin',
  },

  // OpenRouter AI Configuration
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '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',
    model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
    baseUrl: 'https://openrouter.ai/api/v1',
  },

  // Server Configuration
  server: {
    port: process.env.PORT || 5000,
    jwtSecret: process.env.JWT_SECRET || 'network_automation_jwt_secret_2025',
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  // CORS Configuration
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
}; 
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // MongoDB Configuration
  database: {
    mongodb_uri: process.env.MONGODB_URI
  },

  // OpenRouter LLM Configuration
  llm: {
    provider: process.env.LLM_PROVIDER || 'openrouter',
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL,
  },

  // Server Configuration
  server: {
    port: process.env.PORT,
    nodeEnv: process.env.NODE_ENV,
  },

  // Authentication Configuration
  auth: {
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  },

  // CORS Configuration
  cors: {
    origin: process.env.FRONTEND_URL ? [
      process.env.FRONTEND_URL,
      'http://localhost:5173', 
      'http://localhost:3000'
    ] : true, // Allow all origins in production if FRONTEND_URL not set
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  },
}; 
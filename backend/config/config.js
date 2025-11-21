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

  // CORS Configuration
  cors: {
    origin: [
      'http://localhost:5173', 
      'http://localhost:3000',
      'https://8db6a36773dd.ngrok-free.app'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  },
}; 
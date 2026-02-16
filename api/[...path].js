// Vercel serverless function that routes all /api/* requests to the Express app
import app from '../backend/server.js';

export default app;

// Vercel config for this function
export const config = {
  maxDuration: 10  // 10 seconds max (Vercel Hobby limit)
};

// Vercel serverless function that routes all /api/* requests to the Express app
import app from '../backend/server.js';

// Vercel strips the /api prefix for functions in the api/ directory
// We need to prepend it back so Express route matching works
export default async (req, res) => {
  req.url = `/api${req.url}`;
  return app(req, res);
};

// Vercel config for this function
export const config = {
  maxDuration: 10  // 10 seconds max (Vercel Hobby limit)
};

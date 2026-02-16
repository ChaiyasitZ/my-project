// Vercel serverless function that routes all /api/* requests to the Express app
// Cache the app across invocations (warm starts)
let app;

async function getApp() {
  if (!app) {
    try {
      const mod = await import('../backend/server.js');
      app = mod.default;
      console.log('[Vercel] Server module loaded successfully');
    } catch (err) {
      console.error('[Vercel] FATAL: Failed to load server module:', err.message, err.stack);
      throw err;
    }
  }
  return app;
}

// Vercel strips the /api prefix for functions in the api/ directory
// We need to prepend it back so Express route matching works
export default async function handler(req, res) {
  try {
    const handler = await getApp();
    req.url = `/api${req.url}`;
    return await handler(req, res);
  } catch (err) {
    console.error('[Vercel] Request handler error:', err.message, err.stack);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message }));
  }
}

// Vercel config for this function
export const config = {
  maxDuration: 10  // 10 seconds max (Vercel Hobby limit)
};

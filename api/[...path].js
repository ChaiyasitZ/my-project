// Vercel serverless function that routes all /api/* requests to the Express app
// Cache the app across invocations (warm starts)
let app;

async function getApp() {
  if (!app) {
    const mod = await import('../backend/server.js');
    app = mod.default;
  }
  return app;
}

// Vercel passes the URL with /api prefix intact due to rewrite rules
// Only prepend /api if stripped (depends on Vercel routing config)
export default async function handler(req, res) {
  try {
    const appHandler = await getApp();
    if (!req.url.startsWith('/api')) {
      req.url = `/api${req.url}`;
    }
    return await appHandler(req, res);
  } catch (err) {
    console.error('[Vercel] Request error:', err.message);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

export const config = {
  maxDuration: 10
};

// Vercel serverless function that routes all /api/* requests to the Express app
let app;
try {
  const mod = await import('../backend/server.js');
  app = mod.default;
  console.log('[Vercel] Server module loaded successfully');
} catch (err) {
  console.error('[Vercel] FATAL: Failed to load server module:', err.message, err.stack);
}

// Vercel strips the /api prefix for functions in the api/ directory
// We need to prepend it back so Express route matching works
export default async (req, res) => {
  if (!app) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Server module failed to load. Check function logs.' }));
    return;
  }
  try {
    req.url = `/api${req.url}`;
    return await app(req, res);
  } catch (err) {
    console.error('[Vercel] Request handler error:', err.message, err.stack);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message }));
  }
};

// Vercel config for this function
export const config = {
  maxDuration: 10  // 10 seconds max (Vercel Hobby limit)
};

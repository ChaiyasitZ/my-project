// Minimal test function to verify Vercel function execution works
export default async function handler(req, res) {
  const result = {
    ok: true,
    env_check: {
      has_mongodb: !!process.env.MONGODB_URI,
      has_node_env: process.env.NODE_ENV,
      has_vercel: !!process.env.VERCEL,
      mongodb_uri_length: (process.env.MONGODB_URI || '').length,
      mongodb_uri_ends_with: (process.env.MONGODB_URI || '').slice(-10)
    },
    module_load: null,
    module_error: null
  };

  try {
    const mod = await import('../backend/server.js');
    result.module_load = 'success';
    result.has_default = typeof mod.default === 'function';
  } catch (err) {
    result.module_load = 'failed';
    result.module_error = err.message;
    result.module_stack = (err.stack || '').split('\n').slice(0, 5);
  }

  res.status(200).json(result);
}

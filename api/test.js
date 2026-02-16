// Minimal test function to verify Vercel function execution works
export default async function handler(req, res) {
  res.status(200).json({
    ok: true,
    env_check: {
      has_mongodb: !!process.env.MONGODB_URI,
      has_node_env: process.env.NODE_ENV,
      has_vercel: !!process.env.VERCEL,
      mongodb_uri_length: (process.env.MONGODB_URI || '').length,
      mongodb_uri_ends_with: (process.env.MONGODB_URI || '').slice(-10)
    }
  });
}

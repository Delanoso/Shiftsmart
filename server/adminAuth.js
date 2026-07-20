const ADMIN_API_KEY = process.env.ADMIN_API_KEY ?? 'ADMIN-API-KEY';

export function isAdminConfigured() {
  return Boolean(ADMIN_API_KEY);
}

export function requireAdmin(req, res, next) {
  if (!ADMIN_API_KEY) {
    res.status(503).json({
      error: 'Admin access is not configured. Set ADMIN_API_KEY on the server.',
    });
    return;
  }

  const key = req.header('x-admin-key') ?? req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!key || key !== ADMIN_API_KEY) {
    res.status(401).json({ error: 'Invalid admin key' });
    return;
  }

  next();
}

export function getDefaultAdminKeyHint() {
  return ADMIN_API_KEY === 'ADMIN-API-KEY'
    ? 'Using the standard install key. Change ADMIN_API_KEY in .env during setup for production.'
    : null;
}

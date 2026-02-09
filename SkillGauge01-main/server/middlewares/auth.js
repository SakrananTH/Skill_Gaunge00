import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ADMIN_BYPASS } from '../config/constants.js';

export function getTokenFromHeader(req) {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export function requireAuth(req, res, next) {
  try {
    const token = getTokenFromHeader(req);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
    }

    // Admin bypass check (if token matches bypass password for simplicity in dev/test, though in real prod this is risky)
    // The original code uses a signed JWT, unrelated to the admin bypass 'password'. 
    // The ADMIN_BYPASS in constants seems to serve as a 'user' object when logged in.
    
    jwt.verify(token, env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({ error: 'Forbidden', message: 'Invalid or expired token' });
      }
      req.user = decoded;
      next();
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export function authorizeRoles(...allowed) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [];
    
    // Check if user has at least one of the allowed roles
    const hasPermission = allowed.some(role => userRoles.includes(role));
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions' });
    }
    next();
  };
}

export function hasRole(req, ...allowed) {
  const currentRoles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  return allowed.some(role => currentRoles.includes(role));
}

export function canAccessUser(req, userId) {
    if (!userId) return false;
    // Admin and PM can access anyone
    if (hasRole(req, 'admin', 'project_manager')) return true;
    // Users can access themselves
    if (req.user?.id === userId) return true;
    return false;
}

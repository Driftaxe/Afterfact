import { createHash } from 'crypto';

/**
 * Resolves the client IP address from request headers.
 * Safely strips port numbers and parses proxy hops.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const firstHop = forwarded.split(',')[0].trim();
    if (firstHop) return sanitizeIp(firstHop);
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) return sanitizeIp(realIp.trim());

  const cfIp = headers.get('cf-connecting-ip');
  if (cfIp) return sanitizeIp(cfIp.trim());

  return '127.0.0.1';
}

function sanitizeIp(rawIp: string): string {
  let ip = rawIp.replace(/^::ffff:/, '');
  if (ip.includes(':') && ip.split(':').length === 2) {
    ip = ip.split(':')[0];
  }
  return ip;
}

/**
 * Produces a deterministic, anonymized SHA-256 hash of the client IP.
 * Enforces Secret Safety & Privacy standards (P28) — raw IPs are never persisted.
 */
export function hashIp(ip: string, salt: string = 'afterfact_ip_salt_v1'): string {
  return createHash('sha256')
    .update(`${salt}:${ip.trim().toLowerCase()}`, 'utf8')
    .digest('hex');
}

import dns from 'node:dns';

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal']);

function ipToLong(parts: number[]): number {
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function inRange(ip: number, base: string, maskBits: number): boolean {
  const baseParts = base.split('.').map(Number);
  const baseLong = ipToLong(baseParts);
  const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
  return (ip & mask) === (baseLong & mask);
}

function isPrivateOrReservedIpv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
  const ip = ipToLong(parts);
  return (
    inRange(ip, '0.0.0.0', 8) || // "this" network
    inRange(ip, '10.0.0.0', 8) || // private
    inRange(ip, '100.64.0.0', 10) || // CGNAT
    inRange(ip, '127.0.0.0', 8) || // loopback
    inRange(ip, '169.254.0.0', 16) || // link-local (cloud metadata lives here)
    inRange(ip, '172.16.0.0', 12) || // private
    inRange(ip, '192.0.0.0', 24) || // IETF protocol assignments
    inRange(ip, '192.168.0.0', 16) || // private
    inRange(ip, '198.18.0.0', 15) || // benchmarking
    inRange(ip, '224.0.0.0', 4) || // multicast
    inRange(ip, '240.0.0.0', 4) // reserved
  );
}

function isPrivateOrReservedIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return (
    normalized === '::1' || // loopback
    normalized === '::' || // unspecified
    normalized.startsWith('fc') || // unique local
    normalized.startsWith('fd') || // unique local
    normalized.startsWith('fe80') || // link-local
    normalized.startsWith('::ffff:127.') || // ipv4-mapped loopback
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.') ||
    normalized.startsWith('::ffff:169.254.')
  );
}

function isPrivateOrReservedIp(address: string): boolean {
  return address.includes(':') ? isPrivateOrReservedIpv6(address) : isPrivateOrReservedIpv4(address);
}

/** Synchronous check usable inside redirect hooks where DNS lookups aren't practical. */
export function isObviouslyUnsafeUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
    const hostname = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.has(hostname)) return true;
    return isPrivateOrReservedIp(hostname);
  } catch {
    return true;
  }
}

/**
 * Guards against SSRF: rejects non-http(s) schemes, credentials-in-URL, and
 * any hostname that resolves (directly or via DNS) to a private/link-local/
 * loopback address — including cloud metadata endpoints like 169.254.169.254.
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http(s) URLs are allowed.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('URLs with embedded credentials are not allowed.');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error('This host is not allowed.');
  }

  // If the hostname is itself a literal IP, check it directly.
  if (isPrivateOrReservedIp(hostname)) {
    throw new Error('Requests to private/internal addresses are not allowed.');
  }

  const addresses = await new Promise<string[]>((resolve, reject) => {
    dns.lookup(hostname, { all: true }, (err, results) => {
      if (err) reject(err);
      else resolve(results.map((r) => r.address));
    });
  }).catch(() => {
    throw new Error('Could not resolve host.');
  });

  if (addresses.some(isPrivateOrReservedIp)) {
    throw new Error('Requests to private/internal addresses are not allowed.');
  }
}

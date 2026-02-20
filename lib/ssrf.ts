/**
 * Check if an IP address belongs to a private/reserved range.
 * Used to prevent SSRF attacks when fetching user-supplied URLs.
 */
export function isPrivateIp(ip: string): boolean {
  // IPv4-mapped IPv6 (::ffff:x.x.x.x)
  const v4MappedMatch = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (v4MappedMatch) return isPrivateIp(v4MappedMatch[1]);

  // IPv6
  if (ip.includes(":")) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1") return true; // loopback
    if (normalized.startsWith("fe80")) return true; // link-local
    if (normalized.startsWith("fd") || normalized.startsWith("fc")) return true; // unique local (fc00::/7)
    if (normalized === "::" || normalized === "::0") return true;
    return false;
  }

  // IPv4
  const parts = ip.split(".");
  if (parts.length !== 4) return true; // malformed → block
  const octets = parts.map(Number);
  if (octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)) return true;

  const [a, b] = octets;
  if (a === 0) return true; // 0.0.0.0/8 (current network)
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a >= 224) return true; // multicast + reserved (224.0.0.0+)

  return false;
}

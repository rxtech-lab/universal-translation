import { describe, expect, it } from "vitest";
import { isPrivateIp } from "@/lib/ssrf";

describe("isPrivateIp", () => {
  // IPv4 private ranges
  it("blocks loopback (127.x.x.x)", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("127.255.255.255")).toBe(true);
  });

  it("blocks 10.0.0.0/8", () => {
    expect(isPrivateIp("10.0.0.1")).toBe(true);
    expect(isPrivateIp("10.255.255.255")).toBe(true);
  });

  it("blocks 172.16.0.0/12", () => {
    expect(isPrivateIp("172.16.0.1")).toBe(true);
    expect(isPrivateIp("172.31.255.255")).toBe(true);
    // Just outside the range
    expect(isPrivateIp("172.15.255.255")).toBe(false);
    expect(isPrivateIp("172.32.0.1")).toBe(false);
  });

  it("blocks 192.168.0.0/16", () => {
    expect(isPrivateIp("192.168.0.1")).toBe(true);
    expect(isPrivateIp("192.168.255.255")).toBe(true);
  });

  it("blocks link-local (169.254.x.x)", () => {
    expect(isPrivateIp("169.254.0.1")).toBe(true);
    expect(isPrivateIp("169.254.169.254")).toBe(true);
  });

  it("blocks 0.0.0.0/8", () => {
    expect(isPrivateIp("0.0.0.0")).toBe(true);
    expect(isPrivateIp("0.255.255.255")).toBe(true);
  });

  it("blocks multicast and reserved (224+)", () => {
    expect(isPrivateIp("224.0.0.1")).toBe(true);
    expect(isPrivateIp("255.255.255.255")).toBe(true);
  });

  it("allows public IPv4 addresses", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("1.1.1.1")).toBe(false);
    expect(isPrivateIp("93.184.216.34")).toBe(false);
  });

  // IPv6
  it("blocks IPv6 loopback (::1)", () => {
    expect(isPrivateIp("::1")).toBe(true);
  });

  it("blocks IPv6 link-local (fe80::)", () => {
    expect(isPrivateIp("fe80::1")).toBe(true);
    expect(isPrivateIp("fe80::abcd:1234")).toBe(true);
  });

  it("blocks IPv6 unique local (fc00::/7)", () => {
    expect(isPrivateIp("fd00::1")).toBe(true);
    expect(isPrivateIp("fc00::1")).toBe(true);
  });

  // IPv4-mapped IPv6
  it("blocks IPv4-mapped IPv6 with private IPv4", () => {
    expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateIp("::ffff:10.0.0.1")).toBe(true);
    expect(isPrivateIp("::ffff:192.168.1.1")).toBe(true);
    expect(isPrivateIp("::ffff:169.254.169.254")).toBe(true);
  });

  it("allows IPv4-mapped IPv6 with public IPv4", () => {
    expect(isPrivateIp("::ffff:8.8.8.8")).toBe(false);
  });

  // Malformed
  it("blocks malformed IPv4", () => {
    expect(isPrivateIp("999.999.999.999")).toBe(true);
    expect(isPrivateIp("not-an-ip")).toBe(true);
  });
});

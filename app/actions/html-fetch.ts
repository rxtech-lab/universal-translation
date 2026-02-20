"use server";

import { resolve4, resolve6 } from "node:dns/promises";
import { auth } from "@/auth";
import { isPrivateIp } from "@/lib/ssrf";

const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10 MB
const FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; UniversalTranslation/1.0; +https://universaltranslation.app)",
  Accept: "text/html,application/xhtml+xml,*/*",
};

/**
 * Validate that a URL's hostname does not resolve to a private IP.
 */
async function validateHostname(hostname: string): Promise<void> {
  // If hostname is an IP literal, check directly
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error("URL resolves to a private/reserved IP address");
    }
    return;
  }

  // Strip brackets for IPv6 literals
  const bare = hostname.replace(/^\[|\]$/g, "");
  if (bare.includes(":")) {
    if (isPrivateIp(bare)) {
      throw new Error("URL resolves to a private/reserved IP address");
    }
    return;
  }

  // DNS resolve and check all IPs
  const ips: string[] = [];
  try {
    const v4 = await resolve4(hostname).catch(() => [] as string[]);
    const v6 = await resolve6(hostname).catch(() => [] as string[]);
    ips.push(...v4, ...v6);
  } catch {
    throw new Error("Failed to resolve hostname");
  }

  if (ips.length === 0) {
    throw new Error("Hostname did not resolve to any IP address");
  }

  for (const ip of ips) {
    if (isPrivateIp(ip)) {
      throw new Error("URL resolves to a private/reserved IP address");
    }
  }
}

/**
 * Validate a URL: protocol check + hostname IP check.
 */
async function validateUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS URLs are supported");
  }
  await validateHostname(url.hostname);
}

/**
 * Read a response body as text with a size limit.
 */
async function readBodyWithLimit(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    return response.text();
  }

  const decoder = new TextDecoder();
  let html = "";
  let totalBytes = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new Error(`Response too large (max ${maxBytes / 1024 / 1024}MB)`);
      }
      html += decoder.decode(value, { stream: true });
    }
    html += decoder.decode(); // flush
  } catch (err) {
    await reader.cancel().catch(() => {});
    throw err;
  }

  return html;
}

export async function fetchUrlHtml(url: string): Promise<{
  html: string;
  finalUrl: string;
  contentType: string;
}> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Validate initial URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }

  await validateUrl(parsed);

  // Follow redirects manually to validate each hop
  let currentUrl = parsed.toString();
  let response: Response | null = null;

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    response = await fetch(currentUrl, {
      headers: FETCH_HEADERS,
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    const status = response.status;
    if (status >= 300 && status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error("Redirect response missing Location header");
      }

      // Resolve relative redirect
      const redirectUrl = new URL(location, currentUrl);
      await validateUrl(redirectUrl);
      currentUrl = redirectUrl.toString();

      if (i === MAX_REDIRECTS) {
        throw new Error("Too many redirects");
      }
      continue;
    }

    break;
  }

  if (!response || !response.ok) {
    throw new Error(
      `Failed to fetch URL: ${response?.status} ${response?.statusText}`,
    );
  }

  // Validate content type
  const contentType = response.headers.get("content-type") ?? "";
  if (
    !contentType.includes("text/html") &&
    !contentType.includes("application/xhtml+xml") &&
    !contentType.includes("text/plain")
  ) {
    throw new Error("URL does not serve HTML content");
  }

  // Read body with size limit
  const html = await readBodyWithLimit(response, MAX_RESPONSE_SIZE);

  if (!html.trim()) {
    throw new Error("The fetched page has no content");
  }

  return {
    html,
    finalUrl: currentUrl,
    contentType,
  };
}

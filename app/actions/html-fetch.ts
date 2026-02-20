"use server";

import { randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import { auth } from "@/auth";

export async function fetchUrlHtml(url: string): Promise<{
  blobUrl: string;
  finalUrl: string;
  contentType: string;
}> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      onlyMainContent: false,
      maxAge: 172800000,
      parsers: ["pdf"],
      formats: ["html"],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Firecrawl request failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(`Firecrawl error: ${data.error ?? "Unknown error"}`);
  }

  const html: string = data.data?.html ?? data.html ?? "";

  if (!html.trim()) {
    throw new Error("The fetched page has no content");
  }

  const blob = await put(`html-fetch/${randomUUID()}.html`, html, {
    access: "public",
    contentType: "text/html",
  });

  return {
    blobUrl: blob.url,
    finalUrl: url,
    contentType: "text/html",
  };
}

export async function deleteTempBlob(blobUrl: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  await del(blobUrl);
}

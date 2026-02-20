import { describe, expect, it } from "vitest";
import type { UploadPayload } from "@/lib/translation/types";
import { htmlDescriptor } from "@/lib/translation/html/descriptor";

describe("htmlDescriptor", () => {
  it("has correct metadata", () => {
    expect(htmlDescriptor.formatId).toBe("html");
    expect(htmlDescriptor.fileExtensions).toContain(".html");
    expect(htmlDescriptor.fileExtensions).toContain(".htm");
    expect(htmlDescriptor.displayName).toBe("HTML");
  });

  it("detects .html file with high score when content has HTML indicators", async () => {
    const payload: UploadPayload = {
      kind: "single-file",
      file: new File(
        ["<!DOCTYPE html><html><body><p>Hello</p></body></html>"],
        "page.html",
        { type: "text/html" },
      ),
    };
    const result = await htmlDescriptor.detect(payload);
    expect(result.score).toBe(1.0);
  });

  it("detects .htm file with high score", async () => {
    const payload: UploadPayload = {
      kind: "single-file",
      file: new File(["<html><body><p>Hello</p></body></html>"], "page.htm", {
        type: "text/html",
      }),
    };
    const result = await htmlDescriptor.detect(payload);
    expect(result.score).toBe(1.0);
  });

  it("detects .html file with lower score when content lacks HTML indicators", async () => {
    const payload: UploadPayload = {
      kind: "single-file",
      file: new File(["Just some text content"], "page.html", {
        type: "text/html",
      }),
    };
    const result = await htmlDescriptor.detect(payload);
    expect(result.score).toBe(0.7);
  });

  it("returns score 0 for non-HTML single file", async () => {
    const payload: UploadPayload = {
      kind: "single-file",
      file: new File(["Hello world"], "readme.txt", { type: "text/plain" }),
    };
    const result = await htmlDescriptor.detect(payload);
    expect(result.score).toBe(0);
  });

  it("detects archive containing HTML files", async () => {
    const payload: UploadPayload = {
      kind: "archive",
      tree: {
        files: [
          {
            path: "index.html",
            content: new TextEncoder().encode(
              "<html><body>Hello</body></html>",
            ),
          },
          {
            path: "about.html",
            content: new TextEncoder().encode(
              "<html><body>About</body></html>",
            ),
          },
        ],
      },
      originalFileName: "site.zip",
    };
    const result = await htmlDescriptor.detect(payload);
    expect(result.score).toBe(0.85);
  });

  it("returns score 0 for archive without HTML files", async () => {
    const payload: UploadPayload = {
      kind: "archive",
      tree: {
        files: [
          {
            path: "readme.txt",
            content: new TextEncoder().encode("hello"),
          },
        ],
      },
      originalFileName: "archive.zip",
    };
    const result = await htmlDescriptor.detect(payload);
    expect(result.score).toBe(0);
  });

  it("ignores __MACOSX files in archives", async () => {
    const payload: UploadPayload = {
      kind: "archive",
      tree: {
        files: [
          {
            path: "__MACOSX/index.html",
            content: new TextEncoder().encode("<html></html>"),
          },
        ],
      },
      originalFileName: "site.zip",
    };
    const result = await htmlDescriptor.detect(payload);
    expect(result.score).toBe(0);
  });

  it("creates an HtmlClient instance", () => {
    const client = htmlDescriptor.createClient();
    expect(client).toBeDefined();
    expect(client.getProject).toBeDefined();
  });
});

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { projects, terms as termsTable } from "@/lib/db/schema";
import {
  DocumentClient,
  type DocumentFormatData,
} from "@/lib/translation/document/client";
import { HtmlClient, type HtmlFormatData } from "@/lib/translation/html/client";
import {
  LyricsClient,
  type LyricsFormatData,
} from "@/lib/translation/lyrics/client";
import { PoClient, type PoFormatData } from "@/lib/translation/po/client";
import { SrtClient, type SrtFormatData } from "@/lib/translation/srt/client";
import type { Term } from "@/lib/translation/tools/term-tools";
import type { TranslationProject } from "@/lib/translation/types";
import {
  XclocClient,
  type XclocFormatData,
} from "@/lib/translation/xcloc/client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { projectId } = await params;

  // Load project from DB
  const [dbProject] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

  if (!dbProject) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const content = dbProject.content as TranslationProject | null;
  const formatData = dbProject.formatData as unknown;

  if (!content || !formatData) {
    return NextResponse.json(
      { error: "Project has no content data" },
      { status: 400 },
    );
  }

  // Load terms from DB
  const dbTerms = await db
    .select()
    .from(termsTable)
    .where(eq(termsTable.projectId, projectId));

  const projectTerms: Term[] = dbTerms.map((t) => ({
    id: t.id,
    slug: t.slug,
    originalText: t.originalText,
    translation: t.translation,
    comment: t.comment,
  }));

  // Create the appropriate client based on formatId and initialize from DB data
  let exportResult: Awaited<ReturnType<typeof SrtClient.prototype.exportFile>>;

  try {
    switch (dbProject.formatId) {
      case "srt": {
        const client = new SrtClient();
        client.loadFromJson(content, formatData as SrtFormatData, {
          blobUrl: dbProject.blobUrl ?? undefined,
          projectId,
        });
        exportResult = await client.exportFile(projectTerms);
        break;
      }
      case "po": {
        const client = new PoClient();
        client.loadFromJson(content, formatData as PoFormatData, {
          blobUrl: dbProject.blobUrl ?? undefined,
          projectId,
        });
        exportResult = await client.exportFile(projectTerms);
        break;
      }
      case "xcloc": {
        const client = new XclocClient();
        client.loadFromJson(content, formatData as XclocFormatData, {
          blobUrl: dbProject.blobUrl ?? undefined,
          projectId,
        });
        exportResult = await client.exportFile(projectTerms);
        break;
      }
      case "html": {
        const client = new HtmlClient();
        client.loadFromJson(content, formatData as HtmlFormatData, {
          projectId,
        });
        exportResult = await client.exportFile(projectTerms);
        break;
      }
      case "document": {
        const client = new DocumentClient();
        client.loadFromJson(content, formatData as DocumentFormatData, {
          blobUrl: dbProject.blobUrl ?? undefined,
          projectId,
        });
        exportResult = await client.exportFile(projectTerms);
        break;
      }
      case "lyrics": {
        const client = new LyricsClient();
        client.loadFromJson(content, formatData as LyricsFormatData, {
          projectId,
        });
        exportResult = await client.exportFile(projectTerms);
        break;
      }
      default:
        return NextResponse.json(
          { error: `Unsupported format: ${dbProject.formatId}` },
          { status: 400 },
        );
    }
  } catch (err) {
    return NextResponse.json(
      {
        error: `Export failed: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 },
    );
  }

  if (exportResult.hasError) {
    return NextResponse.json(
      { error: exportResult.errorMessage },
      { status: 500 },
    );
  }

  const { blob, fileName } = exportResult.data;

  if (!blob) {
    return NextResponse.json(
      { error: "No file content generated" },
      { status: 500 },
    );
  }

  // Stream the blob content back to the client
  const stream = blob.stream();
  const encodedFileName = encodeURIComponent(fileName);

  return new Response(stream, {
    headers: {
      "Content-Type": blob.type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
    },
  });
}

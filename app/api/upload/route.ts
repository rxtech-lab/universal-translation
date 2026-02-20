import { type HandleUploadBody, handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await auth();
        if (!session?.user?.id) {
          throw new Error("Unauthorized");
        }

        return {
          allowedContentTypes: [
            "application/zip",
            "application/x-zip-compressed",
            "application/octet-stream",
            "application/x-subrip",
            "text/plain",
            "text/srt",
            "text/markdown",
            "text/x-markdown",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/html",
          ],
          maximumSizeInBytes: 100 * 1024 * 1024, // 100MB
          allowOverwrite: true,
          tokenPayload: JSON.stringify({
            userId: session.user.id,
          }),
        };
      },
      onUploadCompleted: async () => {
        // no-op, project creation is handled by the client-side flow
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}

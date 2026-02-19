import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/auth";
import { NextResponse } from "next/server";

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

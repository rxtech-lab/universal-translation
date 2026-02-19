"use server";

import { auth } from "@/auth";
import { createProject } from "./projects";
import type { TranslationProject } from "@/lib/translation/types";

export async function createProjectFromParsed(data: {
	name: string;
	formatId: string;
	blobUrl: string;
	content: TranslationProject;
	formatData: Record<string, unknown>;
	sourceLanguage?: string;
	targetLanguage?: string;
	sourceLocale?: string;
	targetLocale?: string;
	metadata?: Record<string, unknown>;
}) {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");

	const projectId = await createProject({
		name: data.name,
		formatId: data.formatId,
		sourceLanguage: data.sourceLanguage,
		targetLanguage: data.targetLanguage,
		sourceLocale: data.sourceLocale,
		targetLocale: data.targetLocale,
		blobUrl: data.blobUrl,
		content: data.content,
		formatData: data.formatData,
		metadata: data.metadata,
	});

	return projectId;
}

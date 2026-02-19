import { auth } from "@/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import type { TranslationProject } from "@/lib/translation/types";
import {
	convertToModelMessages,
	createGateway,
	stepCountIs,
	streamText,
	tool,
} from "ai";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

export const maxDuration = 120;

const DEFAULT_MODEL = "anthropic/claude-sonnet-4-20250514";

function createModel() {
	const gateway = createGateway({
		apiKey: process.env.AI_GATEWAY_API_KEY ?? "",
	});
	return gateway(DEFAULT_MODEL);
}

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ projectId: string }> },
) {
	const session = await auth();
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const userId = session.user.id;
	const { projectId } = await params;

	const [dbProject] = await db
		.select({
			content: projects.content,
			sourceLanguage: projects.sourceLanguage,
			targetLanguage: projects.targetLanguage,
		})
		.from(projects)
		.where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

	if (!dbProject?.content) {
		return NextResponse.json({ error: "Project not found" }, { status: 404 });
	}

	const projectContent = structuredClone(
		dbProject.content,
	) as TranslationProject;
	const sourceLanguage =
		projectContent.sourceLanguage ?? dbProject.sourceLanguage ?? "en";
	const targetLanguage =
		projectContent.targetLanguages?.[0] ??
		dbProject.targetLanguage ??
		"zh-Hans";

	const resourceSummaries = projectContent.resources
		.map((r) => {
			const translated = r.entries.filter((e) => e.targetText.trim()).length;
			return `- ${r.id} (${r.label}): ${translated}/${r.entries.length} translated`;
		})
		.join("\n");

	const body = await request.json();
	const modelMessages = await convertToModelMessages(body.messages);

	const result = streamText({
		model: createModel(),
		system: `You are a translation editing assistant for a software localization project.

Source language: ${sourceLanguage}
Target language: ${targetLanguage}

Project resources:
${resourceSummaries}

You can:
1. Search for translation entries by source text or ID
2. Get the details of a specific entry
3. Update translations for specific entries
4. List all resources in the project
5. Show a visual chart of overall translation progress

When updating translations:
- Preserve format specifiers: %@, %lld, %1$@, %2$@, %%
- Keep markdown formatting if present
- Be natural and contextually appropriate for app UI

Always explain what you're doing and confirm changes with the user.`,
		messages: modelMessages,
		stopWhen: stepCountIs(20),
		tools: {
			updateTranslation: tool({
				description:
					"Update the translation for a specific entry. Use this when the user asks you to change a translation.",
				inputSchema: z.object({
					resourceId: z
						.string()
						.describe("The resource ID containing the entry"),
					entryId: z.string().describe("The entry ID to update"),
					targetText: z.string().describe("The new translated text"),
				}),
				execute: async ({
					resourceId,
					entryId,
					targetText,
				}): Promise<{
					success: boolean;
					error: string;
					resourceId: string;
					entryId: string;
					oldText: string;
					newText: string;
					sourceText: string;
				}> => {
					const resource = projectContent.resources.find(
						(r) => r.id === resourceId,
					);
					if (!resource)
						return {
							success: false,
							error: "Resource not found",
							resourceId,
							entryId,
							oldText: "",
							newText: "",
							sourceText: "",
						};
					const entry = resource.entries.find((e) => e.id === entryId);
					if (!entry)
						return {
							success: false,
							error: "Entry not found",
							resourceId,
							entryId,
							oldText: "",
							newText: "",
							sourceText: "",
						};

					const oldText = entry.targetText;
					entry.targetText = targetText;

					await db
						.update(projects)
						.set({
							content: projectContent,
							updatedAt: new Date(),
						})
						.where(
							and(eq(projects.id, projectId), eq(projects.userId, userId)),
						);

					return {
						success: true,
						error: "",
						resourceId,
						entryId,
						oldText,
						newText: targetText,
						sourceText: entry.sourceText,
					};
				},
			}),

			searchEntries: tool({
				description:
					"Search translation entries by source text content. Returns matching entries with their current translations.",
				inputSchema: z.object({
					query: z.string().describe("Search text to find in source entries"),
					resourceId: z
						.string()
						.optional()
						.describe("Optionally limit to a specific resource"),
				}),
				execute: async ({ query, resourceId }) => {
					const lowerQuery = query.toLowerCase();
					const searchResources = resourceId
						? projectContent.resources.filter((r) => r.id === resourceId)
						: projectContent.resources;

					return searchResources
						.flatMap((r) =>
							r.entries
								.filter(
									(e) =>
										e.sourceText.toLowerCase().includes(lowerQuery) ||
										e.id.toLowerCase().includes(lowerQuery) ||
										e.targetText.toLowerCase().includes(lowerQuery),
								)
								.slice(0, 15)
								.map((e) => ({
									resourceId: r.id,
									entryId: e.id,
									sourceText: e.sourceText,
									targetText: e.targetText || "(not yet translated)",
									comment: e.comment,
								})),
						)
						.slice(0, 20);
				},
			}),

			getEntry: tool({
				description: "Get the full details of a specific translation entry.",
				inputSchema: z.object({
					resourceId: z.string().describe("The resource ID"),
					entryId: z.string().describe("The entry ID"),
				}),
				execute: async ({ resourceId, entryId }) => {
					const resource = projectContent.resources.find(
						(r) => r.id === resourceId,
					);
					if (!resource) return { error: "Resource not found" };
					const entry = resource.entries.find((e) => e.id === entryId);
					if (!entry) return { error: "Entry not found" };
					return {
						resourceId,
						entryId: entry.id,
						sourceText: entry.sourceText,
						targetText: entry.targetText,
						comment: entry.comment,
						context: entry.context,
						maxLength: entry.maxLength,
						pluralForm: entry.pluralForm,
					};
				},
			}),

			listResources: tool({
				description:
					"List all resources in the project with their translation progress.",
				inputSchema: z.object({}),
				execute: async () => {
					return projectContent.resources.map((r) => ({
						id: r.id,
						label: r.label,
						totalEntries: r.entries.length,
						translatedEntries: r.entries.filter((e) => e.targetText.trim())
							.length,
					}));
				},
			}),

			showTranslationProgress: tool({
				description:
					"Show a visual chart of translation progress across all resources. Use this when the user asks about progress, completion status, or wants an overview.",
				inputSchema: z.object({}),
				execute: async () => {
					const resources = projectContent.resources.map((r) => {
						const total = r.entries.length;
						const translated = r.entries.filter((e) =>
							e.targetText.trim(),
						).length;
						return {
							name: r.label || r.id,
							translated,
							untranslated: total - translated,
							total,
							percentage:
								total > 0 ? Math.round((translated / total) * 100) : 0,
						};
					});

					const totalEntries = resources.reduce((sum, r) => sum + r.total, 0);
					const totalTranslated = resources.reduce(
						(sum, r) => sum + r.translated,
						0,
					);

					return {
						resources,
						summary: {
							totalEntries,
							totalTranslated,
							totalUntranslated: totalEntries - totalTranslated,
							overallPercentage:
								totalEntries > 0
									? Math.round((totalTranslated / totalEntries) * 100)
									: 0,
						},
					};
				},
			}),
		},
	});

	return result.toUIMessageStreamResponse();
}

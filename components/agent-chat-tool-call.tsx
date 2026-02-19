"use client";

import type { ToolUIPart, DynamicToolUIPart } from "ai";
import { Loader2, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";

type AnyToolPart = ToolUIPart | DynamicToolUIPart;

interface AgentChatToolCallProps {
	part: AnyToolPart;
}

function getToolName(part: AnyToolPart): string {
	if ("toolName" in part) return part.toolName as string;
	return part.type.replace(/^tool-/, "");
}

function getOutput(part: AnyToolPart): unknown {
	if (part.state === "output-available" && "output" in part) {
		return part.output;
	}
	return null;
}

function StatusIcon({ part }: { part: AnyToolPart }) {
	if (part.state === "output-available") {
		return <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />;
	}
	if (part.state === "output-error") {
		return <AlertCircle className="h-3 w-3 text-destructive shrink-0" />;
	}
	return <Loader2 className="h-3 w-3 animate-spin shrink-0" />;
}

function UpdateTranslationResult({
	output,
}: {
	output: Record<string, unknown>;
}) {
	if (!output.success) {
		return (
			<div className="text-destructive">Failed: {String(output.error)}</div>
		);
	}

	return (
		<div className="mt-1 space-y-0.5">
			<div className="text-muted-foreground truncate">
				{String(output.sourceText)}
			</div>
			<div className="flex items-center gap-1.5">
				<span className="line-through text-muted-foreground/60 truncate max-w-[40%]">
					{String(output.oldText) || "(empty)"}
				</span>
				<ArrowRight className="h-2.5 w-2.5 shrink-0 text-muted-foreground/60" />
				<span className="text-green-600 dark:text-green-400 truncate max-w-[40%]">
					{String(output.newText)}
				</span>
			</div>
		</div>
	);
}

function SearchEntriesResult({ output }: { output: unknown[] }) {
	if (output.length === 0) {
		return <div className="text-muted-foreground">No entries found</div>;
	}

	return (
		<div className="mt-1 space-y-0.5">
			{output.slice(0, 5).map((entry) => {
				const e = entry as Record<string, unknown>;
				return (
					<div
						key={`${String(e.resourceId)}:${String(e.entryId)}`}
						className="flex items-baseline gap-1.5 truncate"
					>
						<span className="text-muted-foreground truncate max-w-[45%]">
							{String(e.sourceText)}
						</span>
						<ArrowRight className="h-2 w-2 shrink-0 text-muted-foreground/60" />
						<span className="truncate max-w-[45%]">{String(e.targetText)}</span>
					</div>
				);
			})}
			{output.length > 5 && (
				<div className="text-muted-foreground">
					...and {output.length - 5} more
				</div>
			)}
		</div>
	);
}

interface ProgressData {
	resources: {
		name: string;
		translated: number;
		untranslated: number;
		total: number;
		percentage: number;
	}[];
	summary: {
		totalEntries: number;
		totalTranslated: number;
		totalUntranslated: number;
		overallPercentage: number;
	};
}

const progressChartConfig = {
	translated: {
		label: "Translated",
		color: "var(--color-green-500)",
	},
	untranslated: {
		label: "Untranslated",
		color: "var(--color-muted)",
	},
} satisfies ChartConfig;

function TranslationProgressResult({ output }: { output: ProgressData }) {
	const { resources, summary } = output;

	return (
		<Card size="sm" className="mt-1.5">
			<CardHeader>
				<CardTitle className="text-xs">Translation Progress</CardTitle>
				<CardDescription>
					{summary.totalTranslated} / {summary.totalEntries} entries translated
					({summary.overallPercentage}%)
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer
					config={progressChartConfig}
					className="aspect-auto h-30 w-full"
				>
					<BarChart
						data={resources}
						layout="vertical"
						margin={{ left: 0, right: 0, top: 0, bottom: 0 }}
					>
						<YAxis
							dataKey="name"
							type="category"
							tickLine={false}
							axisLine={false}
							width={80}
							tick={{ fontSize: 10 }}
						/>
						<XAxis type="number" hide />
						<ChartTooltip
							content={
								<ChartTooltipContent
									hideLabel
									formatter={(value, name) => (
										<span>
											{String(name)}: {String(value)}
										</span>
									)}
								/>
							}
						/>
						<Bar
							dataKey="translated"
							stackId="a"
							fill="var(--color-translated)"
							radius={[4, 0, 0, 4]}
						/>
						<Bar
							dataKey="untranslated"
							stackId="a"
							fill="var(--color-untranslated)"
							radius={[0, 4, 4, 0]}
						/>
					</BarChart>
				</ChartContainer>
				<div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
					<div className="flex items-center gap-1">
						<div className="h-2 w-2 rounded-sm bg-green-500" />
						Translated
					</div>
					<div className="flex items-center gap-1">
						<div className="h-2 w-2 rounded-sm bg-muted" />
						Untranslated
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function ToolOutput({
	toolName,
	output,
}: {
	toolName: string;
	output: unknown;
}) {
	if (!output) return null;

	if (
		toolName === "updateTranslation" &&
		typeof output === "object" &&
		output !== null
	) {
		return (
			<UpdateTranslationResult output={output as Record<string, unknown>} />
		);
	}

	if (toolName === "searchEntries" && Array.isArray(output)) {
		return <SearchEntriesResult output={output} />;
	}

	if (
		toolName === "showTranslationProgress" &&
		typeof output === "object" &&
		output !== null
	) {
		return <TranslationProgressResult output={output as ProgressData} />;
	}

	return null;
}

export function AgentChatToolCall({ part }: AgentChatToolCallProps) {
	const toolName = getToolName(part);
	const output = getOutput(part);
	const isDone = part.state === "output-available";

	const displayName: Record<string, string> = {
		updateTranslation: "Update Translation",
		searchEntries: "Search Entries",
		getEntry: "Get Entry",
		listResources: "List Resources",
		showTranslationProgress: "Translation Progress",
	};

	return (
		<div className="text-[10px] border rounded-md bg-card text-card-foreground shadow-xs px-2.5 py-1.5 my-1">
			<div className="flex items-center gap-1.5 text-muted-foreground">
				<StatusIcon part={part} />
				<span className="italic">
					{isDone ? "" : "Calling "}
					{displayName[toolName] ?? toolName}
					{isDone ? "" : "..."}
				</span>
			</div>
			{isDone && <ToolOutput toolName={toolName} output={output} />}
		</div>
	);
}

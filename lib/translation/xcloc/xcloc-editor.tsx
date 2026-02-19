"use client";

import React, { useState, useMemo, useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { PanelLeft } from "lucide-react";
import type { TranslationProject } from "../types";
import type { Term } from "../tools/term-tools";
import { XclocEntryRow } from "./xcloc-entry-row";

interface XclocEditorProps {
	project: TranslationProject;
	onEntryUpdate: (
		resourceId: string,
		entryId: string,
		update: { targetText?: string; comment?: string },
	) => void;
	streamingEntryIds: Set<string>;
	terms: Term[];
}

export function XclocEditor({
	project,
	onEntryUpdate,
	streamingEntryIds,
	terms,
}: XclocEditorProps) {
	const [activeResourceId, setActiveResourceId] = useState<string>(
		project.resources[0]?.id ?? "",
	);
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const isMobile = useIsMobile();

	const activeResource = useMemo(
		() => project.resources.find((r) => r.id === activeResourceId),
		[project.resources, activeResourceId],
	);

	const stats = useMemo(() => {
		if (!activeResource) return { total: 0, translated: 0 };
		const total = activeResource.entries.length;
		const translated = activeResource.entries.filter(
			(e) => e.targetText.trim() !== "",
		).length;
		return { total, translated };
	}, [activeResource]);

	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const entries = activeResource?.entries ?? [];

	const virtualizer = useVirtualizer({
		count: entries.length,
		getScrollElement: () => scrollContainerRef.current,
		estimateSize: () => 180,
		overscan: 5,
	});

	const handleEntryUpdate = useCallback(
		(entryId: string, update: { targetText?: string; comment?: string }) => {
			onEntryUpdate(activeResourceId, entryId, update);
		},
		[activeResourceId, onEntryUpdate],
	);

	const hasMultipleResources = project.resources.length > 1;

	const resourceList = hasMultipleResources
		? project.resources.map((resource) => {
				const resTranslated = resource.entries.filter(
					(e) => e.targetText.trim() !== "",
				).length;
				const isActive = resource.id === activeResourceId;
				return (
					<button
						key={resource.id}
						type="button"
						onClick={() => {
							setActiveResourceId(resource.id);
							if (isMobile) setSidebarOpen(false);
						}}
						className={cn(
							"w-full text-left px-4 py-2.5 text-xs hover:bg-accent transition-colors flex items-center justify-between border-b last:border-b-0",
							isActive && "bg-accent text-accent-foreground",
						)}
					>
						<span className="truncate">{resource.label}</span>
						<Badge variant="secondary" className="ml-2 shrink-0 text-[10px]">
							{resTranslated}/{resource.entries.length}
						</Badge>
					</button>
				);
			})
		: null;

	return (
		<div className="flex h-full gap-4">
			{/* Desktop resource sidebar */}
			{hasMultipleResources && !isMobile && (
				<Card className="w-64 shrink-0 overflow-y-auto sticky top-20 self-start max-h-screen">
					<CardHeader className="border-b">
						<CardTitle>Resources</CardTitle>
					</CardHeader>
					<CardContent className="p-0">{resourceList}</CardContent>
				</Card>
			)}

			{/* Mobile resource Sheet */}
			{hasMultipleResources && isMobile && (
				<Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
					<SheetContent side="left" className="w-72 p-0">
						<SheetHeader className="p-4 border-b">
							<SheetTitle>Resources</SheetTitle>
						</SheetHeader>
						<div className="overflow-y-auto flex-1">{resourceList}</div>
					</SheetContent>
				</Sheet>
			)}

			{/* Entry list */}
			<Card className="flex-1 flex flex-col min-h-0">
				<CardHeader className="border-b shrink-0">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							{hasMultipleResources && isMobile && (
								<Button
									variant="ghost"
									size="icon-sm"
									onClick={() => setSidebarOpen(true)}
								>
									<PanelLeft className="h-4 w-4" />
								</Button>
							)}
							<CardTitle>
								{activeResource?.label ?? "No resource selected"}
							</CardTitle>
						</div>
						<Badge variant="outline">
							{stats.translated}/{stats.total} translated
						</Badge>
					</div>
				</CardHeader>
				<CardContent
					ref={scrollContainerRef}
					className="flex-1 overflow-y-auto p-0"
				>
					{entries.length > 0 ? (
						<div
							className="relative w-full"
							style={{ height: virtualizer.getTotalSize() }}
						>
							{virtualizer.getVirtualItems().map((virtualRow) => {
								const entry = entries[virtualRow.index];
								return (
									<div
										key={entry.id}
										data-index={virtualRow.index}
										ref={virtualizer.measureElement}
										className="absolute left-0 w-full"
										style={{ top: virtualRow.start }}
									>
										<XclocEntryRow
											entry={entry}
											resourceId={activeResourceId}
											onUpdate={(update) => handleEntryUpdate(entry.id, update)}
											isStreaming={streamingEntryIds.has(
												`${activeResourceId}:${entry.id}`,
											)}
											terms={terms}
										/>
									</div>
								);
							})}
						</div>
					) : (
						<div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
							No entries in this resource
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

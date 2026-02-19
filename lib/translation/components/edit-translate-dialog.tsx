"use client";

import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { AgentChat } from "@/components/agent-chat";
import { useCallback } from "react";

interface EditTranslateDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projectId: string;
	onTranslationUpdated: (
		resourceId: string,
		entryId: string,
		targetText: string,
	) => void;
}

export function EditTranslateDialog({
	open,
	onOpenChange,
	projectId,
	onTranslationUpdated,
}: EditTranslateDialogProps) {
	const handleToolCall = useCallback(
		(toolCall: {
			toolCallId: string;
			toolName: string;
			args: Record<string, unknown>;
		}) => {
			if (toolCall.toolName === "updateTranslation") {
				const { resourceId, entryId, targetText } = toolCall.args as {
					resourceId: string;
					entryId: string;
					targetText: string;
				};
				onTranslationUpdated(resourceId, entryId, targetText);
			}
			return undefined;
		},
		[onTranslationUpdated],
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl! h-[70vh] flex flex-col p-0 gap-0">
				<DialogHeader className="px-4 pt-4 pb-3 border-b shrink-0">
					<DialogTitle>Edit Translate</DialogTitle>
				</DialogHeader>
				<div className="flex-1 min-h-0">
					<AgentChat
						config={{
							apiUrl: `/api/chat/${projectId}`,
							chatId: `edit-translate:${projectId}`,
							onToolCall: handleToolCall,
						}}
						className="h-full"
					/>
				</div>
			</DialogContent>
		</Dialog>
	);
}

"use client";

import { AlertCircle } from "lucide-react";

import {
	Popover,
	PopoverContent,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { EditorStatus } from "./types";

interface TranslationStatusProps {
	status: EditorStatus;
	errors?: string[];
	onClearErrors?: () => void;
	className?: string;
}

export function TranslationStatus({
	status,
	errors = [],
	onClearErrors,
	className,
}: TranslationStatusProps) {
	return (
		<div
			className={cn(
				"flex items-center gap-2 text-xs text-muted-foreground",
				className,
			)}
		>
			{status.state === "idle" && (
				<span className="animate-in fade-in duration-300">Ready</span>
			)}
			{status.state === "saving" && (
				<span className="animate-in fade-in duration-300">Saving...</span>
			)}
			{status.state === "saved" && (
				<span className="animate-in fade-in duration-300">
					Saved {status.at.toLocaleTimeString()}
				</span>
			)}
			{status.state === "translating" && (
				<span className="animate-in fade-in duration-300">
					Translating {status.current}/{status.total}
				</span>
			)}
			{status.state === "error" && (
				<span className="text-destructive animate-in fade-in duration-300">
					Error: {status.message}
				</span>
			)}

			{errors.length > 0 && (
				<Popover
					onOpenChange={(open) => {
						if (!open) onClearErrors?.();
					}}
				>
					<PopoverTrigger asChild>
						<button
							type="button"
							className="inline-flex items-center gap-1 text-destructive hover:text-destructive/80 transition-colors"
						>
							<AlertCircle className="h-3.5 w-3.5" />
							<span>
								{errors.length} {errors.length === 1 ? "error" : "errors"}
							</span>
						</button>
					</PopoverTrigger>
					<PopoverContent align="end" className="w-80 max-h-60 overflow-y-auto">
						<PopoverHeader>
							<PopoverTitle>Translation Errors</PopoverTitle>
						</PopoverHeader>
						<ul className="flex flex-col gap-1.5">
							{errors.map((error) => (
								<li
									key={error}
									className="text-xs text-destructive bg-destructive/5 px-2 py-1.5 wrap-break-word"
								>
									{error}
								</li>
							))}
						</ul>
					</PopoverContent>
				</Popover>
			)}
		</div>
	);
}

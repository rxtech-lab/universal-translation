"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileArchive, Loader2 } from "lucide-react";
import { DefaultUploadProcessor } from "@/lib/translation/upload-processor";
import { createDefaultRegistry } from "@/lib/translation/registry-impl";
import { createProjectFromParsed } from "@/app/actions/upload";

type UploadState =
	| { step: "idle" }
	| { step: "uploading"; progress: number }
	| { step: "parsing" }
	| { step: "creating" }
	| { step: "error"; message: string };

export function UploadClient() {
	const router = useRouter();
	const [state, setState] = useState<UploadState>({ step: "idle" });
	const [dragOver, setDragOver] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const processFile = useCallback(
		async (file: File) => {
			try {
				// Step 1: Upload to Vercel Blob
				setState({ step: "uploading", progress: 0 });
				const blob = await upload(file.name, file, {
					access: "public",
					handleUploadUrl: "/api/upload",
				});

				// Step 2: Parse locally
				setState({ step: "parsing" });
				const processor = new DefaultUploadProcessor();
				const payloadResult = await processor.process(file);
				if (payloadResult.hasError) {
					setState({
						step: "error",
						message: payloadResult.errorMessage,
					});
					return;
				}

				const registry = await createDefaultRegistry();
				const resolved = await registry.resolve(payloadResult.data);
				if (!resolved) {
					setState({
						step: "error",
						message: "Unsupported file format. Please upload an .xcloc file.",
					});
					return;
				}

				const loadResult = await resolved.client.load(payloadResult.data);
				if (loadResult.hasError) {
					setState({
						step: "error",
						message: loadResult.errorMessage,
					});
					return;
				}

				const project = resolved.client.getProject();
				const formatId = resolved.match.descriptor.formatId;
				const sourceLanguage = resolved.client.getSourceLanguage() ?? undefined;
				const targetLanguages = resolved.client.getTargetLanguages();

				// Get format-specific data for DB storage
				let formatData: Record<string, unknown> = {};
				if (
					"getFormatData" in resolved.client &&
					typeof resolved.client.getFormatData === "function"
				) {
					formatData = resolved.client.getFormatData() as unknown as Record<
						string,
						unknown
					>;
				}

				// Step 3: Create project in DB
				setState({ step: "creating" });
				const projectId = await createProjectFromParsed({
					name: file.name.replace(/\.zip$/, ""),
					formatId,
					blobUrl: blob.url,
					content: project,
					formatData,
					sourceLanguage,
					targetLanguage: targetLanguages[0],
					sourceLocale: sourceLanguage,
					targetLocale: targetLanguages[0],
				});

				router.push(`/dashboard/projects/${projectId}`);
			} catch (err) {
				setState({
					step: "error",
					message: err instanceof Error ? err.message : "Upload failed",
				});
			}
		},
		[router],
	);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setDragOver(false);
			const file = e.dataTransfer.files[0];
			if (file) processFile(file);
		},
		[processFile],
	);

	const handleFileSelect = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (file) processFile(file);
		},
		[processFile],
	);

	const isProcessing = state.step !== "idle" && state.step !== "error";

	return (
		<Card className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
			<CardHeader>
				<CardTitle>New Translation Project</CardTitle>
				<CardDescription>
					Upload a translation file to get started
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div
					onDragOver={(e) => {
						e.preventDefault();
						setDragOver(true);
					}}
					onDragLeave={() => setDragOver(false)}
					onDrop={handleDrop}
					className={`border-2 border-dashed p-8 text-center transition-colors ${
						dragOver
							? "border-primary bg-primary/5"
							: "border-muted-foreground/25 hover:border-muted-foreground/50"
					} ${isProcessing ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
					onClick={() => !isProcessing && inputRef.current?.click()}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							if (!isProcessing) inputRef.current?.click();
						}
					}}
					role="button"
					tabIndex={0}
				>
					<input
						ref={inputRef}
						type="file"
						accept=".zip,.xcloc"
						onChange={handleFileSelect}
						className="hidden"
					/>

					{state.step === "idle" && (
						<div className="flex flex-col items-center gap-3 animate-in fade-in duration-300">
							<Upload className="h-8 w-8 text-muted-foreground" />
							<div>
								<p className="text-sm font-medium">
									Drop your file here or click to browse
								</p>
								<p className="text-xs text-muted-foreground mt-1">
									Supports .xcloc bundles (as .zip)
								</p>
							</div>
							<div className="flex gap-2">
								<Badge variant="outline">
									<FileArchive className="h-3 w-3 mr-1" />
									.xcloc
								</Badge>
							</div>
						</div>
					)}

					{state.step === "uploading" && (
						<div className="flex flex-col items-center gap-3 animate-in fade-in duration-300">
							<Loader2 className="h-8 w-8 text-primary animate-spin" />
							<p className="text-sm font-medium">Uploading...</p>
						</div>
					)}

					{state.step === "parsing" && (
						<div className="flex flex-col items-center gap-3 animate-in fade-in duration-300">
							<Loader2 className="h-8 w-8 text-primary animate-spin" />
							<p className="text-sm font-medium">Parsing translation file...</p>
						</div>
					)}

					{state.step === "creating" && (
						<div className="flex flex-col items-center gap-3 animate-in fade-in duration-300">
							<Loader2 className="h-8 w-8 text-primary animate-spin" />
							<p className="text-sm font-medium">Creating project...</p>
						</div>
					)}

					{state.step === "error" && (
						<div className="flex flex-col items-center gap-3 animate-in fade-in duration-300">
							<p className="text-sm font-medium text-destructive">
								{state.message}
							</p>
							<Button
								variant="outline"
								size="sm"
								onClick={(e) => {
									e.stopPropagation();
									setState({ step: "idle" });
								}}
							>
								Try again
							</Button>
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

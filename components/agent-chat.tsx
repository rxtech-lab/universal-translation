"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart } from "ai";
import { AgentChatToolCall } from "./agent-chat-tool-call";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SendHorizonal, Loader2, Square, Trash2 } from "lucide-react";
import Markdown from "react-markdown";
import { cn } from "@/lib/utils";

export interface AgentChatConfig {
	/** The API endpoint URL for this agent */
	apiUrl: string;
	/** Unique chat ID (used for localStorage key and useChat id) */
	chatId: string;
	/** Callback when a tool call is received from the agent */
	onToolCall?: (toolCall: {
		toolCallId: string;
		toolName: string;
		args: Record<string, unknown>;
	}) => void;
}

interface AgentChatProps {
	config: AgentChatConfig;
	className?: string;
}

const STORAGE_KEY_PREFIX = "agent-chat-history:";

function loadMessages(chatId: string): UIMessage[] {
	try {
		const stored = localStorage.getItem(STORAGE_KEY_PREFIX + chatId);
		if (stored) return JSON.parse(stored);
	} catch {
		// ignore parse errors
	}
	return [];
}

function saveMessages(chatId: string, messages: UIMessage[]) {
	try {
		localStorage.setItem(STORAGE_KEY_PREFIX + chatId, JSON.stringify(messages));
	} catch {
		// ignore storage errors
	}
}

function clearMessages(chatId: string) {
	try {
		localStorage.removeItem(STORAGE_KEY_PREFIX + chatId);
	} catch {
		// ignore storage errors
	}
}

export function AgentChat({ config, className }: AgentChatProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [initialMessages] = useState(() => loadMessages(config.chatId));
	const onToolCallRef = useRef(config.onToolCall);
	onToolCallRef.current = config.onToolCall;

	const { messages, setMessages, sendMessage, status, stop, error } = useChat({
		id: config.chatId,
		transport: new DefaultChatTransport({
			api: config.apiUrl,
		}),
		messages: initialMessages,
		onToolCall: ({ toolCall }) => {
			onToolCallRef.current?.({
				toolCallId: toolCall.toolCallId,
				toolName: toolCall.toolName,
				args: toolCall.input as Record<string, unknown>,
			});
		},
	});

	const [inputValue, setInputValue] = useState("");

	// Persist messages to localStorage
	useEffect(() => {
		if (messages.length > 0) {
			saveMessages(config.chatId, messages);
		}
	}, [messages, config.chatId]);

	// Auto-scroll to bottom
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	});

	const isLoading = status === "submitted" || status === "streaming";

	const handleSend = useCallback(() => {
		const text = inputValue.trim();
		if (!text || isLoading) return;
		sendMessage({ text });
		setInputValue("");
	}, [inputValue, isLoading, sendMessage]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleSend();
			}
		},
		[handleSend],
	);

	const handleClear = useCallback(() => {
		clearMessages(config.chatId);
		setMessages([]);
	}, [config.chatId, setMessages]);

	return (
		<div className={cn("flex flex-col h-full", className)}>
			{/* Messages area */}
			<div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
				{messages.length === 0 && (
					<div className="flex items-center justify-center h-full text-sm text-muted-foreground">
						Ask the AI to help you edit translations...
					</div>
				)}
				{messages.map((message) => {
					const isUser = message.role === "user";

					// Group consecutive parts of the same kind together
					const groups: {
						type: "text" | "tool";
						parts: typeof message.parts;
					}[] = [];
					for (const part of message.parts) {
						const kind = isToolUIPart(part)
							? "tool"
							: part.type === "text"
								? "text"
								: null;
						if (!kind) continue;
						const last = groups[groups.length - 1];
						if (last?.type === kind) {
							last.parts.push(part);
						} else {
							groups.push({ type: kind, parts: [part] });
						}
					}

					return (
						<div
							key={message.id}
							className={cn(
								"flex flex-col gap-1",
								isUser ? "items-end" : "items-start",
							)}
						>
							{groups.map((group) => {
								const groupKey =
									group.type === "text"
										? `text-${(group.parts[0] as { text: string }).text?.slice(0, 32)}`
										: `tool-${(group.parts[0] as { toolCallId: string }).toolCallId}`;
								if (group.type === "text") {
									return (
										<div
											key={groupKey}
											className={cn(
												"max-w-[80%] px-3 py-2 text-xs rounded-lg",
												isUser
													? "bg-primary text-primary-foreground"
													: "bg-muted",
											)}
										>
											{group.parts.map((part) => {
												if (part.type !== "text") return null;
												return (
													<div
														key={part.text}
														className="prose prose-xs dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_pre]:my-1 [&_code]:text-[11px]"
													>
														<Markdown>{part.text}</Markdown>
													</div>
												);
											})}
										</div>
									);
								}

								return (
									<div key={groupKey} className="w-full space-y-1">
										{group.parts.map((part) => {
											if (!isToolUIPart(part)) return null;
											return (
												<AgentChatToolCall key={part.toolCallId} part={part} />
											);
										})}
									</div>
								);
							})}
						</div>
					);
				})}
				{status === "submitted" && (
					<div className="flex justify-start">
						<div className="bg-muted px-3 py-2 text-xs rounded-lg flex items-center gap-2">
							<Loader2 className="h-3 w-3 animate-spin" />
							Thinking...
						</div>
					</div>
				)}
				{error && (
					<div className="text-xs text-destructive px-3 py-2 bg-destructive/10 rounded-lg">
						Error: {error.message}
					</div>
				)}
			</div>

			{/* Input area */}
			<div className="border-t p-3 flex gap-2 items-center">
				{messages.length > 0 && !isLoading && (
					<Button
						size="icon-sm"
						variant="ghost"
						onClick={handleClear}
						title="Clear chat history"
					>
						<Trash2 className="h-3.5 w-3.5" />
					</Button>
				)}
				<Textarea
					value={inputValue}
					onChange={(e) => setInputValue(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="Ask AI to edit translations..."
					className="min-h-10 max-h-32 resize-none flex-1"
					disabled={isLoading}
				/>
				{isLoading ? (
					<Button size="icon-sm" variant="outline" onClick={stop}>
						<Square className="h-3 w-3" />
					</Button>
				) : (
					<Button
						size="icon-sm"
						onClick={handleSend}
						disabled={!inputValue.trim()}
					>
						<SendHorizonal className="h-3.5 w-3.5" />
					</Button>
				)}
			</div>
		</div>
	);
}

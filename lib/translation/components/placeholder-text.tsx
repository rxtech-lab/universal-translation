"use client";

import React from "react";
import { cn } from "@/lib/utils";

// Matches: %@, %lld, %lf, %d, %f, %s, %u, %li, %lu, %1$@, %2$lld, %%, etc.
const PLACEHOLDER_REGEX =
	/(%(?:\d+\$)?(?:[-+ 0#]*)?(?:\d+|\*)?(?:\.(?:\d+|\*))?(?:h{1,2}|l{1,2}|L|q|j|z|t)?[diouxXeEfFgGaAcCsSPnp@%])/g;

interface PlaceholderTextProps {
	text: string;
	className?: string;
}

export function PlaceholderText({ text, className }: PlaceholderTextProps) {
	const parts = text.split(PLACEHOLDER_REGEX);

	return (
		<span className={cn("whitespace-pre-wrap", className)}>
			{parts.map((part, i) =>
				// Odd indices are captured groups (placeholders) from split with capture group
				i % 2 === 1 ? (
					<span
						key={i}
						className="bg-primary/10 text-primary border border-primary/20 px-0.5 mx-0.5 font-mono text-[0.85em] inline-block"
					>
						{part}
					</span>
				) : (
					<React.Fragment key={i}>{part}</React.Fragment>
				),
			)}
		</span>
	);
}

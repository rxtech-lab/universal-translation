"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Term } from "../tools/term-tools";

const TERM_TEMPLATE_RE = /(\$\{\{[a-z0-9-]+\}\})/g;
const TERM_ID_RE = /^\$\{\{([a-z0-9-]+)\}\}$/;

// Matches: %@, %lld, %lf, %d, %f, %s, %u, %li, %lu, %1$@, %2$lld, %%, etc.
const PLACEHOLDER_REGEX =
	/(%(?:\d+\$)?(?:[-+ 0#]*)?(?:\d+|\*)?(?:\.(?:\d+|\*))?(?:h{1,2}|l{1,2}|L|q|j|z|t)?[diouxXeEfFgGaAcCsSPnp@%])/g;

function PlaceholderSegment({ text }: { text: string }) {
	const parts = text.split(PLACEHOLDER_REGEX);
	let phCount = 0;
	let txtCount = 0;
	return (
		<>
			{parts.map((part, idx) =>
				idx % 2 === 1 ? (
					<span
						key={`ph-${part}-${++phCount}`}
						className="bg-primary/10 text-primary border border-primary/20 px-0.5 mx-0.5 font-mono text-[0.85em] inline-block"
					>
						{part}
					</span>
				) : (
					<React.Fragment key={`t-${++txtCount}`}>{part}</React.Fragment>
				),
			)}
		</>
	);
}

interface TermTextProps {
	text: string;
	terms: Term[];
	className?: string;
}

export function TermText({ text, terms, className }: TermTextProps) {
	const termsMap = useMemo(() => new Map(terms.map((t) => [t.id, t])), [terms]);

	const parts = text.split(TERM_TEMPLATE_RE);

	return (
		<span className={cn("whitespace-pre-wrap", className)}>
			{parts.map((part, i) => {
				const idMatch = part.match(TERM_ID_RE);
				if (idMatch) {
					const term = termsMap.get(idMatch[1]);
					return (
						<span
							key={i}
							title={term ? `Term: ${term.originalText}` : idMatch[1]}
							className="bg-violet-500/10 text-violet-700 dark:text-violet-300 border-b border-dashed border-violet-400/50 px-0.5 mx-0.5"
						>
							{term?.translation || part}
						</span>
					);
				}
				return <PlaceholderSegment key={i} text={part} />;
			})}
		</span>
	);
}

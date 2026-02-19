"use client";

import { useReducer, useCallback, useRef } from "react";
import type { TranslationClient } from "../client";
import type { TranslationEntry, TranslationProject } from "../types";

type Action =
	| { type: "SET_PROJECT"; project: TranslationProject }
	| {
			type: "UPDATE_ENTRY";
			resourceId: string;
			entryId: string;
			update: Partial<Pick<TranslationEntry, "targetText" | "comment">>;
	  };

function projectReducer(
	state: TranslationProject,
	action: Action,
): TranslationProject {
	switch (action.type) {
		case "SET_PROJECT":
			return action.project;
		case "UPDATE_ENTRY":
			return {
				...state,
				resources: state.resources.map((r) =>
					r.id !== action.resourceId
						? r
						: {
								...r,
								entries: r.entries.map((e) =>
									e.id !== action.entryId ? e : { ...e, ...action.update },
								),
							},
				),
			};
	}
}

export function useTranslationProject(client: TranslationClient) {
	const clientRef = useRef(client);
	clientRef.current = client;

	const [project, dispatch] = useReducer(projectReducer, client.getProject());

	/** User edit — updates both the client class and React state. */
	const updateEntry = useCallback(
		(
			resourceId: string,
			entryId: string,
			update: Partial<Pick<TranslationEntry, "targetText" | "comment">>,
		) => {
			clientRef.current.updateEntry(resourceId, entryId, update);
			dispatch({ type: "UPDATE_ENTRY", resourceId, entryId, update });
		},
		[],
	);

	/** Stream event — only updates React state (client was already updated by the agent or caller). */
	const applyStreamUpdate = useCallback(
		(
			resourceId: string,
			entryId: string,
			update: Partial<Pick<TranslationEntry, "targetText" | "comment">>,
		) => {
			dispatch({ type: "UPDATE_ENTRY", resourceId, entryId, update });
		},
		[],
	);

	/** Re-snapshot the full project from the client (e.g. after bulk operations). */
	const refreshFromClient = useCallback(() => {
		dispatch({
			type: "SET_PROJECT",
			project: clientRef.current.getProject(),
		});
	}, []);

	return { project, updateEntry, applyStreamUpdate, refreshFromClient };
}

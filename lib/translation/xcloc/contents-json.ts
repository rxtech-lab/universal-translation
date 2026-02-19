import type { OperationResult } from "../types";

export interface XclocContentsJson {
  developmentRegion: string;
  project: string;
  targetLocale: string;
  toolInfo: {
    toolBuildNumber: string;
    toolID: string;
    toolName: string;
    toolVersion: string;
  };
  version: string;
}

export function parseContentsJson(
  content: Uint8Array,
): OperationResult<XclocContentsJson> {
  try {
    const text = new TextDecoder().decode(content);
    const json = JSON.parse(text);

    if (
      !json.developmentRegion ||
      !json.targetLocale ||
      !json.version ||
      !json.project
    ) {
      return {
        hasError: true,
        errorMessage:
          "Invalid contents.json: missing required fields (developmentRegion, targetLocale, version, project)",
      };
    }

    return { hasError: false, data: json as XclocContentsJson };
  } catch (err) {
    return {
      hasError: true,
      errorMessage: `Failed to parse contents.json: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** A single WebVTT subtitle cue. */
export interface VttCue {
  /** Optional cue identifier. */
  id: string | undefined;
  /** Sequential index (1-based) used as a fallback identifier. */
  index: number;
  /** Start time in milliseconds. */
  startMs: number;
  /** End time in milliseconds. */
  endMs: number;
  /** Raw start timestamp string, e.g. "00:01:23.456". */
  startTimestamp: string;
  /** Raw end timestamp string. */
  endTimestamp: string;
  /** Optional cue settings (positioning, alignment, etc.). */
  settings: string;
  /** The text content (may contain newlines for multi-line cues). */
  text: string;
}

/** Convert "HH:MM:SS.mmm" or "MM:SS.mmm" to total milliseconds. */
export function timestampToMs(ts: string): number {
  const parts = ts.split(".");
  const ms = Number(parts[1] ?? 0);
  const hms = parts[0].split(":").map(Number);
  if (hms.length === 3) {
    return hms[0] * 3600000 + hms[1] * 60000 + hms[2] * 1000 + ms;
  }
  // MM:SS.mmm format
  return hms[0] * 60000 + hms[1] * 1000 + ms;
}

/** Convert total milliseconds to "HH:MM:SS.mmm". */
export function msToTimestamp(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mmm = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(mmm).padStart(3, "0")}`;
}

/** Format a cue's timestamp range for display. */
export function formatTimestampRange(cue: VttCue): string {
  return `${cue.startTimestamp} --> ${cue.endTimestamp}`;
}

const TIMESTAMP_RE =
  /^\s*(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})/;

/**
 * Parse WebVTT text into an array of cues.
 * Handles BOM, \r\n line endings, optional cue IDs, and settings.
 */
export function parseVtt(text: string): { header: string; cues: VttCue[] } {
  // Strip BOM and normalise line endings
  const cleaned = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!cleaned) return { header: "WEBVTT", cues: [] };

  // Split into blocks separated by blank lines
  const blocks = cleaned.split(/\n\n+/);
  const cues: VttCue[] = [];

  // First block must start with "WEBVTT"
  let header = "WEBVTT";
  let startBlock = 0;
  if (blocks[0]?.startsWith("WEBVTT")) {
    header = blocks[0];
    startBlock = 1;
  }

  let index = 1;
  for (let i = startBlock; i < blocks.length; i++) {
    const block = blocks[i];
    const lines = block.trim().split("\n");
    if (lines.length < 2) {
      // Could be a single-line cue with just timestamp + empty text,
      // or a NOTE/STYLE block — skip non-cue blocks
      if (lines.length === 1 && TIMESTAMP_RE.test(lines[0])) {
        // Timestamp line only, no text
        const tsMatch = lines[0].match(TIMESTAMP_RE);
        if (tsMatch) {
          const settingsStr = lines[0].slice(tsMatch[0].length).trim();
          cues.push({
            id: undefined,
            index,
            startMs: timestampToMs(tsMatch[1]),
            endMs: timestampToMs(tsMatch[2]),
            startTimestamp: tsMatch[1],
            endTimestamp: tsMatch[2],
            settings: settingsStr,
            text: "",
          });
          index++;
        }
      }
      continue;
    }

    // Skip NOTE and STYLE blocks
    if (lines[0].startsWith("NOTE") || lines[0].startsWith("STYLE")) {
      continue;
    }

    // Determine if first line is a cue ID or a timestamp line
    let cueId: string | undefined;
    let tsLineIndex = 0;

    if (TIMESTAMP_RE.test(lines[0])) {
      // No cue ID, first line is timestamp
      tsLineIndex = 0;
    } else if (lines.length >= 2 && TIMESTAMP_RE.test(lines[1])) {
      // First line is the cue ID
      cueId = lines[0].trim();
      tsLineIndex = 1;
    } else {
      // Not a valid cue block
      continue;
    }

    const tsMatch = lines[tsLineIndex].match(TIMESTAMP_RE);
    if (!tsMatch) continue;

    const startTimestamp = tsMatch[1];
    const endTimestamp = tsMatch[2];
    // Anything after the second timestamp on the same line is cue settings
    const settingsStr = lines[tsLineIndex].slice(tsMatch[0].length).trim();

    // Remaining lines: text content
    const cueText = lines
      .slice(tsLineIndex + 1)
      .join("\n")
      .trim();

    cues.push({
      id: cueId,
      index,
      startMs: timestampToMs(startTimestamp),
      endMs: timestampToMs(endTimestamp),
      startTimestamp,
      endTimestamp,
      settings: settingsStr,
      text: cueText,
    });
    index++;
  }

  return { header, cues };
}

/**
 * Serialize an array of cues back into WebVTT format.
 * Uses the original timestamp strings to preserve timing precision.
 * Note: BOM, CRLF line endings, and extraneous whitespace are normalised
 * during parsing, so the output may differ from the original file bytes.
 */
export function serializeVtt(header: string, cues: VttCue[]): string {
  const parts = [header];

  for (const cue of cues) {
    let block = "";
    if (cue.id) {
      block += `${cue.id}\n`;
    }
    const tsLine = `${cue.startTimestamp} --> ${cue.endTimestamp}${cue.settings ? ` ${cue.settings}` : ""}`;
    block += `${tsLine}\n${cue.text}`;
    parts.push(block);
  }

  return parts.join("\n\n").concat("\n");
}

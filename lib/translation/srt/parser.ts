/** A single SRT subtitle cue. */
export interface SrtCue {
  /** Sequential cue number (1-based). */
  index: number;
  /** Start time in milliseconds. */
  startMs: number;
  /** End time in milliseconds. */
  endMs: number;
  /** Raw start timestamp string, e.g. "00:01:23,456". */
  startTimestamp: string;
  /** Raw end timestamp string. */
  endTimestamp: string;
  /** The text content (may contain newlines for multi-line cues). */
  text: string;
}

/** Convert "HH:MM:SS,mmm" to total milliseconds. */
export function timestampToMs(ts: string): number {
  const [hms, ms] = ts.split(",");
  const [h, m, s] = hms.split(":").map(Number);
  return h * 3600000 + m * 60000 + s * 1000 + Number(ms);
}

/** Convert total milliseconds to "HH:MM:SS,mmm". */
export function msToTimestamp(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mmm = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(mmm).padStart(3, "0")}`;
}

/** Format a cue's timestamp range for display. */
export function formatTimestampRange(cue: SrtCue): string {
  return `${cue.startTimestamp} --> ${cue.endTimestamp}`;
}

const TIMESTAMP_RE =
  /^(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/;

/**
 * Parse SRT text into an array of cues.
 * Handles BOM, \r\n line endings, and trailing whitespace.
 */
export function parseSrt(text: string): SrtCue[] {
  // Strip BOM
  const cleaned = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!cleaned) return [];

  // Split into blocks separated by blank lines
  const blocks = cleaned.split(/\n\n+/);
  const cues: SrtCue[] = [];

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;

    // First line: cue index
    const index = parseInt(lines[0].trim(), 10);
    if (Number.isNaN(index)) continue;

    // Second line: timestamps
    const tsMatch = lines[1].match(TIMESTAMP_RE);
    if (!tsMatch) continue;

    const startTimestamp = tsMatch[1];
    const endTimestamp = tsMatch[2];

    // Remaining lines: text content
    const text = lines.slice(2).join("\n").trim();

    cues.push({
      index,
      startMs: timestampToMs(startTimestamp),
      endMs: timestampToMs(endTimestamp),
      startTimestamp,
      endTimestamp,
      text,
    });
  }

  return cues;
}

/**
 * Serialize an array of cues back into SRT format.
 * Uses the original timestamp strings for lossless round-tripping.
 */
export function serializeSrt(cues: SrtCue[]): string {
  return cues
    .map(
      (cue) =>
        `${cue.index}\n${cue.startTimestamp} --> ${cue.endTimestamp}\n${cue.text}`,
    )
    .join("\n\n")
    .concat("\n");
}

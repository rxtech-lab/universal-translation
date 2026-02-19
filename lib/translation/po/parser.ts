// ============================================================
// PO (Portable Object) Parser & Serializer
// Handles gettext .po files for app and website localization.
// ============================================================

/** Metadata from the PO header entry (msgid ""). */
export interface PoHeader {
  /** All key-value header pairs (e.g. "Content-Type", "Plural-Forms"). */
  raw: Record<string, string>;
  /** Number of plural forms, parsed from Plural-Forms header. Defaults to 2. */
  nplurals: number;
}

/** A single PO entry (msgid/msgstr pair). */
export interface PoEntry {
  /** Translator comments (lines starting with "# "). */
  translatorComments: string[];
  /** Extracted comments (lines starting with "#. "). */
  extractedComments: string[];
  /** Reference locations (lines starting with "#: "). */
  references: string[];
  /** Flags (lines starting with "#, ") — e.g. ["fuzzy", "c-format"]. */
  flags: string[];
  /** Previous msgid for fuzzy matching (lines starting with "#| "). */
  previousMsgid?: string;
  /** Message context (msgctxt). */
  msgctxt?: string;
  /** Source text (msgid). */
  msgid: string;
  /** Plural source text (msgid_plural), if present. */
  msgidPlural?: string;
  /** Translation (msgstr) for non-plural entries. */
  msgstr?: string;
  /** Plural translations indexed by form number. */
  msgstrPlural?: Record<number, string>;
}

/** Top-level PO document. */
export interface PoDocument {
  header: PoHeader;
  entries: PoEntry[];
}

// ---- Escape helpers ----------------------------------------

function unescapePo(str: string): string {
  return str
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function escapePo(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\t/g, "\\t")
    .replace(/\n/g, "\\n");
}

// ---- Parse helpers -----------------------------------------

/** Extract the string value from a quoted PO string, handling multiline concatenation. */
function extractQuotedString(lines: string[], startIdx: number): {
  value: string;
  nextIdx: number;
} {
  let result = "";
  let idx = startIdx;

  while (idx < lines.length) {
    const line = lines[idx].trim();
    const match = line.match(/^"(.*)"$/);
    if (!match) break;
    result += unescapePo(match[1]);
    idx++;
  }

  return { value: result, nextIdx: idx };
}

/** Parse a keyword line (e.g. `msgid "text"`) and return the inline string content. */
function parseKeywordLine(line: string): string | null {
  const match = line.match(/^(?:msgid|msgstr|msgid_plural|msgctxt|msgstr\[\d+\])\s+"(.*)"$/);
  if (!match) return null;
  return unescapePo(match[1]);
}

// ---- Parse header ------------------------------------------

function parseHeader(rawStr: string): PoHeader {
  const raw: Record<string, string> = {};
  for (const line of rawStr.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();
    raw[key] = value;
  }

  let nplurals = 2;
  const pluralForms = raw["Plural-Forms"];
  if (pluralForms) {
    const match = pluralForms.match(/nplurals\s*=\s*(\d+)/);
    if (match) nplurals = parseInt(match[1], 10);
  }

  return { raw, nplurals };
}

// ---- Main parser -------------------------------------------

export function parsePo(text: string): PoDocument {
  // Normalize line endings and strip BOM
  const cleaned = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lines = cleaned.split("\n");

  const entries: PoEntry[] = [];
  let header: PoHeader = { raw: {}, nplurals: 2 };

  let i = 0;
  while (i < lines.length) {
    // Skip blank lines
    if (lines[i].trim() === "") {
      i++;
      continue;
    }

    // Collect comments
    const translatorComments: string[] = [];
    const extractedComments: string[] = [];
    const references: string[] = [];
    const flags: string[] = [];
    let previousMsgid: string | undefined;

    while (i < lines.length && lines[i].startsWith("#")) {
      const line = lines[i];
      if (line.startsWith("#. ")) {
        extractedComments.push(line.slice(3));
      } else if (line.startsWith("#: ")) {
        references.push(line.slice(3));
      } else if (line.startsWith("#, ")) {
        flags.push(...line.slice(3).split(",").map((f) => f.trim()));
      } else if (line.startsWith("#| msgid ")) {
        const match = line.match(/^#\| msgid "(.*)"$/);
        if (match) previousMsgid = unescapePo(match[1]);
      } else if (line.startsWith("# ") || line === "#") {
        translatorComments.push(line.slice(2));
      }
      i++;
    }

    // Parse keyword lines
    let msgctxt: string | undefined;
    let msgid = "";
    let msgidPlural: string | undefined;
    let msgstr: string | undefined;
    const msgstrPlural: Record<number, string> = {};
    let hasPluralStr = false;

    while (i < lines.length && lines[i].trim() !== "") {
      const line = lines[i].trim();

      if (line.startsWith("msgctxt ")) {
        const inline = parseKeywordLine(line);
        i++;
        if (inline !== null) {
          const cont = extractQuotedString(lines, i);
          msgctxt = inline + cont.value;
          i = cont.nextIdx;
        }
      } else if (line.startsWith("msgid_plural ")) {
        const inline = parseKeywordLine(line);
        i++;
        if (inline !== null) {
          const cont = extractQuotedString(lines, i);
          msgidPlural = inline + cont.value;
          i = cont.nextIdx;
        }
      } else if (line.startsWith("msgid ")) {
        const inline = parseKeywordLine(line);
        i++;
        if (inline !== null) {
          const cont = extractQuotedString(lines, i);
          msgid = inline + cont.value;
          i = cont.nextIdx;
        }
      } else if (line.match(/^msgstr\[\d+\] /)) {
        const idxMatch = line.match(/^msgstr\[(\d+)\]\s+"(.*)"$/);
        if (idxMatch) {
          const formIdx = parseInt(idxMatch[1], 10);
          const inline = unescapePo(idxMatch[2]);
          i++;
          const cont = extractQuotedString(lines, i);
          msgstrPlural[formIdx] = inline + cont.value;
          i = cont.nextIdx;
          hasPluralStr = true;
        } else {
          i++;
        }
      } else if (line.startsWith("msgstr ")) {
        const inline = parseKeywordLine(line);
        i++;
        if (inline !== null) {
          const cont = extractQuotedString(lines, i);
          msgstr = inline + cont.value;
          i = cont.nextIdx;
        }
      } else {
        // Unknown line, skip
        i++;
      }
    }

    // Check if this is the header entry
    if (msgid === "" && msgstr !== undefined && entries.length === 0) {
      header = parseHeader(msgstr);
      continue;
    }

    // Skip entries with empty msgid (shouldn't happen after header)
    if (msgid === "" && msgstr === undefined && !hasPluralStr) {
      continue;
    }

    const entry: PoEntry = {
      translatorComments,
      extractedComments,
      references,
      flags,
      previousMsgid,
      msgctxt,
      msgid,
      msgidPlural,
    };

    if (hasPluralStr) {
      entry.msgstrPlural = msgstrPlural;
    } else {
      entry.msgstr = msgstr ?? "";
    }

    entries.push(entry);
  }

  return { header, entries };
}

// ---- Serializer --------------------------------------------

function serializeString(keyword: string, value: string): string {
  const escaped = escapePo(value);
  // For multiline strings (containing \n in the escaped form), use continuation lines
  if (escaped.includes("\\n") && value.length > 0) {
    const parts = escaped.split("\\n");
    const lines: string[] = [];
    lines.push(`${keyword} ""`);
    for (let j = 0; j < parts.length; j++) {
      const suffix = j < parts.length - 1 ? "\\n" : "";
      const part = parts[j] + suffix;
      if (part) {
        lines.push(`"${part}"`);
      }
    }
    return lines.join("\n");
  }
  return `${keyword} "${escaped}"`;
}

export function serializePo(doc: PoDocument): string {
  const lines: string[] = [];

  // Serialize header
  const headerPairs = Object.entries(doc.header.raw);
  if (headerPairs.length > 0) {
    lines.push('msgid ""');
    lines.push('msgstr ""');
    for (const [key, value] of headerPairs) {
      lines.push(`"${escapePo(key)}: ${escapePo(value)}\\n"`);
    }
    lines.push("");
  }

  // Serialize entries
  for (const entry of doc.entries) {
    // Comments
    for (const comment of entry.translatorComments) {
      lines.push(`# ${comment}`);
    }
    for (const comment of entry.extractedComments) {
      lines.push(`#. ${comment}`);
    }
    for (const ref of entry.references) {
      lines.push(`#: ${ref}`);
    }
    if (entry.flags.length > 0) {
      lines.push(`#, ${entry.flags.join(", ")}`);
    }
    if (entry.previousMsgid !== undefined) {
      lines.push(`#| msgid "${escapePo(entry.previousMsgid)}"`);
    }

    // Keywords
    if (entry.msgctxt !== undefined) {
      lines.push(serializeString("msgctxt", entry.msgctxt));
    }
    lines.push(serializeString("msgid", entry.msgid));
    if (entry.msgidPlural !== undefined) {
      lines.push(serializeString("msgid_plural", entry.msgidPlural));
    }

    if (entry.msgstrPlural) {
      const indices = Object.keys(entry.msgstrPlural)
        .map(Number)
        .sort((a, b) => a - b);
      for (const idx of indices) {
        lines.push(serializeString(`msgstr[${idx}]`, entry.msgstrPlural[idx]));
      }
    } else {
      lines.push(serializeString("msgstr", entry.msgstr ?? ""));
    }

    lines.push("");
  }

  return lines.join("\n");
}

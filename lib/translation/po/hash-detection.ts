import type { PoDocument } from "./parser";

/**
 * Returns true if a single msgid looks like a hash token
 * (short, no spaces, alphanumeric with optional +/= characters).
 *
 * Heuristic: 2-12 characters, no whitespace, matches [A-Za-z0-9+/=_-]+
 */
export function isHashLikeMsgid(msgid: string): boolean {
  if (msgid.length < 2 || msgid.length > 12) return false;
  if (/\s/.test(msgid)) return false;
  return /^[A-Za-z0-9+/=_-]+$/.test(msgid);
}

/**
 * Checks whether a PO document's entries predominantly use hash-based msgids.
 * Returns true if more than 50% of non-empty msgids match the hash pattern.
 *
 * Minimum sample: requires at least 3 entries to make a determination.
 * For fewer entries, returns false (assumes standard PO).
 */
export function hasHashBasedMsgids(document: PoDocument): boolean {
  const entries = document.entries.filter((e) => e.msgid.trim() !== "");
  if (entries.length < 3) return false;

  const hashCount = entries.filter((e) => isHashLikeMsgid(e.msgid)).length;
  return hashCount / entries.length > 0.5;
}

/**
 * Checks whether a PO document has hash-based msgids AND its non-empty msgstr
 * values also look like hashes (not human-readable text). This indicates the
 * file is NOT a valid source reference — a valid reference (e.g. en.po) has
 * hash msgids but human-readable English text as msgstr.
 */
export function hasHashBasedMsgstrs(document: PoDocument): boolean {
  const withMsgstr = document.entries.filter(
    (e) => e.msgstr && e.msgstr.trim() !== "",
  );
  if (withMsgstr.length < 3) return false;

  const hashCount = withMsgstr.filter((e) =>
    isHashLikeMsgid(e.msgstr ?? ""),
  ).length;
  return hashCount / withMsgstr.length > 0.5;
}

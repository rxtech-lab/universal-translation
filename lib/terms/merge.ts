/**
 * Given existing terms (by slug) and incoming terms, compute which to insert
 * and which to update. Existing terms not present in `newTerms` are preserved
 * (not deleted).
 */
export function computeTermMerge(
  existingTerms: Array<{ id: string; slug: string }>,
  newTerms: Array<{
    slug: string;
    originalText: string;
    translation: string;
    comment?: string | null;
  }>,
): {
  toInsert: Array<{
    slug: string;
    originalText: string;
    translation: string;
    comment?: string | null;
  }>;
  toUpdate: Array<{
    existingId: string;
    originalText: string;
    translation: string;
    comment?: string | null;
  }>;
} {
  const slugToId = new Map(existingTerms.map((t) => [t.slug, t.id]));

  const toInsert: typeof newTerms = [];
  const toUpdate: Array<{
    existingId: string;
    originalText: string;
    translation: string;
    comment?: string | null;
  }> = [];

  for (const t of newTerms) {
    const existingId = slugToId.get(t.slug);
    if (existingId) {
      toUpdate.push({
        existingId,
        originalText: t.originalText,
        translation: t.translation,
        comment: t.comment,
      });
    } else {
      toInsert.push(t);
    }
  }

  return { toInsert, toUpdate };
}

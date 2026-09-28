// Tags come from #hashtags in the note: "Dinner #goa-trip" → ["goa-trip"].

const TAG_PATTERN = /#([\p{L}\p{M}\p{N}_-]{1,30})/gu; // \p{M}: combining marks (Hindi vowel signs)

export function extractTags(note: string | null | undefined): string[] {
  if (!note) return [];
  const tags = [...note.matchAll(TAG_PATTERN)].map((match) => match[1].toLowerCase());
  return [...new Set(tags)].slice(0, 20);
}

// Shared, dependency-free validation rules for the publication gate.
export function validVerseRange(first, last, chapter) {
  return Number.isInteger(first) && Number.isInteger(last) && first >= 1 &&
    last >= first && last <= chapter.length && Boolean(chapter[first - 1]) && Boolean(chapter[last - 1]);
}

export function duplicateUrls(records) {
  const seen = new Set();
  return records.filter(({ url }) => {
    if (seen.has(url)) return true;
    seen.add(url);
    return false;
  });
}

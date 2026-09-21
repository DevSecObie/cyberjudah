const OPEN = '\uE000', CLOSE = '\uE001';

/** Use the same match for the displayed excerpt and the video seek target. */
export function passageExcerpt(marked: string, cuesJson: string | null, passageStart: number) {
  let text = '', cursor = 0;
  const spans: [number, number][] = [];
  for (const match of marked.matchAll(/\uE000([^\uE000\uE001]*)\uE001/g)) {
    text += marked.slice(cursor, match.index);
    const start = text.length;
    text += match[1];
    spans.push([start, text.length]);
    cursor = match.index! + match[0].length;
  }
  text += marked.slice(cursor);
  const words = [...text.matchAll(/\S+/g)];
  const firstMatch = spans[0]?.[0];
  const matchWord = firstMatch === undefined ? 0 : Math.max(0, words.findIndex(w => w.index! + w[0].length > firstMatch));
  const fromWord = Math.max(0, matchWord - 12);
  const from = words[fromWord]?.index ?? 0;
  const toWord = Math.min(words.length, fromWord + 48);
  const to = Math.max(toWord < words.length ? words[toWord].index! : text.length, spans[0]?.[1] ?? 0);
  let excerpt = from > 0 ? '… ' : '';
  let position = from;
  for (const [start, end] of spans) {
    if (end <= from || start >= to) continue;
    const left = Math.max(start, from), right = Math.min(end, to);
    excerpt += text.slice(position, left) + OPEN + text.slice(left, right) + CLOSE;
    position = right;
  }
  excerpt += text.slice(position, to).trimEnd() + (to < text.length ? ' …' : '');
  let start = Number(passageStart) || 0, exact = false;
  if (firstMatch !== undefined && cuesJson) {
    try {
      const cues: unknown = JSON.parse(cuesJson);
      if (Array.isArray(cues)) for (const cue of cues) {
        if (!Array.isArray(cue) || !Number.isFinite(cue[0]) || !Number.isFinite(cue[1]) || cue[1] < 0) continue;
        if (cue[0] > firstMatch) break;
        start = cue[1]; exact = true;
      }
    } catch { /* Older indexes retain an explicitly labelled passage-start link. */ }
  }
  return { excerpt, start, timing: exact ? 'caption' as const : 'passage' as const };
}

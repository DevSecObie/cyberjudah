// What was on the screen: the frames of a recording placed in its note where the teacher
// pointed at something ("next picture", "look at this map", "pull that up"). The frames are
// YouTube's storyboard sheets, kept by the Telegram Worker in its bucket and served publicly
// at FRAMES_ORIGIN/frames/<video>/<level>/<sheet>.jpg; /api/frames/<video> gives the grid.
// A frame is one cell of a sheet, drawn as a background scaled and positioned in
// percentages, so the same markup fits any box. No image is cut or stored here.
const CUES = [
  /\blook at (this|that|the|these|those) (picture|image|photo|screen|slide|map|chart|graph|diagram|article|headline|video|clip|post|tweet|meme|screenshot|board|painting|drawing|list|table|quote|page)\b/,
  /\b(this|that|the next|next|the first|the second|the last|the other) (picture|image|photo|slide|map|chart|graph|diagram|screenshot|meme|painting|drawing|clip|video|article|headline)\b/,
  /\b(on|onto|up on) the screen\b/,
  /\bpull (that|this|it|the \w+) up\b/,
  /\bput (that|this|it) (up|on the screen)\b/,
  /\bas you can see\b/,
  /\byou can see (here|right here|it here|in this)\b/,
  /\blook (right )?here\b/,
  /\bzoom in\b/,
  /\b(play|roll|run) the (clip|video|tape)\b/,
  /\bshow (them|you|us|y'all|everybody) the (picture|image|photo|slide|map|chart|screen|clip|video)\b/,
  /\bgo to the next (one|slide|picture|image|page)\b/,
];
const LEAD = 5, MERGE = 25;
export const FRAMES_ORIGIN = process.env.FRAMES_ORIGIN || "https://cyberjudah-telegram.oisrae1.workers.dev";

export const isCue = (text) => { const t = String(text).toLowerCase(); return CUES.some((re) => re.test(t)); };

/** The visual moments of a transcript's segments [[t, text], ...]: when the picture is up, and when the words were said. */
export function findVisuals(segments, limit = 80) {
  const out = [];
  for (const [t, text] of segments) {
    if (!isCue(text)) continue;
    const last = out[out.length - 1];
    if (last && t - last.said <= MERGE) continue;
    out.push({ said: Math.round(t), t: Math.max(0, Math.round(t + LEAD)) });
  }
  return out.slice(0, limit);
}

/** The grid of a recording's frames from the Worker, or null (no frames, no network). */
export async function fetchBoard(video, timeoutMs = 10000) {
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    const res = await fetch(`${FRAMES_ORIGIN}/api/frames/${encodeURIComponent(video)}`, { signal: ac.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const b = await res.json();
    return b && b.ok && Array.isArray(b.levels) && b.levels.length ? b : null;
  } catch { return null; }
}

const pickLevel = (levels, width) => { const u = levels.filter((l) => l.interval > 0); return u.find((l) => l.w >= width) ?? u[u.length - 1] ?? null; };
const clock = (t) => { const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = Math.floor(t % 60); return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`; };

/** The figure for one moment: the frame as a sprite cell, the time as its caption, the recording at that moment as its link. */
export function figure(video, board, v) {
  const l = pickLevel(board.levels, 320); if (!l) return "";
  const idx = Math.min(l.frames - 1, Math.max(0, Math.floor(v.t / l.interval)));
  const per = l.rows * l.cols, sheet = Math.floor(idx / per), cell = idx % per, row = Math.floor(cell / l.cols), col = cell % l.cols;
  const x = l.cols > 1 ? (col / (l.cols - 1)) * 100 : 0, y = l.rows > 1 ? (row / (l.rows - 1)) * 100 : 0;
  const style = `background-image:url(${FRAMES_ORIGIN}/frames/${video}/${l.level}/${sheet}.jpg);background-size:${l.cols * 100}% ${l.rows * 100}%;background-position:${x}% ${y}%;background-repeat:no-repeat`;
  return `<figure class="shown" data-t="${v.said}"><a href="https://www.youtube.com/watch?v=${video}&t=${v.said}s" data-t="${v.said}"><span class="frame shown__frame" style="${style}"></span><span class="shown__at">${clock(v.said)}</span></a></figure>`;
}

const HEAD = /^\*\*\[[^\]]+\]\(\/bible\/[^)]+\)\*\*\s+\*\[\[?[\d:]+\]?\(https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}&t=(\d+)s\)\]?\*/;

/**
 * The note's markdown with the figures placed: each moment goes at the end of the scripture
 * block the class was on when it happened (before the next timestamped heading), and moments
 * before any scripture under a closing "Shown in class" heading. A note that already carries
 * figures is left alone.
 */
export function placeFrames(body, video, board, visuals) {
  if (!visuals.length || /class="shown"/.test(body)) return body;
  const lines = body.split("\n");
  const marks = []; // {t, line}
  lines.forEach((l, i) => { const m = HEAD.exec(l); if (m) marks.push({ t: Number(m[1]), line: i }); });
  const inserts = new Map(); const orphans = [];
  for (const v of [...visuals].sort((a, b) => a.said - b.said)) {
    const fig = figure(video, board, v); if (!fig) continue;
    let k = -1;
    for (let i = 0; i < marks.length; i++) if (marks[i].t <= v.said) k = i;
    if (k < 0) { orphans.push(fig); continue; }
    const at = k + 1 < marks.length ? marks[k + 1].line : lines.length;
    inserts.set(at, [...(inserts.get(at) ?? []), fig]);
  }
  const out = [];
  lines.forEach((l, i) => { if (inserts.has(i)) out.push(...inserts.get(i).flatMap((f) => [f, ""])); out.push(l); });
  if (inserts.has(lines.length)) out.push("", ...inserts.get(lines.length).flatMap((f) => [f, ""]));
  if (orphans.length) out.push("", "## Shown in class", "", ...orphans.flatMap((f) => [f, ""]));
  return out.join("\n");
}

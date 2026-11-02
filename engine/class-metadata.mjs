import fs from 'node:fs';
import path from 'node:path';
export const CLASS_HEADER = 'video\tteacher\tdate\ttitle';
export function parseClassMetadata(text) {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').split('\n');
  if (lines.shift() !== CLASS_HEADER) throw new Error('class-teachers.tsv must start with video, teacher, date and title columns');
  const rows = new Map();
  for (const [i, line] of lines.entries()) {
    if (!line) continue;
    const cells = line.split('\t'), [video, teacher, date, title] = cells;
    const validDate = !date || /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date;
    if (cells.length !== 4 || !/^[\w-]{11}$/.test(video) || !title.trim() || title.length > 500 || teacher.length > 200 || !validDate || rows.has(video) || cells.some(s => /[\r\n]/.test(s))) throw new Error(`class-teachers.tsv line ${i + 2}: invalid or repeated class metadata`);
    rows.set(video, { title, teacher, date });
  }
  return rows;
}
export function loadClassMetadata(root) {
  const file = path.join(root, 'data/sources/class-teachers.tsv');
  return fs.existsSync(file) ? parseClassMetadata(fs.readFileSync(file, 'utf8')) : new Map();
}
/** Actual broadcast starts; the class date stays independent of UTC midnight and upload day. */
export function loadClassBroadcasts(root) {
  const file = path.join(root, 'data/sources/class-broadcasts.json');
  const rows = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  for (const [video, row] of Object.entries(rows)) {
    if (!/^[\w-]{11}$/.test(video) || !row || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !Number.isFinite(Date.parse(row.date)) || new Date(row.date).toISOString().slice(0, 10) !== row.date || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(row.broadcastAt) || !Number.isFinite(Date.parse(row.broadcastAt))) throw new Error(`Invalid broadcast metadata for ${video}`);
  }
  return rows;
}
export function correctedClass(record, overrides, video = record.videoId ?? record.video) {
  const correction = overrides.get(video);
  return correction ? { ...record, ...correction, year: correction.date.slice(0,4), dateEstimated: false } : record;
}
/** Includes undated recordings even when nobody has written notes for them. */
export function classCatalog(videos, notes, overrides) {
  const indexed = new Map(Object.entries(videos).map(([video, row]) => [video, { video, title: row.title, teacher: row.teacher || '', date: row.date || '', file: null, url: null }]));
  for (const n of notes) if (n.videoId && ['class','captains'].includes(n.kind)) indexed.set(n.videoId, { video: n.videoId, title: n.title, teacher: n.teacher || '', date: n.date || '', file: n.file, url: n.url });
  return [...indexed.values()].map(row => correctedClass(row, overrides)).sort((a,b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}
/** Who a passage marked only by rank ("Bishop") was, per class: data/sources/rank-teachers.tsv
 * (video, teacher), confirmed by the owner from the class. Only fills in a bare rank with the
 * same rank's full name; a passage that names its teacher, or names none, is left alone. */
export const RANK_HEADER = 'video\tteacher';
const RANK = /^(bishop|deacon|captain|elder)$/i;
export function parseRankTeachers(text) {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').split('\n').filter(l => l && !l.startsWith('#'));
  if (lines.shift() !== RANK_HEADER) throw new Error('rank-teachers.tsv must start with video and teacher columns');
  const rows = new Map();
  for (const [i, line] of lines.entries()) {
    // An optional third column names the bare rank the class wrote when it differs from the
    // teacher's own title (Obie: the "Deacon" of 6Zr0mBGRnyU is Elder Labachaa). A class may have
    // one row per bare rank (its "Deacon" and its "Captain" passages), never two for the same rank.
    const cells = line.split('\t'), [video, teacher, rank] = cells;
    if (cells.length < 2 || cells.length > 3 || !/^[\w-]{11}$/.test(video) || !/^(Bishop|Deacon|Captain|Elder) \S.{0,100}$/.test(teacher ?? '') || (cells.length === 3 && !RANK.test(rank))) throw new Error(`rank-teachers.tsv row ${i + 1}: invalid row`);
    const forRank = (rank ?? teacher.split(' ')[0]).toLowerCase(), list = rows.get(video) ?? [];
    if (list.some(r => r.rank.toLowerCase() === forRank)) throw new Error(`rank-teachers.tsv row ${i + 1}: repeated row`);
    rows.set(video, [...list, { teacher, rank: forRank }]);
  }
  return rows;
}
export function loadRankTeachers(root) {
  const file = path.join(root, 'data/sources/rank-teachers.tsv');
  return fs.existsSync(file) ? parseRankTeachers(fs.readFileSync(file, 'utf8')) : new Map();
}
export function namedTeacher(teacher, video, ranks) {
  const own = String(teacher ?? '').trim(), list = video ? ranks.get(video) : undefined;
  if (!RANK.test(own) || !list) return teacher;
  return list.find(r => r.rank === own.toLowerCase())?.teacher ?? teacher;
}
/** The spelling data/names.tsv gives a leader (name, then ";"-separated variants), by lower-cased
 * variant; a name it does not list is returned as given. */
export function parseNames(text) {
  const map = new Map();
  for (const line of text.replace(/^﻿/, '').replace(/\r\n/g, '\n').split('\n')) {
    if (!line || line.startsWith('#') || line.startsWith('name\t')) continue;
    const [name, variants = ''] = line.split('\t');
    for (const v of [name, ...variants.split(';')]) if (v.trim()) map.set(v.trim().toLowerCase(), name);
  }
  return map;
}
export const officialName = (names, name) => names.get(String(name ?? '').trim().toLowerCase()) ?? name;
/** Who taught a recording, and when, by the class outlines in the sabbath-classes-images R2 bucket:
 * data/sources/r2-class-teachers.tsv (date, file_date, video, teacher, ...). Obie 2026-11-02: the
 * outline names and dates are accurate. A recording filed under two teachers is left out. */
export function parseOutlineTeachers(text, names = new Map()) {
  const lines = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').split('\n').filter(l => l && !l.startsWith('#'));
  const head = (lines.shift() ?? '').split('\t'), v = head.indexOf('video'), t = head.indexOf('teacher'), d = head.indexOf('date');
  if (v < 0 || t < 0 || d < 0) throw new Error('r2-class-teachers.tsv must have date, video and teacher columns');
  const seen = new Map();
  for (const line of lines) {
    const c = line.split('\t'), video = c[v], teacher = officialName(names, c[t] ?? '').trim(), date = c[d] ?? '';
    if (!/^[\w-]{11}$/.test(video ?? '') || !teacher) continue;
    const row = seen.get(video);
    if (row === null) continue;
    if (row && row.teacher !== teacher) { seen.set(video, null); continue; }
    seen.set(video, row ?? { teacher, date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '' });
  }
  return new Map([...seen].filter(([, r]) => r));
}
export function loadOutlineTeachers(root) {
  const nf = path.join(root, 'data/names.tsv'), f = path.join(root, 'data/sources/r2-class-teachers.tsv');
  const names = fs.existsSync(nf) ? parseNames(fs.readFileSync(nf, 'utf8')) : new Map();
  return fs.existsSync(f) ? parseOutlineTeachers(fs.readFileSync(f, 'utf8'), names) : new Map();
}
/** A recording without a note: its outline names the teacher (over a name heard in the captions)
 * and gives the date when the recording has none. An admin correction is applied after this. */
export function outlinedClass(record, outlines, video) {
  const o = outlines.get(video);
  return o ? { ...record, teacher: o.teacher, date: record.date || o.date } : record;
}

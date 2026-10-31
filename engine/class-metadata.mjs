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
  const lines = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').split('\n').filter(l => l && !l.startsWith('#'));
  if (lines.shift() !== RANK_HEADER) throw new Error('rank-teachers.tsv must start with video and teacher columns');
  const rows = new Map();
  for (const [i, line] of lines.entries()) {
    const cells = line.split('\t'), [video, teacher] = cells;
    if (cells.length !== 2 || !/^[\w-]{11}$/.test(video) || !/^(Bishop|Deacon|Captain|Elder) \S.{0,100}$/.test(teacher ?? '') || rows.has(video)) throw new Error(`rank-teachers.tsv row ${i + 1}: invalid or repeated row`);
    rows.set(video, teacher);
  }
  return rows;
}
export function loadRankTeachers(root) {
  const file = path.join(root, 'data/sources/rank-teachers.tsv');
  return fs.existsSync(file) ? parseRankTeachers(fs.readFileSync(file, 'utf8')) : new Map();
}
export function namedTeacher(teacher, video, ranks) {
  const own = String(teacher ?? '').trim(), named = video ? ranks.get(video) : undefined;
  return RANK.test(own) && named && named.toLowerCase().startsWith(own.toLowerCase() + ' ') ? named : teacher;
}

import fs from 'node:fs';
const root = new URL('../../data/bible/', import.meta.url);
const bounds = {};
for (const file of fs.readdirSync(root).filter(f => f.endsWith('.json') && f !== 'index.json')) {
  const { chapters } = JSON.parse(fs.readFileSync(new URL(file,root), 'utf8'));
  bounds[file.slice(0,-5)] = Object.keys(chapters).sort((a,b)=>Number(a)-Number(b)).map(k=>chapters[k].length);
}
fs.writeFileSync(new URL('../src/data/dictionary/verse-bounds.json',import.meta.url), JSON.stringify(bounds));

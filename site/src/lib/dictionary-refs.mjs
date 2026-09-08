// Plain-text tokens only. Never interpret imported dictionary text as HTML.
const groups = [
  ['Genesis','Gen'],['Exodus','Ex','Exod'],['Leviticus','Lev'],['Numbers','Num'],['Deuteronomy','Deut'],['Joshua','Josh'],['Judges','Judg'],['Ruth'],
  ['1 Samuel','1 Sam'],['2 Samuel','2 Sam'],['1 Kings','1 Ki','1 Kgs'],['2 Kings','2 Ki','2 Kgs'],['1 Chronicles','1 Chr','1 Chron'],['2 Chronicles','2 Chr','2 Chron'],
  ['Ezra'],['Nehemiah','Neh'],['Esther','Esth'],['Job'],['Psalms','Psalm','Ps','Psa'],['Proverbs','Prov'],['Ecclesiastes','Eccl'],['Song of Solomon','Canticles','Cant','Song'],
  ['Isaiah','Isa'],['Jeremiah','Jer'],['Lamentations','Lam'],['Ezekiel','Ezek'],['Daniel','Dan'],['Hosea','Hos'],['Joel'],['Amos'],['Obadiah','Obad'],['Jonah'],['Micah','Mic'],['Nahum','Nah'],['Habakkuk','Hab'],['Zephaniah','Zeph'],['Haggai','Hag'],['Zechariah','Zech'],['Malachi','Mal'],
  ['Matthew','Matt'],['Mark','Mk'],['Luke','Lk'],['John','Jn'],['Acts'],['Romans','Rom'],['1 Corinthians','1 Cor'],['2 Corinthians','2 Cor'],['Galatians','Gal'],['Ephesians','Eph'],['Philippians','Phil'],['Colossians','Col'],['1 Thessalonians','1 Thess'],['2 Thessalonians','2 Thess'],['1 Timothy','1 Tim'],['2 Timothy','2 Tim'],['Titus','Tit'],['Philemon','Philem','Phlm'],['Hebrews','Heb'],['James','Jas'],['1 Peter','1 Pet'],['2 Peter','2 Pet'],['1 John','1 Jn'],['2 John','2 Jn'],['3 John','3 Jn'],['Jude'],['Revelation','Rev'],
  ['Tobit','Tob'],['Judith','Jdt'],['Wisdom of Solomon','Wisdom','Wis'],['Sirach','Ecclus'],['Baruch','Bar'],['1 Maccabees','1 Macc'],['2 Maccabees','2 Macc'],['1 Esdras','1 Esd'],['2 Esdras','2 Esd'],
];
const aliases = new Map(groups.flatMap(([book, ...short]) => [book, ...short].map(name => [name.toLowerCase(), book.toLowerCase().replaceAll(' ', '-')] )));
const names = [...aliases.keys()].sort((a,b) => b.length-a.length).map(s => s.replaceAll(' ', '\\s+')).join('|');
const explicit = new RegExp(`\\b(${names})\\.?\\s+(\\d+)(?::(\\d+(?:[-–]\\d+)?(?:,\\s*\\d+(?:[-–]\\d+)?(?![\\d:]))*))?`, 'gi');

/** Link explicit citations and unambiguous continuations within the same citation list. */
export function dictionaryRefs(text, bounds) {
  const parts = [];
  let end = 0;
  const add = (start, finish, slug, chapter, spec) => {
    const max = bounds[slug]?.[chapter - 1];
    if (!max) return false;
    if (spec && spec.split(/,\s*/).some(piece => { const [a,b=a] = piece.split(/[-–]/).map(Number); return a < 1 || b < a || b > max; })) return false;
    if (start > end) parts.push({ text: text.slice(end,start) });
    parts.push({ text: text.slice(start,finish), href: `/bible/${slug}/${chapter}${spec ? `#v${parseInt(spec)}` : ''}`, verses: spec?.replaceAll('–','-') });
    end = finish;
    return true;
  };
  explicit.lastIndex = 0;
  for (const match of text.matchAll(explicit)) {
    const slug = aliases.get(match[1].toLowerCase().replace(/\s+/g,' '));
    let chapter = Number(match[2]);
    let finish = match.index + match[0].length;
    if (!add(match.index,finish,slug,chapter,match[3])) continue;
    // Semicolons/commas followed by chapter:verse inherit the explicitly named book.
    let next;
    while ((next = text.slice(finish).match(/^([;,]\s*)(\d+):(\d+(?:[-–]\d+)?(?:,\s*\d+(?:[-–]\d+)?(?![\d:]))*)/))) {
      chapter = Number(next[2]);
      if (!add(finish+next[1].length,finish+next[0].length,slug,chapter,next[3])) break;
      finish += next[0].length;
    }
  }
  if (end < text.length) parts.push({ text: text.slice(end) });
  return parts;
}

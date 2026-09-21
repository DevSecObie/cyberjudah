import { Fragment } from 'react';

// FTS5 supplies match boundaries, including case/diacritic and phrase matches.
// Render source content as React text; never interpret transcript HTML.
export function SearchHighlight({ text }: { text: string }) {
  return text.split(/(\uE000[^\uE000\uE001]*\uE001)/g).map((part, i) =>
    part.startsWith('\uE000') && part.endsWith('\uE001')
      ? <mark key={i} style={{ background: '#fde68a', color: '#171717', borderRadius: '.15em', padding: '0 .08em', fontWeight: 700 }}>{part.slice(1, -1)}</mark>
      : <Fragment key={i}>{part}</Fragment>,
  );
}

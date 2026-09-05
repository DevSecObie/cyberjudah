---
title: API
---

# API

Static JSON, served with the site, same versification as the pages. Paths are relative to the site root.

| Path | Returns |
| --- | --- |
| `/api/kjv/books.json` | the 81 books: name, slug, testament, chapter count |
| `/api/kjv/<book-slug>/index.json` | one book |
| `/api/kjv/<book-slug>/<chapter>.json` | one chapter: `{book, chapter, verses:[{verse, text}]}` |
| `/api/concordance/<book-slug>/<chapter>.json` | everything that cites the chapter: laws, precepts, cases, notes |
| `/api/laws/index.json` | the handbook: parts and sections |
| `/api/laws/<section-id>.json` | one section with every law and its references, e.g. `/api/laws/10A.json` |
| `/api/precepts/index.json` | the precept index |
| `/api/precepts/<slug>.json` | one precept with its references |
| `/api/cases/index.json` | the case studies |
| `/api/cases/<slug>.json` | one case |
| `/api/notes/index.json` | the study notes, class notes, and encyclopedia entries |

Every chapter has a concordance file. A chapter that nothing cites returns `{"cited_by": []}`
rather than a 404, so walking the book index never breaks, and rows are deduplicated: a note
that quotes a passage links every verse in it, and those repeats are collapsed to one row per
(kind, url, verses).

Book slugs are lowercase with hyphens: `genesis`, `1-samuel`, `sirach`, `esther-greek`, `epistle-of-jeremiah`.

Examples: [`/api/kjv/judges/16.json`](/api/kjv/judges/16.json) · [`/api/concordance/judges/16.json`](/api/concordance/judges/16.json) · [`/api/laws/10A.json`](/api/laws/10A.json) · [`/api/cases/achan.json`](/api/cases/achan.json)

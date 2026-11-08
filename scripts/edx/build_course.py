"""Build an Open edX course (OLX) from the 4 Chapters a Day study notes.

    build_course.py genesis                     every chapter of Genesis that has a note
    build_course.py genesis --chapters 1        just Genesis 1 (the pilot)
    build_course.py genesis --chapters 1-4      a range
    build_course.py genesis --out /some/dir     where the .tar.gz goes (default: dist/edx)

The result is <out>/<book>.tar.gz, which Studio imports under Tools > Import.

How a book maps onto a course:

    course       the book                        Genesis
    section      one reading session (4 ch.)     Reading 1: Genesis 1-4
    subsection   one chapter                     Genesis 1: The Creation of Light and Mankind
    unit         the whole chapter (KJV), then   Read Genesis 1
                 one per verse block from note   Genesis 1:1-2
    quiz         one graded subsection/chapter   Genesis 1: Check your understanding

The notes stay the source. Rebuild and re-import after a note changes; Studio replaces the
course content in place. Quizzes come from scripts/edx/quizzes/<book>/<chapter>.json, drafted
from the note and reviewed by hand. A chapter without a quiz file simply has no quiz.

Standard library only, so it runs anywhere Python 3.9+ does.
"""
import argparse, html, io, json, os, re, sys, tarfile

ROOT = os.environ.get("CJ_ROOT") or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
QUIZZES = os.path.join(ROOT, "scripts", "edx", "quizzes")
ORG = "CyberJudah"
PER_SECTION = 4  # chapters per reading session, as in 4 Chapters a Day


# ---------------------------------------------------------------- markdown (the subset the notes use)

LINK = re.compile(r"\[([^\]]+)\]\(([^)\s]+)\)")
BOLD = re.compile(r"\*\*(.+?)\*\*")


YOUTUBE = re.compile(r"^https?://(www\.|m\.)?(youtube\.com|youtu\.be)/")


def link(m):
    """Only YouTube links leave the course; every other link keeps just its text."""
    text, url = m.group(1), m.group(2)
    if YOUTUBE.match(url):
        return f'<a href="{html.escape(url)}" target="_blank" rel="noopener">{text}</a>'
    return text


def inline(text):
    out = html.escape(text, quote=False)
    out = out.replace("&lt;sup&gt;", "<sup>").replace("&lt;/sup&gt;", "</sup>")
    out = LINK.sub(link, out)
    return BOLD.sub(r"<strong>\1</strong>", out)


def indent(line):
    return len(line) - len(line.lstrip(" "))


def render(lines):
    """Paragraphs, headings, blockquotes and nested lists: everything a study note contains."""
    out, i = [], 0
    while i < len(lines):
        line = lines[i]
        s = line.strip()
        if not s:
            i += 1
        elif s.startswith("#"):
            level = min(len(s) - len(s.lstrip("#")) + 1, 6)
            out.append(f"<h{level}>{inline(s.lstrip('#').strip())}</h{level}>")
            i += 1
        elif s.startswith(">"):
            body = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                body.append(re.sub(r"^>\s?", "", lines[i].strip()))
                i += 1
            out.append(f"<blockquote>{render(body)}</blockquote>")
        elif s.startswith("- "):
            items = []
            while i < len(lines) and lines[i].startswith("- "):
                item = [lines[i][2:]]
                i += 1
                # an item runs on while lines are indented, blank lines included
                while i < len(lines) and (not lines[i].strip() or indent(lines[i]) >= 2):
                    item.append(lines[i][2:] if lines[i].strip() else "")
                    i += 1
                items.append(item)
            out.append("<ul>" + "".join(f"<li>{render(it)}</li>" for it in items) + "</ul>")
        else:
            para = []
            while i < len(lines) and lines[i].strip() and not re.match(r"\s*(#|>|- )", lines[i]):
                para.append(lines[i].strip())
                i += 1
            out.append(f"<p>{inline(' '.join(para))}</p>")
    return "\n".join(out)


# ---------------------------------------------------------------- notes

def read_note(book, chapter):
    path = os.path.join(ROOT, "docs", "study", book, f"{chapter}.md")
    if not os.path.exists(path):
        return None
    text = open(path, encoding="utf-8").read()
    meta, body = {}, text
    if text.startswith("---"):
        head, body = text[3:].split("\n---", 1)
        for line in head.strip().splitlines():
            k, _, v = line.partition(":")
            meta[k.strip()] = v.strip().strip('"')
    return meta, body.strip("\n")


BLOCK = re.compile(r"^\*\*\[([^\]]+)\]\([^)]+\)\*\*\s*$")


def units(body):
    """Split a note into its introduction and one unit per verse block."""
    # "Read the chapter -> [Genesis 1](...)" only points at the website
    lines = [l for l in body.splitlines() if not l.startswith("Read the chapter")]
    starts = [i for i, l in enumerate(lines) if BLOCK.match(l)]
    out = []
    intro = lines[: starts[0]] if starts else lines
    if any(l.strip() for l in intro):
        out.append(("Introduction", render(intro)))
    for n, s in enumerate(starts):
        end = starts[n + 1] if n + 1 < len(starts) else len(lines)
        out.append((BLOCK.match(lines[s]).group(1), render(lines[s + 1 : end])))
    return out


def chapter_text(book, chapter):
    """The whole KJV chapter, one paragraph per verse, from data/bible/<book>.json."""
    verses = json.load(open(os.path.join(ROOT, "data", "bible", f"{book}.json"), encoding="utf-8"))["chapters"].get(str(chapter))
    if not verses:
        return None
    return "\n".join(f"<p><sup>{n}</sup> {html.escape(v, quote=False)}</p>" for n, v in enumerate(verses, 1))


# ---------------------------------------------------------------- OLX

def attr(v):
    return html.escape(str(v), quote=True)


def problem_xml(q, n):
    choices = "".join(
        f'<choice correct="{"true" if j == q["answer"] else "false"}">{html.escape(c)}</choice>'
        for j, c in enumerate(q["choices"])
    )
    why = f'<p>{inline(q["explain"])}</p>' if q.get("explain") else ""
    ref = f'<p>See {inline(q["ref"])}.</p>' if q.get("ref") else ""
    return (
        f'<problem display_name="Question {n}" max_attempts="2" weight="1" showanswer="finished">\n'
        f'<multiplechoiceresponse>\n<label>{html.escape(q["q"])}</label>\n'
        f'<choicegroup type="MultipleChoice" shuffle="true">{choices}</choicegroup>\n'
        f'</multiplechoiceresponse>\n'
        f'<solution><div class="detailed-solution"><p>Explanation</p>{why}{ref}</div></solution>\n'
        f'</problem>\n'
    )


def build(book, chapters, run="2026"):
    index = {b["slug"]: b for b in json.load(open(os.path.join(ROOT, "data", "bible", "index.json")))}
    if book not in index:
        sys.exit(f"unknown book: {book}")
    name = index[book]["book"]
    files = {}  # path inside the course folder -> text
    code = re.sub(r"[^A-Za-z0-9]", "", name)[:12].upper()

    sections = {}
    for ch in chapters:
        note = read_note(book, ch)
        if note:
            sections.setdefault((ch - 1) // PER_SECTION, []).append((ch, note))
    if not sections:
        sys.exit(f"no study notes for {name} {chapters[0]}-{chapters[-1]}")

    chapter_refs = []
    for s, items in sorted(sections.items()):
        first, last = s * PER_SECTION + 1, min((s + 1) * PER_SECTION, index[book]["chapters"])
        sec_id = f"{book}-reading-{s + 1}"
        span = f"{first}" if first == last else f"{first}-{last}"
        seqs = []
        for ch, (meta, body) in items:
            seq_id = f"{book}-{ch}"
            verts = []
            lessons = units(body)
            text = chapter_text(book, ch)
            if text:
                lessons.insert(0, (f"Read {name} {ch}", text))
            for n, (title, content) in enumerate(lessons, 1):
                vid = f"{seq_id}-{n:02d}"
                files[f"html/{vid}.html"] = content + "\n"
                files[f"html/{vid}.xml"] = f'<html filename="{vid}" display_name="{attr(title)}"/>\n'
                files[f"vertical/{vid}.xml"] = f'<vertical display_name="{attr(title)}">\n  <html url_name="{vid}"/>\n</vertical>\n'
                verts.append(vid)
            files[f"sequential/{seq_id}.xml"] = (
                f'<sequential display_name="{attr(meta.get("title", f"{name} {ch}"))}">\n'
                + "".join(f'  <vertical url_name="{v}"/>\n' for v in verts)
                + "</sequential>\n"
            )
            seqs.append(seq_id)

            quiz_path = os.path.join(QUIZZES, book, f"{ch}.json")
            if os.path.exists(quiz_path):
                quiz = json.load(open(quiz_path, encoding="utf-8"))
                qid = f"{seq_id}-quiz"
                probs = []
                for n, q in enumerate(quiz["questions"], 1):
                    pid = f"{qid}-{n:02d}"
                    files[f"problem/{pid}.xml"] = problem_xml(q, n)
                    probs.append(pid)
                files[f"vertical/{qid}.xml"] = (
                    f'<vertical display_name="Check your understanding">\n'
                    + "".join(f'  <problem url_name="{p}"/>\n' for p in probs)
                    + "</vertical>\n"
                )
                files[f"sequential/{qid}.xml"] = (
                    f'<sequential display_name="{attr(f"{name} {ch}: Check your understanding")}" '
                    f'graded="true" format="Quiz">\n  <vertical url_name="{qid}"/>\n</sequential>\n'
                )
                seqs.append(qid)
        files[f"chapter/{sec_id}.xml"] = (
            f'<chapter display_name="{attr(f"Reading {s + 1}: {name} {span}")}">\n'
            + "".join(f'  <sequential url_name="{q}"/>\n' for q in seqs)
            + "</chapter>\n"
        )
        chapter_refs.append(sec_id)

    files["course.xml"] = f'<course url_name="{run}" org="{ORG}" course="{code}"/>\n'
    files[f"course/{run}.xml"] = (
        f'<course display_name="{attr(name)}" language="en" start="2026-01-01T00:00:00Z">\n'
        + "".join(f'  <chapter url_name="{c}"/>\n' for c in chapter_refs)
        + "</course>\n"
    )
    files[f"policies/{run}/policy.json"] = json.dumps(
        {f"course/{run}": {"display_name": name, "language": "en", "start": "2026-01-01T00:00:00Z",
                           "self_paced": True, "tabs": [{"type": "courseware", "name": "Course"},
                                                         {"type": "progress", "name": "Progress"}]}},
        indent=2) + "\n"
    files[f"policies/{run}/grading_policy.json"] = json.dumps(
        {"GRADER": [{"type": "Quiz", "short_label": "Q", "min_count": 1, "drop_count": 0, "weight": 1.0}],
         "GRADE_CUTTERS": {"Pass": 0.7}}, indent=2) + "\n"
    files["policies/assets.json"] = "{}\n"
    # our own About page, so Open edX's default (with its outside links) is not used
    files["about/overview.html"] = (
        f"<section class=\"about\"><h2>About this course</h2>\n"
        f"<p>Read the book of {html.escape(name)} in the King James Version, chapter by chapter, with the "
        f"study notes from the 4 Chapters a Day readings. Each chapter opens with the whole text, then "
        f"walks through it verse block by verse block, and ends with a short quiz.</p></section>\n"
    )
    files["about/short_description.html"] = f"Read {html.escape(name)} in the KJV with the 4 Chapters a Day study notes.\n"
    return files


def write_tar(files, path):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with tarfile.open(path, "w:gz") as tar:
        for name in sorted(files):
            data = files[name].encode("utf-8")
            info = tarfile.TarInfo(f"course/{name}")
            info.size = len(data)
            info.mtime = 0
            tar.addfile(info, io.BytesIO(data))


def parse_chapters(spec, total):
    if not spec:
        return list(range(1, total + 1))
    out = []
    for part in spec.split(","):
        a, _, b = part.partition("-")
        out += list(range(int(a), int(b or a) + 1))
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("book", help="book slug, e.g. genesis")
    ap.add_argument("--chapters", help="e.g. 1, 1-4 or 1,3,5 (default: all)")
    ap.add_argument("--run", default="2026", help="course run in the course key (default 2026)")
    ap.add_argument("--out", default=os.path.join(ROOT, "dist", "edx"))
    a = ap.parse_args()
    books = {b["slug"]: b for b in json.load(open(os.path.join(ROOT, "data", "bible", "index.json")))}
    if a.book not in books:
        sys.exit(f"unknown book: {a.book}")
    files = build(a.book, parse_chapters(a.chapters, books[a.book]["chapters"]), a.run)
    path = os.path.join(a.out, f"{a.book}.tar.gz")
    write_tar(files, path)
    print(f"{path}: {sum(1 for f in files if f.startswith('vertical/'))} units, "
          f"{sum(1 for f in files if f.startswith('problem/'))} questions")


if __name__ == "__main__":
    main()

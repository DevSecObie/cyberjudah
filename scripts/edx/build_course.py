"""Build an Open edX course (OLX) from the 4 Chapters a Day study notes.

    build_course.py genesis                     every chapter of Genesis
    build_course.py genesis --chapters 1        just Genesis 1 (the pilot)
    build_course.py genesis --chapters 1-4      a range
    build_course.py genesis --out /some/dir     where the .tar.gz goes (default: dist/edx)

The result is <out>/<book>.tar.gz, which Studio imports under Tools > Import.

How a book maps onto a course:

    course       the book                        Genesis
    section      one reading session (4 ch.)     Genesis 1-4
                 first, About this reading       its chapters and the note's introduction
    subsection   one chapter, always in order:   Genesis 1: The Creation of Light and Mankind
    unit           what the chapter covers       Overview
                   the whole chapter (KJV)       Read Genesis 1
                   one per verse block           Genesis 1:1-2
                   the main points               Key takeaways
                   the quiz, last (graded)       Check your understanding
    section      last, one question per chapter  Final assessment (Final Exam, 60% of the grade)
    page         in the course menu              People of Genesis

The notes stay the source. Rebuild and re-import after a note changes; Studio replaces the
course content in place. Quizzes come from scripts/edx/quizzes/<book>/<chapter>.json, and each
chapter's objectives and key takeaways from scripts/edx/lessons/<book>/<chapter>.json, both drafted
from the note and reviewed by hand. A chapter without a quiz file simply has no quiz, and a
chapter without a study note yet still gets its "Read" unit with the full text.

Needs Python 3.12 or newer (macOS's own python3 is 3.9: use Homebrew's).
"""
import argparse, hashlib, html, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import olx  # noqa: E402
from olx import write_tar  # noqa: E402,F401  (kept importable from here)

ROOT = os.environ.get("CJ_ROOT") or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
QUIZZES = os.path.join(ROOT, "scripts", "edx", "quizzes")
# per chapter: learning objectives and key takeaways, drafted from the note and reviewed by hand
LESSONS = os.path.join(ROOT, "scripts", "edx", "lessons")
ORG = "CyberJudah"
PER_SECTION = 4  # chapters per reading session, as in 4 Chapters a Day


# ---------------------------------------------------------------- markdown (the subset the notes use)

LINK = re.compile(r"\[([^\[\]]+)\]\(([^)\s]+)\)")
BOLD = re.compile(r"\*\*((?:[^*]|\*[^*\s][^*]*\*)+?)\*\*")  # may hold an *italic* inside
ITALIC = re.compile(r"(?<![*\w])\*(?![*\s])(.+?)(?<![*\s])\*(?![*\w])")


YOUTUBE = re.compile(r"^https?://(www\.|m\.)?(youtube\.com|youtu\.be)/")


def link(m):
    """Only YouTube links leave the course; every other link keeps just its text."""
    text, url = m.group(1), m.group(2)
    if YOUTUBE.match(url):
        # inline() has escaped the whole line already, url included
        return f'<a href="{url}" target="_blank" rel="noopener">{text}</a>'
    return text


def inline(text):
    out = html.escape(text, quote=False)
    out = out.replace("&lt;sup&gt;", "<sup>").replace("&lt;/sup&gt;", "</sup>")
    out = LINK.sub(link, out)
    return ITALIC.sub(r"<em>\1</em>", BOLD.sub(r"<strong>\1</strong>", out))


# the website's own markup in a note (video mounts, wrappers, figures): not course content
SITE_HTML = re.compile(r"<!--|</?(div|span|p|figure|img|iframe|script)\b")


def indent(line):
    return len(line) - len(line.lstrip(" "))


def render(lines):
    """Paragraphs, headings, blockquotes and nested lists: everything a study note contains."""
    return "\n".join(render_parts(lines))


def render_parts(lines):
    """render(), as a list of its top-level blocks."""
    out, i = [], 0
    while i < len(lines):
        line = lines[i]
        s = line.strip()
        if not s or SITE_HTML.match(s):
            # blank, or the site's own html (video mounts, figures, wrappers): not course content
            i += 1
        elif s.startswith("#"):
            # components may use only h3-h6; the page already uses h1 and h2 (Open edX accessibility docs)
            level = min(len(s) - len(s.lstrip("#")) + 2, 6)
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
            base = indent(line)
            while i < len(lines) and indent(lines[i]) == base and lines[i].strip().startswith("- "):
                item = [lines[i].strip()[2:]]
                i += 1
                # an item runs on while lines are indented further, blank lines included
                while i < len(lines) and (not lines[i].strip() or indent(lines[i]) >= base + 2):
                    item.append(lines[i][base + 2:] if lines[i].strip() else "")
                    i += 1
                items.append(item)
            out.append("<ul>" + "".join(f"<li>{render(it)}</li>" for it in items) + "</ul>")
        else:
            para = []
            while i < len(lines) and lines[i].strip() and not re.match(r"\s*(#|>|- )", lines[i]) \
                    and not SITE_HTML.match(lines[i].strip()):
                para.append(lines[i].strip())
                i += 1
            text = " ".join(para)
            if text == "Precepts:":
                out.append('<p class="label">Precepts</p>')
            else:
                out.append(f"<p>{inline(text)}</p>")
    return out


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


BLOCK = re.compile(r"^\*\*\[([^\]]+)\]\([^)]+\)\*\*(\s+\*\[\[[^\]]+\]\([^)]+\)\]\*)?\s*$")


SOURCE_MARK = re.compile(r"\{\{source:(\d+)\}\}")
_SOURCES = []
_SOURCE_FILE = os.path.join(ROOT, "data", "study", "sources.json")
_SOURCE_DATA = None


def note_sources(book, chapter):
    """{bullet key: source} for a study note, from data/study/sources.json (scripts/study/sources.py):
    the class, teacher and moment each point of the note was taught in, where it was found."""
    global _SOURCE_DATA
    if _SOURCE_DATA is None:
        _SOURCE_DATA = json.load(open(_SOURCE_FILE, encoding="utf-8")) if os.path.exists(_SOURCE_FILE) else {}
    return _SOURCE_DATA.get(f"/study/{book}/{chapter}", {})


def bullet_key(text):
    return hashlib.sha1(text.strip().encode("utf-8")).hexdigest()[:12]


def youtube(video, t):
    return f"https://www.youtube.com/watch?v={video}&t={int(t)}s"


def class_title(t):
    """A class's title without channel tags: '#IUIC || 15 Minutes W/ The Captains || Is Divorce Of Man
    or God?' reads 'Is Divorce Of Man or God?'."""
    t = " ".join(w for w in (t or "").split() if not w.startswith("#"))
    if "||" in t:
        t = [p for p in t.split("||") if p.strip()][-1]
    t = ", ".join(p.strip() for p in t.split("|") if p.strip())
    return t.strip() or "a class"


def source_line(src):
    """'Taught in <class> · <teacher> · <date> · [12:34]', the time a YouTube link to that moment."""
    bits = [html.escape(class_title(src.get("title")), quote=False)]
    if src.get("teacher"):
        bits.append(html.escape(src["teacher"], quote=False))
    if src.get("date"):
        bits.append(src["date"])
    t = src.get("t") or 0
    bits.append(f'<a href="{html.escape(youtube(src["video"], t))}" target="_blank" rel="noopener">'
                f'{html.escape(src.get("ts") or "watch", quote=False)}</a>')
    return '<span class="source">Taught in ' + " · ".join(bits) + "</span>"


def lesson_html(lines):
    """One verse block laid out for reading: the verses set apart, then the teaching point by point
    with where each was taught, then the precepts as cards."""
    parts = render_parts(lines)
    out, taught = [], False
    for part in parts:
        if part.startswith("<blockquote>") and not taught:
            out.append(part.replace("<blockquote>", '<blockquote class="scripture">', 1))
        elif part.startswith("<ul>"):
            if not taught:
                out.append("<h3>The teaching</h3>")
                taught = True
            out.append(part.replace("<ul>", '<ul class="teaching">', 1))
        else:
            out.append(part)
    # where each point was taught, under the point (marked by units())
    return SOURCE_MARK.sub(lambda m: _SOURCES[int(m.group(1))], "\n".join(out))


def units(body, sources=None):
    """Split a note into its introduction and one unit per verse block:
    [(title, html, clip)], clip being (video, start, end) of the class that taught it, or None."""
    sources = sources or {}
    # "Read the chapter -> [Genesis 1](...)" only points at the website
    lines = [l for l in body.splitlines() if not l.startswith("Read the chapter")]
    # under each point of the note, where it was taught
    marked = []
    for l in lines:
        if l.startswith("- "):
            src = sources.get(bullet_key(l[2:]))
            if src and src.get("video"):
                _SOURCES.append(source_line(src))
                l += f" {{{{source:{len(_SOURCES) - 1}}}}}"
        marked.append(l)
    lines = marked
    starts = [i for i, l in enumerate(lines) if BLOCK.match(l)]
    out = []
    intro = lines[: starts[0]] if starts else lines
    if any(l.strip() for l in intro):
        out.append(("Introduction", olx.page(lesson_html(intro)), None))
    for n, s in enumerate(starts):
        end = starts[n + 1] if n + 1 < len(starts) else len(lines)
        block = lines[s + 1: end]
        out.append((BLOCK.match(lines[s]).group(1), olx.page(lesson_html(block)), clip_for(lines[s:end], sources)))
    return out


def minutes(text, lessons, quiz):
    """About how long a chapter takes: reading at 200 words a minute, two minutes a passage, the clips,
    and a minute a question, to the nearest five minutes."""
    words = len(re.sub(r"<[^>]+>", " ", text or "").split())
    clips = sum((c[2] - c[1]) for _, _, c in lessons if c) / 60
    total = words / 200 + 2 * len(lessons) + clips + (len(quiz["questions"]) if quiz else 0)
    return max(5, int(round(total / 5.0)) * 5)


def chapter_overview(name, ch, title, lessons, text, quiz, plan=None):
    """The first unit of every chapter: what you will learn, how long it takes, and the steps through
    it, always in the same order."""
    clips = sum(1 for _, _, c in lessons if c)
    passages = ", ".join(t for t, _, _ in lessons)
    steps = []
    if text:
        steps.append(("Read", f"the whole of {name} {ch} in the King James Version."))
    if lessons:
        steps.append(("Study", f"{len(lessons)} scripture{'s' if len(lessons) != 1 else ''}, one page each: "
                               "the verses, what was taught on them, and the precepts."
                               + (f" {clips} of them play the moment of the class that taught them." if clips else "")))
    if plan and plan.get("takeaways"):
        steps.append(("Key takeaways", "the main points of the chapter on one page."))
    if quiz:
        steps.append(("Check your understanding", f"{len(quiz['questions'])} questions from what was taught."))
    out = [f'<p class="lead">{olx.esc(title)}</p>',
           f'<ul class="facts"><li><b>Time</b>About {minutes(text, lessons, quiz)} minutes</li>'
           f'<li><b>Scriptures</b>{len(lessons)}</li><li><b>Class clips</b>{clips}</li>'
           f'<li><b>Questions</b>{len(quiz["questions"]) if quiz else 0}</li></ul>']
    if plan and plan.get("objectives"):
        out += ["<h3>What you will learn</h3>", '<ul class="teaching">']
        out += [f"<li>{olx.esc(o)}</li>" for o in plan["objectives"]]
        out.append("</ul>")
    out += ["<h3>In this chapter</h3>", '<ol class="steps">']
    out += [f"<li><strong>{olx.esc(k)}</strong> {olx.esc(v)}</li>" for k, v in steps]
    out.append("</ol>")
    if passages:
        out.append(f'<p class="note">Scriptures: {olx.esc(passages)}</p>')
    return olx.page("\n".join(out))


def takeaways_page(name, ch, plan):
    """The page before the quiz: the chapter's main points, as the classes taught them."""
    out = [f'<p class="lead">The main points of {olx.esc(name)} {ch}. Read them over, then check your understanding.</p>',
           '<ol class="steps">'] + [f"<li>{olx.esc(t)}</li>" for t in plan["takeaways"]] + ["</ol>"]
    return olx.page("\n".join(out))


def reading_about(name, span, titles, intros):
    """The first page of every reading: its chapters, then what the notes say about the reading."""
    out = [f'<p class="lead">{olx.esc(name)} {olx.esc(span)}. Each chapter in this reading is one lesson: '
           "an overview, the chapter to read, its scriptures one page each, then a short check of your "
           "understanding.</p>", "<h3>The chapters</h3>", '<ol class="steps">']
    out += [f"<li>{olx.esc(t)}</li>" for t in titles]
    out.append("</ol>")
    for intro in intros:
        # the note's own introduction, without its wrapper and its "Introduction" heading
        inner = re.sub(r"^.*?<div[^>]*>\n?|\n?</div>\s*$", "", intro, flags=re.S)
        inner = re.sub(r"<h\d>Introduction</h\d>\n?", "", inner)
        out.append(inner)
    return olx.page("\n".join(out))


def clip_for(block_lines, sources):
    """The moment of the class that taught most of this block: from the first point taught there
    to two minutes past the last."""
    found = [sources.get(bullet_key(SOURCE_MARK.sub("", l[2:]))) for l in block_lines if l.startswith("- ")]
    found = [f for f in found if f and f.get("video") and f.get("t") is not None]
    if not found:
        return None
    video = max({f["video"] for f in found}, key=lambda v: sum(f["video"] == v for f in found))
    ts = sorted(f["t"] for f in found if f["video"] == video)
    return video, max(0, ts[0] - 10), ts[-1] + 120


def chapter_text(book, chapter):
    """The whole KJV chapter, one paragraph per verse, from data/bible/<book>.json."""
    verses = json.load(open(os.path.join(ROOT, "data", "bible", f"{book}.json"), encoding="utf-8"))["chapters"].get(str(chapter))
    if not verses:
        return None
    return olx.page("\n".join(f"<p><sup>{n}</sup> {html.escape(v, quote=False)}</p>"
                              for n, v in enumerate(verses, 1)), "chapter")


# ---------------------------------------------------------------- OLX

def attr(v):
    return html.escape(str(v), quote=True)


def problem_xml(q, n, **kw):
    why = f'<p>{inline(q["explain"])}</p>' if q.get("explain") else ""
    ref = f'<p>See {inline(q["ref"])}.</p>' if q.get("ref") else ""
    return olx.single_select(f"Question {n}", q["q"], q["choices"], q["answer"], why + ref, **kw)


def final_questions(book, quizzes):
    """One question from every chapter's quiz for the final, the same one on every build."""
    out = []
    for ch, quiz in sorted(quizzes.items()):
        qs = quiz["questions"]
        i = int(hashlib.sha1(f"{book}:{ch}:final".encode()).hexdigest(), 16) % len(qs)
        out.append((ch, qs[i]))
    return out


def people_page(book, name):
    """A custom page: the people of the book who appear in five verses or more, in order of first
    appearance, from data/people-kjv/people.json."""
    path = os.path.join(ROOT, "data", "people-kjv", "people.json")
    if not os.path.exists(path):
        return None
    rows = []
    for p in json.load(open(path, encoding="utf-8"))["people"]:
        vs = [v for v in p["verses"] if v.split("/")[0] == book]
        if len(vs) < 5 or p.get("type") == "Unknown":
            continue
        first = min(vs, key=lambda v: tuple(int(x) for x in v.split("/")[1:3]))
        c, v = first.split("/")[1:3]
        rows.append(((int(c), int(v)), p["name"], p.get("description", ""), f"{name} {c}:{v}", len(vs)))
    if not rows:
        return None
    rows.sort()
    items = [f'<li><span class="ref">{olx.esc(n)}</span><p>{olx.esc(d)}</p>'
             f'<p class="note">First named in {olx.esc(r)} · in {k} verses of {olx.esc(name)}</p></li>'
             for _, n, d, r, k in rows]
    return olx.page(f'<p class="lead">The people of {olx.esc(name)}, in the order they first appear, '
                    f'{len(rows)} in all.</p>\n<ul class="cards">\n' + "\n".join(items) + "\n</ul>")


def book_outcomes(name):
    return [f"Read the whole book of {name} in the King James Version",
            f"Explain what was taught on each scripture of {name}, and the precepts that go with it",
            "Connect each scripture to the precepts that explain it, precept upon precept",
            "Check your understanding of every chapter with a short quiz"]


def build(book, chapters, run="2026"):
    index = {b["slug"]: b for b in json.load(open(os.path.join(ROOT, "data", "bible", "index.json")))}
    if book not in index:
        sys.exit(f"unknown book: {book}")
    name = index[book]["book"]
    files = {}  # path inside the course folder -> text
    code = re.sub(r"[^A-Za-z0-9]", "", name).upper()

    sections = {}
    for ch in chapters:
        # a chapter with no study note yet is still there to read
        note = read_note(book, ch)
        if not note and chapter_text(book, ch):
            note = ({"title": f"{name} {ch}"}, "")
        if note:
            sections.setdefault((ch - 1) // PER_SECTION, []).append((ch, note))
    if not sections:
        sys.exit(f"no study notes for {name} {chapters[0]}-{chapters[-1]}")

    # the first thing a student sees: what the course does and how it works
    has_quiz = any(os.path.exists(os.path.join(QUIZZES, book, f"{ch}.json")) for ch in chapters)
    intro = olx.intro_html(
        f"Welcome to {name}. In this course you read the book of {name} in the King James Version, "
        f"chapter by chapter, together with what was taught on it in the 4 Chapters a Day readings. "
        f"By the end you will have read the whole book and studied it verse by verse, precept upon precept.",
        [("Readings.", f"Each section is one reading session of up to {PER_SECTION} chapters, as in 4 Chapters a Day."),
         ("Read the chapter.", "Every chapter opens with the whole chapter to read, verse by verse."),
         ("Study it.", "Then the chapter is opened block by block: the verses, what was taught on them, "
                       "and the precepts, the scriptures that go with them."),
         ("Key takeaways.", "Each chapter closes with its main points on one page, to review before the quiz."),
         ("Check your understanding.", "Then a short quiz from what was taught. You get two tries at each "
                                       "question, and the answer shows the scripture.") if has_quiz else
         ("Check your understanding.", "Short quizzes after each chapter are being added."),
         ("Final assessment.", "At the end, one question from every chapter, one try each. The chapter quizzes "
                               "count 40% of your grade and the final 60%; 70% passes and earns the certificate."),
         ("Your progress.", "The Progress tab shows what you have finished and your scores.")],
        "Take it at your own pace. A chapter a day, or four, as you are able.", book_outcomes(name))
    files["html/intro-about.html"] = intro + "\n"
    files["html/intro-about.xml"] = '<html filename="intro-about" display_name="What this course does"/>\n'
    files["vertical/intro-about.xml"] = '<vertical display_name="What this course does">\n  <html url_name="intro-about"/>\n</vertical>\n'
    files["sequential/intro-about.xml"] = '<sequential display_name="About this course">\n  <vertical url_name="intro-about"/>\n</sequential>\n'
    files["chapter/intro.xml"] = '<chapter display_name="Introduction">\n  <sequential url_name="intro-about"/>\n</chapter>\n'
    chapter_refs = ["intro"]
    quizzes = {}
    total_minutes = 0
    for s, items in sorted(sections.items()):
        first, last = s * PER_SECTION + 1, min((s + 1) * PER_SECTION, index[book]["chapters"])
        sec_id = f"{book}-reading-{s + 1}"
        span = f"{first}" if first == last else f"{first}-{last}"
        seqs = []
        reading_intros, chapter_titles = [], []
        for ch, (meta, body) in items:
            seq_id = f"{book}-{ch}"
            verts = []
            # every chapter is laid out the same way, in the same order (docs.openedx.org, Accessibility
            # Best Practices Checklist, "Make Your Course Easy to Navigate"):
            #   Overview / Read <Book> <ch> / one unit per passage / Check your understanding
            lessons = units(body, note_sources(book, ch))
            intro = lessons.pop(0)[1] if lessons and lessons[0][0] == "Introduction" else None
            text = chapter_text(book, ch)
            quiz_path = os.path.join(QUIZZES, book, f"{ch}.json")
            quiz = json.load(open(quiz_path, encoding="utf-8")) if os.path.exists(quiz_path) else None
            title = meta.get("title", f"{name} {ch}")
            plan_path = os.path.join(LESSONS, book, f"{ch}.json")
            plan = json.load(open(plan_path, encoding="utf-8")) if os.path.exists(plan_path) else None
            if quiz:
                quizzes[ch] = quiz
            total_minutes += minutes(text, lessons, quiz)
            ordered = [("Overview", chapter_overview(name, ch, title, lessons, text, quiz, plan), None)]
            if intro:
                reading_intros.append(intro)
            chapter_titles.append(title)
            if text:
                ordered.append((f"Read {name} {ch}", text, None))
            ordered += lessons
            if plan and plan.get("takeaways"):
                ordered.append(("Key takeaways", takeaways_page(name, ch, plan), None))
            for n, (utitle, content, clip) in enumerate(ordered, 1):
                vid = f"{seq_id}-{n:02d}"
                files[f"html/{vid}.html"] = content + "\n"
                files[f"html/{vid}.xml"] = f'<html filename="{vid}" display_name="{attr(utitle)}"/>\n'
                children = f'  <html url_name="{vid}"/>\n'
                if clip:
                    # the class teaching these verses: a clip of the YouTube class (start_time/end_time)
                    v, a, b = clip
                    files[f"video/{vid}-v.xml"] = (
                        f'<video display_name="Watch it taught in the class" youtube_id_1_0="{attr(v)}" '
                        f'youtube="1.00:{attr(v)}" start_time="{olx.hms(a)}" end_time="{olx.hms(b)}" '
                        f'download_video="false"/>\n')
                    children += f'  <video url_name="{vid}-v"/>\n'
                files[f"vertical/{vid}.xml"] = f'<vertical display_name="{attr(utitle)}">\n{children}</vertical>\n'
                verts.append(vid)
            if quiz:
                # the last unit of the chapter, so the chapter is one lesson from start to finish
                qid = f"{seq_id}-quiz"
                probs = []
                for n, q in enumerate(quiz["questions"], 1):
                    pid = f"{qid}-{n:02d}"
                    files[f"problem/{pid}.xml"] = problem_xml(q, n)
                    probs.append(pid)
                files[f"vertical/{qid}.xml"] = (
                    f'<vertical display_name="Check your understanding" discussion_enabled="false">\n'
                    + "".join(f'  <problem url_name="{p}"/>\n' for p in probs)
                    + "</vertical>\n"
                )
                verts.append(qid)
            graded = ' graded="true" format="Quiz"' if quiz else ""
            files[f"sequential/{seq_id}.xml"] = (
                f'<sequential display_name="{attr(title)}"{graded}>\n'
                + "".join(f'  <vertical url_name="{v}"/>\n' for v in verts)
                + "</sequential>\n"
            )
            seqs.append(seq_id)
        # the first lesson of every reading: what it covers, once, at the top
        about = f"{sec_id}-about"
        files[f"html/{about}.html"] = reading_about(name, span, chapter_titles, reading_intros) + "\n"
        files[f"html/{about}.xml"] = f'<html filename="{about}" display_name="About this reading"/>\n'
        files[f"vertical/{about}.xml"] = f'<vertical display_name="About this reading">\n  <html url_name="{about}"/>\n</vertical>\n'
        files[f"sequential/{about}.xml"] = f'<sequential display_name="About this reading">\n  <vertical url_name="{about}"/>\n</sequential>\n'
        seqs.insert(0, about)
        files[f"chapter/{sec_id}.xml"] = (
            f'<chapter display_name="{attr(f"{name} {span}")}">\n'
            + "".join(f'  <sequential url_name="{q}"/>\n' for q in seqs)
            + "</chapter>\n"
        )
        chapter_refs.append(sec_id)

    # the final assessment: one question from every chapter, one try each
    final = final_questions(book, quizzes) if len(quizzes) >= 5 else []
    if final:
        about = ('<p class="lead">The final assessment covers the whole book: one question from every chapter, '
                 f'{len(final)} in all.</p>\n<ul class="facts"><li><b>Questions</b>{len(final)}</li>'
                 f'<li><b>Tries</b>One per question</li><li><b>Weight</b>60% of your grade</li>'
                 f'<li><b>To pass</b>70% overall</li></ul>\n'
                 '<p>Review the key takeaways of each chapter before you begin. Each answer shows the scripture '
                 'behind it once you submit.</p>')
        files["html/final-about.html"] = olx.page(about) + "\n"
        files["html/final-about.xml"] = '<html filename="final-about" display_name="Before you begin"/>\n'
        files["vertical/final-about.xml"] = '<vertical display_name="Before you begin" discussion_enabled="false">\n  <html url_name="final-about"/>\n</vertical>\n'
        verts = ["final-about"]
        for start in range(0, len(final), 10):
            part = final[start:start + 10]
            vid = f"final-{start // 10 + 1}"
            probs = []
            for n, (ch, q) in enumerate(part, start + 1):
                pid = f"{vid}-{n:02d}"
                files[f"problem/{pid}.xml"] = problem_xml(q, n, max_attempts=1)
                probs.append(pid)
            files[f"vertical/{vid}.xml"] = (
                f'<vertical display_name="Questions {start + 1}-{start + len(part)}" discussion_enabled="false">\n'
                + "".join(f'  <problem url_name="{p}"/>\n' for p in probs) + "</vertical>\n")
            verts.append(vid)
        files["sequential/final-exam.xml"] = (
            f'<sequential display_name="{attr(f"{name}: Final assessment")}" graded="true" format="Final Exam">\n'
            + "".join(f'  <vertical url_name="{v}"/>\n' for v in verts) + "</sequential>\n")
        files["chapter/final.xml"] = '<chapter display_name="Final assessment">\n  <sequential url_name="final-exam"/>\n</chapter>\n'
        chapter_refs.append("final")

    files["course.xml"] = f'<course url_name="{run}" org="{ORG}" course="{code}"/>\n'
    files[f"course/{run}.xml"] = (
        f'<course display_name="{attr(name)}" language="en" start="2026-01-01T00:00:00Z">\n'
        + "".join(f'  <chapter url_name="{c}"/>\n' for c in chapter_refs)
        + "</course>\n"
    )
    # custom pages in the course menu (docs.openedx.org, "Create Course Tabs in OLX")
    tabs = [{"type": "courseware", "name": "Course"}, {"type": "progress", "name": "Progress"},
            {"type": "discussion", "name": "Discussion"}]
    people = people_page(book, name)
    if people:
        files["tabs/people.html"] = people + "\n"
        tabs.append({"course_staff_only": False, "name": f"People of {name}", "type": "static_tab", "url_slug": "people"})
    tabs.append({"type": "edxnotes", "name": "Notes"})
    files[f"policies/{run}/policy.json"] = json.dumps(
        {f"course/{run}": {"display_name": name, "language": "en", "start": "2026-01-01T00:00:00Z",
                           "self_paced": True, "tabs": tabs,
                           # a discussion on every lesson page, none on the quizzes (discussion_enabled below);
                           # the chapters are graded, so graded units must allow it
                           "discussions_settings": {"enable_graded_units": True, "enable_in_context": True,
                                                    "provider_type": "openedx", "unit_level_visibility": True},
                           "edxnotes": True,
                           # a certificate of completion as soon as a learner passes (70%)
                           "cert_html_view_enabled": True,
                           "certificates_display_behavior": "early_no_info",
                           "certificates": {"certificates": [{
                               "id": 1, "version": 1, "is_active": True, "name": name, "course_title": name,
                               "description": f"Certificate of completion for {name}", "signatories": []}]}}},
        indent=2) + "\n"
    grader = [{"type": "Quiz", "short_label": "Q", "min_count": 1, "drop_count": 0, "weight": 0.4 if final else 1.0}]
    if final:
        grader.append({"type": "Final Exam", "short_label": "Final", "min_count": 1, "drop_count": 0, "weight": 0.6})
    files[f"policies/{run}/grading_policy.json"] = json.dumps(
        {"GRADER": grader, "GRADE_CUTOFFS": {"Pass": 0.7}}, indent=2) + "\n"
    card = olx.card_png(name, "The Books", "book")
    if card:
        files["static/course_card.png"] = card
        policy = json.loads(files[f"policies/{run}/policy.json"])
        policy[f"course/{run}"]["course_image"] = "course_card.png"
        files[f"policies/{run}/policy.json"] = json.dumps(policy, indent=2) + "\n"
    olx.add_static(files, code)
    # our own About page, so Open edX's default (with its outside links) is not used
    files["about/overview.html"] = olx.overview_html(
        [f"Read the book of {name} in the King James Version, chapter by chapter, together with what was "
         f"taught on it in the 4 Chapters a Day readings. Each chapter opens with the whole chapter to read. "
         f"Then it is opened block by block: the verses set apart, the teaching point by point with the class "
         f"each point was taught in, and the precepts, the scriptures that go with it. Where a class taught "
         f"those verses, the lesson plays that moment of the class.",
         f"Each chapter closes with its key takeaways and a short quiz that checks your understanding, with the "
         f"scripture behind every answer."
         + (f" A final assessment covers the whole book, and passing the course (70%) earns a certificate."
            if final else ""),
         f"About {max(1, round(total_minutes / 60))} hours in all, self paced: read a chapter a day, or four, "
         f"and the Progress page keeps your place."],
        book_outcomes(name))
    files["about/short_description.html"] = f"Read {html.escape(name)} in the KJV with the 4 Chapters a Day study notes.\n"
    return files


def parse_chapters(spec, book):
    if not spec:
        # not always 1..n: Greek Esther exists only as chapters 10-16
        chapters = json.load(open(os.path.join(ROOT, "data", "bible", f"{book}.json"), encoding="utf-8"))["chapters"]
        return sorted(int(c) for c in chapters)
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
    files = build(a.book, parse_chapters(a.chapters, a.book), a.run)
    path = os.path.join(a.out, f"{a.book}.tar.gz")
    write_tar(files, path)
    print(f"{path}: {sum(1 for f in files if f.startswith('vertical/'))} units, "
          f"{sum(1 for f in files if f.startswith('problem/'))} questions")


if __name__ == "__main__":
    main()

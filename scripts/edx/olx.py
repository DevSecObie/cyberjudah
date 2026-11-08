"""A small model of an Open edX course, written out as OLX (the format Studio imports).

    course = Course("CASES", "Case Studies", about="...")
    sec = course.section("Primeval")
    sub = sec.subsection("Adam and Eve")
    sub.unit("The charge", html="<p>...</p>", problems=[problem_xml(...)])
    sub.unit("Watch the class", video="z3ONy4yAFek")
    files = course.files()          # path inside the course folder -> text or bytes
    write_tar(files, "dist/edx/cases.tar.gz")

Every builder in scripts/edx produces the same files dict, so they share write_tar and the
course card image.
"""
import html, io, json, os, re, tarfile

ORG = "CyberJudah"
RUN = "2026"
START = "2026-01-01T00:00:00Z"

# Card colours, one per kind of course; text on them is white and passes 4.5:1.
COLOURS = {"book": (46, 58, 135), "class": (122, 62, 22), "case": (110, 32, 48), "topic": (28, 84, 74)}


def attr(v):
    return html.escape(str(v), quote=True)


def hms(seconds):
    s = int(seconds)
    return f"{s // 3600:02d}:{s % 3600 // 60:02d}:{s % 60:02d}"


def slug(text, limit=60):
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s[:limit].strip("-") or "x"


class Unit:
    def __init__(self, uid, title, html_body=None, problems=(), video=None):
        self.uid, self.title, self.html, self.problems, self.video = uid, title, html_body, list(problems), video


class Subsection:
    def __init__(self, uid, title, graded=False):
        self.uid, self.title, self.graded, self.units = uid, title, graded, []

    def unit(self, title, html=None, problems=(), video=None):
        u = Unit(f"{self.uid}-{len(self.units) + 1:03d}", title, html, problems, video)
        self.units.append(u)
        return u


class Section:
    def __init__(self, uid, title):
        self.uid, self.title, self.subsections = uid, title, []

    def subsection(self, title, graded=False, uid=None):
        s = Subsection(uid or f"{self.uid}-{len(self.subsections) + 1:03d}", title, graded)
        self.subsections.append(s)
        return s


class Course:
    def __init__(self, code, name, about="", short="", kind="book", subtitle=""):
        self.code, self.name, self.about, self.short, self.kind = code, name, about, short, kind
        self.subtitle = subtitle
        self.sections = []
        self.extra = {}  # more files, e.g. from a builder that writes its own

    def section(self, title, uid=None):
        s = Section(uid or f"s{len(self.sections) + 1:03d}", title)
        self.sections.append(s)
        return s

    @property
    def key(self):
        return f"course-v1:{ORG}+{self.code}+{RUN}"

    def files(self):
        f = dict(self.extra)
        graded = False
        for sec in self.sections:
            for sub in sec.subsections:
                for u in sub.units:
                    children = []
                    if u.video:
                        # video is a YouTube id, or (id, start, end) in seconds to play one clip of a class
                        vid, start, end = (u.video, None, None) if isinstance(u.video, str) else u.video
                        clip = "".join(f' {k}="{hms(v)}"' for k, v in (("start_time", start), ("end_time", end)) if v)
                        f[f"video/{u.uid}-v.xml"] = (
                            f'<video display_name="{attr(u.title)}" youtube_id_1_0="{attr(vid)}" '
                            f'youtube="1.00:{attr(vid)}"{clip} download_video="false"/>\n')
                        children.append(f'  <video url_name="{u.uid}-v"/>\n')
                    if u.html:
                        f[f"html/{u.uid}.html"] = u.html + "\n"
                        f[f"html/{u.uid}.xml"] = f'<html filename="{u.uid}" display_name="{attr(u.title)}"/>\n'
                        children.append(f'  <html url_name="{u.uid}"/>\n')
                    for n, p in enumerate(u.problems, 1):
                        f[f"problem/{u.uid}-p{n:02d}.xml"] = p
                        children.append(f'  <problem url_name="{u.uid}-p{n:02d}"/>\n')
                    f[f"vertical/{u.uid}.xml"] = f'<vertical display_name="{attr(u.title)}">\n' + "".join(children) + "</vertical>\n"
                extra = ' graded="true" format="Quiz"' if sub.graded else ""
                graded = graded or sub.graded
                f[f"sequential/{sub.uid}.xml"] = (
                    f'<sequential display_name="{attr(sub.title)}"{extra}>\n'
                    + "".join(f'  <vertical url_name="{u.uid}"/>\n' for u in sub.units) + "</sequential>\n")
            f[f"chapter/{sec.uid}.xml"] = (
                f'<chapter display_name="{attr(sec.title)}">\n'
                + "".join(f'  <sequential url_name="{s.uid}"/>\n' for s in sec.subsections) + "</chapter>\n")
        f["course.xml"] = f'<course url_name="{RUN}" org="{ORG}" course="{self.code}"/>\n'
        f[f"course/{RUN}.xml"] = (
            f'<course display_name="{attr(self.name)}" language="en" start="{START}">\n'
            + "".join(f'  <chapter url_name="{s.uid}"/>\n' for s in self.sections) + "</course>\n")
        policy = {"display_name": self.name, "language": "en", "start": START, "self_paced": True,
                  "tabs": [{"type": "courseware", "name": "Course"}, {"type": "progress", "name": "Progress"}]}
        card = card_png(self.name, self.subtitle, self.kind)
        if card:
            f["static/course_card.png"] = card
            policy["course_image"] = "course_card.png"
        f[f"policies/{RUN}/policy.json"] = json.dumps({f"course/{RUN}": policy}, indent=2) + "\n"
        f[f"policies/{RUN}/grading_policy.json"] = json.dumps(
            {"GRADER": [{"type": "Quiz", "short_label": "Q", "min_count": 1, "drop_count": 0, "weight": 1.0}]
             if graded else [], "GRADE_CUTOFFS": {"Pass": 0.7}}, indent=2) + "\n"
        f["policies/assets.json"] = "{}\n"
        f["about/overview.html"] = (f'<section class="about"><h2>About this course</h2>\n'
                                    f"<p>{html.escape(self.about)}</p></section>\n")
        f["about/short_description.html"] = html.escape(self.short or self.about) + "\n"
        return f


# ---------------------------------------------------------------- course card

FONT_DIRS = ["/usr/share/fonts/truetype/dejavu", "/System/Library/Fonts/Supplemental", "/Library/Fonts"]


def _font(names, size):
    from PIL import ImageFont
    for d in FONT_DIRS:
        for n in names:
            p = os.path.join(d, n)
            if os.path.exists(p):
                return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def card_png(title, subtitle, kind):
    """A 756x378 course card: the title on a plain colour, so the catalog reads at a glance.
    Needs Pillow; without it the course simply has no card image."""
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return None
    W, H = 756, 378
    img = Image.new("RGB", (W, H), COLOURS.get(kind, COLOURS["book"]))
    d = ImageDraw.Draw(img)
    big = _font(["DejaVuSerif-Bold.ttf", "Georgia Bold.ttf"], 56)
    small = _font(["DejaVuSans.ttf", "Arial.ttf"], 24)
    # wrap the title to the card width
    words, lines, line = title.split(), [], ""
    for w in words:
        t = (line + " " + w).strip()
        if d.textlength(t, font=big) > W - 96 and line:
            lines.append(line)
            line = w
        else:
            line = t
    lines.append(line)
    size = 56
    while len(lines) > 3 and size > 30:
        size -= 6
        big = _font(["DejaVuSerif-Bold.ttf", "Georgia Bold.ttf"], size)
        words, lines, line = title.split(), [], ""
        for w in words:
            t = (line + " " + w).strip()
            if d.textlength(t, font=big) > W - 96 and line:
                lines.append(line)
                line = w
            else:
                line = t
        lines.append(line)
    y = H // 2 - (len(lines) * (size + 10)) // 2
    for l in lines:
        d.text((48, y), l, font=big, fill="white")
        y += size + 10
    if subtitle:
        d.text((48, H - 60), subtitle, font=small, fill=(235, 235, 235))
    d.text((48, 36), "CyberJudah Learn", font=small, fill=(235, 235, 235))
    out = io.BytesIO()
    img.save(out, "PNG", optimize=True)
    return out.getvalue()


# ---------------------------------------------------------------- output

def write_tar(files, path):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with tarfile.open(path, "w:gz") as tar:
        for name in sorted(files):
            data = files[name] if isinstance(files[name], bytes) else files[name].encode("utf-8")
            info = tarfile.TarInfo(f"course/{name}")
            info.size = len(data)
            info.mtime = 0
            tar.addfile(info, io.BytesIO(data))


# ---------------------------------------------------------------- checks

HREF = re.compile(r'href="([^"]*)"')
YOUTUBE_URL = re.compile(r"^https?://(www\.|m\.)?(youtube\.com|youtu\.be)/")


def check(files):
    """Problems that would make an import fail or break the course rules; [] when it is sound.
    Every XML parses, every url_name a parent points at exists, and the only links are YouTube."""
    import xml.etree.ElementTree as ET
    errs = []
    for name, data in files.items():
        if name.endswith(".xml") and isinstance(data, str):
            try:
                root = ET.fromstring(data)
            except ET.ParseError as e:
                errs.append(f"{name}: {e}")
                continue
            for child in root:
                ref = child.get("url_name")
                if ref and child.tag in ("chapter", "sequential", "vertical", "html", "problem", "video") \
                        and name != "course.xml" and f"{child.tag}/{ref}.xml" not in files:
                    errs.append(f"{name}: missing {child.tag}/{ref}.xml")
        if isinstance(data, str) and name.endswith((".html", ".xml")):
            for url in HREF.findall(data):
                if not YOUTUBE_URL.match(html.unescape(url)):
                    errs.append(f"{name}: link outside the course: {url}")
        if name.startswith("html/") and name.endswith(".html"):
            try:
                ET.fromstring(f"<div>{data}</div>")
            except ET.ParseError as e:
                errs.append(f"{name}: {e}")
    return errs

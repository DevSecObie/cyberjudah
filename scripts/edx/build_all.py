"""Build every course: all the books, the class series, the Case Studies and the topic courses.

    build_all.py                     everything into dist/edx/ and dist/edx/manifest.tsv
    build_all.py --only books        just one kind: books, classes, cases or topics

manifest.tsv lists each course's key, title and archive, which is what the import on the
server reads (see README.md, "Import every course").
"""
import argparse, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import olx, build_course, build_series, build_cases, build_topics  # noqa: E402
from build_course import ROOT  # noqa: E402


def book_courses():
    for b in json.load(open(os.path.join(ROOT, "data", "bible", "index.json"))):
        files = build_course.build(b["slug"], build_course.parse_chapters(None, b["slug"]))
        code = files["course.xml"].split('course="')[1].split('"')[0]
        yield f"course-v1:{olx.ORG}+{code}+{olx.RUN}", b["book"], os.path.join("books", f"{b['slug']}.tar.gz"), files


def other(courses, folder=""):
    for c in courses:
        yield c.key, c.name, os.path.join(folder, f"{olx.slug(c.name)}.tar.gz"), c.files()


KINDS = {
    "books": book_courses,
    "classes": lambda: other(build_series.courses(), "classes"),
    "cases": lambda: other([build_cases.build()]),
    "topics": lambda: other(build_topics.courses()),
}


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", default=os.path.join(ROOT, "dist", "edx"))
    ap.add_argument("--only", choices=sorted(KINDS))
    a = ap.parse_args()
    rows, keys = [], set()
    for kind in ([a.only] if a.only else ["books", "classes", "cases", "topics"]):
        for key, title, rel, files in KINDS[kind]():
            if key in keys:
                sys.exit(f"two courses share the key {key}")
            keys.add(key)
            olx.write_tar(files, os.path.join(a.out, rel))
            rows.append((kind, key, title, rel))
            print(f"{kind:8s} {key:45s} {rel}")
    with open(os.path.join(a.out, "manifest.tsv"), "w", encoding="utf-8") as f:
        f.write("kind\tkey\ttitle\tarchive\n")
        f.writelines("\t".join(r) + "\n" for r in rows)
    print(f"{len(rows)} courses, manifest at {os.path.join(a.out, 'manifest.tsv')}")


if __name__ == "__main__":
    main()

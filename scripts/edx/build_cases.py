"""The Case Studies course: every case in data/cases.json, era by era.

    build_cases.py                   dist/edx/case-studies.tar.gz

    course       Case Studies
    section      an era (12)                      Primeval
    subsection   one case                         C001 Adam and Eve
    unit         The charge                       the charge and the offense, with scripture cited
                 The verdict                      "By the law, what was the verdict?" (one try,
                                                  the answer shows the judgment scripture records)
                 What scripture records           the judgment and the summary

The verdict question is practice, not graded: four choices, the recorded verdict and three
others picked the same way on every build, so a rebuild does not reshuffle a student's answers.
"""
import argparse, hashlib, html, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import olx  # noqa: E402
from build_course import ROOT  # noqa: E402


def paras(items):
    if isinstance(items, str):
        items = [items]
    return "\n".join(f"<p>{html.escape(p, quote=False)}</p>" for p in items if p)


def refs_text(refs):
    return "; ".join(html.escape(f"{r['book']} {r['chapter']}" + (f":{r['verses']}" if r.get("verses") else ""))
                     for r in refs or [])


def refs_line(refs):
    if not refs:
        return ""
    return "<p><strong>Read:</strong> " + "; ".join(
        html.escape(f"{r['book']} {r['chapter']}:{r['verses']}" if r.get("verses") else f"{r['book']} {r['chapter']}")
        for r in refs) + "</p>"


def verdict_problem(case, verdicts):
    keys = list(verdicts)
    right = case["verdict"]
    others = sorted((k for k in keys if k != right),
                    key=lambda k: hashlib.sha1(f"{case['slug']}:{k}".encode()).hexdigest())[:3]
    choices = sorted([right] + others, key=keys.index)
    why = f"<p>What scripture records: {html.escape(right.capitalize())}, {html.escape(verdicts[right])}.</p>"
    return olx.single_select("Your verdict", f"By the law, what was the verdict on {case['name']}?",
                             [f"{k.capitalize()}: {verdicts[k]}" for k in choices], choices.index(right), why,
                             max_attempts=1, weight=0, shuffle=False)


def build():
    d = json.load(open(os.path.join(ROOT, "data", "cases.json"), encoding="utf-8"))
    verdicts = d["verdicts"]
    c = olx.Course("CASES", "Case Studies", kind="case", subtitle=f"{len(d['cases'])} cases · {len(d['eras'])} eras",
                   about=(f"{len(d['cases'])} cases from scripture, from the Primeval era on: who was charged, "
                          "with what, what the law says, and what judgment scripture records. Read the charge, "
                          "give your verdict, then see what was recorded, with every scripture cited."),
                   short="Judge each case by the law, then read what scripture records.")
    c.introduction(olx.intro_html(
        f"Welcome to Case Studies. Here you judge {len(d['cases'])} cases from scripture by the law of the "
        "Most High, then see what judgment scripture records, so you learn the law by seeing it applied.",
        [("Eras.", f"The cases run in order through {len(d['eras'])} eras, from the Primeval era on."),
         ("The charge.", "Each case opens with who was charged, with what, and the offense in full, with the "
                         "scriptures cited."),
         ("The verdict.", "Then you give your verdict: by the law, what was the judgment? You get one try. "
                          "These questions are practice and do not count toward a grade."),
         ("What scripture records.", "Last, the judgment as scripture records it, a summary of the case, and "
                                     "the laws it touches in The Law course.")],
        "Read each case carefully and judge it by the law before you look at the answer."))
    for n, era in enumerate(d["eras"], 1):
        cases = [x for x in d["cases"] if x["era"] == era]
        if not cases:
            continue
        sec = c.section(era, uid=f"era-{n:02d}")
        for case in cases:
            sub = sec.subsection(f"{case['code']} {case['name']}", uid=f"case-{case['code'].lower()}")
            facts = (f'<ul class="facts"><li><b>Case</b>{html.escape(case["code"])}</li>'
                     f'<li><b>Era</b>{html.escape(case["era"])}</li>'
                     + f'<li><b>Scriptures</b>{len(case.get("refs") or [])} passages</li></ul>')
            charge = (f'{facts}\n<h3>The charge</h3>\n<p class="lead">{html.escape(case["charge"], quote=False)}</p>\n'
                      f'<h3>The offense</h3>\n{paras(case.get("offenseFull") or case.get("offense"))}\n'
                      + (f'<h3>Read</h3>\n<p class="note">{refs_text(case.get("refs"))}</p>\n' if case.get("refs") else "")
                      + '<p class="lead">Judge it by the law, then give your verdict below.</p>')
            sub.unit("The case", html=olx.page(charge), problems=[verdict_problem(case, verdicts)])
            v = case["verdict"]
            record = (f'<div class="verdict"><p class="label">The verdict</p><p class="name">{html.escape(v.capitalize())}</p>'
                      f'<p class="note">{html.escape(verdicts.get(v, ""))}</p></div>\n'
                      f'<h3>What scripture records</h3>\n{paras(case.get("judgmentFull") or case.get("judgment"))}\n'
                      f'<h3>Summary</h3>\n{paras(case.get("summary"))}')
            if case.get("laws"):
                record += ('\n<h3>The law</h3>\n<p>' + ", ".join(html.escape(str(x)) for x in case["laws"])
                           + ' <span class="note">(numbered as in The Law course)</span></p>')
            record = olx.page(record)
            sub.unit("What scripture records", html=record)
    return c


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", default=os.path.join(ROOT, "dist", "edx"))
    a = ap.parse_args()
    c = build()
    path = os.path.join(a.out, "case-studies.tar.gz")
    olx.write_tar(c.files(), path)
    print(f"{path}: {c.key}")


if __name__ == "__main__":
    main()

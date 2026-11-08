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
    opts = "".join(
        f'<choice correct="{"true" if k == right else "false"}">{html.escape(k.capitalize())}: '
        f'{html.escape(verdicts[k])}</choice>' for k in choices)
    why = paras(case.get("judgmentFull") or case.get("judgment") or "")
    return (
        f'<problem display_name="The verdict" max_attempts="1" weight="0" showanswer="finished">\n'
        f'<multiplechoiceresponse>\n<label>By the law, what was the verdict on {html.escape(case["name"])}?</label>\n'
        f'<choicegroup type="MultipleChoice">{opts}</choicegroup>\n</multiplechoiceresponse>\n'
        f'<solution><div class="detailed-solution"><p>What scripture records: {html.escape(right.capitalize())}</p>'
        f'{why}</div></solution>\n</problem>\n')


def build():
    d = json.load(open(os.path.join(ROOT, "data", "cases.json"), encoding="utf-8"))
    verdicts = d["verdicts"]
    c = olx.Course("CASES", "Case Studies", kind="case", subtitle=f"{len(d['cases'])} cases · {len(d['eras'])} eras",
                   about=(f"{len(d['cases'])} cases from scripture, from the Primeval era on: who was charged, "
                          "with what, what the law says, and what judgment scripture records. Read the charge, "
                          "give your verdict, then see what was recorded, with every scripture cited."),
                   short="Judge each case by the law, then read what scripture records.")
    for n, era in enumerate(d["eras"], 1):
        cases = [x for x in d["cases"] if x["era"] == era]
        if not cases:
            continue
        sec = c.section(era, uid=f"era-{n:02d}")
        for case in cases:
            sub = sec.subsection(f"{case['code']} {case['name']}", uid=f"case-{case['code'].lower()}")
            charge = (f"<h3>The charge</h3>\n{paras(case['charge'])}\n<h3>The offense</h3>\n"
                      f"{paras(case.get('offenseFull') or case.get('offense'))}\n{refs_line(case.get('refs'))}")
            sub.unit("The charge", html=charge)
            sub.unit("The verdict", problems=[verdict_problem(case, verdicts)])
            v = case["verdict"]
            record = (f"<h3>{html.escape(v.capitalize())}</h3>\n<p><em>{html.escape(verdicts.get(v, ''))}</em></p>\n"
                      f"{paras(case.get('judgmentFull') or case.get('judgment'))}\n"
                      f"<h3>Summary</h3>\n{paras(case.get('summary'))}")
            if case.get("laws"):
                record += "\n<p><strong>The law:</strong> " + ", ".join(html.escape(str(x)) for x in case["laws"]) + \
                          " (see The Law handbook course)</p>"
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

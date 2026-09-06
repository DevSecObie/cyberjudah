#!/usr/bin/env python3
"""Merge scripts/cases-add-*.py into data/cases.json (idempotent: existing slugs are replaced)."""
import json, importlib.util, os, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = f"{ROOT}/data/cases.json"; data = json.load(open(p))
by = {c["slug"]: c for c in data["cases"]}
for f in sorted(glob.glob(f"{ROOT}/scripts/cases-add-*.py")):
    spec = importlib.util.spec_from_file_location("m", f); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    for c in m.CASES: by[c["slug"]] = c
order = {e: i for i, e in enumerate(data["eras"])}
data["cases"] = sorted(by.values(), key=lambda c: (order[c["era"]], c.get("kind", "judgment") != "judgment", c["name"].lower()))
data["verdicts"]["blessed"] = "kept the law, and the blessing scripture records for it"
json.dump(data, open(p, "w"), indent=1, ensure_ascii=False); open(p, "a").write("\n")
print(len(data["cases"]), "cases;", sum(1 for c in data["cases"] if c.get("kind") == "blessing"), "kept the law")

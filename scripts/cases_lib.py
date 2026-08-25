"""Shared helpers for the case-study modules (scripts/cases_*.py).

Every module exports CASES, a list of dicts with this shape:

  slug     url-safe id; unique across all modules
  name     display name
  era      one of ERA_ORDER below (controls grouping and order in the app)
  charge   one line: what they are charged with
  verdict  one of VERDICTS below
  summary  2-3 sentences: the case in brief
  offense  what they did, measured against the law
  judgment what came of it
  refs     R("Book c:v-v", ...) scripture, KJV canon + KJV Apocrypha
  laws     handbook ids: section ("10A") or entry ("10A.4")
  topics   precept-index slugs (see src/data/precepts.json)
  themes   free tags used to relate cases to one another
"""
import re

ERA_ORDER = [
    "Primeval",
    "Patriarchal",
    "Egypt",
    "Wilderness",
    "Conquest",
    "Judges",
    "United Monarchy",
    "Divided Kingdom",
    "Exile and Return",
    "Second Temple (Apocrypha)",
    "Gospels",
    "Apostolic",
]

# What each verdict means. The app maps these to badges (see Reader.tsx VERDICT).
VERDICTS = {
    "death":       "put to death, whether by court, by God directly, or by the sword",
    "plague":      "plague, disease, or fire from God, usually on a group",
    "exile":       "banished, cast out, or scattered",
    "captivity":   "carried captive, bound, or handed to enemies",
    "curse":       "a pronounced curse or standing sentence without immediate death",
    "restitution": "the wrong was made good under the law of restitution",
    "spared":      "guilty, but spared on repentance, intercession, or by the withdrawal of witnesses",
    "reprieve":    "sentence pronounced but softened, delayed, or stayed",
    "temporal":    "a bounded judgment in this life: sickness, defeat, loss, humiliation",
    "unrecorded":  "the offense and the statute are recorded; scripture does not record the sentence",
}

def ref(s):
    m = re.match(r"^(.+?)\s+(\d+)(?::([\d,\-]+))?$", s.strip())
    if not m:
        raise ValueError(f"bad ref: {s!r}")
    return {"book": m.group(1), "chapter": int(m.group(2)), "verses": (m.group(3) or "")}

def R(*ss):
    return [ref(s) for s in ss]

"""A small, dependency-free language identifier for caption text.

Captions in this corpus are overwhelmingly English, but some channels teach in Spanish and a
few caption tracks are YouTube translations. Two signals are enough to tell them apart:

1. Writing system: a text written mostly in Arabic, Cyrillic, Hangul, kana, Han, Hebrew,
   Greek or Devanagari letters is reported by script (BCP 47 `und-<Script>`, or the one
   language that script implies, such as Korean for Hangul).
2. Function words: for Latin-script text, the share of tokens that are the most common
   function words of each candidate language.

Anything too short or too close to call is `und` (undetermined). Codes are ISO 639-1.
"""

import re
from collections import Counter

MIN_WORDS = 20
MIN_SCORE = 0.12
MIN_MARGIN = 0.03

FUNCTION_WORDS = {
    "en": "the and of to a in is that it you i for this was he we they be on not with are his "
          "have as but all so what do my your him them their there then when if",
    "es": "de la que el en y los se del las un por con no una su para es al lo como más pero sus "
          "le ya este porque muy está cuando también mi yo nos esta todo",
    "pt": "de o que e do da em um para é com não uma os no se na por mais as dos como mas ao ele "
          "das à seu sua ou quando muito nós você isso está",
    "fr": "de la le et les des en un du une que est pour qui dans il ne pas sur au avec ce plus "
          "par je vous nous sont mais ou",
    "de": "der die und in den von zu das mit sich des auf für ist im dem nicht ein eine als auch "
          "es an werden aus er hat dass",
    "it": "di e il la che in per un del non una sono le con si da i lo gli al è come anche ma "
          "questo della",
    "nl": "de en van het een in is dat op te zijn met voor niet aan er ook als bij door maar",
    "pl": "i w nie na się z do to że jest o jak co ale po tak za od już tylko",
    "ro": "și de în la cu nu un o că pe se din care mai este să ce sunt au fost",
    "ht": "mwen ou li nou yo pa se nan ak pou sa ki gen konn fè bondye m w l n k tout lè sou te ap",
}
FUNCTION_SETS = {code: set(words.split()) for code, words in FUNCTION_WORDS.items()}

# Scripts that decide the language on their own, checked in this order.
SCRIPTS = (
    ("und-Arab", re.compile(r"[\u0600-\u06FF\u0750-\u077F]")),
    ("und-Cyrl", re.compile(r"[\u0400-\u04FF]")),
    ("ko", re.compile(r"[\u1100-\u11FF\uAC00-\uD7AF]")),
    ("ja", re.compile(r"[\u3040-\u30FF]")),
    ("und-Hani", re.compile(r"[\u4E00-\u9FFF]")),
    ("und-Hebr", re.compile(r"[\u0590-\u05FF]")),
    ("el", re.compile(r"[\u0370-\u03FF]")),
    ("und-Deva", re.compile(r"[\u0900-\u097F]")),
    ("th", re.compile(r"[\u0E00-\u0E7F]")),
)
NON_LATIN = re.compile("|".join(pattern.pattern for _code, pattern in SCRIPTS))
WORD = re.compile(r"[^\W\d_]+(?:'[^\W\d_]+)?", re.UNICODE)
TAG = re.compile(r"\[[^\[\]]*\]")


def detect(text):
    """(language code, confidence 0..1) for a piece of caption text."""
    text = TAG.sub(" ", text or "")
    words = WORD.findall(text)
    letters = sum(map(len, words))
    if not letters:
        return "und", 0.0
    non_latin = len(NON_LATIN.findall(text))
    if non_latin / letters >= 0.5:
        if non_latin < MIN_WORDS:
            return "und", 0.0
        code, count = max(((code, len(p.findall(text))) for code, p in SCRIPTS), key=lambda x: x[1])
        return code, round(count / letters, 3)

    if len(words) < MIN_WORDS:
        return "und", 0.0
    counts = Counter(w.lower() for w in words)
    total = len(words)
    scores = sorted(
        ((sum(counts[w] for w in vocab) / total, code) for code, vocab in FUNCTION_SETS.items()),
        reverse=True,
    )
    (best, code), (second, _other) = scores[0], scores[1]
    if best < MIN_SCORE or best - second < MIN_MARGIN:
        return "und", round(best, 3)
    return code, round(best, 3)

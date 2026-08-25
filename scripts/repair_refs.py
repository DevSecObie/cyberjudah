"""Known citation errors in the PDF extraction of A Handbook of Bible Law, and their repairs.

pdftotext drops the punctuation between verse numbers in a handful of citations ("Deut 10:12, 20"
comes out as "10: 121 20"). Each entry: (law id, book, chapter as parsed) -> list of corrected
{book, chapter, verses} refs replacing the broken one. Found by running the CyberJudah vault
validator over the generated law notes; verified against the KJV text.

Used by parse_handbook.py at parse time and by build_vault.py / the app data at load time.
"""
REPAIRS = {
    ("2C.2",  "Deuteronomy", 10):   [("Deuteronomy", 10, "12"), ("Deuteronomy", 10, "20")],
    ("2D.3",  "1 Corinthians", 10): [("1 Corinthians", 10, "14"), ("1 Corinthians", 10, "19-20")],
    ("3A.3",  "Romans", 141):       [("Romans", 14, "1")],
    ("3C.9",  "Romans", 13):        [("Romans", 13, "8-10")],
    ("3E.1",  "Zephaniah", 13):     [("Zephaniah", 3, "13")],
    ("3G.2",  "Philippians", 1):    [("Philippians", 1, "5"), ("Philippians", 1, "27")],
    ("3G.18", "Ephesians", 4):      [("Ephesians", 4, "3"), ("Ephesians", 4, "13")],
    ("3I.1",  "Job", 31):           [("Job", 31, "29")],
    ("3L.4",  "Proverbs", 9):       [("Proverbs", 9, "7-8")],
    ("3L.8",  "1 Corinthians", 11): [("1 Corinthians", 11, "17-18")],
    ("9C.5",  "Exodus", 31):        [("Exodus", 31, "13"), ("Exodus", 31, "16-17")],
    ("9C.11", "Exodus", 16):        [("Exodus", 16, "5"), ("Exodus", 16, "22-30")],
    ("11B.3", "Isaiah", 31):        [("Isaiah", 31, "1")],
    ("17H.9", "Jude", 16):          [("Jude", 1, "16"), ("Jude", 1, "18")],
    ("18A.1", "Genesis", 14):       [("Genesis", 14, "19"), ("Genesis", 14, "22")],
    ("22D.9", "1 Chronicles", 18):  [("1 Chronicles", 18, "2"), ("1 Chronicles", 18, "6")],
}

def repair(parts):
    """Apply REPAIRS in place to a handbook parts list. Returns the number of refs replaced."""
    n = 0
    for p in parts:
        for s in p["sections"]:
            for e in s["entries"]:
                lid = f"{s['id']}.{e['n']}"
                out = []
                for r in e["refs"]:
                    fix = REPAIRS.get((lid, r["book"], r["chapter"]))
                    if fix:
                        out += [{"book": b, "chapter": c, "verses": v} for b, c, v in fix]; n += 1
                    else:
                        out.append(r)
                e["refs"] = out
    return n

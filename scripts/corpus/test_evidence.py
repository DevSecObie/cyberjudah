#!/usr/bin/env python3
import gzip
import json
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "ai"))
import draft  # noqa: E402
import evidence  # noqa: E402


def corpus(folder, passages):
    """A two-recording corpus in the build's format."""
    docs = [
        {"doc_id": "youtube:aaaaaaaaaaa", "video_id": "aaaaaaaaaaa", "title": "Edom Revealed", "feed": "classes", "date": "2024-01-06", "note_path": None, "quality_flags": []},
        {"doc_id": "youtube:bbbbbbbbbbb", "video_id": "bbbbbbbbbbb", "title": "Duplicate", "feed": "classes", "date": None, "note_path": None, "quality_flags": ["duplicate_content"]},
    ]
    (folder / "documents.jsonl").write_text("".join(json.dumps(d) + "\n" for d in docs), encoding="utf-8")
    with gzip.open(folder / "segments.jsonl.gz", "wt", encoding="utf-8") as out:
        for p in passages:
            out.write(json.dumps(p) + "\n")
    return folder


def passage(doc, index, text, start, refs=(), region="speech"):
    return {"doc_id": doc, "segment_id": f"{doc}:{index:06d}", "segment_index": index, "region": region, "start_seconds": start,
            "text_normalized": text, "cue_offsets": [[0, start], [len(text) // 2, start + 30]], "scripture_references": list(refs)}


class EvidenceTests(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        ref = {"book": "Obadiah", "chapter": 1, "first_verse": 18, "last_verse": None, "heard_as": "Obadiah 1 18", "verified": True}
        self.corpus = corpus(Path(folder.name), [
            passage("youtube:aaaaaaaaaaa", 0, "shalom all praise to the most high we talk about edom today", 10),
            passage("youtube:aaaaaaaaaaa", 1, "read obadiah the house of esau for stubble edom is red the edomites are edom", 600, [ref]),
            passage("youtube:aaaaaaaaaaa", 2, "edom sung in the intro", 0, region="pre_speech"),
            passage("youtube:bbbbbbbbbbb", 0, "edom edom edom edom", 5),
        ])

    def test_pack_quotes_the_teaching_passage_with_its_time(self):
        edom, esau = evidence.pack_many(self.corpus, [("Edom", ["Edomites"]), ("Esau", [])], excerpts=5, verses=3)
        self.assertEqual((edom["recordings"], edom["mentions"]), (1, 4))  # duplicate and intro left out
        self.assertEqual(len(edom["excerpts"]), 1)
        first = edom["excerpts"][0]
        self.assertIn("obadiah", first["text"])  # the passage citing scripture, not the greeting
        self.assertEqual(first["seconds"], 630)
        self.assertTrue(first["url"].endswith("&t=630s"))
        self.assertEqual(edom["taught_alongside"], [{"chapter": "Obadiah 1", "passages": 1}])
        self.assertEqual(esau["recordings"], 1)
        self.assertGreater(edom["kjv_verse_count"], 50)
        self.assertTrue(all("Edom" in v["text"] or "Edomites" in v["text"] for v in edom["kjv_verses"]))

    def test_longest_form_wins_where_forms_overlap(self):
        edom, phrase = evidence.pack_many(self.corpus, [("edom", []), ("edom is red", [])], excerpts=5, verses=0)
        self.assertEqual(phrase["mentions"], 1)
        # "we talk about edom" and "are edom"; "edomites" is another word, "edom is red" the phrase's.
        self.assertEqual(edom["mentions"], 2)


class DraftTests(unittest.TestCase):
    def test_lists_and_requests(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "terms.tsv"
            path.write_text("# comment\nEdom\tEdomite; Edomites\nZion\n\n", encoding="utf-8")
            self.assertEqual(draft.read_list(path), [("Edom", ["Edomite", "Edomites"]), ("Zion", [])])
        params = draft.request_params("glossary", {"term": "Edom", "excerpts": []})
        self.assertEqual(params["model"], "claude-opus-5")
        self.assertEqual(params["output_config"]["format"]["schema"], draft.GLOSSARY_SCHEMA)
        self.assertEqual(params["system"][0]["cache_control"], {"type": "ephemeral"})
        self.assertEqual(draft.slugify("The Twelve Tribes of Israel!"), "the-twelve-tribes-of-israel")

    def test_glossary_drafts_never_replace_reviewed_entries(self):
        with tempfile.TemporaryDirectory() as folder:
            original = draft.GLOSSARY
            draft.GLOSSARY = Path(folder) / "glossary.json"
            try:
                draft.GLOSSARY.write_text(json.dumps({"about": "", "entries": [{"term": "Edom", "slug": "edom", "definition": "reviewed"}]}), encoding="utf-8")
                pack = {"recordings": 3, "excerpts": [{"id": "E1", "title": "T", "video": "aaaaaaaaaaa", "seconds": 12.7}]}
                report = []
                added = draft.write_glossary([
                    ({"term": "Edom", "aliases": [], "definition": "new", "scripture": [], "moments": [], "notes_for_reviewer": ""}, pack),
                    ({"term": "Zion", "aliases": ["Sion"], "definition": "d", "scripture": ["Psalms 2:6"], "moments": ["E1", "E9"], "notes_for_reviewer": ""}, pack),
                ], report)
                data = json.loads(draft.GLOSSARY.read_text(encoding="utf-8"))
            finally:
                draft.GLOSSARY = original
        self.assertEqual(added, 1)
        self.assertEqual([e["definition"] for e in data["entries"]], ["reviewed", "d"])
        self.assertEqual(data["entries"][1]["taught"], [{"title": "T", "video": "aaaaaaaaaaa", "seconds": 12}])


if __name__ == "__main__":
    unittest.main()

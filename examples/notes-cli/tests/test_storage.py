import json
import tempfile
import unittest
from pathlib import Path

from src import storage


class TestStorage(unittest.TestCase):
    def test_load_returns_empty_when_the_file_is_absent(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(storage.load(Path(tmp) / "missing.json"), [])

    def test_save_then_load_round_trips(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "notes.json"
            storage.save(path, [{"id": 1, "title": "a"}])
            self.assertEqual(storage.load(path), [{"id": 1, "title": "a"}])

    def test_save_leaves_no_temp_files_behind(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "notes.json"
            storage.save(path, [{"id": 1}])
            self.assertEqual([p.name for p in Path(tmp).iterdir()], ["notes.json"])

    def test_save_replaces_rather_than_appends(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "notes.json"
            storage.save(path, [{"id": 1}])
            storage.save(path, [{"id": 2}])
            self.assertEqual(json.loads(path.read_text()), [{"id": 2}])


if __name__ == "__main__":
    unittest.main()

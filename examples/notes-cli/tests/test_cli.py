import io
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

from src.cli import main


class TestCli(unittest.TestCase):
    def run_cli(self, tmp: str, *argv: str) -> str:
        buffer = io.StringIO()
        with redirect_stdout(buffer):
            main(["--store", str(Path(tmp) / "notes.json"), *argv])
        return buffer.getvalue()

    def test_add_then_list_shows_the_note(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.run_cli(tmp, "add", "buy bread")
            self.assertIn("buy bread", self.run_cli(tmp, "list"))

    def test_list_on_an_empty_store_says_so(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertIn("no notes", self.run_cli(tmp, "list"))


if __name__ == "__main__":
    unittest.main()

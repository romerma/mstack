import unittest

from src.notes import Note


class TestNote(unittest.TestCase):
    def test_ids_increment_from_the_existing_set(self):
        self.assertEqual(Note.new([], "first").id, 1)
        self.assertEqual(Note.new([{"id": 4}, {"id": 2}], "next").id, 5)

    def test_created_at_is_iso_8601_utc(self):
        self.assertTrue(Note.new([], "t").created_at.endswith("+00:00"))

    def test_a_note_is_immutable(self):
        note = Note.new([], "t")
        with self.assertRaises(Exception):
            note.title = "changed"

    def test_serialization_keeps_every_field(self):
        self.assertEqual(
            set(Note.new([], "t", "b").to_dict()), {"id", "title", "body", "created_at"}
        )


if __name__ == "__main__":
    unittest.main()

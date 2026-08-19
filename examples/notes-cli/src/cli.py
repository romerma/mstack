"""Notes CLI. Deliberately small: this repository exists to exercise mstack."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import storage
from .notes import Note

DEFAULT_STORE = Path.home() / ".notes-cli" / "notes.json"


def cmd_add(args: argparse.Namespace) -> int:
    notes = storage.load(args.store)
    note = Note.new(notes, args.title, args.body)
    notes.append(note.to_dict())
    storage.save(args.store, notes)
    print(f"added {note.id}: {note.title}")
    return 0


def cmd_list(args: argparse.Namespace) -> int:
    notes = storage.load(args.store)
    if not notes:
        print("no notes")
        return 0
    for note in notes:
        print(f"{note['id']:>3}  {note['created_at']}  {note['title']}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="notes")
    parser.add_argument("--store", type=Path, default=DEFAULT_STORE)
    subparsers = parser.add_subparsers(dest="command", required=True)

    add = subparsers.add_parser("add")
    add.add_argument("title")
    add.add_argument("--body", default="")
    add.set_defaults(func=cmd_add)

    listing = subparsers.add_parser("list")
    listing.set_defaults(func=cmd_list)

    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())

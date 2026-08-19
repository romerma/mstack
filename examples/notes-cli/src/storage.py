"""Atomic JSON persistence for notes."""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path


def load(path: Path) -> list[dict]:
    """Return the stored notes, or an empty list when the file is absent."""
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def save(path: Path, notes: list[dict]) -> None:
    """Write notes atomically.

    A partial write here loses every note, not just the one being added, so the
    payload lands in a temp file on the same filesystem and is renamed over the
    target. Rename is atomic within a filesystem; write-in-place is not.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    handle = tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", dir=path.parent, delete=False
    )
    try:
        with handle:
            json.dump(notes, handle, indent=2)
        os.replace(handle.name, path)
    except BaseException:
        Path(handle.name).unlink(missing_ok=True)
        raise

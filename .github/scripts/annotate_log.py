#!/usr/bin/env python3
"""Turns a failed step's log into workflow annotations.

The annotations show up in the run summary and through the check-runs API
(`gh api repos/<owner>/<repo>/check-runs/<job id>/annotations`), so a failure can be read without
downloading the raw job log.

usage: annotate_log.py <log file> <title>
"""
import re
import sys

DIGEST_LIMIT = 12_000
TAIL_LIMIT = 16_000
TAIL_LINES = 150

ERROR_LINE = re.compile(
    r"^e: |error:|\bFAILED\b|What went wrong|Caused by|Unresolved reference|Execution failed|"
    r"AAPT|Manifest merger|Could not (resolve|find|get)|No such file|cannot find|undefined:",
    re.IGNORECASE,
)
BLOCK_LINE = re.compile(r"What went wrong|\bFAILED\b|Caused by")


def escape_data(text: str) -> str:
    return text.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")


def escape_property(text: str) -> str:
    return escape_data(text).replace(":", "%3A").replace(",", "%2C")


def digest(lines):
    out, seen, i = [], set(), 0
    while i < len(lines):
        line = lines[i].rstrip()
        if ERROR_LINE.search(line) and line not in seen:
            seen.add(line)
            out.append(line[:500])
            if BLOCK_LINE.search(line):
                # the explanation follows the headline: keep a few lines of it
                for follow in lines[i + 1 : i + 10]:
                    follow = follow.rstrip()
                    if follow and follow not in seen:
                        seen.add(follow)
                        out.append(follow[:500])
        i += 1
    text = "\n".join(out)
    return text[:DIGEST_LIMIT]


def main() -> int:
    path, title = sys.argv[1], sys.argv[2]
    try:
        with open(path, encoding="utf-8", errors="replace") as handle:
            lines = handle.read().splitlines()
    except OSError as error:
        lines = [f"cannot read {path}: {error}"]

    found = digest(lines)
    tail = "\n".join(lines[-TAIL_LINES:])[-TAIL_LIMIT:]
    name = escape_property(title)
    if found:
        print(f"::error title={name} (error lines)::{escape_data(found)}")
    print(f"::error title={name} (end of the log)::{escape_data(tail)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

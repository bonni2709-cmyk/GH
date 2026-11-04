#!/usr/bin/env python3
"""Looks things up in a `uiautomator dump` that is piped in on stdin.

    uitool.py has <regex>      exit status 0 when some node matches
    uitool.py center <regex>   print "x y", the centre of the first node that matches
    uitool.py texts            print every non-empty text / content-desc, one per line

The regex is tried against the attribute text of every <node ...> element (text, resource-id,
package, content-desc, bounds, ...).
"""
import re
import sys


def read_dump():
    return sys.stdin.buffer.read().decode("utf-8", "replace")


def nodes(xml):
    return re.findall(r"<node [^>]*>", xml)


def attribute(node, name):
    match = re.search(r'\b' + name + r'="([^"]*)"', node)
    return match.group(1) if match else ""


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) == 2 and sys.argv[1] == "texts":
        for node in nodes(read_dump()):
            for name in ("text", "content-desc"):
                value = attribute(node, name)
                if value:
                    print(value)
        return 0
    if len(sys.argv) != 3 or sys.argv[1] not in ("has", "center"):
        sys.exit("usage: uitool.py has|center <regex> | texts")
    command, pattern = sys.argv[1], re.compile(sys.argv[2])
    for node in nodes(read_dump()):
        if not pattern.search(node):
            continue
        if command == "has":
            return 0
        bounds = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', node)
        if bounds:
            x1, y1, x2, y2 = (int(v) for v in bounds.groups())
            print((x1 + x2) // 2, (y1 + y2) // 2)
            return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())

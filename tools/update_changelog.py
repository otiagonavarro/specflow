#!/usr/bin/env python3
"""Update CHANGELOG.md from git log.

Reads the existing CHANGELOG.md, finds the latest date entry, fetches all
commits since that date from git log, generates new changelog entries in
Keep a Changelog format, and inserts them after the header.

Usage:
    python tools/update_changelog.py          # update from last entry
    python tools/update_changelog.py --check  # exit 1 if changes needed (CI mode)
"""

import argparse
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
CHANGELOG_PATH = PROJECT_ROOT / "CHANGELOG.md"

HEADER_PATTERN = re.compile(
    r"(O formato é baseado em \[Keep a Changelog\]"
    r"\(https://keepachangelog\.com/pt-BR/1\.0\.0/\)\.\n\n"
    r"---\n\n)"
    r"(## \[)",
    re.DOTALL,
)

DATE_ENTRY_PATTERN = re.compile(r"^## \[(\d{4}-\d{2}-\d{2})\]", re.MULTILINE)


def get_last_changelog_date(content: str) -> str | None:
    """Extract the most recent date from the changelog."""
    matches = DATE_ENTRY_PATTERN.findall(content)
    return max(matches) if matches else None


def run_git_log(since_date: str) -> list[tuple[str, str, str]]:
    """Return list of (date, subject, author) for commits since given date."""
    result = subprocess.run(
        [
            "git",
            "--no-pager",
            "log",
            f"--since={since_date}",
            "--pretty=format:%ad||%s||%an",
            "--date=format:%Y-%m-%d",
            "--no-merges",
        ],
        capture_output=True,
        text=True,
        cwd=str(PROJECT_ROOT),
        check=True,
    )

    commits = []
    for line in result.stdout.strip().split("\n"):
        if not line.strip():
            continue
        parts = line.split("||", 2)
        if len(parts) != 3:
            continue
        commits.append((parts[0], parts[1], parts[2]))

    return commits


def categorize_commit(subject: str) -> str:
    """Categorize a commit subject into Added/Changed/Fixed/Reverted."""
    lower = subject.lower()

    if lower.startswith("revert"):
        return "reverted"

    if lower.startswith("fix"):
        return "fixed"

    added_prefixes = (
        "feat",
        "feature",
        "add ",
        "create ",
        "import ",
        "inclus",
        "schedule ",
        "put config",
        "set created_at",
        "set ",
    )
    if lower.startswith(added_prefixes):
        return "added"

    changed_prefixes = (
        "chore",
        "refactor",
        "style",
        "update ",
        "remove ",
        "restore ",
        "change ",
        "improve ",
        "normalize ",
        "reduce ",
        "increase ",
        "throttle ",
        "clarify ",
        "continue ",
        "restrict ",
        "allow ",
        "align ",
        "transfer ",
    )
    return "changed" if lower.startswith(changed_prefixes) else "added"


def generate_entries(commits_by_date: dict[str, list[tuple[str, str, str]]]) -> str:
    """Generate changelog markdown from commits grouped by date."""
    section_titles = {
        "added": "Added",
        "changed": "Changed",
        "fixed": "Fixed",
        "reverted": "Reverted",
    }

    sorted_dates = sorted(commits_by_date.keys(), reverse=True)
    blocks = []

    for date in sorted_dates:
        commits = commits_by_date[date]
        sections: dict[str, list[str]] = {
            "added": [],
            "changed": [],
            "fixed": [],
            "reverted": [],
        }

        for subject, author in commits:
            author_display = f" — *{author}*" if author else ""
            entry = f"- {subject}{author_display}"
            category = categorize_commit(subject)
            sections[category].append(entry)

        lines = [f"## [{date}]", ""]
        for key in ("added", "changed", "fixed", "reverted"):
            if sections[key]:
                lines.extend(
                    (
                        f"### {section_titles[key]}",
                        "",
                        "\n".join(sections[key]),
                        "",
                    )
                )
        lines.extend(("---", ""))
        blocks.append("\n".join(lines))

    return "\n".join(blocks)


def update_changelog(content: str, new_entries: str) -> str:
    """Insert new entries into the changelog after the header separator."""
    match = HEADER_PATTERN.search(content)
    if not match:
        raise RuntimeError("Could not find changelog header pattern")

    prefix = content[: match.end(1)]
    suffix = content[match.end(1) :]

    return f"{prefix}{new_entries}\n{suffix}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Update CHANGELOG.md from git log")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit 1 if changelog needs updating (for CI)",
    )
    args = parser.parse_args()

    content = CHANGELOG_PATH.read_text(encoding="utf-8")
    last_date = get_last_changelog_date(content)

    if not last_date:
        print("❌ Could not find any date entry in CHANGELOG.md")
        return 1

    commits = run_git_log(last_date)

    commits_by_date: dict[str, list[tuple[str, str, str]]] = defaultdict(list)
    for date, subject, author in commits:
        if date > last_date:
            commits_by_date[date].append((subject, author))

    if not commits_by_date:
        print("✅ CHANGELOG.md is already up to date")
        return 0

    new_entries = generate_entries(commits_by_date)
    updated_content = update_changelog(content, new_entries)

    if args.check:
        if updated_content != content:
            print(
                f"❌ CHANGELOG.md is outdated. "
                f"{len(commits_by_date)} new date(s) with "
                f"{sum(len(v) for v in commits_by_date.values())} commit(s)."
            )
            return 1
        print("✅ CHANGELOG.md is up to date")
        return 0

    CHANGELOG_PATH.write_text(updated_content, encoding="utf-8")
    print(
        f"✅ CHANGELOG.md updated with {len(commits_by_date)} new date(s) "
        f"and {sum(len(v) for v in commits_by_date.values())} commit(s)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

import csv
from pathlib import Path


def read_csv(csv_path: Path) -> list[dict]:
    with open(csv_path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def write_csv(csv_path: Path, rows: list[dict]) -> None:
    fieldnames = list(rows[0].keys())
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def incomplete_topics(rows: list[dict], slug: str | None, limit: int) -> list[dict]:
    if slug:
        for row in rows:
            if row["Slug"] == slug:
                return [row]
        return []
    results = [r for r in rows if not r.get("Completed", "").strip()]
    return results[:limit]


def mark_complete(csv_path: Path, rows: list[dict], slug: str, date_str: str) -> None:
    for row in rows:
        if row["Slug"] == slug:
            row["Completed"] = date_str
            break
    write_csv(csv_path, rows)

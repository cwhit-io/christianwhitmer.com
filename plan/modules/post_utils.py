from datetime import date
from pathlib import Path


def build_frontmatter(row: dict, header_image: str = "") -> str:
    title = row["Title"].replace('"', '\\"')
    tags_raw = row.get("Tags", "[]")
    tags = [
        t.strip()
        for t in tags_raw.strip("[]").replace("'", "").replace('"', "").split(", ")
        if t.strip()
    ]
    description = row["Description"].replace('"', '\\"')
    post_date = row.get("Date", str(date.today()))
    tags_inline = "[" + ", ".join(f'"{t}"' for t in tags) + "]"
    lines = [
        "---",
        f'title: "{title}"',
        f"date: {post_date}",
        f'description: "{description}"',
        f'author: "{row["Author"]}"',
        f"tags: {tags_inline}",
    ]
    if header_image:
        lines.append(f'headerImage: "{header_image}"')
    lines.append("---")
    return "\n".join(lines)


def create_post(row: dict, body: str, header_image: str = "") -> Path:
    slug = row["Slug"]
    post_dir = Path(__file__).parent.parent.parent / "src" / "content" / "blog" / slug
    post_dir.mkdir(parents=True, exist_ok=True)
    post_file = post_dir / "index.md"
    frontmatter = build_frontmatter(row, header_image)
    content = f"{frontmatter}\n\n{body}\n"
    post_file.write_text(content, encoding="utf-8")
    return post_file

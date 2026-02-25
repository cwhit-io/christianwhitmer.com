"""
run.py - Generate church tech blog posts using the Monica AI API.

Usage:
    python run.py                     # next incomplete topic
    python run.py --slug <slug>       # specific topic by slug
    python run.py --limit 3           # process up to 3 incomplete topics
    python run.py --test              # dry-run: write placeholder posts, no API calls
    python run.py --test --limit 5    # dry-run for 5 posts

Config (plan/.env):
    MONICA_API_KEY=your_api_key_here
    MONICA_MODEL=gpt-4o

Requirements:
    pip install openai python-dotenv
"""

import os
import sys
import csv
import argparse
import textwrap
from datetime import date
from pathlib import Path

try:
    from openai import OpenAI
except ImportError:
    sys.exit("openai package not found. Run: pip install openai")

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    # Fall back to manual .env parsing if python-dotenv is not installed
    _env_file = Path(__file__).parent / ".env"
    if _env_file.exists():
        for _line in _env_file.read_text().splitlines():
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _v = _line.split("=", 1)
                os.environ.setdefault(_k.strip(), _v.strip().strip('"').strip("'"))

# ---------------------------------------------------------------------------
# Config (read from environment / .env)
# ---------------------------------------------------------------------------

MONICA_BASE_URL = "https://openapi.monica.im/v1"

CSV_PATH = Path(__file__).parent / "church_tech_blog_topics.csv"
BLOG_DIR = Path(__file__).parent.parent / "src" / "content" / "blog"

TEST_BODY = textwrap.dedent("""
    > **TEST MODE** — this post was generated without calling the API.

    ## Introduction

    This is a placeholder body for **{title}**.

    ## Section One

    Lorem ipsum dolor sit amet, consectetur adipiscing elit.

    ## Section Two

    Praesent commodo cursus magna, vel scelerisque nisl consectetur.

    ## Conclusion

    Thanks for reading this test post!
""").strip()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def get_config() -> tuple[str, str]:
    """Return (api_key, model) from environment, exiting if missing."""
    api_key = os.environ.get("MONICA_API_KEY", "").strip()
    model = os.environ.get("MONICA_MODEL", "").strip()

    missing = []
    if not api_key:
        missing.append("MONICA_API_KEY")
    if not model:
        missing.append("MONICA_MODEL")

    if missing:
        sys.exit(
            f"Missing required .env value(s): {', '.join(missing)}\n"
            "Copy plan/.env.example to plan/.env and fill in the values."
        )

    return api_key, model


def read_csv() -> list[dict]:
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def write_csv(rows: list[dict]) -> None:
    fieldnames = list(rows[0].keys())
    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def incomplete_topics(rows: list[dict], slug: str | None, limit: int) -> list[dict]:
    """Return a list of topics to process, respecting --slug and --limit."""
    if slug:
        for row in rows:
            if row["Slug"] == slug:
                return [row]
        return []
    results = [r for r in rows if not r.get("Completed", "").strip()]
    return results[:limit]


def build_prompt(row: dict) -> str:
    tags_raw = row.get("Tags", "")
    tags = tags_raw.strip("[]").replace("'", "").replace('"', "")

    return textwrap.dedent(f"""
        You are a knowledgeable church technology writer. Write a complete, engaging blog post
        for a church tech blog aimed at pastors, church administrators, and ministry leaders.

        Post details:
        - Title: {row["Title"]}
        - Topic area: {row["Topic"]}
        - Description / angle: {row["Description"]}
        - Tags / keywords: {tags}

        Requirements:
        - Length: ~800–1200 words
        - Tone: Warm, practical, and professional — not overly academic
        - Structure: Use Markdown headings (##, ###) to organize sections
        - Include a brief intro that hooks the reader
        - Include 3–5 practical, actionable sections with real-world advice
        - End with an encouraging conclusion
        - Do NOT include the post title as an H1 (it will be in frontmatter)
        - Do NOT include a YAML frontmatter block — output only the body content
        - Do NOT wrap the output in a code fence
    """).strip()


def call_monica(client: OpenAI, model: str, prompt: str) -> str:
    print("  Calling Monica API… ", end="", flush=True)
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
    )
    print("done.")
    return response.choices[0].message.content.strip()


def build_frontmatter(row: dict) -> str:
    title = row["Title"].replace('"', '\\"')
    tags_raw = row.get("Tags", "[]")
    tags = tags_raw.strip("[]").replace("'", "").replace('"', "").split(", ")
    tags_yaml = "\n".join(f'  - "{t.strip()}"' for t in tags if t.strip())
    description = row["Description"].replace('"', '\\"')
    post_date = row.get("Date", str(date.today()))

    header_image = row.get("HeaderImage", "").strip()
    header_line = f'\nheaderImage: "{header_image}"' if header_image else ""

    return textwrap.dedent(f"""
        ---
        title: "{title}"
        date: {post_date}
        description: "{description}"
        author: "{row["Author"]}"
        tags:
        {tags_yaml}{header_line}
        ---
    """).strip()


def create_post(row: dict, body: str) -> Path:
    slug = row["Slug"]
    post_dir = BLOG_DIR / slug
    post_dir.mkdir(parents=True, exist_ok=True)
    post_file = post_dir / "index.md"

    frontmatter = build_frontmatter(row)
    content = f"{frontmatter}\n\n{body}\n"
    post_file.write_text(content, encoding="utf-8")
    return post_file


def mark_complete(rows: list[dict], slug: str) -> None:
    for row in rows:
        if row["Slug"] == slug:
            row["Completed"] = str(date.today())
            break
    write_csv(rows)


def process_topic(
    topic: dict,
    rows: list[dict],
    client: OpenAI | None,
    model: str,
    test: bool,
) -> None:
    print(f"\n  Topic:  {topic['Topic']}")
    print(f"  Title:  {topic['Title']}")
    print(f"  Slug:   {topic['Slug']}")
    print(f"  Date:   {topic['Date']}")

    if test:
        body = TEST_BODY.format(title=topic["Title"])
        print("  [TEST MODE] Using placeholder body.")
    else:
        prompt = build_prompt(topic)
        body = call_monica(client, model, prompt)

    post_path = create_post(topic, body)
    rel = post_path.relative_to(Path(__file__).parent.parent)
    print(f"  Post written → {rel}")

    mark_complete(rows, topic["Slug"])
    print(f"  Marked complete ({date.today()}).")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate church tech blog posts via Monica AI."
    )
    parser.add_argument(
        "--slug",
        help="Process a specific topic by slug (ignores --limit).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=1,
        metavar="N",
        help="Number of incomplete topics to process (default: 1).",
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Dry-run mode: write placeholder posts without calling the API.",
    )
    args = parser.parse_args()

    rows = read_csv()
    topics = incomplete_topics(rows, args.slug, args.limit)

    if not topics:
        if args.slug:
            sys.exit(f"No topic found with slug: {args.slug}")
        else:
            print("All topics are already marked complete. Nothing to do.")
            return

    mode_label = " [TEST MODE]" if args.test else ""
    print(f"\nFound {len(topics)} topic(s) to process.{mode_label}")

    # Only load credentials / create client when not in test mode
    client: OpenAI | None = None
    model = ""
    if not args.test:
        api_key, model = get_config()
        client = OpenAI(api_key=api_key, base_url=MONICA_BASE_URL)
    else:
        model = os.environ.get("MONICA_MODEL", "test")

    confirm = (
        input(f"\nGenerate {len(topics)} post(s){mode_label}? [Y/n] ").strip().lower()
    )
    if confirm == "n":
        print("Aborted.")
        return

    for i, topic in enumerate(topics, 1):
        print(f"\n[{i}/{len(topics)}]")
        process_topic(topic, rows, client, model, args.test)

    print(f"\nAll done! {len(topics)} post(s) created.")


if __name__ == "__main__":
    main()

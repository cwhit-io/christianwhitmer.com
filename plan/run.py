"""
run.py - Generate church tech blog posts using the Monica AI API.

Usage:
    python run.py                     # next incomplete topic
    python run.py --slug <slug>       # specific topic by slug
    python run.py --limit 3           # process up to 3 incomplete topics
    python run.py --test              # dry-run: write placeholder posts, no API calls
    python run.py --test --limit 5    # dry-run for 5 posts
    python run.py --skip-image        # generate post only, skip header image

Config (plan/.env):
    MONICA_API_KEY=your_api_key_here
    MONICA_MODEL=gpt-4o
    MONICA_FLUX_MODEL=flux_pro    # flux_schnell | flux_dev | flux_pro

Requirements:
    pip install openai python-dotenv requests
"""

import os
import sys
import argparse
from datetime import date
from pathlib import Path

from modules.ai_config import get_config
from modules.csv_utils import read_csv, incomplete_topics, mark_complete
from modules.prompt_templates import build_prompt
from modules.image_gen import generate_header_image, MONICA_BASE_URL
from modules.post_utils import create_post
from modules.validation import validate_post


try:
    from openai import OpenAI
except ImportError:
    sys.exit("openai package not found. Run: pip install openai")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CSV_PATH = Path(__file__).parent / "church_tech_blog_topics.csv"
BLOG_DIR = Path(__file__).parent.parent / "src" / "content" / "blog"

TEST_BODY = (
    "> **TEST MODE** — this post was generated without calling the API.\n\n"
    "## Introduction\n\nThis is a placeholder body for **{title}**.\n\n"
    "## Section One\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit.\n\n"
    "## Section Two\n\nPraesent commodo cursus magna, vel scelerisque nisl consectetur.\n\n"
    "## Conclusion\n\nThanks for reading this test post!"
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def call_monica(client: OpenAI, model: str, prompt: str) -> str:
    print(f"  Calling Monica API ({model})… ", end="", flush=True)
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
    )
    print("done.")
    return response.choices[0].message.content.strip()


def process_topic(
    topic: dict,
    rows: list[dict],
    client: OpenAI | None,
    api_key: str,
    model: str,
    flux_model: str,
    test: bool,
    skip_image: bool,
) -> None:
    print(f"\n  Topic:  {topic['Topic']}")
    print(f"  Title:  {topic['Title']}")
    print(f"  Slug:   {topic['Slug']}")
    print(f"  Date:   {topic['Date']}")

    post_dir = BLOG_DIR / topic["Slug"]
    post_dir.mkdir(parents=True, exist_ok=True)

    if test:
        body = TEST_BODY.format(title=topic["Title"])
        header_image = ""
        print("  [TEST MODE] Skipping API calls.")
    else:
        # Generate header image first (unless skipped)
        header_image = ""
        if not skip_image:
            header_image = generate_header_image(api_key, flux_model, topic, post_dir)
        else:
            print("  Skipping header image generation.")

        # Generate post body
        prompt = build_prompt(topic)
        body = call_monica(client, model, prompt)

        # Validate post
        warnings = validate_post(body, topic)
        if warnings:
            print("  ⚠️  Validation warnings:")
            for w in warnings:
                print(f"      - {w}")

    post_path = create_post(topic, body, header_image)
    rel = post_path.relative_to(Path(__file__).parent.parent)
    print(f"  Post written → {rel}")

    mark_complete(CSV_PATH, rows, topic["Slug"], str(date.today()))
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
    parser.add_argument(
        "--skip-image",
        action="store_true",
        help="Skip header image generation (post only).",
    )
    args = parser.parse_args()

    rows = read_csv(CSV_PATH)
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
    api_key = model = flux_model = ""
    if not args.test:
        api_key, model, flux_model = get_config()
        client = OpenAI(
            api_key=api_key, base_url=MONICA_BASE_URL
        )  # MONICA_BASE_URL from module.image_gen
        print(f"Using model: {model}, image model: {flux_model}")
    else:
        model = os.environ.get("MONICA_MODEL", "test")
        flux_model = os.environ.get("MONICA_FLUX_MODEL", "flux_schnell")

    confirm = (
        input(f"\nGenerate {len(topics)} post(s){mode_label}? [Y/n] ").strip().lower()
    )
    if confirm == "n":
        print("Aborted.")
        return

    for i, topic in enumerate(topics, 1):
        print(f"\n[{i}/{len(topics)}]")
        process_topic(
            topic, rows, client, api_key, model, flux_model, args.test, args.skip_image
        )

    print(f"\nAll done! {len(topics)} post(s) created.")


if __name__ == "__main__":
    main()

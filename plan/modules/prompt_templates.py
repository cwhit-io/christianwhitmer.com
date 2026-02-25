import textwrap


# Keep the example post short and style-focused so it teaches voice without biasing topics too hard.
# (Cybersecurity is fine, but we avoid overly security-specific patterns that can “bleed” into other posts.)
EXAMPLE_POST = textwrap.dedent("""
    You lock the front doors and count the offering with care—but what about the digital doors to your church? From email scams to lost laptops, ministries face real cyber threats, often with fewer resources. The good news: a handful of practical habits can dramatically reduce risk and protect the people you serve. Here’s how to strengthen your church’s cybersecurity without becoming a full-time IT professional.

    ## Why Cybersecurity Matters for Ministries

    Churches steward sensitive information every day—donor records, prayer requests, counseling notes, children’s check-in details, and volunteer background checks. A breach can harm trust, disrupt ministry operations, and put people at risk. Cybersecurity isn’t about fear; it’s about faithful stewardship through simple, repeatable habits.

    ## 1) Lock Down Accounts with Strong Access Controls

    Think of accounts (email, giving, finance systems, cloud storage, your church management system) like master keys. Protect them like you would a key ring that opens every room.

    - Turn on multi-factor authentication (MFA) everywhere. MFA blocks most account takeovers even if a password leaks.
    - Use a password manager so staff aren’t reusing passwords across tools.
    - Right-size permissions by role, and review access quarterly.

    ## Where to Begin

    - This week: Turn on MFA for email and finance accounts.
    - Next: Set up a password manager and remove shared logins.
    - Then: Write a one-page “what to do if we get hacked” plan and make sure backups are real by testing one restore.

    ## Encouragement for the Journey

    Cybersecurity doesn’t have to be intimidating or expensive. Start with basics, involve your team, and celebrate progress. When you lock your digital doors and teach wise habits, you create a safer space for people to worship, serve, and grow.
""").strip()


def _clean_tags(tags_raw: str) -> str:
    """
    Normalize tags from CSV-ish formats like:
    - "['a', 'b']"
    - '["a","b"]'
    - "a, b"
    """
    if not tags_raw:
        return ""
    tags = str(tags_raw).strip()
    tags = tags.strip("[]").replace("'", "").replace('"', "")
    return ", ".join([t.strip() for t in tags.split(",") if t.strip()])


def build_prompt(row: dict) -> str:
    """
    Build an instruction prompt that:
    - stays MDX-safe
    - allows rare brand mentions without endorsements
    - requires a clear structure with examples
    - uses a conditional implementation section (plan vs. next step/checklist)
    """
    tags = _clean_tags(row.get("Tags", ""))

    # Keep the example from bloating prompts (token cost + instruction collisions).
    example_snippet = EXAMPLE_POST
    if len(example_snippet) > 2200:
        example_snippet = example_snippet[:2200].rstrip()

    title = row.get("Title", "").strip()
    topic = row.get("Topic", "").strip()
    desc = row.get("Description", "").strip()

    return textwrap.dedent(f"""
        You are a church technology writer creating practical, encouraging posts for pastors,
        church administrators, and volunteer tech leads (not IT professionals).

        Study and mimic the structure, tone, and depth of this example:

        ---
        {example_snippet}
        ---

        POST DETAILS (use these as your source of truth):
        - Title: {title}
        - Topic area: {topic}
        - Description: {desc}
        - Tags: {tags}

        TARGET READER:
        - Tech comfort: Beginner to intermediate
        - Constraints: Limited budget, small team, wearing multiple hats
        - Goal: Practical guidance that works on Sunday morning (not enterprise architecture)

        OUTPUT FORMAT (MDX-safe Markdown):
        - Output Markdown only (no YAML frontmatter; no H1 title; the title is handled elsewhere).
        - Do NOT wrap the entire post in code fences.
        - Avoid raw HTML tags and JSX/MDX components (no <div>, <br>, <Callout>, etc.).
        - Avoid curly braces that could be interpreted as MDX/JSX (no {{like this}}).
        - Use headings (##, ###), paragraphs, and bullet lists.
        - Links: standard Markdown links only (no bare URLs).

        HARD REQUIREMENTS:
        - Length: 1000–1400 words (minimum 800, maximum 1600).
        - Opening: 1–2 paragraphs that start with a real ministry scenario + a promise.
          Avoid generic openers like “In today’s digital world…”
        - Include a “Why this matters” section (1 paragraph) with stakes, not fear-mongering.
        - Include 3–5 main sections using ## headings. Each section must have:
          - A clear, descriptive heading (not clever or vague)
          - 2–4 actionable bullets
          - At least one concrete scenario/example from church life
        - Implementation guidance (choose ONE, based on fit):
          - If the topic is process-heavy (rollout, migration, training, security posture, standardization):
            include ## A 30-Day Starter Plan OR ## Where to Begin OR ## Quick Wins This Week.
          - If the topic is NOT process-heavy:
            include ## Next Step OR ## Checklist (3–8 bullets).
        - End with an encouraging conclusion (2–3 paragraphs) that normalizes the challenge and points forward.

        TONE:
        - Conversational but authoritative (helpful friend, not a consultant).
        - Use “you” / “your church” naturally.
        - Analogies are welcome when they clarify.
        - Encourage without being alarmist, preachy, or salesy.

        BRANDS (rare, neutral, non-promotional):
        - Prefer vendor-neutral language.
        - Mention specific brands ONLY when it clarifies an example or reduces ambiguity.
        - If you mention a brand, list 2–4 options neutrally (no endorsements, no “best”).
          Example: “Common options include Planning Center, Breeze, and Realm.”
        - Do not invent pricing, features, or guarantees. No affiliate language. No vendor favoritism.

        TECHNICAL ACCURACY:
        - Spell out acronyms on first use, then use acronym (e.g., “Multi-factor authentication (MFA)”).
        - Don’t claim legal compliance (e.g., HIPAA-compliant) unless explicitly supported in the prompt.
        - Avoid version numbers unless absolutely critical.

        DO NOT:
        - Use corporate jargon (“leverage”, “synergize”, “utilize”, “ecosystem”, “solutions”).
        - Include placeholder text (TODO, TK, [insert…]).
        - Write shallow listicles without explanatory depth.
        - End with engagement bait (“What are your thoughts?”).

        SELF-CHECK BEFORE YOU OUTPUT:
        - Every section answers what/why/how (not just why).
        - Bullets are specific actions, not vague suggestions.
        - Examples feel like real church operations (Sunday morning, volunteers, finance, kids, AV).
        - Headings are scannable and descriptive.
        - Output is MDX-safe (no HTML/JSX; no curly braces).
    """).strip()


def build_image_prompt(row: dict) -> str:
    """
    Image prompt for an editorial hero image. Optimized to avoid text/logos/screens
    that frequently ruin hero images.
    """
    title = row.get("Title", "").strip()
    topic = row.get("Topic", "").strip()
    desc = row.get("Description", "").strip()

    return textwrap.dedent(f"""
        Professional editorial hero image for a church technology blog post.

        Topic: {topic}
        Title: {title}
        Context: {desc}

        Style:
        - Photorealistic editorial photography
        - Modern, warm lighting, clean composition
        - Approachable, hopeful, practical mood (not corporate or sterile)
        - Contemporary church environment with subtle technology cues
        - Prefer environmental scenes over isolated objects

        Avoid:
        - Any text, words, letters, signage, captions, overlays, watermarks
        - Readable screens (phones, laptops, projectors, monitors) or UI elements
        - Brand logos, trademarks, or identifiable product branding
        - Staged “stock photo” vibes (handshakes, boardrooms, forced posing)
        - Overly literal interpretations (e.g., giant padlock hovering over a church)

        Technical requirements:
        - Aspect ratio 16:9 (1344x768)
        - High quality, suitable as a website hero/header image

        Visual reference:
        - Documentary/editorial look: authentic church setting + subtle tech, calm and competent.
    """).strip()

import textwrap


# Representative excerpt from a hand-crafted post — teaches voice, structure, AND formatting conventions.
# Shows: bold inline text, bold bullet leads, ### sub-sections, --- separators, blockquote examples, short paragraphs.
EXAMPLE_POST = textwrap.dedent("""
    It's five minutes before service. A first-time visitor walks up to your Welcome Desk and asks, "Do you take online giving?" Whether your church is just starting with digital giving or cleaning up a patchwork of tools, the goal is the same: **make giving easy for people and safe for your ministry**.

    This guide will help you choose practical giving paths, reduce friction, and protect donor data—all without turning you into an IT professional.

    ## Why this matters

    Generosity is part of worship, not just a financial transaction. When giving feels confusing, slow, or risky, people hesitate—even if they want to support the mission.

    Clear, secure digital paths:

    - Let busy families give from their seats
    - Support recurring giving for steadier planning
    - Meet people where they already are: **on their phones**

    ---

    ## Choose simple giving paths people will actually use

    Aim for **2–3 primary channels** that fit your congregation, then present them consistently in print, on screen, and online.

    ### 1) A clean giving page with a short, memorable link

    - Use something like **`yourchurch.org/give`** and ensure it's mobile-friendly
    - Offer **one-time** and **recurring** gifts with a few clearly named funds: *General, Missions, Benevolence*

    ### 2) Text-to-give or QR codes for fast entry

    - **Text-to-give:** put the number on slides and seatback cards
    - **QR codes:** go straight to the giving page (no detours)

    > **Example:** During Christmas services, you run a slide with `yourchurch.org/give` and a QR code. Greeters hand out cards with the same link, and the bulletin points to the simplest path.

    ---

    ## A 30-Day Starter Plan

    ### Week 1 — Decide and prepare

    - Choose your platform (e.g., Planning Center Giving, Tithe.ly, Pushpay, Breeze)
    - Enable payment methods: **card + ACH**
    - Set staff roles and enable **MFA**

    ### Week 2 — Build and secure

    - **Publish the short link** and create QR codes that land directly on the giving page
    - Test on multiple phones and networks

    ---

    ## Encouragement for the journey

    Moving to digital tithing isn't about replacing envelopes; it's about removing barriers to generosity.

    Start small, test with real people, and celebrate progress. Over time, online giving becomes a smooth, trustworthy part of your worship rhythm—freeing you to focus on the mission and the people you serve.
""").strip()


def _clean_tags str:
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

    # Preserve the full example — it's a carefully crafted formatting model.
    example_snippet = EXAMPLE_POST
    if len(example_snippet) > 3200:
        example_snippet = example_snippet[:3200].rstrip()

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

        FORMATTING (apply throughout):
        - Use **bold** to highlight key terms, action phrases, and critical warnings on first meaningful use.
          Example: "Turn on **multi-factor authentication (MFA)**" or "**Never store card numbers in a spreadsheet.**"
        - Bold sparingly—aim for 2–4 bold phrases per major section, not every sentence.
        - Separate paragraphs with a blank line. Never run two paragraphs together.
        - Keep paragraphs short: 3–5 sentences max. Break long explanations into two paragraphs.
        - In bullet lists, bold the lead phrase or action before the explanation.
          Example: "- **Enable MFA on all admin accounts.** This blocks most account takeovers even if a password leaks."
        - Use a blank line before and after every bullet list, heading, and example block.
        - Avoid walls of text—if a paragraph exceeds 5 sentences, split it.

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
        - Formatting: key terms and action phrases are bolded in bullets and body text.
        - No paragraph runs longer than 5 sentences; no two paragraphs are merged without a blank line.
        - Every bullet list has a blank line before and after it.
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

def validate_post(body: str, row: dict) -> list[str]:
    warnings = []
    word_count = len(body.split())
    if word_count < 800:
        warnings.append(f"Post is only {word_count} words (target: 1000-1400)")
    elif word_count > 1600:
        warnings.append(f"Post is {word_count} words (may be too long)")
    heading_count = body.count("\n##")
    if heading_count < 3:
        warnings.append(
            f"Only {heading_count} main sections (## headings) — target 3-5"
        )
    if "```" in body and body.count("```") % 2 != 0:
        warnings.append("Unclosed code fence detected")
    placeholders = ["[insert", "[add", "[example", "TODO", "TK", "[your ", "[specific"]
    for p in placeholders:
        if p.lower() in body.lower():
            warnings.append(f"Possible placeholder text: '{p}'")
    generic_starts = [
        "in today's digital world",
        "in today's modern world",
        "in the modern world",
        "technology is changing",
        "as we all know",
        "in this day and age",
        "in recent years",
    ]
    first_150 = body[:150].lower()
    for g in generic_starts:
        if g in first_150:
            warnings.append(f"Generic opening detected: '{g}'")
    jargon = ["leverage", "synergize", "utilize", "ecosystem", "paradigm", "holistic"]
    body_lower = body.lower()
    found_jargon = [j for j in jargon if j in body_lower]
    if found_jargon:
        warnings.append(f"Corporate jargon detected: {', '.join(found_jargon)}")
    bait_phrases = ["what are your thoughts", "let us know", "share in the comments"]
    for phrase in bait_phrases:
        if phrase in body_lower:
            warnings.append(f"Engagement bait detected: '{phrase}'")
    title = row["Title"]
    if body.startswith(f"# {title}") or body.startswith(f"#{title}"):
        warnings.append("Title appears as H1 in body (should be frontmatter only)")
    return warnings

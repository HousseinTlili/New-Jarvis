import re

def clean_text_for_speech(text: str) -> str:
    """
    Strip Markdown formatting, code blocks, and other non-pronounceable
    symbols so edge-tts reads the text naturally.
    """
    if not text:
        return "I have generated the response for you."

    # Remove fenced code blocks (``` ... ```)
    text = re.sub(r"```[\s\S]*?```", " I have generated the output for you. ", text)

    # Remove inline code backticks (keep inner text)
    text = re.sub(r"`([^`]*)`", r"\1", text)

    # Remove Markdown bold/italic formatting
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"__(.+?)__",      r"\1", text)
    text = re.sub(r"\*(.+?)\*",      r"\1", text)
    text = re.sub(r"_(.+?)_",        r"\1", text)

    # Remove Markdown headers (# Heading)
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)

    # Remove horizontal rules
    text = re.sub(r"^[-*_]{3,}\s*$", "", text, flags=re.MULTILINE)

    # Remove Markdown links: [label](url) -> label
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)

    # Remove bare URLs
    text = re.sub(r"https?://\S+", "", text)

    # Remove blockquotes
    text = re.sub(r"^>+\s?", "", text, flags=re.MULTILINE)

    # Convert standalone math/operator symbols to spoken words
    text = re.sub(r"\s\+\s",  " plus ",   text)
    text = re.sub(r"\s-\s",   " minus ",  text)
    text = re.sub(r"\s=\s",   " equals ", text)
    text = re.sub(r"\s>\s",   " greater than ", text)
    text = re.sub(r"\s<\s",   " less than ",    text)

    # Strip remaining special characters that add no spoken value
    text = re.sub(r"[*_~|\\^]", "", text)

    # Strip emojis and other non-ASCII symbols
    text = re.sub(r"[^\x00-\x7F]+", "", text)

    # Collapse multiple blank lines or spaces
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r" {2,}",  " ",    text)
    text = text.strip()

    if not text:
        return "I have generated the response for you."

    return text

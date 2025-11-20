# backend/app/core/formatters.py
from typing import Dict, List, Any
from bs4 import BeautifulSoup
import markdown as md
from app.core.parse_utils import extract_json_from_text

def parse_llm_output(raw: str) -> Dict[str, Any]:
    """
    Return canonical structure:
    {
      "title": Optional[str],
      "summary": Optional[str],
      "sections": [
        {"heading": "...", "content_md": "..."},
        ...
      ]
    }
    """
    # Try direct JSON extraction first
    parsed = extract_json_from_text(raw)
    if parsed:
        # If parsed looks like a section object, normalize to structure
        if "sections" in parsed and isinstance(parsed["sections"], list):
            return {
                "title": parsed.get("title"),
                "summary": parsed.get("summary"),
                "sections": [
                    {"heading": s.get("heading") or "", "content_md": s.get("content_md") or ""}
                    for s in parsed["sections"]
                ],
            }
        # If returned a single section dict
        if "heading" in parsed and "content_md" in parsed:
            return {"title": parsed.get("title"), "summary": parsed.get("summary"), "sections": [
                {"heading": parsed["heading"], "content_md": parsed["content_md"]}
            ]}

    # Fallback: treat raw as Markdown, convert to HTML to split
    return _markdown_to_structure(raw)


def _markdown_to_structure(raw_md: str) -> Dict[str, Any]:
    html = md.markdown(raw_md, extensions=["extra", "nl2br"])
    soup = BeautifulSoup(html, "html.parser")

    title = None
    summary = None
    sections = []

    h1 = soup.find("h1")
    if h1:
        title = h1.get_text().strip()
        h1.decompose()

    # first paragraph as summary
    p = soup.find("p")
    if p:
        summary = p.get_text().strip()
        p.decompose()

    # collect h2/h3 sections; if none, make a single section
    headings = soup.find_all(["h2", "h3"])
    if headings:
        for h in headings:
            heading_text = h.get_text().strip()
            content_html = []
            for sib in h.next_siblings:
                if getattr(sib, "name", None) in ("h2", "h3"):
                    break
                content_html.append(str(sib))
            content_md = _html_to_simple_md("".join(content_html))
            sections.append({"heading": heading_text, "content_md": content_md})
    else:
        # everything left -> single section
        content_md = _html_to_simple_md(str(soup))
        sections.append({"heading": title or "Document", "content_md": content_md})

    return {"title": title, "summary": summary, "sections": sections}


def _html_to_simple_md(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    lines = []
    # paragraphs
    for p in soup.find_all("p"):
        txt = p.get_text().strip()
        if txt:
            lines.append(txt)
    # lists
    for ul in soup.find_all(["ul", "ol"]):
        for li in ul.find_all("li"):
            t = li.get_text().strip()
            if t:
                lines.append("- " + t)
    # fallback: text
    if not lines:
        txt = soup.get_text().strip()
        if txt:
            lines.append(txt)
    return "\n\n".join(lines)

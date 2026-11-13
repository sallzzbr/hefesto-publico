#!/usr/bin/env python3
"""Inject SEO meta tags into HTML module files.

Usage:
    python atualizar_seo.py <html_path> <seo_json_path> [--default-image URL]

The SEO JSON can be either:
- a single object with title, description, author, url (optional), image (optional);
- a list of objects with the same keys plus file, relative to the SEO JSON path.

For list manifests, the JSON-LD type is derived per page: the course root
(file == "index.html") keeps @type Course; every other page becomes a
LearningResource with isPartOf + a BreadcrumbList derived from the manifest.
An entry can force a type with the optional "type" key.
"""
import json
from pathlib import Path

from bs4 import BeautifulSoup

# Dimensões da arte default de compartilhamento (og-image do curso)
DEFAULT_IMAGE_WIDTH = "1200"
DEFAULT_IMAGE_HEIGHT = "630"


def update_seo(html_path: str, seo_data: dict, default_image: str | None = None) -> None:
    """Inject or update SEO meta tags in an HTML file.

    Args:
        html_path: Path to the HTML file to modify.
        seo_data: Dict with keys: title, description, author, url (optional),
            image (optional), type (optional JSON-LD @type), is_part_of (optional),
            breadcrumb (optional list of {name, item}).
        default_image: og:image fallback when the entry has no "image".
    """
    html_file = Path(html_path)
    soup = BeautifulSoup(html_file.read_text(encoding="utf-8"), "html.parser")
    head = soup.find("head")

    # Title
    title_tag = head.find("title")
    if title_tag:
        title_tag.string = seo_data["title"]
    else:
        title_tag = soup.new_tag("title")
        title_tag.string = seo_data["title"]
        head.append(title_tag)

    # Meta description
    _set_meta(soup, head, "description", seo_data["description"])

    # Open Graph
    _set_meta(soup, head, "og:title", seo_data["title"], is_property=True)
    _set_meta(soup, head, "og:description", seo_data["description"], is_property=True)
    _set_meta(soup, head, "og:type", "website", is_property=True)
    if "url" in seo_data:
        _set_meta(soup, head, "og:url", seo_data["url"], is_property=True)

    image = seo_data.get("image") or default_image
    if image:
        _set_meta(soup, head, "og:image", image, is_property=True)
        if "image" not in seo_data:
            # Dimensões só são conhecidas para a arte default do projeto
            _set_meta(soup, head, "og:image:width", DEFAULT_IMAGE_WIDTH, is_property=True)
            _set_meta(soup, head, "og:image:height", DEFAULT_IMAGE_HEIGHT, is_property=True)
        _set_meta(soup, head, "twitter:card", "summary_large_image")

    # JSON-LD
    for existing in head.find_all("script", type="application/ld+json"):
        existing.decompose()

    jsonld_type = seo_data.get("type", "Course")
    jsonld = {
        "@context": "https://schema.org",
        "@type": jsonld_type,
        "name": seo_data["title"],
        "description": seo_data["description"],
    }
    person = {"@type": "Person", "name": seo_data.get("author", "")}
    if jsonld_type == "Course":
        jsonld["provider"] = person
    else:
        jsonld["author"] = person
        jsonld["inLanguage"] = "pt-BR"
        if "is_part_of" in seo_data:
            jsonld["isPartOf"] = seo_data["is_part_of"]
    _append_jsonld(soup, head, jsonld)

    breadcrumb = seo_data.get("breadcrumb")
    if breadcrumb:
        items = []
        for position, crumb in enumerate(breadcrumb, start=1):
            item = {"@type": "ListItem", "position": position, "name": crumb["name"]}
            if crumb.get("item"):
                item["item"] = crumb["item"]
            items.append(item)
        _append_jsonld(
            soup,
            head,
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": items,
            },
        )

    html_file.write_text(str(soup), encoding="utf-8")


def update_from_seo_file(
    target_path: str, seo_json_path: str, default_image: str | None = None
) -> list[Path]:
    """Update one HTML file or a whole course directory from an SEO JSON file."""
    target = Path(target_path)
    seo_path = Path(seo_json_path)
    seo_data = json.loads(seo_path.read_text(encoding="utf-8"))

    if isinstance(seo_data, dict):
        if target.is_dir():
            raise ValueError("SEO JSON em objeto só pode atualizar um arquivo HTML por vez.")
        update_seo(str(target), seo_data, default_image=default_image)
        return [target]

    if not isinstance(seo_data, list):
        raise ValueError("SEO JSON deve ser um objeto ou uma lista de objetos.")

    enriched = _enrich_manifest_entries(seo_data)
    entries = _select_manifest_entries(target, seo_path, enriched)
    for html_path, entry in entries:
        update_seo(str(html_path), entry, default_image=default_image)

    return [html_path for html_path, _entry in entries]


def _enrich_manifest_entries(seo_data: list[dict]) -> list[dict]:
    """Derive JSON-LD type, isPartOf and breadcrumb for each manifest entry.

    The context (course name/url, module titles) comes from the manifest itself,
    so updating a single file still gets the full breadcrumb chain.
    """
    by_file = {entry.get("file"): entry for entry in seo_data}
    course = by_file.get("index.html")
    course_name = _breadcrumb_name(course["title"]) if course else None
    course_url = course.get("url") if course else None

    enriched = []
    for entry in seo_data:
        item = dict(entry)
        file = item.get("file", "")
        if file == "index.html":
            item.setdefault("type", "Course")
            enriched.append(item)
            continue

        item.setdefault("type", "LearningResource")
        if item["type"] == "LearningResource" and course_name and course_url:
            item.setdefault(
                "is_part_of", {"@type": "Course", "name": course_name, "url": course_url}
            )

        crumbs = []
        if course_name and course_url:
            crumbs.append({"name": course_name, "item": course_url})
        parent_dir = str(Path(file).parent)
        if parent_dir != "." and file != f"{parent_dir}/index.html":
            module_index = by_file.get(f"{parent_dir}/index.html")
            if module_index:
                crumbs.append(
                    {"name": _breadcrumb_name(module_index["title"]), "item": module_index.get("url")}
                )
        crumbs.append({"name": _breadcrumb_name(item["title"])})
        if len(crumbs) >= 2:
            item.setdefault("breadcrumb", crumbs)
        enriched.append(item)

    return enriched


def _breadcrumb_name(title: str) -> str:
    """Short page name for breadcrumbs: drop the ' — contexto | Mimyr' suffixes."""
    return title.split(" — ")[0].split(" | ")[0].strip()


def _append_jsonld(soup, head, data: dict) -> None:
    script_tag = soup.new_tag("script", type="application/ld+json")
    script_tag.string = json.dumps(data, ensure_ascii=False, indent=2)
    head.append(script_tag)


def _select_manifest_entries(target: Path, seo_path: Path, seo_data: list[dict]) -> list[tuple[Path, dict]]:
    entries = [(_manifest_entry_path(seo_path, entry), entry) for entry in seo_data]

    if target.is_dir():
        target_root = target.resolve()
        selected = [
            (html_path, entry)
            for html_path, entry in entries
            if _is_relative_to(html_path.resolve(), target_root)
        ]
    else:
        target_resolved = target.resolve()
        selected = [
            (html_path, entry)
            for html_path, entry in entries
            if html_path.resolve() == target_resolved
        ]

    if not selected:
        raise ValueError(f"Nenhuma entrada de SEO encontrada para {target}")

    return selected


def _manifest_entry_path(seo_path: Path, entry: dict) -> Path:
    if "file" not in entry:
        raise ValueError("Entradas em lista no SEO JSON precisam conter a chave 'file'.")
    return seo_path.parent / entry["file"]


def _is_relative_to(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
    except ValueError:
        return False
    return True


def _set_meta(soup, head, name: str, content: str, is_property: bool = False) -> None:
    """Set or update a <meta> tag."""
    attr = "property" if is_property else "name"
    existing = head.find("meta", attrs={attr: name})
    if existing:
        existing["content"] = content
    else:
        tag = soup.new_tag("meta")
        tag[attr] = name
        tag["content"] = content
        head.append(tag)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Injeta meta tags SEO em HTMLs de curso.")
    parser.add_argument("target", help="Arquivo HTML ou diretório do curso")
    parser.add_argument("seo_json", help="Manifest SEO (objeto ou lista de objetos)")
    parser.add_argument(
        "--default-image",
        default=None,
        help="URL da og:image usada quando a entrada do manifest não define 'image'",
    )
    args = parser.parse_args()

    updated_paths = update_from_seo_file(args.target, args.seo_json, default_image=args.default_image)
    for updated_path in updated_paths:
        print(f"SEO updated: {updated_path}")

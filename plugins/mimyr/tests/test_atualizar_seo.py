"""Tests for atualizar_seo.py."""
import json
import tempfile
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from atualizar_seo import update_from_seo_file, update_seo


MINIMAL_HTML = """<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Old Title</title>
</head>
<body><p>Content</p></body>
</html>"""

SEO_DATA = {
    "title": "APIs para Designers — Mimyr",
    "description": "Entenda APIs, servidores e bancos de dados sem precisar programar.",
    "author": "Antonio Salgado",
    "url": "https://mimyr.dev/ux-e-tecnologia/modulo-1",
}


def test_update_title():
    with tempfile.NamedTemporaryFile(suffix=".html", mode="w", delete=False, encoding="utf-8") as f:
        f.write(MINIMAL_HTML)
        path = f.name
    try:
        update_seo(path, SEO_DATA)
        html = Path(path).read_text(encoding="utf-8")
        assert "<title>APIs para Designers — Mimyr</title>" in html
    finally:
        Path(path).unlink()


def test_update_meta_description():
    with tempfile.NamedTemporaryFile(suffix=".html", mode="w", delete=False, encoding="utf-8") as f:
        f.write(MINIMAL_HTML)
        path = f.name
    try:
        update_seo(path, SEO_DATA)
        html = Path(path).read_text(encoding="utf-8")
        assert 'name="description"' in html
        assert "Entenda APIs" in html
    finally:
        Path(path).unlink()


def test_update_open_graph():
    with tempfile.NamedTemporaryFile(suffix=".html", mode="w", delete=False, encoding="utf-8") as f:
        f.write(MINIMAL_HTML)
        path = f.name
    try:
        update_seo(path, SEO_DATA)
        html = Path(path).read_text(encoding="utf-8")
        assert 'property="og:title"' in html
        assert 'property="og:description"' in html
        assert 'property="og:url"' in html
    finally:
        Path(path).unlink()


def test_update_jsonld():
    with tempfile.NamedTemporaryFile(suffix=".html", mode="w", delete=False, encoding="utf-8") as f:
        f.write(MINIMAL_HTML)
        path = f.name
    try:
        update_seo(path, SEO_DATA)
        html = Path(path).read_text(encoding="utf-8")
        assert "application/ld+json" in html
        assert '"@type": "Course"' in html
        assert "Antonio Salgado" in html
    finally:
        Path(path).unlink()


def test_idempotent():
    """Running update_seo twice should not duplicate tags."""
    with tempfile.NamedTemporaryFile(suffix=".html", mode="w", delete=False, encoding="utf-8") as f:
        f.write(MINIMAL_HTML)
        path = f.name
    try:
        update_seo(path, SEO_DATA)
        update_seo(path, SEO_DATA)
        html = Path(path).read_text(encoding="utf-8")
        assert html.count("application/ld+json") == 1
        assert html.count('property="og:title"') == 1
    finally:
        Path(path).unlink()


def test_default_image_applied_when_entry_has_no_image():
    with tempfile.NamedTemporaryFile(suffix=".html", mode="w", delete=False, encoding="utf-8") as f:
        f.write(MINIMAL_HTML)
        path = f.name
    try:
        update_seo(path, SEO_DATA, default_image="https://mimyr.dev/og-image.png")
        html = Path(path).read_text(encoding="utf-8")
        assert 'property="og:image" content="https://mimyr.dev/og-image.png"' in html.replace("content=", "content=") or (
            'property="og:image"' in html and "og-image.png" in html
        )
        assert 'property="og:image:width"' in html
        assert 'property="og:image:height"' in html
        assert 'name="twitter:card"' in html
    finally:
        Path(path).unlink()


def test_entry_image_overrides_default_image():
    with tempfile.NamedTemporaryFile(suffix=".html", mode="w", delete=False, encoding="utf-8") as f:
        f.write(MINIMAL_HTML)
        path = f.name
    try:
        update_seo(path, SEO_DATA | {"image": "https://mimyr.dev/custom.png"}, default_image="https://mimyr.dev/og-image.png")
        html = Path(path).read_text(encoding="utf-8")
        assert "custom.png" in html
        assert "og-image.png" not in html
        # Dimensões só são conhecidas para a imagem default
        assert 'property="og:image:width"' not in html
    finally:
        Path(path).unlink()


def _write_course_tree(tmp_path: Path) -> Path:
    """Cria um mini-curso (index + módulo + capítulo) com manifest no padrão do seo.json real."""
    (tmp_path / "modulo-1").mkdir()
    for filename in ["index.html", "modulo-1/index.html", "modulo-1/apis-conceito.html"]:
        (tmp_path / filename).write_text(MINIMAL_HTML, encoding="utf-8")
    manifest = [
        {
            "file": "index.html",
            "title": "UX e tecnologia | Mimyr",
            "description": "Curso para designers.",
            "author": "Antonio Salgado",
            "url": "https://interfacedousuario.com.br/ux-e-tecnologia/",
        },
        {
            "file": "modulo-1/index.html",
            "title": "Módulo 1: Seu dev falou 'API' — Mimyr",
            "description": "Vocabulário técnico mínimo.",
            "author": "Antonio Salgado",
            "url": "https://interfacedousuario.com.br/ux-e-tecnologia/modulo-1/",
        },
        {
            "file": "modulo-1/apis-conceito.html",
            "title": "A API: o garçom que conecta tudo — Módulo 1 | Mimyr",
            "description": "O que é uma API.",
            "author": "Antonio Salgado",
            "url": "https://interfacedousuario.com.br/ux-e-tecnologia/modulo-1/apis-conceito.html",
        },
    ]
    manifest_path = tmp_path / "seo.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
    return manifest_path


def test_course_index_keeps_course_type(tmp_path: Path):
    manifest_path = _write_course_tree(tmp_path)
    update_from_seo_file(str(tmp_path), str(manifest_path))
    html = (tmp_path / "index.html").read_text(encoding="utf-8")
    assert '"@type": "Course"' in html
    assert '"@type": "LearningResource"' not in html


def test_subpage_gets_learning_resource_with_is_part_of(tmp_path: Path):
    manifest_path = _write_course_tree(tmp_path)
    update_from_seo_file(str(tmp_path), str(manifest_path))
    html = (tmp_path / "modulo-1" / "apis-conceito.html").read_text(encoding="utf-8")
    assert '"@type": "LearningResource"' in html
    assert '"isPartOf"' in html
    assert "UX e tecnologia" in html


def test_subpage_gets_breadcrumb_with_three_levels(tmp_path: Path):
    manifest_path = _write_course_tree(tmp_path)
    update_from_seo_file(str(tmp_path), str(manifest_path))
    html = (tmp_path / "modulo-1" / "apis-conceito.html").read_text(encoding="utf-8")
    data = _extract_jsonld_blocks(html)
    breadcrumbs = [block for block in data if block.get("@type") == "BreadcrumbList"]
    assert len(breadcrumbs) == 1
    items = breadcrumbs[0]["itemListElement"]
    assert [item["position"] for item in items] == [1, 2, 3]
    assert items[0]["name"] == "UX e tecnologia"
    assert items[1]["name"].startswith("Módulo 1")
    assert items[2]["name"] == "A API: o garçom que conecta tudo"


def test_module_index_gets_breadcrumb_with_two_levels(tmp_path: Path):
    manifest_path = _write_course_tree(tmp_path)
    update_from_seo_file(str(tmp_path), str(manifest_path))
    html = (tmp_path / "modulo-1" / "index.html").read_text(encoding="utf-8")
    data = _extract_jsonld_blocks(html)
    breadcrumbs = [block for block in data if block.get("@type") == "BreadcrumbList"]
    assert len(breadcrumbs) == 1
    assert [item["position"] for item in breadcrumbs[0]["itemListElement"]] == [1, 2]


def test_type_override_per_entry(tmp_path: Path):
    manifest_path = _write_course_tree(tmp_path)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest[2]["type"] = "Course"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
    update_from_seo_file(str(tmp_path), str(manifest_path))
    html = (tmp_path / "modulo-1" / "apis-conceito.html").read_text(encoding="utf-8")
    blocks = _extract_jsonld_blocks(html)
    assert any(block.get("@type") == "Course" for block in blocks)
    assert not any(block.get("@type") == "LearningResource" for block in blocks)


def test_manifest_rerun_is_idempotent(tmp_path: Path):
    manifest_path = _write_course_tree(tmp_path)
    update_from_seo_file(str(tmp_path), str(manifest_path))
    first = (tmp_path / "modulo-1" / "apis-conceito.html").read_text(encoding="utf-8")
    update_from_seo_file(str(tmp_path), str(manifest_path))
    second = (tmp_path / "modulo-1" / "apis-conceito.html").read_text(encoding="utf-8")
    assert first == second
    assert second.count("BreadcrumbList") == 1


def _extract_jsonld_blocks(html: str) -> list:
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    return [json.loads(tag.string) for tag in soup.find_all("script", type="application/ld+json")]


def test_update_from_manifest_list_matches_single_html(tmp_path: Path):
    html_path = tmp_path / "modulo-1.html"
    html_path.write_text(MINIMAL_HTML, encoding="utf-8")
    manifest_path = tmp_path / "seo.json"
    manifest_path.write_text(json.dumps([SEO_DATA | {"file": "modulo-1.html"}]), encoding="utf-8")

    updated = update_from_seo_file(str(html_path), str(manifest_path))

    html = html_path.read_text(encoding="utf-8")
    assert updated == [html_path]
    assert "<title>APIs para Designers — Mimyr</title>" in html


def test_update_from_manifest_list_can_update_course_directory(tmp_path: Path):
    for filename in ["modulo-1.html", "modulo-2.html"]:
        (tmp_path / filename).write_text(MINIMAL_HTML, encoding="utf-8")
    manifest_path = tmp_path / "seo.json"
    manifest_path.write_text(
        json.dumps(
            [
                SEO_DATA | {"file": "modulo-1.html", "title": "Modulo 1 — Mimyr"},
                SEO_DATA | {"file": "modulo-2.html", "title": "Modulo 2 — Mimyr"},
            ]
        ),
        encoding="utf-8",
    )

    updated = update_from_seo_file(str(tmp_path), str(manifest_path))

    assert updated == [tmp_path / "modulo-1.html", tmp_path / "modulo-2.html"]
    assert "<title>Modulo 1 — Mimyr</title>" in (tmp_path / "modulo-1.html").read_text(encoding="utf-8")
    assert "<title>Modulo 2 — Mimyr</title>" in (tmp_path / "modulo-2.html").read_text(encoding="utf-8")

"""Tests for corrigir_acentos.py."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from corrigir_acentos import apply_to_file, build_corpus_map, strip_diacritics  # noqa: E402


def _write(tmp_path: Path, name: str, body: str) -> Path:
    html = f"<!DOCTYPE html><html lang='pt-BR'><head><title>x</title></head><body>{body}</body></html>"
    p = tmp_path / name
    p.write_text(html, encoding="utf-8")
    return p


def test_strip_diacritics_handles_accents_and_cedilla():
    assert strip_diacritics("função") == "funcao"
    assert strip_diacritics("você") == "voce"
    assert strip_diacritics("Código") == "Codigo"


def test_corpus_map_learns_from_accented_usage(tmp_path: Path):
    # "módulo" e "você" aparecem acentuados; "modulo"/"voce" são candidatos
    _write(tmp_path, "a.html", "<p>O módulo ensina. Você aprende. módulo de novo.</p>")
    _write(tmp_path, "b.html", "<p>Neste modulo, voce vai ver.</p>")
    mapping = build_corpus_map(str(tmp_path))
    assert mapping["modulo"] == "módulo"
    assert mapping["voce"] == "você"


def test_blocklist_protects_valid_words(tmp_path: Path):
    # "quê" existe no corpus, mas "que" está na blocklist -> nunca vira "quê"
    _write(tmp_path, "a.html", "<p>Sei lá o quê. O que importa é que funciona.</p>")
    mapping = build_corpus_map(str(tmp_path))
    assert "que" not in mapping


def test_apply_skips_code_blocks(tmp_path: Path):
    _write(tmp_path, "a.html", "<p>módulo</p>")  # semente para o mapa
    page = _write(tmp_path, "b.html", "<p>Use o modulo.</p><pre><code>import modulo</code></pre>")
    mapping = build_corpus_map(str(tmp_path))
    apply_to_file(page, mapping)
    html = page.read_text(encoding="utf-8")
    assert "Use o módulo." in html
    assert "import modulo" in html  # código intacto


def test_apply_preserves_case(tmp_path: Path):
    _write(tmp_path, "a.html", "<p>técnico</p>")
    page = _write(tmp_path, "b.html", "<p>Tecnico e tecnico e TECNICO.</p>")
    mapping = build_corpus_map(str(tmp_path))
    apply_to_file(page, mapping)
    html = page.read_text(encoding="utf-8")
    assert "Técnico e técnico e TÉCNICO." in html


def test_apply_is_idempotent(tmp_path: Path):
    _write(tmp_path, "a.html", "<p>página</p>")
    page = _write(tmp_path, "b.html", "<p>Veja a pagina.</p>")
    mapping = build_corpus_map(str(tmp_path))
    first = apply_to_file(page, mapping)
    after_first = page.read_text(encoding="utf-8")
    second = apply_to_file(page, mapping)
    assert first and not second
    assert page.read_text(encoding="utf-8") == after_first


def test_apply_skips_html_comments(tmp_path: Path):
    _write(tmp_path, "a.html", "<p>áreas</p>")  # semente
    page = _write(tmp_path, "b.html", "<p>areas quentes</p><!-- broken areas here -->")
    mapping = build_corpus_map(str(tmp_path))
    apply_to_file(page, mapping)
    html = page.read_text(encoding="utf-8")
    assert "áreas quentes" in html  # texto visível corrigido
    assert "<!-- broken areas here -->" in html  # comentário intacto


def test_diacritic_guard_blocks_non_diacritic_change(tmp_path: Path):
    # Mapa malicioso: trocaria "casa" por "coisa" (não é só diacrítico) -> bloqueado
    page = _write(tmp_path, "b.html", "<p>A casa é azul.</p>")
    apply_to_file(page, {"casa": "coisa"})
    assert "A casa é azul." in page.read_text(encoding="utf-8")

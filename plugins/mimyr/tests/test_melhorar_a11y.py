"""Tests for melhorar_a11y.py."""
import sys
import subprocess
from pathlib import Path

import pytest
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from melhorar_a11y import improve_html, improve_tree  # noqa: E402


NAV_HTML = """<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>X</title></head>
<body>
<nav aria-label="Navegação entre páginas" class="subpage-nav">
  <a class="prev" href="apis-pratica.html" rel="prev">← REST, GraphQL e os verbos HTTP</a>
  <a class="next" href="cache-cookies.html" rel="next">Cache e cookies: por que o site lembra de você →</a>
</nav>
</body></html>"""

TABLE_HTML = """<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>X</title></head>
<body>
<h2>Comparativo</h2>
<table class="comparison-table">
  <caption>REST vs GraphQL: comparativo rápido</caption>
  <thead><tr><th>Aspecto</th><th>REST</th><th>GraphQL</th></tr></thead>
  <tbody><tr><th>Endereços</th><td>Um URL</td><td>Um endpoint</td></tr></tbody>
</table>
</body></html>"""

BARE_TABLE_HTML = """<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>X</title></head>
<body>
<h3>Tipos de dado</h3>
<table>
  <tr><th>Tipo</th><th>Exemplo</th></tr>
  <tr><td>string</td><td>"oi"</td></tr>
</table>
</body></html>"""


def test_prev_link_gets_aria_label_with_arrow_stripped():
    out = improve_html(NAV_HTML)
    soup = BeautifulSoup(out, "html.parser")
    prev = soup.select_one(".subpage-nav a.prev")
    assert prev["aria-label"] == "Anterior: REST, GraphQL e os verbos HTTP"


def test_next_link_gets_aria_label():
    out = improve_html(NAV_HTML)
    soup = BeautifulSoup(out, "html.parser")
    nxt = soup.select_one(".subpage-nav a.next")
    assert nxt["aria-label"] == "Próximo: Cache e cookies: por que o site lembra de você"


def test_nav_is_idempotent():
    once = improve_html(NAV_HTML)
    twice = improve_html(once)
    assert once == twice


def test_existing_aria_label_preserved_when_correct():
    once = improve_html(NAV_HTML)
    # Rodar de novo não deve alterar o label já correto
    assert "Anterior: REST" in once
    assert improve_html(once).count("Anterior: REST") == 1


def test_header_th_get_scope_col():
    out = improve_html(BARE_TABLE_HTML)
    soup = BeautifulSoup(out, "html.parser")
    header_ths = soup.select("table tr")[0].find_all("th")
    assert all(th.get("scope") == "col" for th in header_ths)


def test_table_wrapped_in_region_with_label_from_caption():
    out = improve_html(TABLE_HTML)
    soup = BeautifulSoup(out, "html.parser")
    table = soup.find("table")
    wrap = table.parent
    assert wrap.name == "div"
    assert "table-wrap" in wrap.get("class", [])
    assert wrap.get("role") == "region"
    assert wrap.get("tabindex") == "0"
    assert "comparativo rápido" in wrap.get("aria-label", "").lower()


def test_bare_table_wrap_label_from_preceding_heading():
    out = improve_html(BARE_TABLE_HTML)
    soup = BeautifulSoup(out, "html.parser")
    wrap = soup.find("table").parent
    assert "table-wrap" in wrap.get("class", [])
    assert "tipos de dado" in wrap.get("aria-label", "").lower()


def test_table_not_double_wrapped():
    once = improve_html(TABLE_HTML)
    twice = improve_html(once)
    assert once == twice
    soup = BeautifulSoup(twice, "html.parser")
    assert len(soup.select("div.table-wrap")) == 1


def test_improve_tree_returns_changed_files(tmp_path: Path):
    (tmp_path / "a.html").write_text(NAV_HTML, encoding="utf-8")
    (tmp_path / "b.html").write_text(
        "<html><head><title>x</title></head><body><p>nada</p></body></html>",
        encoding="utf-8",
    )
    changed = improve_tree(str(tmp_path))
    assert tmp_path / "a.html" in changed
    assert tmp_path / "b.html" not in changed


def run_cli(*args):
    script = Path(__file__).parent.parent / "scripts" / "melhorar_a11y.py"
    return subprocess.run(
        [sys.executable, "-B", str(script), *map(str, args)],
        capture_output=True, text=True, timeout=15,
    )


def disk_state(path):
    stat = path.stat()
    return path.read_bytes(), stat.st_mtime_ns, stat.st_ino


@pytest.mark.parametrize("flag_first", [False, True])
def test_cli_dry_run_reports_proposed_attributes_without_writing(tmp_path, flag_first):
    """Ignorar a flag ou escrevê-la tarde demais altera bytes/mtime do capítulo."""
    chapter = tmp_path / "capitulo.html"
    chapter.write_text(NAV_HTML, encoding="utf-8")
    before = disk_state(chapter)
    args = ["--dry-run", chapter] if flag_first else [chapter, "--dry-run"]

    result = run_cli(*args)

    assert disk_state(chapter) == before
    assert result.returncode == 0, result.stderr
    assert 'aria-label="Anterior: REST, GraphQL e os verbos HTTP"' in result.stdout
    assert str(chapter) in result.stdout
    assert set(tmp_path.iterdir()) == {chapter}


def test_cli_dry_run_directory_preserves_nested_and_symlink_targets(tmp_path):
    """A recursão deve propagar dry_run, inclusive a HTML acessível via symlink."""
    course = tmp_path / "curso"
    module = course / "modulo"
    module.mkdir(parents=True)
    chapter = module / "capitulo.html"
    chapter.write_text(TABLE_HTML, encoding="utf-8")
    outside = tmp_path / "externo.html"
    outside.write_text(NAV_HTML, encoding="utf-8")
    link = course / "link.html"
    link.symlink_to(outside)
    notes = course / "notas.txt"
    notes.write_text(TABLE_HTML, encoding="utf-8")
    before = {p: disk_state(p) for p in (chapter, outside, notes)}
    entries = set(tmp_path.rglob("*"))

    result = run_cli(course, "--dry-run")

    assert {p: disk_state(p) for p in before} == before
    assert link.is_symlink()
    assert set(tmp_path.rglob("*")) == entries
    assert result.returncode == 0, result.stderr
    assert 'scope="col"' in result.stdout
    assert 'scope="row"' in result.stdout
    assert 'role="region"' in result.stdout
    assert str(chapter) in result.stdout and str(link) in result.stdout
    assert str(notes) not in result.stdout


def test_cli_explicit_correction_still_writes_and_is_idempotent(tmp_path):
    """Evita tornar a ferramenta inteira somente leitura para esconder o defeito."""
    chapter = tmp_path / "capitulo.html"
    chapter.write_text(TABLE_HTML, encoding="utf-8")

    result = run_cli(chapter)

    assert result.returncode == 0, result.stderr
    soup = BeautifulSoup(chapter.read_text(encoding="utf-8"), "html.parser")
    assert soup.select_one("thead th")["scope"] == "col"
    assert soup.select_one("tbody th")["scope"] == "row"
    assert soup.select_one("div.table-wrap")["role"] == "region"
    corrected = disk_state(chapter)
    again = run_cli(chapter)
    assert again.returncode == 0, again.stderr
    assert disk_state(chapter) == corrected


def test_cli_invalid_dry_run_option_does_not_fall_back_to_writing(tmp_path):
    """Flag desconhecida precisa abortar antes de qualquer transformação no disco."""
    chapter = tmp_path / "capitulo.html"
    chapter.write_text(NAV_HTML, encoding="utf-8")
    before = disk_state(chapter)

    result = run_cli(chapter, "--dry-rnu")

    assert disk_state(chapter) == before
    assert result.returncode != 0

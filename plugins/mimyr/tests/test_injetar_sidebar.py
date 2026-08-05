"""Tests for injetar_sidebar.py."""
import sys
from pathlib import Path

from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from injetar_sidebar import build_toc, inject_sidebar, process_course  # noqa: E402


MODULE_INDEX = """<!DOCTYPE html><html lang="pt-BR"><head><title>x</title></head><body>
<main class="module"><header class="module-header"><p class="module-number">Módulo 2 de 7</p></header>
<ol class="module-index-list">
  <li class="module-index-item"><a href="a.html">Capítulo A</a><span class="time">~5 min</span></li>
  <li class="module-index-item"><a href="b.html">Capítulo B</a><span class="time">~4 min</span></li>
</ol></main></body></html>"""

CHAPTER = """<!DOCTYPE html><html lang="pt-BR"><head><title>x</title></head><body>
<main class="module" id="main-content"><article><h1>Cap</h1></article>
<nav class="subpage-nav"><a class="next" rel="next" href="b.html">B →</a></nav></main></body></html>"""


def _make_module(tmp_path: Path) -> Path:
    mod = tmp_path / "modulo-2"
    mod.mkdir()
    (mod / "index.html").write_text(MODULE_INDEX, encoding="utf-8")
    (mod / "a.html").write_text(CHAPTER, encoding="utf-8")
    (mod / "b.html").write_text(CHAPTER, encoding="utf-8")
    return mod


def test_build_toc_reads_ordered_chapters(tmp_path: Path):
    mod = _make_module(tmp_path)
    toc = build_toc(mod / "index.html")
    assert toc == [("a.html", "Capítulo A"), ("b.html", "Capítulo B")]


def test_inject_adds_sidebar_with_current_marked(tmp_path: Path):
    mod = _make_module(tmp_path)
    toc = build_toc(mod / "index.html")
    inject_sidebar(mod / "a.html", toc, "Módulo 2")
    soup = BeautifulSoup((mod / "a.html").read_text(encoding="utf-8"), "html.parser")
    main = soup.find("main", class_="module")
    assert "chapter" in main.get("class")
    nav = main.find("nav", class_="chapter-toc")
    assert nav is not None
    assert nav.find("h2").get_text(strip=True) == "Módulo 2"
    links = nav.select("a")
    assert [a.get_text(strip=True) for a in links] == ["Capítulo A", "Capítulo B"]
    current = [a for a in links if a.get("aria-current") == "page"]
    assert len(current) == 1 and current[0]["href"] == "a.html"
    # a sidebar é o primeiro filho do main (antes do article)
    assert main.find(recursive=False).get("class") == ["chapter-toc"]


def test_inject_is_idempotent(tmp_path: Path):
    mod = _make_module(tmp_path)
    toc = build_toc(mod / "index.html")
    assert inject_sidebar(mod / "a.html", toc, "Módulo 2") is True
    first = (mod / "a.html").read_text(encoding="utf-8")
    assert inject_sidebar(mod / "a.html", toc, "Módulo 2") is False
    assert (mod / "a.html").read_text(encoding="utf-8") == first
    # não duplica a sidebar
    assert first.count('class="chapter-toc"') == 1


def test_process_course_skips_index_and_preserves_analytics_nav(tmp_path: Path):
    _make_module(tmp_path)
    changed = process_course(str(tmp_path))
    names = sorted(p.name for p in changed)
    assert names == ["a.html", "b.html"]  # index.html não é capítulo
    # preserva a subpage-nav (analytics)
    soup = BeautifulSoup((tmp_path / "modulo-2" / "a.html").read_text(encoding="utf-8"), "html.parser")
    assert soup.select_one(".subpage-nav .next[rel='next']") is not None

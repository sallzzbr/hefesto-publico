"""Tests for atualizar_indice_curso.py."""
import sys
from pathlib import Path

from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from atualizar_indice_curso import module_stats, update_course_index  # noqa: E402


MODULE_INDEX = """<!DOCTYPE html><html><head><title>x</title></head><body>
<main class="module"><header class="module-header"><p class="reading-time">Tempo total: ~{mins} min</p></header>
<ol class="module-index-list">{items}</ol></main></body></html>"""

COURSE_INDEX = """<!DOCTYPE html><html><head><title>x</title></head><body>
<main class="index-page">
<section class="modules-section"><h2>O que você vai aprender</h2>
<ol class="module-list">
<li class="module-item"><span class="module-num">01</span><div><h3><a href="modulo-1/index.html">M1</a></h3><p>desc</p></div></li>
<li class="module-item"><span class="module-num">02</span><div><h3><a href="modulo-2/index.html">M2</a></h3><p>desc</p></div></li>
</ol></section></main></body></html>"""


def _course(tmp_path: Path):
    def mod(n, chapters, mins):
        d = tmp_path / f"modulo-{n}"
        d.mkdir()
        items = "".join(
            f'<li class="module-index-item"><a href="c{i}.html">C{i}</a></li>' for i in range(chapters)
        )
        (d / "index.html").write_text(MODULE_INDEX.format(mins=mins, items=items), encoding="utf-8")
    mod(1, 7, 24)
    mod(2, 9, 31)
    (tmp_path / "index.html").write_text(COURSE_INDEX, encoding="utf-8")
    return tmp_path


def test_module_stats_reads_count_and_time(tmp_path: Path):
    _course(tmp_path)
    chapters, label, minutes = module_stats(tmp_path / "modulo-1" / "index.html")
    assert chapters == 7
    assert minutes == 24
    assert label == "~24 min"


def test_injects_module_meta_and_course_total(tmp_path: Path):
    _course(tmp_path)
    assert update_course_index(str(tmp_path)) is True
    soup = BeautifulSoup((tmp_path / "index.html").read_text(encoding="utf-8"), "html.parser")

    metas = [m.get_text(strip=True) for m in soup.select(".module-item .module-meta")]
    assert metas == ["7 capítulos · ~24 min", "9 capítulos · ~31 min"]

    total = soup.select_one(".modules-section .course-meta")
    assert total is not None
    # 16 capítulos, 55 min -> ~55 min
    assert "16 capítulos" in total.get_text()
    assert "~55 min de leitura" in total.get_text()


def test_singular_chapter(tmp_path: Path):
    _course(tmp_path)
    d = tmp_path / "modulo-1"
    (d / "index.html").write_text(
        MODULE_INDEX.format(mins=3, items='<li class="module-index-item"><a href="c.html">C</a></li>'),
        encoding="utf-8",
    )
    update_course_index(str(tmp_path))
    soup = BeautifulSoup((tmp_path / "index.html").read_text(encoding="utf-8"), "html.parser")
    first = soup.select_one(".module-item .module-meta").get_text(strip=True)
    assert first == "1 capítulo · ~3 min"


def test_idempotent(tmp_path: Path):
    _course(tmp_path)
    assert update_course_index(str(tmp_path)) is True
    assert update_course_index(str(tmp_path)) is False
    soup = BeautifulSoup((tmp_path / "index.html").read_text(encoding="utf-8"), "html.parser")
    assert len(soup.select(".module-item .module-meta")) == 2  # não duplica
    assert len(soup.select(".course-meta")) == 1


def test_hours_format(tmp_path: Path):
    _course(tmp_path)
    # 2 módulos somando 209 min -> ~3h30
    for n, mins in [(1, 100), (2, 109)]:
        d = tmp_path / f"modulo-{n}"
        items = '<li class="module-index-item"><a href="c.html">C</a></li>'
        (d / "index.html").write_text(MODULE_INDEX.format(mins=mins, items=items), encoding="utf-8")
    update_course_index(str(tmp_path))
    soup = BeautifulSoup((tmp_path / "index.html").read_text(encoding="utf-8"), "html.parser")
    assert "~3h30 de leitura" in soup.select_one(".course-meta").get_text()

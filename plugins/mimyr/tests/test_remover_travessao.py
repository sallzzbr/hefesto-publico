"""Tests for remover_travessao.py."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from remover_travessao import process_html  # noqa: E402


def _body(inner: str) -> str:
    return f"<!DOCTYPE html><html><head><title>x</title></head><body>{inner}</body></html>"


def test_default_dash_becomes_comma():
    out, changes = process_html(_body("<p>o endereço — uma URL.</p>"))
    assert "o endereço, uma URL." in out
    assert len(changes) == 1


def test_comma_aside_becomes_parentheses():
    out, _ = process_html(_body("<p>o perfil inteiro — nome, email, bio — e clica.</p>"))
    assert "o perfil inteiro (nome, email, bio) e clica." in out


def test_term_definition_heading_becomes_colon():
    out, _ = process_html(_body("<h3>GET — ler</h3>"))
    assert "<h3>GET: ler</h3>" in out


def test_term_definition_in_li_becomes_colon():
    out, _ = process_html(_body("<ul><li>POST — criar</li></ul>"))
    assert "<li>POST: criar</li>" in out


def test_skips_code_and_pre():
    out, _ = process_html(_body('<p>veja — isso</p><pre><code>a — b</code></pre>'))
    assert "veja, isso" in out
    assert "a — b" in out  # código intacto


def test_skips_title_separator_in_head():
    out, changes = process_html(_body("<p>nada aqui</p>"))
    # o travessão do <title> não é tocado
    assert "<title>x</title>" in out
    assert changes == []


def test_idempotent():
    once, _ = process_html(_body("<p>é só leitura — você não vai quebrar nada.</p>"))
    twice, changes2 = process_html(once)
    # invariante real: re-rodar não produz novas mudanças e não sobra travessão
    assert changes2 == []
    assert "—" not in once.split("<body>")[1]


def test_title_attribute_not_touched():
    # travessão em atributo (não é texto visível) permanece
    out, _ = process_html(_body('<p><abbr title="a — b">x</abbr> — y</p>'))
    assert 'title="a — b"' in out
    assert "</abbr>, y" in out  # o travessão visível virou vírgula

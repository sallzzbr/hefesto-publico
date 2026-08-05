#!/usr/bin/env python3
"""Remove travessões (—, em-dash) da PROSA visível dos cursos.

Antonio não escreve com travessão (ver perfil-de-voz.md). Este tool substitui
o travessão pela pontuação adequada, só no texto visível (pula <code>, <pre>,
<script>, <style>, <head>, comentários e atributos):

1. aparte que contém vírgula, entre dois travessões -> parênteses
   "perfil inteiro — nome, email, bio — e clica"  ->  "perfil inteiro (nome, email, bio) e clica"
2. "TERMO — definição" em <li> (item começa com travessão) -> dois-pontos
   "<strong>GET</strong> — ler"  ->  "GET: ler"
3. demais travessões " — " -> vírgula (default da voz, conversacional)

Casos que ficariam melhor como ponto (duas orações independentes) devem ser
revisados à mão depois; o default vírgula nunca fica gramaticalmente errado.

Uso:
    python remover_travessao.py <dir-ou-arquivo> [--dry-run]
"""
import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup, Comment, NavigableString

SKIP = {"code", "pre", "script", "style", "head", "title"}
DASH = "—"


def _visible_strings(soup):
    for node in soup.find_all(string=True):
        if isinstance(node, Comment):
            continue
        if isinstance(node, NavigableString) and not any(a.name in SKIP for a in node.parents):
            yield node


TERM_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6", "dt", "li"}


def _transform(text: str, term_context: bool) -> str:
    if DASH not in text:
        return text
    out = text
    # 1. aparte com vírgula entre dois travessões -> parênteses
    out = re.sub(rf"\s{DASH}\s+([^{DASH}]+?,[^{DASH}]+?)\s+{DASH}\s", r" (\1) ", out)
    # 2. "TERMO — definição" em título/dt/li (termo de palavra única) -> dois-pontos
    if term_context:
        out = re.sub(rf"^(\s*)([^\s{DASH}]+)\s+{DASH}\s+([^{DASH}]+?)(\s*)$", r"\1\2: \3\4", out)
        # item que começa com travessão (TERMO no irmão anterior, ex.: <strong>) -> dois-pontos
        out = re.sub(rf"^(\s*){DASH}\s+", r"\1: ", out)
    # 3. travessão espaçado -> vírgula
    out = re.sub(rf"\s+{DASH}\s+", ", ", out)
    # 4. travessão em borda / sem espaço -> vírgula
    out = re.sub(rf"\s*{DASH}\s*", ", ", out)
    # limpeza
    out = out.replace(" ,", ",").replace(",,", ",").replace("( ", "(").replace(" )", ")")
    out = re.sub(r"[ \t]{2,}", " ", out)
    return out


def process_html(html: str) -> tuple[str, list[tuple[str, str]]]:
    soup = BeautifulSoup(html, "html.parser")
    changes = []
    for node in list(_visible_strings(soup)):
        text = str(node)
        if DASH not in text:
            continue
        term_context = node.parent.name in TERM_TAGS
        new = _transform(text, term_context)
        if new != text:
            node.replace_with(new)
            changes.append((text.strip(), new.strip()))
    return str(soup), changes


def process_path(target: str, dry_run: bool):
    p = Path(target)
    files = [p] if p.is_file() else sorted(p.rglob("*.html"))
    total = 0
    for f in files:
        html = f.read_text(encoding="utf-8")
        new_html, changes = process_html(html)
        if changes:
            total += len(changes)
            if dry_run:
                print(f"\n## {f}")
                for before, after in changes:
                    print(f"  - {before}")
                    print(f"  + {after}")
            else:
                f.write_text(new_html, encoding="utf-8")
    return total


if __name__ == "__main__":
    args = sys.argv[1:]
    dry = "--dry-run" in args
    targets = [a for a in args if a != "--dry-run"]
    if not targets:
        print("Usage: python remover_travessao.py <dir-ou-arquivo> [--dry-run]")
        sys.exit(1)
    n = process_path(targets[0], dry)
    print(f"\n{'(dry-run) ' if dry else ''}{n} travessão(ões) substituído(s).")

#!/usr/bin/env python3
"""Restaura acentos e cedilhas em palavras do texto VISÍVEL dos cursos.

Estratégia: o próprio corpus do curso é o dicionário. A maioria dos capítulos
já tem os acentos certos, então para cada palavra sem acento verificamos se a
forma acentuada já existe no corpus e, em caso afirmativo, corrigimos.

Segurança (três camadas):
1. Só toca nós de texto visível — pula <code>, <pre>, <script>, <style>, <head>.
2. Blocklist de formas ASCII que SÃO palavras válidas (que, tem, nos, usa, ...),
   evitando trocas erradas como "que" -> "quê".
3. Trava de diacrítico: uma substituição só é aplicada se as duas formas forem
   idênticas ao remover acentos/cedilha — nunca reescreve palavra.

Uso:
    python corrigir_acentos.py <dir-do-curso> [--dry-run] [--extra de=dê,...]
"""
import argparse
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

from bs4 import BeautifulSoup, Comment, NavigableString

SKIP_TAGS = {"code", "pre", "script", "style", "head", "title"}
WORD_RE = re.compile(r"[A-Za-zÀ-ÿ]{2,}")

# Formas ASCII que também são palavras pt-BR válidas (verbos, pronomes, conjunções).
# Auto-correção NUNCA mexe nelas; se precisarem de acento, é caso a caso.
BLOCKLIST = {
    "que", "tem", "nos", "vem", "usa", "conecta", "completa", "continua",
    "junta", "chama", "saia", "especifica", "ai", "ve", "le", "ha",
    "esta", "este", "estas", "estes", "so", "sera", "serao", "pode",
    "para", "publica", "publicas", "pratica", "praticas", "duvida",
    "secretaria", "de", "da", "do", "no", "na", "as", "os", "la", "sao",
    "porque", "e", "a", "o", "pelo", "regiao", "numero", "sede", "area",
    # Verbos cuja forma sem acento é correta (o substantivo/forma com acento é homógrafo):
    "referencia", "copia", "analise", "critica", "pratica", "indica",
    "deixa", "completa", "continua", "conecta", "junta", "chama", "usa",
}


def strip_diacritics(text: str) -> str:
    nfd = unicodedata.normalize("NFD", text)
    bare = "".join(c for c in nfd if unicodedata.category(c) != "Mn")
    return bare.replace("ç", "c").replace("Ç", "C")


def _visible_strings(soup):
    for node in soup.find_all(string=True):
        if isinstance(node, Comment):
            continue  # comentários HTML não são texto visível
        if isinstance(node, NavigableString) and not any(
            anc.name in SKIP_TAGS for anc in node.parents
        ):
            yield node


def build_corpus_map(course_dir: str) -> dict:
    """Constrói {forma_ascii: forma_acentuada} a partir do uso real no corpus."""
    forms = Counter()
    for html in Path(course_dir).rglob("*.html"):
        soup = BeautifulSoup(html.read_text(encoding="utf-8"), "html.parser")
        for node in _visible_strings(soup):
            for word in WORD_RE.findall(str(node)):
                forms[word.lower()] += 1

    by_key = defaultdict(list)
    for word, count in forms.items():
        by_key[strip_diacritics(word)].append((word, count))

    mapping = {}
    for key, variants in by_key.items():
        if key in BLOCKLIST:
            continue
        has_bare = any(word == key for word, _ in variants)
        accented = [(w, c) for w, c in variants if w != key and strip_diacritics(w) == key]
        if has_bare and accented:
            mapping[key] = max(accented, key=lambda x: x[1])[0]
    return mapping


def _match_case(source: str, target: str) -> str:
    if source.isupper():
        return target.upper()
    if source[:1].isupper():
        return target[:1].upper() + target[1:]
    return target


def apply_to_file(path: Path, mapping: dict) -> list[tuple[str, str]]:
    """Aplica as correções a um arquivo. Retorna [(de, para), ...] do que mudou."""
    soup = BeautifulSoup(path.read_text(encoding="utf-8"), "html.parser")
    changes: list[tuple[str, str]] = []

    def repl(match: re.Match) -> str:
        word = match.group(0)
        target = mapping.get(word.lower())
        if not target:
            return word
        # Trava de diacrítico: só troca se for idêntico sem acentos
        if strip_diacritics(word).lower() != strip_diacritics(target).lower():
            return word
        fixed = _match_case(word, target)
        if fixed != word:
            changes.append((word, fixed))
        return fixed

    for node in list(_visible_strings(soup)):
        new_text = WORD_RE.sub(repl, str(node))
        if new_text != str(node):
            node.replace_with(new_text)

    if changes:
        path.write_text(str(soup), encoding="utf-8")
    return changes


def run(course_dir: str, dry_run: bool, extra: dict) -> dict:
    mapping = build_corpus_map(course_dir)
    mapping.update(extra)
    total = Counter()
    for html in sorted(Path(course_dir).rglob("*.html")):
        if dry_run:
            soup = BeautifulSoup(html.read_text(encoding="utf-8"), "html.parser")
            for node in _visible_strings(soup):
                for word in WORD_RE.findall(str(node)):
                    t = mapping.get(word.lower())
                    if t and strip_diacritics(word).lower() == strip_diacritics(t).lower() and _match_case(word, t) != word:
                        total[(word, _match_case(word, t))] += 1
        else:
            for de, para in apply_to_file(html, mapping):
                total[(de, para)] += 1
    return total


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Restaura acentos no texto visível do curso.")
    parser.add_argument("course_dir")
    parser.add_argument("--dry-run", action="store_true", help="Só reporta, não grava.")
    parser.add_argument("--extra", default="", help="Pares extra forma=acentuada,sep por vírgula.")
    args = parser.parse_args()

    extra = {}
    if args.extra:
        for pair in args.extra.split(","):
            k, _, v = pair.partition("=")
            if k and v:
                extra[k.strip().lower()] = v.strip()

    counts = run(args.course_dir, args.dry_run, extra)
    for (de, para), n in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"{n:3}  {de!r} -> {para!r}")
    print(f"\n{'(dry-run) ' if args.dry_run else ''}{sum(counts.values())} substituição(ões) em {len(counts)} forma(s).")

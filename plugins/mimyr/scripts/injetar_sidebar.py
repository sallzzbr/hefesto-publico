#!/usr/bin/env python3
"""Injeta uma sidebar de navegação (TOC do módulo) em cada capítulo.

Para cada `modulo-N/index.html`, lê a lista ordenada de capítulos e injeta
`<nav class="chapter-toc">` como primeiro filho de `<main class="module">`
em cada página de capítulo, marcando o capítulo atual com aria-current.
Adiciona a classe `chapter` ao `<main>` (ativa o grid com sidebar no CSS).

Idempotente: regenera a sidebar a cada execução (remove a anterior).

Uso:
    python injetar_sidebar.py <dir-do-curso>
"""
import sys
from pathlib import Path

from bs4 import BeautifulSoup


def build_toc(module_index: Path) -> list[tuple[str, str]]:
    """Retorna [(href, label), ...] na ordem do índice do módulo."""
    soup = BeautifulSoup(module_index.read_text(encoding="utf-8"), "html.parser")
    items = []
    for link in soup.select(".module-index-list .module-index-item a"):
        href = link.get("href", "").strip()
        label = link.get_text(strip=True)
        if href and href != "index.html":
            items.append((href, label))
    return items


def inject_sidebar(chapter_path: Path, toc: list[tuple[str, str]], module_label: str) -> bool:
    """Injeta/atualiza a sidebar num capítulo. Retorna True se mudou."""
    soup = BeautifulSoup(chapter_path.read_text(encoding="utf-8"), "html.parser")
    main = soup.find("main", class_="module")
    if main is None:
        return False

    before = str(soup)

    # garante a classe 'chapter' no main
    classes = main.get("class", [])
    if "chapter" not in classes:
        classes.append("chapter")
        main["class"] = classes

    # remove sidebar antiga (idempotência)
    for old in main.find_all("nav", class_="chapter-toc"):
        old.decompose()

    current = chapter_path.name
    nav = soup.new_tag("nav")
    nav["class"] = ["chapter-toc"]
    nav["aria-label"] = "Neste módulo"
    heading = soup.new_tag("h2")
    heading.string = module_label
    nav.append(heading)
    ol = soup.new_tag("ol")
    for href, label in toc:
        li = soup.new_tag("li")
        a = soup.new_tag("a", href=href)
        a.string = label
        if href == current:
            a["aria-current"] = "page"
        li.append(a)
        ol.append(li)
    nav.append(ol)

    main.insert(0, nav)

    after = str(soup)
    if after != before:
        chapter_path.write_text(after, encoding="utf-8")
        return True
    return False


def process_course(course_dir: str) -> list[Path]:
    """Injeta sidebars em todos os capítulos de todos os módulos. Retorna alterados."""
    root = Path(course_dir)
    changed = []
    for module_index in sorted(root.glob("modulo-*/index.html")):
        module_dir = module_index.parent
        toc = build_toc(module_index)
        if not toc:
            continue
        module_label = _module_label(module_index)
        toc_hrefs = {href for href, _ in toc}
        for href in toc_hrefs:
            chapter = module_dir / href
            if chapter.exists() and chapter.name != "index.html":
                if inject_sidebar(chapter, toc, module_label):
                    changed.append(chapter)
    return changed


def _module_label(module_index: Path) -> str:
    """Rótulo curto do módulo para o topo da sidebar (ex.: 'Módulo 6')."""
    soup = BeautifulSoup(module_index.read_text(encoding="utf-8"), "html.parser")
    num = soup.find("p", class_="module-number")
    if num:
        text = num.get_text(strip=True)
        # "Módulo 6 de 7" -> "Módulo 6"
        return text.split(" de ")[0].strip()
    return "Neste módulo"


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python injetar_sidebar.py <dir-do-curso>")
        sys.exit(1)
    changed = process_course(sys.argv[1])
    for path in changed:
        print(f"sidebar: {path}")
    print(f"{len(changed)} capítulo(s) atualizado(s).")

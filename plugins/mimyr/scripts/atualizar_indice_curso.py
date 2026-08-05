#!/usr/bin/env python3
"""Sincroniza a meta de tempo/capítulos no índice do curso.

Lê cada `modulo-N/index.html` (número de capítulos + "Tempo total: ~X min") e
atualiza, no `index.html` do curso, de forma idempotente:

- dentro de cada card `.module-item`: uma linha `.module-meta` com
  "N capítulos · ~X min";
- logo abaixo do título da seção de módulos: uma linha `.course-meta` com o
  total do curso ("M capítulos · ~Hh MM de leitura").

Uso:
    python atualizar_indice_curso.py <dir-do-curso>
"""
import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup


def module_stats(module_index: Path) -> tuple[int, str, int]:
    """Retorna (n_capitulos, texto_tempo, minutos) de um índice de módulo."""
    soup = BeautifulSoup(module_index.read_text(encoding="utf-8"), "html.parser")
    chapters = len(soup.select(".module-index-list .module-index-item"))
    rt = soup.find("p", class_="reading-time")
    text = rt.get_text() if rt else ""
    m = re.search(r"~?\s*(\d+)\s*min", text)
    minutes = int(m.group(1)) if m else 0
    time_label = f"~{minutes} min"
    return chapters, time_label, minutes


def _meta_label(chapters: int, time_label: str) -> str:
    unit = "capítulo" if chapters == 1 else "capítulos"
    return f"{chapters} {unit} · {time_label}"


def _course_total_label(total_chapters: int, total_minutes: int) -> str:
    rounded = round(total_minutes / 5) * 5  # arredonda p/ 5 min ("~")
    hours, mins = divmod(rounded, 60)
    if hours:
        dur = f"~{hours}h{mins:02d}" if mins else f"~{hours}h"
    else:
        dur = f"~{rounded} min"
    return f"{total_chapters} capítulos · {dur} de leitura"


def update_course_index(course_dir: str) -> bool:
    """Atualiza o index.html do curso. Retorna True se mudou."""
    root = Path(course_dir)
    index = root / "index.html"
    soup = BeautifulSoup(index.read_text(encoding="utf-8"), "html.parser")
    before = str(soup)

    total_chapters = 0
    total_minutes = 0

    for item in soup.select(".module-item"):
        link = item.select_one("h3 a")
        if not link:
            continue
        href = link.get("href", "")
        module_index = (root / href).resolve()
        if not module_index.is_file():
            continue
        chapters, time_label, minutes = module_stats(module_index)
        total_chapters += chapters
        total_minutes += minutes

        meta = item.find("p", class_="module-meta")
        if meta is None:
            meta = soup.new_tag("p")
            meta["class"] = ["module-meta"]
            # insere no mesmo container do título/descrição
            container = link.find_parent("div") or item
            container.append(meta)
        meta.string = _meta_label(chapters, time_label)

    # total do curso, abaixo do título da seção de módulos
    section = soup.find(class_="modules-section")
    if section:
        heading = section.find(["h2", "h3"])
        if heading:
            course_meta = section.find("p", class_="course-meta")
            if course_meta is None:
                course_meta = soup.new_tag("p")
                course_meta["class"] = ["course-meta"]
                heading.insert_after(course_meta)
            course_meta.string = _course_total_label(total_chapters, total_minutes)

    after = str(soup)
    if after != before:
        index.write_text(after, encoding="utf-8")
        return True
    return False


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python atualizar_indice_curso.py <dir-do-curso>")
        sys.exit(1)
    changed = update_course_index(sys.argv[1])
    print("índice atualizado." if changed else "índice já estava em dia.")

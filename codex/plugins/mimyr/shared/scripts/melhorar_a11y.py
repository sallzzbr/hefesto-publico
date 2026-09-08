#!/usr/bin/env python3
"""Melhorias de acessibilidade em batch nos HTMLs de curso.

Aplica três transformações idempotentes:

1. Links de navegação `.subpage-nav`/`.module-nav` (`a.prev`/`a.next`) ganham
   `aria-label` descritivo ("Anterior: <título>" / "Próximo: <título>"),
   removendo a dependência da seta decorativa (← →) para indicar direção.
2. `<th>` de cabeçalho recebem `scope="col"`; `<th>` de linha (dentro de
   `<tbody>`) recebem `scope="row"`.
3. Tabelas são envoltas em `<div class="table-wrap" role="region" tabindex="0"
   aria-label="…">` — rolagem horizontal acessível em telas estreitas. O rótulo
   vem do `<caption>` ou do heading anterior.

Uso:
    python melhorar_a11y.py <arquivo_ou_diretorio>
"""
import sys
from pathlib import Path

from bs4 import BeautifulSoup

_ARROWS = "←→↑↓⟵⟶»«›‹"


def improve_html(html: str) -> str:
    """Aplica as melhorias e devolve o HTML resultante (função pura)."""
    soup = BeautifulSoup(html, "html.parser")
    _label_nav_links(soup)
    _fix_table_scopes(soup)
    _wrap_tables(soup)
    return str(soup)


def improve_file(path: Path) -> bool:
    """Aplica as melhorias a um arquivo. Retorna True se o conteúdo mudou."""
    original = path.read_text(encoding="utf-8")
    improved = improve_html(original)
    if improved != original:
        path.write_text(improved, encoding="utf-8")
        return True
    return False


def improve_tree(target_path: str) -> list[Path]:
    """Aplica a um arquivo ou a todos os .html sob um diretório.

    Retorna a lista de arquivos efetivamente alterados.
    """
    target = Path(target_path)
    files = [target] if target.is_file() else sorted(target.rglob("*.html"))
    return [f for f in files if improve_file(f)]


def _label_nav_links(soup) -> None:
    for link in soup.select(".subpage-nav a, .module-nav a"):
        classes = link.get("class") or []
        if "prev" in classes:
            prefix = "Anterior: "
        elif "next" in classes:
            prefix = "Próximo: "
        else:
            continue
        title = link.get_text(strip=True).strip(_ARROWS + " \t\n").strip()
        if title:
            link["aria-label"] = f"{prefix}{title}"


def _fix_table_scopes(soup) -> None:
    for table in soup.find_all("table"):
        header_row = _header_row(table)
        if header_row is not None:
            for th in header_row.find_all("th", recursive=False):
                if not th.get("scope"):
                    th["scope"] = "col"
        body = table.find("tbody")
        body_rows = body.find_all("tr") if body else []
        for row in body_rows:
            for th in row.find_all("th", recursive=False):
                if not th.get("scope"):
                    th["scope"] = "row"


def _header_row(table):
    thead = table.find("thead")
    if thead:
        first = thead.find("tr")
        if first:
            return first
    # Sem <thead>: primeira linha que contenha apenas <th>
    first_tr = table.find("tr")
    if first_tr and first_tr.find("th") and not first_tr.find("td"):
        return first_tr
    return None


def _wrap_tables(soup) -> None:
    for table in soup.find_all("table"):
        parent = table.parent
        if parent and parent.name == "div" and "table-wrap" in (parent.get("class") or []):
            continue  # já envolta

        label = _table_label(table)
        wrapper = soup.new_tag("div")
        wrapper["class"] = ["table-wrap"]
        wrapper["role"] = "region"
        wrapper["tabindex"] = "0"
        if label:
            wrapper["aria-label"] = label

        table.insert_before(wrapper)
        wrapper.append(table.extract())


def _table_label(table) -> str:
    caption = table.find("caption")
    if caption and caption.get_text(strip=True):
        return caption.get_text(strip=True)
    heading = table.find_previous(["h2", "h3", "h4"])
    if heading and heading.get_text(strip=True):
        return f"Tabela: {heading.get_text(strip=True)}"
    return "Tabela"


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python melhorar_a11y.py <arquivo_ou_diretorio>")
        sys.exit(1)

    changed = improve_tree(sys.argv[1])
    for path in changed:
        print(f"a11y atualizado: {path}")
    print(f"{len(changed)} arquivo(s) alterado(s).")

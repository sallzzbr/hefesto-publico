#!/usr/bin/env python3
"""Detecta texto de SVG que estoura o viewBox nos capitulos de um curso.

Mede a largura real com as metricas das fontes auto-hospedadas em
courses/<curso>/fonts/ (Inter para o corpo, Fraunces para os titulos em
serifa), em vez de estimar por numero de caracteres. Estimativa erra: os
diagramas ja foram cortados duas vezes com contas de guardanapo.

    python tools/checar_svg_overflow.py courses/ux-e-tecnologia
"""
from __future__ import annotations

import sys
from pathlib import Path

from bs4 import BeautifulSoup
from fontTools.ttLib import TTFont

# font-weight do <text> -> arquivo da fonte
INTER = {"400": "inter-400", "500": "inter-500", "600": "inter-600", "700": "inter-700"}
FRAUNCES = {"500": "fraunces-500", "600": "fraunces-600", "700": "fraunces-700"}


def carregar_fontes(fonts_dir: Path) -> dict[str, tuple[dict, int]]:
    """Mapeia nome do arquivo -> (advance widths por caractere, unitsPerEm)."""
    fontes = {}
    for arquivo in sorted(fonts_dir.glob("*.woff2")):
        tt = TTFont(arquivo, lazy=True)
        upem = tt["head"].unitsPerEm
        cmap = tt.getBestCmap()
        hmtx = tt["hmtx"]
        larguras = {}
        for code, glyph in cmap.items():
            try:
                larguras[chr(code)] = hmtx[glyph][0]
            except KeyError:
                pass
        fontes[arquivo.stem] = (larguras, upem)
        tt.close()
    return fontes


def largura(texto: str, fontes, familia: str, peso: str, tamanho: float) -> float:
    tabela = FRAUNCES if "serif" in (familia or "").lower() else INTER
    chave = tabela.get(peso) or tabela[sorted(tabela)[0]]
    if chave not in fontes:  # peso ausente cai no mais proximo disponivel
        chave = sorted(fontes)[0]
    larguras, upem = fontes[chave]
    fallback = larguras.get("x", upem // 2)
    total = sum(larguras.get(c, fallback) for c in texto)
    return total / upem * tamanho


def herda(node, tag, attr, padrao=None):
    return node.get(attr) or tag.get(attr) or padrao


def caixas(svg, fontes) -> list[tuple[float, float, float, float, str]]:
    """Bounding box (esq, dir, topo, base, texto) de cada linha de texto."""
    saida = []
    for tag in svg.find_all("text"):
        # cada tspan com x proprio comeca uma linha nova
        nodes = tag.find_all("tspan") or [tag]
        y_corrente = float(herda(nodes[0], tag, "y", 0))
        for node in nodes:
            txt = "".join(node.find_all(string=True, recursive=False)).strip()
            if not txt:
                continue
            tamanho = float(herda(node, tag, "font-size", 14))
            peso = str(herda(node, tag, "font-weight", "400"))
            familia = herda(node, tag, "font-family", "")
            anchor = herda(node, tag, "text-anchor", "start")
            x = float(herda(node, tag, "x", 0))
            y = float(node.get("y") or y_corrente) + float(node.get("dy") or 0)
            y_corrente = y
            w = largura(txt, fontes, familia, peso, tamanho)
            esq = {"middle": x - w / 2, "end": x - w}.get(anchor, x)
            # caixa vertical aproximada em torno da baseline
            saida.append((esq, esq + w, y - tamanho * 0.78, y + tamanho * 0.22, txt))
    return saida


def checar(curso: Path, folga: float = 1.5) -> int:
    fontes = carregar_fontes(curso / "fonts")
    if not fontes:
        print(f"sem fontes em {curso / 'fonts'}", file=sys.stderr)
        return 2

    estouros = colisoes = 0
    for pagina in sorted(curso.rglob("*.html")):
        sopa = BeautifulSoup(pagina.read_text(encoding="utf-8"), "lxml")
        for svg in sopa.find_all("svg"):
            vb = svg.get("viewbox") or svg.get("viewBox")
            if not vb:
                continue
            x0, _, w, _ = (float(v) for v in vb.split())
            x1 = x0 + w
            rel = pagina.relative_to(curso)
            bbs = caixas(svg, fontes)

            for esq, dir_, _, _, txt in bbs:
                if esq < x0 - 0.5 or dir_ > x1 + 0.5:
                    estouros += 1
                    print(f"[estouro]  {rel}: {esq:.0f}..{dir_:.0f} fora de [{x0:.0f}..{x1:.0f}]")
                    print(f"           {txt[:60]!r}")

            for i, a in enumerate(bbs):
                for b in bbs[i + 1:]:
                    sobrepoe_x = a[0] < b[1] - folga and b[0] < a[1] - folga
                    sobrepoe_y = a[2] < b[3] - folga and b[2] < a[3] - folga
                    if sobrepoe_x and sobrepoe_y:
                        colisoes += 1
                        print(f"[colisao]  {rel}: {a[4][:34]!r} x {b[4][:34]!r}")

    print(f"\n{estouros} estouro(s) de viewBox, {colisoes} colisao(oes) entre textos")
    return 1 if (estouros or colisoes) else 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        raise SystemExit(2)
    raise SystemExit(checar(Path(sys.argv[1])))

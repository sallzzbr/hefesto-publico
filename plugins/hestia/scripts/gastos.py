#!/usr/bin/env python3
"""Analise do historico de gastos: evolucao por categoria, medias, variacoes e recorrencias.

Cobre a skill `analisar-gastos`, a ultima do hestia que ainda fazia conta em prosa. As contas
dela sao as mais faceis de errar sem ninguem notar, porque o erro sai com cara de numero certo:
uma media sobre a base errada muda o "32% acima" para "18% acima" e a frase continua plausivel.

Regras que vem da skill e ficam travadas por golden test:

- **Taxa de poupanca = saldo / receitas**, e mes sem receita devolve `null` com motivo (mesma
  regra do `resumo_mes.py`: 0% e uma afirmacao falsa no lugar de uma ausencia).
- **Degradacao por tamanho de base**, literal da skill: 1 mes -> so a visao do mes; 2 meses ->
  variacoes mes a mes, sem media historica; 3+ meses -> media e desvio entram. Como a media
  historica exclui o proprio mes (ver abaixo), "3+ meses de dados" e o mesmo que "2+ meses de
  BASE" — e e assim que o minimo esta escrito no codigo.
- **Fora do padrao = acima de media + 1 desvio OU mais de 30% acima da media**, e o simetrico
  para baixo, que a skill pede em separado ("pode ser conta que nao chegou, nao economia").
- **Tendencia pelos ultimos 3 meses da janela.**
- **Recorrencias x realidade**: divergencia de valor e recorrencia que nao apareceu.

Tres decisoes que a skill NAO fecha, decididas com o dono em 2026-07-29 e escritas aqui para o
golden nao congelar acidente:

1. **A media historica usa SO os meses anteriores ao analisado.** O mes nao entra na base contra
   a qual ele e medido. Com janela de 7 meses, a base tem 6 — e e por isso que a fixture
   reproduz literalmente o "media de 6 meses" que a skill escreve. A alternativa (janela
   inteira, mes incluso) tem vies sistematico numa direcao so: o mes puxa 1/n da media para
   perto de si, o desvio sai sempre subestimado e o gate sempre erra a favor de nao acusar.
2. **Mes sem lancamento na categoria conta como R$ 0,00 na media.** Assim o n e o mesmo para
   toda categoria e a frase "media de 6 meses" e verdade em toda linha. O preco e que categoria
   esporadica (IPVA, presente) aparece como fora do padrao no mes em que acontece — por isso
   toda variacao carrega `meses_com_gasto_na_base` e `base_esparsa`, para ser narrada como
   observacao e nao como alarme.
3. **Tendencia = monotonicidade estrita** nos ultimos 3 meses: sobe-sobe -> subindo,
   desce-desce -> caindo, qualquer zigue-zague -> estavel. E a leitura literal de "pelo
   movimento dos ultimos 3 meses" e a unica que nao inventa um limiar numerico que a skill
   nao tem.

E o que este script deliberadamente NAO faz: rotular caso "limitrofe". A skill chama os limiares
de "heuristica de apresentacao" e manda narrar caso limitrofe como observacao — mas nao define
onde comeca o limitrofe, e um `limitrofe: true` com banda inventada por mim seria regra de
negocio nova disfarcada de calculo. O script devolve `folga_sobre_o_limite`, a menor distancia
ate um limiar atingido: folga pequena e o insumo do "isso e limitrofe", e a frase e do modelo.

100% leitura. Nao grava nada, nao acessa o Drive: os CSVs chegam por caminho ou stdin.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from decimal import Decimal

from brl import ErroDeEntrada, brl, dinheiro, pct
from dados import ler_csv
from estatistica import desvio_amostral, media

# Meses de BASE (meses anteriores ao analisado). 2 de base = 3 de dados, que e onde a skill
# manda media e desvio entrarem. Ver a decisao 1 no cabecalho.
MINIMO_MESES_DE_BASE = 2
MESES_DA_TENDENCIA = 3
LIMIAR_PCT = Decimal("0.30")
QUANTAS_MUDANCAS = 3

CRITERIO = {
    "media_mais_1_desvio": "desvio",
    "media_menos_1_desvio": "desvio",
    "pct_acima": "pct",
    "pct_abaixo": "pct",
}


def mes_de(linha: dict) -> str:
    """`data` (AAAA-MM-DD) -> `AAAA-MM`. O mes vem do DADO, nao do nome do arquivo.

    Nome de arquivo e renomeavel e o conteudo nao: derivar o mes do `data` faz um livro salvo
    como `copia de 2026-06.csv` continuar valendo, e impede que um arquivo mal nomeado joque o
    mes inteiro na coluna errada da serie.
    """
    d = (linha.get("data") or "").strip()
    if len(d) < 7 or d[4] != "-" or not d[:4].isdigit() or not d[5:7].isdigit():
        raise ErroDeEntrada(
            f"data {d!r} nao esta em AAAA-MM-DD — sem o mes nao da para montar a serie, e "
            f"chutar o mes de uma linha desloca a media de uma categoria inteira"
        )
    # Mes fora de 01-12 nao e detalhe de validacao: `2026-13-05` passaria nos testes acima e
    # abriria uma COLUNA a mais na janela, empurrando a base em um mes e somando uma categoria
    # inteira num balde que nao existe — errado, e sem nenhum sintoma.
    if not 1 <= int(d[5:7]) <= 12:
        raise ErroDeEntrada(f"data {d!r} tem mes {d[5:7]}, fora de 01-12")
    return d[:7]


def classificar(linha: dict) -> str:
    tipo = (linha.get("tipo") or "despesa").strip().lower()
    if tipo not in ("despesa", "receita"):
        raise ErroDeEntrada(
            f"tipo '{tipo}' desconhecido em {linha.get('data', '?')} — o contrato admite "
            f"'despesa' ou 'receita'. Linha com tipo invalido nao pode ser somada num lado "
            f"nem no outro sem inventar."
        )
    return tipo


def carregar(caminhos: list[str]) -> tuple[list[dict], list[str]]:
    """Le os livros mensais e devolve (linhas, arquivos com cabecalho legado).

    O legado e detectado POR ARQUIVO, nao pelo conjunto: uma janela de 6 meses pode ter os
    quatro primeiros no cabecalho antigo (sem `tipo`, tudo despesa) e os dois ultimos no novo.
    Decidir isso uma vez para o lote leria receita como despesa — ou o contrario — em metade
    da janela, e a serie por categoria sairia errada sem nenhum sintoma.
    """
    linhas, legados = [], []
    # mes -> (posicao do arquivo em --livros, caminho). A chave e a POSICAO, e nao o caminho:
    # o erro mais provavel aqui e o mesmo livro entrar duas vezes na lista, e comparar caminho
    # com caminho da igual e deixa passar exatamente esse caso — que dobra o mes inteiro em
    # silencio, com um total que passa perfeitamente por gasto real. Um mes pode se repetir
    # DENTRO de um arquivo (livro concatenado), nunca entre duas entradas da lista.
    dono: dict[str, tuple[int, str]] = {}
    for posicao, caminho in enumerate(caminhos):
        do_arquivo = ler_csv(caminho, ["data", "categoria", "valor"], f"livro {caminho}")
        legado = "tipo" not in do_arquivo[0]
        if legado:
            legados.append(caminho)
        for linha in do_arquivo:
            if legado:
                linha["tipo"] = "despesa"
            mes = mes_de(linha)
            antes = dono.setdefault(mes, (posicao, caminho))
            if antes[0] != posicao:
                raise ErroDeEntrada(
                    f"o mes {mes} vem de duas entradas de --livros ({antes[1]} e {caminho}). "
                    f"Somar as duas dobraria o mes; escolher uma exigiria adivinhar qual e o "
                    f"livro bom."
                )
            linha["_mes"] = mes
            linhas.append(linha)
    return linhas, legados


def agregar(linhas: list[dict]) -> tuple[dict, dict, dict, set]:
    """Soma por mes e por (mes, categoria). Categoria so de DESPESA — receita nao tem quebra."""
    receitas: dict[str, Decimal] = defaultdict(Decimal)
    despesas: dict[str, Decimal] = defaultdict(Decimal)
    # defaultdict e o que materializa a decisao 2: (mes, categoria) sem lancamento vale 0.
    por_categoria: dict[tuple[str, str], Decimal] = defaultdict(Decimal)
    categorias: set[str] = set()

    for linha in linhas:
        valor = brl(linha["valor"], f"valor (linha {linha.get('data', '?')})")
        mes = linha["_mes"]
        if classificar(linha) == "receita":
            receitas[mes] += valor
            continue
        categoria = linha.get("categoria") or "(sem categoria)"
        despesas[mes] += valor
        por_categoria[(mes, categoria)] += valor
        categorias.add(categoria)

    return receitas, despesas, por_categoria, categorias


def visao_do_mes(mes: str, anterior: str | None, receitas: dict, despesas: dict) -> dict:
    r, d = receitas[mes], despesas[mes]
    saldo = r - d
    visao = {
        "mes": mes,
        "receitas": dinheiro(r),
        "despesas": dinheiro(d),
        "saldo": dinheiro(saldo),
        "taxa_de_poupanca_pct": pct(saldo / r) if r > 0 else None,
    }
    if r <= 0:
        visao["taxa_de_poupanca_motivo"] = (
            "mes sem receita lancada — a taxa exige dividir pelas receitas, e 0% seria uma "
            "afirmacao falsa em vez de uma ausencia"
        )
    if anterior is None:
        visao["comparacao_com_mes_anterior"] = None
    else:
        saldo_anterior = receitas[anterior] - despesas[anterior]
        visao["comparacao_com_mes_anterior"] = {
            "mes_anterior": anterior,
            "receitas_anterior": dinheiro(receitas[anterior]),
            "despesas_anterior": dinheiro(despesas[anterior]),
            "saldo_anterior": dinheiro(saldo_anterior),
            "receitas_delta": dinheiro(r - receitas[anterior]),
            "despesas_delta": dinheiro(d - despesas[anterior]),
            "saldo_delta": dinheiro(saldo - saldo_anterior),
        }
    return visao


def tendencia(valores: list[Decimal]) -> str:
    """Monotonicidade estrita. Ver a decisao 3 no cabecalho."""
    if all(a < b for a, b in zip(valores, valores[1:])):
        return "subindo"
    if all(a > b for a, b in zip(valores, valores[1:])):
        return "caindo"
    return "estavel"


def evolucao_por_categoria(janela: list[str], categorias: set, por_categoria: dict) -> list[dict]:
    itens = []
    ultimos = janela[-MESES_DA_TENDENCIA:]
    for categoria in sorted(categorias):
        serie = [por_categoria[(m, categoria)] for m in janela]
        item = {
            "categoria": categoria,
            "serie": [
                {"mes": m, "valor": dinheiro(v)} for m, v in zip(janela, serie)
            ],
            "total_na_janela": dinheiro(sum(serie, Decimal(0))),
        }
        if len(janela) < MESES_DA_TENDENCIA:
            item["tendencia"] = None
            item["tendencia_motivo"] = (
                f"tendencia exige {MESES_DA_TENDENCIA} meses de janela; ha {len(janela)}"
            )
        else:
            item["tendencia"] = tendencia([por_categoria[(m, categoria)] for m in ultimos])
            item["tendencia_base"] = ultimos
        itens.append(item)
    return sorted(itens, key=lambda i: (-Decimal(i["total_na_janela"]), i["categoria"]))


def variacoes_fora_do_padrao(
    mes: str, base: list[str], categorias: set, por_categoria: dict
) -> tuple[list[dict], list[dict]]:
    """Devolve (variacoes, categorias novas no mes).

    Categoria sem nenhum gasto na base sai em lista propria em vez de virar variacao: com media
    zero nao existe "X% acima da media" — a divisao nao e possivel, e a comparacao com media +
    desvio (que tambem e zero) acusaria qualquer centavo. Ela e noticia, mas de outro tipo.
    """
    variacoes, novas = [], []
    for categoria in sorted(categorias):
        valor = por_categoria[(mes, categoria)]
        historico = [por_categoria[(m, categoria)] for m in base]
        m = media(historico)

        if m == 0:
            if valor > 0:
                novas.append({
                    "categoria": categoria,
                    "valor": dinheiro(valor),
                    "motivo": (
                        f"sem gasto nesta categoria em nenhum dos {len(base)} meses da base — "
                        f"nao ha media para comparar, entao nao ha percentual a afirmar"
                    ),
                })
            continue

        s = desvio_amostral(historico)
        limites = {
            "media_mais_1_desvio": m + s,
            "media_menos_1_desvio": m - s,
            "pct_acima": m * (Decimal(1) + LIMIAR_PCT),
            "pct_abaixo": m * (Decimal(1) - LIMIAR_PCT),
        }
        acima = [k for k in ("media_mais_1_desvio", "pct_acima") if valor > limites[k]]
        abaixo = [k for k in ("media_menos_1_desvio", "pct_abaixo") if valor < limites[k]]
        atingidos = acima or abaixo
        if not atingidos:
            continue

        com_gasto = sum(1 for v in historico if v != 0)
        variacoes.append({
            "categoria": categoria,
            "direcao": "acima" if acima else "abaixo",
            "valor": dinheiro(valor),
            "media": dinheiro(m),
            "media_de_n_meses": len(base),
            "desvio": dinheiro(s),
            "variacao_pct": pct((valor - m) / m),
            "limites": {k: dinheiro(v) for k, v in limites.items()},
            "criterios_atingidos": sorted({CRITERIO[k] for k in atingidos}),
            "folga_sobre_o_limite": dinheiro(min(abs(valor - limites[k]) for k in atingidos)),
            "meses_com_gasto_na_base": com_gasto,
            "base_esparsa": com_gasto < len(base),
        })

    variacoes.sort(key=lambda v: (v["direcao"], -abs(Decimal(v["variacao_pct"])), v["categoria"]))
    return variacoes, novas


def maiores_mudancas(mes: str, anterior: str, categorias: set, por_categoria: dict) -> dict:
    deltas = []
    for categoria in categorias:
        atual, previo = por_categoria[(mes, categoria)], por_categoria[(anterior, categoria)]
        if atual == previo:
            continue
        deltas.append({
            "categoria": categoria,
            "valor": dinheiro(atual),
            "valor_anterior": dinheiro(previo),
            "delta": dinheiro(atual - previo),
            "_d": atual - previo,
        })

    def sem_interno(itens):
        return [{k: v for k, v in i.items() if k != "_d"} for i in itens]

    subiram = sorted([d for d in deltas if d["_d"] > 0], key=lambda d: (-d["_d"], d["categoria"]))
    cairam = sorted([d for d in deltas if d["_d"] < 0], key=lambda d: (d["_d"], d["categoria"]))
    return {
        "mes_anterior": anterior,
        # Listas curtas quando ha menos que QUANTAS_MUDANCAS movimentos reais e o certo: encher
        # com categoria de delta zero seria apresentar "nao mudou" como uma das maiores mudancas.
        "mais_subiram": sem_interno(subiram[:QUANTAS_MUDANCAS]),
        "mais_cairam": sem_interno(cairam[:QUANTAS_MUDANCAS]),
    }


def recorrencias_x_realidade(linhas_do_mes: list[dict], recorrencias: list[dict]) -> dict:
    """Cadastro contra o que foi lancado no mes.

    O casamento e por NOME na descricao, e o valor NAO entra nele — de proposito, e e o que
    separa esta funcao da checagem do `resumo_mes.py`. La, "ja lancada" pede nome E valor,
    porque a pergunta e "posso deixar de lancar isto?". Aqui a pergunta e o contrario: "o que
    foi lancado bate com o cadastro?". Com o valor no casamento, a assinatura que subiu de preco
    — o exemplo que a propria skill da — cairia em "nao apareceu", escondendo justamente o caso
    que esta secao existe para achar.
    """
    conferem, divergencias, nao_apareceram = [], [], []
    for r in recorrencias:
        nome = (r.get("nome") or "").strip()
        if not nome:
            raise ErroDeEntrada(
                "recorrencias.csv: linha sem `nome` — o casamento com o lancamento e pelo nome, "
                "e casar por vazio bateria com toda descricao do mes"
            )
        cadastrado = brl(r["valor"], f"recorrencias.valor ({nome})")
        ficha = {
            "nome": nome,
            "tipo": (r.get("tipo") or "despesa").strip().lower(),
            "categoria": r.get("categoria"),
            "valor_cadastrado": dinheiro(cadastrado),
        }
        casadas = [
            (l, brl(l["valor"], f"valor (linha {l.get('data', '?')})"))
            for l in linhas_do_mes
            if nome.lower() in (l.get("descricao") or "").lower()
        ]
        if not casadas:
            nao_apareceram.append({
                **ficha,
                "motivo": "nenhum lancamento do mes tem esse nome na descricao",
            })
        elif any(v == cadastrado for _, v in casadas):
            conferem.append({**ficha, "lancamentos": len(casadas)})
        else:
            divergencias.append({
                **ficha,
                "lancado": [
                    {
                        "data": l.get("data"),
                        "descricao": l.get("descricao"),
                        "valor": dinheiro(v),
                        "diferenca": dinheiro(v - cadastrado),
                    }
                    for l, v in casadas
                ],
            })
    return {
        "conferem": conferem,
        "divergencias": divergencias,
        "nao_apareceram": nao_apareceram,
        "criterio": (
            "casamento pelo nome CONTIDO na descricao (substring, case-insensitive, sem "
            "acento-fold); o valor fica "
            "FORA do casamento para que a recorrencia que mudou de preco caia em 'divergencias' "
            "e nao em 'nao_apareceram'"
        ),
    }


def analisar(linhas: list[dict], mes: str, janela: list[str], recorrencias: list[dict] | None) -> dict:
    receitas, despesas, por_categoria, categorias = agregar(linhas)
    base = janela[:-1]
    anterior = base[-1] if base else None
    puladas: dict[str, str] = {}

    resultado: dict = {
        "mes": mes,
        "janela": janela,
        "meses_de_base": base,
        "visao_do_mes": visao_do_mes(mes, anterior, receitas, despesas),
        "evolucao_por_categoria": evolucao_por_categoria(janela, categorias, por_categoria),
    }
    if anterior is None:
        puladas["visao_do_mes.comparacao_com_mes_anterior"] = (
            "so 1 mes na janela — comparacao mes a mes exige pelo menos 2"
        )

    if len(base) >= MINIMO_MESES_DE_BASE:
        variacoes, novas = variacoes_fora_do_padrao(mes, base, categorias, por_categoria)
        resultado["variacoes_fora_do_padrao"] = variacoes
        resultado["categorias_novas_no_mes"] = novas
    else:
        resultado["variacoes_fora_do_padrao"] = None
        resultado["categorias_novas_no_mes"] = None
        puladas["variacoes_fora_do_padrao"] = (
            f"a media historica exige {MINIMO_MESES_DE_BASE} meses ANTERIORES ao analisado "
            f"({MINIMO_MESES_DE_BASE + 1} meses de dados); a janela tem {len(janela)}"
        )

    if anterior is None:
        resultado["maiores_mudancas"] = None
        puladas["maiores_mudancas"] = "mudanca mes a mes exige um mes anterior na janela"
    else:
        resultado["maiores_mudancas"] = maiores_mudancas(
            mes, anterior, categorias, por_categoria
        )

    if recorrencias is None:
        resultado["recorrencias_x_realidade"] = None
        puladas["recorrencias_x_realidade"] = (
            "nao ha recorrencias cadastradas (recorrencias.csv nao informado)"
        )
    else:
        resultado["recorrencias_x_realidade"] = recorrencias_x_realidade(
            [l for l in linhas if l["_mes"] == mes], recorrencias
        )

    resultado["criterios"] = {
        "base_da_media": (
            "media historica = SO os meses anteriores ao analisado; o mes nao entra na base "
            "contra a qual e medido"
        ),
        "meses_sem_gasto_na_categoria": (
            "contam como R$ 0,00 na media, para que o n seja o mesmo em toda categoria e "
            "'media de N meses' seja verdade em toda linha"
        ),
        "fora_do_padrao": (
            f"acima de media + 1 desvio OU mais de {LIMIAR_PCT * 100:.0f}% acima da media; "
            f"o simetrico marca o desvio para baixo"
        ),
        "desvio": "amostral (n-1), a definicao unica do estatistica.py",
        "precisao": (
            "as comparacoes rodam na precisao cheia e o arredondamento para 2 casas "
            "acontece so na exibicao; num caso muito justo o `valor` pode sair igual "
            "ao limite exibido e ainda assim ter cruzado o limite real"
        ),
        "tendencia": (
            f"monotonicidade estrita nos ultimos {MESES_DA_TENDENCIA} meses da janela; "
            f"qualquer zigue-zague e 'estavel'"
        ),
        "limitrofe": (
            "nao ha rotulo de limitrofe: a skill chama os limiares de heuristica de "
            "apresentacao mas nao define a banda, entao o script devolve `folga_sobre_o_limite` "
            "(menor distancia ate um limiar atingido) e a leitura fica com quem narra"
        ),
        "categorias": "a quebra por categoria e so de DESPESA; receita entra so na visao do mes",
    }
    resultado["simplificacoes"] = [
        "'mes anterior' e o mes imediatamente anterior PRESENTE nos livros informados, que pode "
        "nao ser o mes calendario anterior se houver buraco na janela",
        "mes que nao veio nos livros nao entra na janela nem vira R$ 0,00 — a base e o que foi "
        "informado, e nao um calendario preenchido por conta propria",
    ]
    if puladas:
        resultado["secoes_puladas"] = puladas
    return resultado


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--livros", required=True, nargs="+",
                   help="um ou mais AAAA-MM.csv (ou - para stdin)")
    p.add_argument("--mes", help="AAAA-MM a analisar (default: o mais recente nos livros)")
    p.add_argument("--recorrencias", help="recorrencias.csv, para a secao recorrencias x realidade")
    args = p.parse_args(argv)

    try:
        linhas, legados = carregar(args.livros)
        presentes = sorted({l["_mes"] for l in linhas})
        mes = args.mes or presentes[-1]
        if mes not in presentes:
            raise ErroDeEntrada(
                f"--mes {mes} nao tem nenhum lancamento nos livros informados (meses presentes: "
                f"{', '.join(presentes)}). Analisar um mes sem dado exigiria inventar o dado."
            )

        janela = [m for m in presentes if m <= mes]
        fora = [m for m in presentes if m > mes]
        recorrencias = (
            ler_csv(args.recorrencias, ["nome", "tipo", "valor"], "recorrencias.csv")
            if args.recorrencias else None
        )
        resultado = analisar(
            [l for l in linhas if l["_mes"] in set(janela)], mes, janela, recorrencias
        )
    except ErroDeEntrada as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 1

    if fora:
        resultado["meses_posteriores_ignorados"] = fora
    if legados:
        resultado["compatibilidade"] = (
            f"{len(legados)} livro(s) com cabecalho antigo (sem coluna `tipo`): todas as linhas "
            f"deles lidas como despesa"
        )

    json.dump(resultado, sys.stdout, ensure_ascii=False, indent=2)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())

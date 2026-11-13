#!/usr/bin/env python3
"""Nota de mercado -> lancamento no livro, agrupado por categoria do catalogo.

Cobre o Fluxo 2 da skill `mercado`. E a conta de dinheiro mais perigosa que restava no hestia,
e nao por ser a mais difícil: e a unica cujo resultado e GRAVADO. As analises erradas produzem
uma frase errada, que o usuario pode estranhar; esta produz uma linha de despesa errada no livro
do orcamento, que depois vira base de media, de desvio e de tendencia nas outras skills. Erro
aqui se propaga para todas as demais contas do plugin.

Faz as tres contas que a skill `mercado` define, e nao so o agrupamento:

- **Agrupa por `categoria` do catalogo e soma cada grupo** (Fluxo 2, passo 1), produzindo uma
  linha de despesa por categoria no formato do livro.
- **Confere `quantidade` x `valor_unitario` ~ `valor_total`** por item. Isso nao e zelo extra:
  e o motivo declarado de o contrato guardar os dois campos ("guardar os dois valida a
  extracao", secao "Itens do mes"). Tolerancia de **1 centavo**, que e o quanto o mercado
  truncar em vez de arredondar pode custar (0,850 kg x 24,90 = 21,165: a nota escreve 21,16 ou
  21,17, e os dois distam 0,005 do exato). Acima disso a linha foi extraida errado.
- **Confere a soma dos itens contra o total da nota**, quando o total vem em `--total-da-nota`
  (Fluxo 1, passo 2).

**Cada nota tem identidade propria** (achado HES-04, decisao do dono): a coluna `nota` do
`AAAA-MM-itens.csv` guarda `AAAA-MM-DD-N`, a data da nota e um sequencial entre as notas daquela
data. Antes dela a nota era o par (data, mercado), e duas compras no mesmo mercado no mesmo dia
viravam uma so: o lancamento somava as duas, ou a segunda nunca entrava no livro porque a
descricao repetia a da primeira. A descricao do lancamento agora carrega o identificador, e
`--nota` filtra por ele.

Arquivo sem a coluna (dados ja gravados no Drive) continua valendo, com a identidade antiga e
sem reinterpretacao: linha sem identificador nao ganha um inventado, e a descricao proposta para
ela e a do formato anterior, a mesma dos lancamentos ja gravados. Como ali duas compras do mesmo
dia e mercado sao indistinguiveis, o lancamento so e proposto depois que o usuario confirma que
a selecao e uma nota so (`--nota-unica-confirmada`).

No arquivo migrado (cabecalho com `nota`, linhas antigas com o campo vazio) a compra antiga ainda
nao lancada pode dividir mercado e dia com uma compra nova identificada. `--data`/`--mercado`
pegam as duas, e `--nota` so pega linha identificada; `--sem-nota` e o filtro das linhas sem
identificador, combinavel com os outros dois, e e o caminho que o `lancamento_motivo` aponta.

As duas conferencias **relatam, nao recusam** — a skill manda "mostre e pergunte antes de
seguir", e a decisao e do usuario. Recusar aqui trocaria o julgamento dele pelo meu.

Item fora do catalogo nao tem `categoria` e nao pode entrar em grupo nenhum. Ele **nao** derruba
a nota inteira: sai em `sem_categoria` com o valor, e o `lancamento_proposto` carrega
`nao_coberto` justamente para que o buraco seja impossivel de narrar por omissao. Lancar menos
do que se gastou e o modo de falha desta funcao, e por isso o numero do que ficou de fora anda
junto do que vai ser gravado, e nao numa secao separada que se esquece de ler.

100% leitura. Nao grava nada e nao acessa o Drive: os CSVs chegam por caminho ou stdin, e quem
grava no livro e o fluxo da skill, depois da confirmacao do usuario.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from decimal import Decimal

from brl import ErroDeEntrada, arredondar, brl, centavos_exatos, dinheiro, pct
from dados import ler_csv

# 1 centavo: ver a justificativa no cabecalho. Constante para o golden nao congelar um numero
# solto e para a mensagem de divergencia poder cita-la.
TOLERANCIA_EXTRACAO = Decimal("0.01")

# Identificador da nota: data da nota + sequencial entre as notas daquela data no arquivo.
FORMATO_NOTA = re.compile(r"^(\d{4}-\d{2}-\d{2})-[1-9]\d*$")


def identidade(item: dict) -> tuple[str | None, str, str]:
    """(nota, data, mercado) do item. `nota` None e a identidade antiga, por (data, mercado)."""
    data = item.get("data") or ""
    nota = (item.get("nota") or "").strip() or None
    if nota is not None:
        formato = FORMATO_NOTA.match(nota)
        if not formato:
            raise ErroDeEntrada(
                f"nota {nota!r} ({item.get('produto')}, {data}) fora do formato AAAA-MM-DD-N. "
                f"Agrupar por um identificador que nao se sabe ler fundiria ou separaria notas "
                f"por acaso."
            )
        if formato.group(1) != data:
            raise ErroDeEntrada(
                f"nota {nota} esta numa linha com data {data} ({item.get('produto')}). O "
                f"identificador carrega a data da nota; os dois discordando e linha editada pela "
                f"metade, e agrupar assim gravaria a compra no dia errado."
            )
    return nota, data, item.get("mercado") or ""


def notas_da_selecao(itens: list[dict]) -> list[tuple[str | None, str, str]]:
    """Notas distintas da selecao, recusando identificador repetido em compras diferentes."""
    vistas: dict[str, tuple[str, str]] = {}
    chaves = set()
    for item in itens:
        nota, data, mercado = identidade(item)
        if nota is not None:
            antes = vistas.setdefault(nota, (data, mercado))
            if antes != (data, mercado):
                raise ErroDeEntrada(
                    f"a nota {nota} aparece em mais de uma compra ({antes[0]} {antes[1]}; "
                    f"{data} {mercado}). Identificador repetido funde duas notas, que e o "
                    f"defeito que ele existe para impedir: corrija o identificador no arquivo."
                )
        chaves.add((nota, data, mercado))
    # Linha antiga (nota None) antes das identificadas na mesma data: ordena por texto vazio.
    return sorted(chaves, key=lambda k: (k[1], k[2], k[0] or ""))


def tem_quantidade(item: dict) -> bool:
    """Item com os dois campos que a conferencia de extracao precisa.

    Item sem quantidade legivel e caso PREVISTO pelo contrato — a skill manda registra-lo com
    `quantidade` e `valor_unitario` vazios e so o `valor_total`. Conferir esse item exigiria
    inventar a quantidade.
    """
    return bool(item.get("quantidade") or "") and bool(item.get("valor_unitario") or "")


def conferir_extracao(item: dict) -> dict | None:
    """`quantidade` x `valor_unitario` vs `valor_total`. None quando fecha na tolerancia."""
    qtd, unitario = item["quantidade"], item["valor_unitario"]
    nome = item["produto"]
    esperado = brl(qtd, f"quantidade ({nome})") * brl(unitario, f"valor_unitario ({nome})")
    total = brl(item["valor_total"], f"valor_total ({nome})")
    diferenca = total - esperado
    if abs(diferenca) <= TOLERANCIA_EXTRACAO:
        return None
    return {
        "produto": nome,
        "data": item.get("data"),
        "quantidade": qtd,
        "valor_unitario": dinheiro(brl(unitario)),
        "valor_total": dinheiro(total),
        "esperado": dinheiro(esperado),
        "diferenca": dinheiro(diferenca),
        "tolerancia": dinheiro(TOLERANCIA_EXTRACAO),
    }


def agrupar(itens: list[dict], catalogo: dict[str, dict]) -> dict:
    por_categoria: dict[str, Decimal] = defaultdict(Decimal)
    quantos: dict[str, int] = defaultdict(int)
    sem_categoria, divergencias, sem_quantidade = [], [], []
    total_geral = Decimal(0)
    fora = Decimal(0)

    for item in itens:
        nome = item["produto"]
        data = item.get("data") or "?"
        bruto = item.get("valor_total") or ""
        if not bruto:
            raise ErroDeEntrada(
                f"item '{nome}' ({data}) esta sem `valor_total`. E o unico campo que sempre "
                f"existe no contrato — sem ele nao ha o que somar, e estimar pelo unitario "
                f"inventaria dinheiro que vai ser GRAVADO no livro."
            )
        valor = centavos_exatos(
            bruto, f"valor_total ({nome}, {data})",
            "faria a soma das linhas gravadas no livro divergir do total da nota",
        )
        total_geral += valor

        if not tem_quantidade(item):
            sem_quantidade.append({
                "produto": nome, "data": item.get("data"), "valor_total": dinheiro(valor),
                "motivo": "registrado so com valor_total (contrato da skill); fica fora da "
                          "conferencia de extracao e das comparacoes de preco unitario",
            })
        else:
            divergencia = conferir_extracao(item)
            if divergencia:
                divergencias.append(divergencia)

        categoria = (catalogo.get(nome, {}).get("categoria") or "").strip()
        if not categoria:
            # `fora` e ACUMULADO aqui, e nao derivado de `total_geral - agrupado`. A subtracao
            # daria o mesmo numero e tornaria o invariante "agrupado + fora = total" verdadeiro
            # por construcao — ou seja, um teste que nao pode falhar, que e o mesmo que nao
            # existir. Somando os dois lados de forma independente, o invariante mede algo.
            fora += valor
            sem_categoria.append({
                "produto": nome, "data": item.get("data"), "valor_total": dinheiro(valor),
                "motivo": "produto sem `categoria` no catalogo — sem ela nao ha grupo, e "
                          "chutar um grupo gravaria despesa na categoria errada",
            })
            continue
        por_categoria[categoria] += valor
        quantos[categoria] += 1

    agrupado = sum(por_categoria.values(), Decimal(0))

    return {
        "itens_considerados": len(itens),
        "total_dos_itens": dinheiro(total_geral),
        "total_agrupado": dinheiro(agrupado),
        "total_sem_categoria": dinheiro(fora),
        "por_categoria": [
            {
                "categoria": c,
                "valor": dinheiro(v),
                "itens": quantos[c],
                "pct_do_agrupado": pct(v / agrupado) if agrupado > 0 else None,
            }
            for c, v in sorted(por_categoria.items(), key=lambda kv: (-kv[1], kv[0]))
        ],
        "sem_categoria": sem_categoria,
        "itens_sem_quantidade": sem_quantidade,
        "divergencias_de_extracao": divergencias,
    }


def propor_lancamento(
    notas: list[tuple[str | None, str, str]], grupos: dict, nota_unica_confirmada: bool
) -> tuple[dict | None, str | None]:
    """Uma linha de despesa por categoria, no formato do livro (Fluxo 2, passo 2).

    Exige UMA nota: a descricao identifica a nota, e duas notas no mesmo lote nao tem descricao
    unica que seja verdade. Em vez de inventar um rotulo guarda-chuva, devolve as notas achadas
    e o filtro que isola cada uma; o agrupamento acima continua valendo como informacao.
    """
    if len(notas) != 1:
        rotulos = "; ".join(
            f"nota {n} em {m}" if n else f"sem `nota`, {d} em {m}" for n, d, m in notas
        )
        caminhos = []
        if any(n is not None for n, _, _ in notas):
            caminhos.append("--nota <AAAA-MM-DD-N> para uma nota identificada")
        if any(n is None for n, _, _ in notas):
            # So --data/--mercado nao basta no arquivo migrado: pegam tambem a compra nova
            # identificada do mesmo dia e mercado, e a selecao volta a ter duas notas.
            caminhos.append(
                "--sem-nota junto de --data e --mercado para as linhas sem `nota` (formato "
                "anterior a 0.13.0)"
            )
        return None, (
            f"a selecao tem {len(notas)} notas distintas ({rotulos}). A descricao do lancamento "
            f"identifica a nota, entao o lote precisa de uma nota por vez: filtre com "
            f"{'; ou com '.join(caminhos)}."
        )
    nota, data, mercado = notas[0]
    if nota is None and not nota_unica_confirmada:
        return None, (
            f"linhas sem `nota` (formato anterior a 0.13.0): a identidade e (data, mercado), e "
            f"duas compras em {mercado} no dia {data} estariam fundidas nesta selecao de "
            f"{grupos['itens_considerados']} itens, R$ {grupos['total_dos_itens']}. Pergunte ao "
            f"usuario se isso e UMA nota (o total impresso ajuda); so com o sim rode de novo com "
            f"--nota-unica-confirmada."
        )
    if nota is None:
        # Formato anterior, de proposito: e o texto dos lancamentos ja gravados, e a checagem de
        # duplicidade no livro compara descricao. Trocar aqui faria nota antiga parecer nova.
        descricao = f"Mercado {mercado} — nota de {data[8:10]}/{data[5:7]}"
    else:
        descricao = f"Mercado {mercado} (nota {nota})"
    return {
        "nota": nota,
        "identidade": "legada" if nota is None else "nota",
        "data": data,
        "mercado": mercado,
        "descricao": descricao,
        # `metodo` fica nulo de proposito: a skill manda usar o da nota se visivel e PERGUNTAR
        # se nao. O script nao ve a nota, so o CSV — preencher aqui seria adivinhar.
        "metodo": None,
        "metodo_motivo": "use o metodo da nota se visivel; senao pergunte ao usuario (Fluxo 2)",
        "linhas": [
            {
                "data": data, "tipo": "despesa", "categoria": g["categoria"],
                "descricao": descricao, "valor": g["valor"],
            }
            for g in grupos["por_categoria"]
        ],
        "total": grupos["total_agrupado"],
        "nao_coberto": grupos["total_sem_categoria"],
    }, None


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--itens", required=True, help="AAAA-MM-itens.csv, ou - para stdin")
    p.add_argument("--catalogo", required=True, help="produtos.csv")
    p.add_argument("--data", help="AAAA-MM-DD da nota (filtro)")
    p.add_argument("--mercado", help="nome do mercado (filtro, comparacao exata)")
    p.add_argument("--nota", help="identificador AAAA-MM-DD-N da nota (filtro, coluna `nota`)")
    p.add_argument("--sem-nota", action="store_true",
                   help="so linhas sem identificador na coluna `nota` (formato anterior a "
                        "0.13.0); combine com --data e --mercado")
    p.add_argument("--nota-unica-confirmada", action="store_true",
                   help="linhas sem `nota` (arquivo antigo ou --sem-nota): o usuario "
                        "confirmou que a selecao e UMA nota")
    p.add_argument("--total-da-nota", help="total impresso na nota, para conferir a soma")
    args = p.parse_args(argv)

    try:
        itens = ler_csv(args.itens, ["data", "mercado", "produto", "valor_total"], "itens")
        legado = "nota" not in itens[0]
        catalogo = {
            c["produto"]: c
            for c in ler_csv(args.catalogo, ["produto", "categoria"], "produtos.csv")
        }
        if args.nota is not None and not args.nota.strip():
            # Descartar o vazio, como o `if args.nota` fazia, transformava a selecao no arquivo
            # inteiro em silencio.
            raise ErroDeEntrada(
                "--nota vazio. Para selecionar as linhas sem identificador use --sem-nota, junto "
                "de --data e --mercado."
            )
        if args.nota is not None and args.sem_nota:
            raise ErroDeEntrada(
                "--nota e --sem-nota se excluem: um pega so a nota identificada, o outro so as "
                "linhas sem identificador."
            )
        if args.nota and legado:
            raise ErroDeEntrada(
                "--nota pedido, mas o arquivo de itens esta sem a coluna `nota` (formato anterior "
                "a 0.13.0): nele a nota e identificada por --data e --mercado."
            )
        if args.data:
            itens = [i for i in itens if (i.get("data") or "") == args.data]
        if args.mercado:
            itens = [i for i in itens if (i.get("mercado") or "") == args.mercado]
        if args.nota:
            itens = [i for i in itens if (i.get("nota") or "").strip() == args.nota]
        if args.sem_nota:
            itens = [i for i in itens if not (i.get("nota") or "").strip()]
        if not itens:
            raise ErroDeEntrada(
                "nenhum item na selecao (--data/--mercado/--nota/--sem-nota nao casaram com linha "
                "nenhuma). Agrupar zero item devolveria um lancamento de R$ 0,00 com cara de nota "
                "vazia."
            )

        notas = notas_da_selecao(itens)
        grupos = agrupar(itens, catalogo)
        proposto, motivo = propor_lancamento(notas, grupos, args.nota_unica_confirmada)

        resultado = {
            "notas_na_selecao": [{"nota": n, "data": d, "mercado": m} for n, d, m in notas],
            **grupos,
            "lancamento_proposto": proposto,
        }
        if motivo:
            resultado["lancamento_motivo"] = motivo
        if legado:
            resultado["compatibilidade"] = (
                "arquivo de itens sem a coluna `nota` (formato anterior a 0.13.0): a nota e "
                "identificada por (data, mercado), sem identificador inventado para as linhas"
            )

        if args.total_da_nota:
            informado = brl(args.total_da_nota, "--total-da-nota")
            soma = brl(grupos["total_dos_itens"])
            resultado["conferencia_do_total_da_nota"] = {
                "informado": dinheiro(informado),
                "soma_dos_itens": dinheiro(soma),
                "diferenca": dinheiro(soma - informado),
                "confere": arredondar(soma) == arredondar(informado),
            }
    except ErroDeEntrada as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 1

    resultado["criterios"] = {
        "agrupamento": "pela coluna `categoria` do produtos.csv; a soma de cada grupo e de "
                       "`valor_total`, o unico campo que todo item tem",
        "extracao": f"quantidade x valor_unitario comparado a valor_total, tolerancia de "
                    f"{dinheiro(TOLERANCIA_EXTRACAO)} (1 centavo, o custo de o mercado truncar "
                    f"em vez de arredondar); item sem quantidade fica fora da conferencia",
        "divergencia": "relatada, nunca recusada — a skill manda mostrar e perguntar antes de "
                       "seguir, e a decisao de gravar assim mesmo e do usuario",
        "formato": "os valores saem com PONTO decimal, que e o padrao do JSON no hestia. Ao "
                   "GRAVAR no livro converta para virgula (tabela BRL <-> cru da skill): planilha "
                   "em pt-BR le '312.40' como 31240",
        "item_orfao": "segregado em `sem_categoria` e somado em `nao_coberto` dentro do proprio "
                      "lancamento proposto, para que lancar menos do que se gastou nao passe "
                      "por omissao na narrativa",
    }
    resultado["criterios"]["identidade"] = (
        "cada nota e a coluna `nota` (AAAA-MM-DD-N); linha sem identificador vale pela "
        "identidade antiga (data, mercado), e selecionada por --sem-nota com --data e --mercado "
        "e so ganha lancamento com --nota-unica-confirmada"
    )
    resultado["simplificacoes"] = [
        "`--data`, `--mercado` e `--nota` comparam o texto exato como esta no CSV, sem "
        "normalizar acento nem caixa: 'Atacadao' nao casa com 'Atacadão'",
        "a conferencia do total da nota compara o total de TODOS os itens da selecao, orfaos "
        "inclusive — e o que a nota impressa cobra, diferente do que o lancamento cobre",
    ]

    json.dump(resultado, sys.stdout, ensure_ascii=False, indent=2)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())

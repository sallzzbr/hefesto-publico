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
import sys
from collections import defaultdict
from decimal import Decimal

from brl import ErroDeEntrada, arredondar, brl, centavos_exatos, dinheiro, pct
from dados import ler_csv

# 1 centavo: ver a justificativa no cabecalho. Constante para o golden nao congelar um numero
# solto e para a mensagem de divergencia poder cita-la.
TOLERANCIA_EXTRACAO = Decimal("0.01")


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


def propor_lancamento(notas: list[tuple[str, str]], grupos: dict) -> tuple[dict | None, str | None]:
    """Uma linha de despesa por categoria, no formato do livro (Fluxo 2, passo 2).

    Exige UMA nota: a descricao que a skill especifica nomeia o mercado e a data ("Mercado Pao
    de Acucar — nota de 12/07"), e duas notas no mesmo lote nao tem descricao unica que seja
    verdade. Em vez de inventar um rotulo guarda-chuva, devolve as notas achadas para quem chama
    filtrar — o agrupamento acima continua valendo como informacao.
    """
    if len(notas) != 1:
        return None, (
            f"a selecao tem {len(notas)} notas distintas ({'; '.join(f'{d} {m}' for d, m in notas)}"
            f"). A descricao do lancamento nomeia mercado e data, entao o lote precisa de uma "
            f"nota por vez: filtre com --data e --mercado."
        )
    data, mercado = notas[0]
    descricao = f"Mercado {mercado} — nota de {data[8:10]}/{data[5:7]}"
    return {
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
    p.add_argument("--total-da-nota", help="total impresso na nota, para conferir a soma")
    args = p.parse_args(argv)

    try:
        itens = ler_csv(args.itens, ["data", "mercado", "produto", "valor_total"], "itens")
        catalogo = {
            c["produto"]: c
            for c in ler_csv(args.catalogo, ["produto", "categoria"], "produtos.csv")
        }
        if args.data:
            itens = [i for i in itens if (i.get("data") or "") == args.data]
        if args.mercado:
            itens = [i for i in itens if (i.get("mercado") or "") == args.mercado]
        if not itens:
            raise ErroDeEntrada(
                "nenhum item na selecao (--data/--mercado nao casaram com linha nenhuma). "
                "Agrupar zero item devolveria um lancamento de R$ 0,00 com cara de nota vazia."
            )

        grupos = agrupar(itens, catalogo)
        notas = sorted({(i.get("data") or "", i.get("mercado") or "") for i in itens})
        proposto, motivo = propor_lancamento(notas, grupos)

        resultado = {
            "notas_na_selecao": [{"data": d, "mercado": m} for d, m in notas],
            **grupos,
            "lancamento_proposto": proposto,
        }
        if motivo:
            resultado["lancamento_motivo"] = motivo

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
    resultado["simplificacoes"] = [
        "`--data` e `--mercado` comparam o texto exato como esta no CSV, sem normalizar acento "
        "nem caixa: 'Atacadao' nao casa com 'Atacadão'",
        "a conferencia do total da nota compara o total de TODOS os itens da selecao, orfaos "
        "inclusive — e o que a nota impressa cobra, diferente do que o lancamento cobre",
    ]

    json.dump(resultado, sys.stdout, ensure_ascii=False, indent=2)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())

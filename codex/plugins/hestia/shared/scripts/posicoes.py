#!/usr/bin/env python3
"""Atualizacao de posicoes: antes/depois por ativo, contra o print da corretora.

Cobre o Fluxo 2 da skill `investimentos` ("mostre antes/depois — saldo antigo -> novo, com a
variacao em BRL e %"). Era a ultima conta em prosa do plugin, e escapou das varreduras
anteriores porque nao parece uma conta: e uma subtracao e uma divisao por posicao, no momento
em que o usuario confirma uma ESCRITA em `carteira.csv` e `snapshots.csv`. Um `%` errado ali e
um update ruim aprovado com numero bonito.

Por que nao da para o `rendimento.py` fazer isto, ainda que ele tambem compare saldos: ele le
`snapshots.csv`, ou seja, dado JA GRAVADO. Aqui o saldo novo vem de um print da corretora e
ainda nao existe em arquivo nenhum. Entrada diferente, pergunta diferente.

O script nao le o print — quem extrai e o modelo, e a skill manda perguntar o que estiver
ilegivel. As posicoes lidas chegam num CSV `ativo;saldo[;quantidade]`, e o script faz o resto.

Os tres casos do Fluxo 2, e o que cada um faz com o arquivo:

- **Existente nos dois** — variacao em BRL e %, e a linha entra na carteira proposta com o saldo
  novo e `atualizado_em` = data do print.
- **Novo no print** — a skill manda PROPOR CADASTRAR, e classe/instituicao/indexador nao estao
  no print. Sai em `novos_no_print` com o saldo e os campos que faltam nomeados; nao vira linha
  de carteira, porque montar uma linha com `classe` chutada gravaria dado inventado.
- **Ausente do print** — a skill diz "NUNCA remova sozinho". Ele fica na carteira proposta com o
  saldo ANTIGO e, principalmente, com o `atualizado_em` ANTIGO: bumpar a data afirmaria que a
  posicao foi conferida naquele print, e ela nao foi. E nao ganha snapshot, por consequencia
  direta disso — um snapshot com saldo velho na data de hoje faria o `rendimento.py` calcular
  variacao zero e reportar "estavel" onde a verdade e "nao sei".

Divisao por zero tem o mesmo tratamento que a taxa de poupanca do `resumo_mes.py`: posicao que
vinha de saldo 0 nao tem variacao percentual, e o campo vem `null` com motivo em vez de um
numero. 0% ali afirmaria "nao mudou" sobre uma posicao que saiu do zero.

100% leitura. Nao grava nada e nao acessa o Drive: os CSVs chegam por caminho ou stdin, e quem
grava e o fluxo da skill, depois da confirmacao do usuario.
"""

from __future__ import annotations

import argparse
import json
import sys
from decimal import Decimal

from brl import ErroDeEntrada, brl, centavos_exatos, dinheiro, pct
from dados import ler_csv

MOTIVO_SEM_BASE = (
    "saldo anterior era R$ 0,00 — nao ha base para variacao percentual, e 0% afirmaria "
    "'nao mudou' sobre uma posicao que saiu do zero"
)
CAMPOS_DO_CADASTRO = ("classe", "instituicao", "indexador", "vencimento")


def indexar(linhas: list[dict], campo: str, rotulo: str) -> dict[str, dict]:
    """Indexa por `ativo`, recusando repetido.

    `ativo` e "nome legivel unico" no contrato. Repetido nao e detalhe: em `carteira.csv` ele
    duplicaria a posicao no patrimonio, e no print nao se sabe qual saldo vale. As duas coisas
    mudam um numero, entao as duas param.
    """
    indice: dict[str, dict] = {}
    for linha in linhas:
        nome = (linha.get(campo) or "").strip()
        if not nome:
            raise ErroDeEntrada(f"{rotulo}: linha sem `{campo}` — sem o nome nao da para casar")
        if nome in indice:
            raise ErroDeEntrada(
                f"{rotulo}: o ativo '{nome}' aparece duas vezes. O contrato pede nome unico; "
                f"somar os dois inflaria o patrimonio e escolher um exigiria adivinhar."
            )
        indice[nome] = linha
    return indice


def variacao(antes: Decimal, depois: Decimal) -> dict:
    delta = depois - antes
    return {
        "saldo_antes": dinheiro(antes),
        "saldo_depois": dinheiro(depois),
        "variacao": dinheiro(delta),
        "variacao_pct": pct(delta / antes) if antes > 0 else None,
        **({} if antes > 0 else {"variacao_pct_motivo": MOTIVO_SEM_BASE}),
    }


def comparar(carteira: dict[str, dict], print_: dict[str, dict], data: str) -> dict:
    atualizadas, novos, ausentes = [], [], []
    carteira_proposta, snapshots = [], []
    antes_total = depois_total = confirmado_antes = confirmado_depois = Decimal(0)

    for ativo, atual in sorted(carteira.items()):
        antes = centavos_exatos(
            atual["saldo"], f"carteira.saldo ({ativo})",
            "faria o patrimonio divergir da soma das linhas gravadas",
        )
        antes_total += antes
        lido = print_.get(ativo)

        if lido is None:
            # "NUNCA remova sozinho": a linha e mantida INTACTA, com a data antiga inclusive.
            ausentes.append({
                "ativo": ativo,
                "saldo_na_carteira": dinheiro(antes),
                "atualizado_em": atual.get("atualizado_em"),
                "motivo": "nao aparece no print — pergunte o que houve (resgatou? venceu? so nao "
                          "aparece nesse print?). A linha fica como esta, e a data NAO avanca: "
                          "bumpar afirmaria que a posicao foi conferida neste print",
            })
            intacta = dict(atual)
            # O saldo passa pelo `dinheiro()` mesmo sem mudar de valor. Copiar o texto cru do CSV
            # deixaria ESTA linha com virgula decimal e as atualizadas com ponto, no mesmo array
            # que a skill vai gravar — e a linha gravada em formato diferente das vizinhas e
            # exatamente o tipo de sujeira que ninguem revisa. O valor nao muda; o formato, sim.
            intacta["saldo"] = dinheiro(antes)
            carteira_proposta.append(intacta)
            depois_total += antes
            continue

        depois = centavos_exatos(
            lido["saldo"], f"print.saldo ({ativo})",
            "faria o patrimonio divergir da soma das linhas gravadas",
        )
        depois_total += depois
        confirmado_antes += antes
        confirmado_depois += depois

        ficha = {"ativo": ativo, "classe": atual.get("classe"), **variacao(antes, depois)}
        qtd_antes = (atual.get("quantidade") or "").strip()
        qtd_depois = (lido.get("quantidade") or "").strip()
        if qtd_depois:
            ficha["quantidade_antes"] = qtd_antes or None
            ficha["quantidade_depois"] = qtd_depois
            # Bandeira, nao conta nova: com a quantidade mudando, a variacao de saldo mistura
            # aporte com rendimento, e separar os dois exige `movimentos.csv` — que e o
            # `rendimento.py`. Narrar "subiu 12%" sem dizer isso credita ao mercado o que foi
            # compra do usuario.
            ficha["quantidade_mudou"] = bool(qtd_antes) and qtd_antes != qtd_depois
        atualizadas.append(ficha)

        linha = dict(atual)
        linha["saldo"] = dinheiro(depois)
        linha["atualizado_em"] = data
        if qtd_depois:
            linha["quantidade"] = qtd_depois
        carteira_proposta.append(linha)
        snapshots.append({"data": data, "ativo": ativo, "saldo": dinheiro(depois)})

    for ativo, lido in sorted(print_.items()):
        if ativo in carteira:
            continue
        saldo = centavos_exatos(
            lido["saldo"], f"print.saldo ({ativo})",
            "faria o patrimonio divergir da soma das linhas gravadas",
        )
        depois_total += saldo
        novos.append({
            "ativo": ativo,
            "saldo": dinheiro(saldo),
            "quantidade": (lido.get("quantidade") or "").strip() or None,
            "falta_cadastrar": list(CAMPOS_DO_CADASTRO),
            "motivo": "ativo novo no print — a skill manda propor cadastrar, e estes campos nao "
                      "estao no print. Sem eles a linha nao entra na carteira proposta: montar "
                      "uma com `classe` chutada gravaria dado inventado",
        })

    return {
        "data_do_print": data,
        "patrimonio_antes": dinheiro(antes_total),
        "patrimonio_depois": dinheiro(depois_total),
        "patrimonio_variacao": dinheiro(depois_total - antes_total),
        "variacao_das_posicoes_confirmadas": {
            **variacao(confirmado_antes, confirmado_depois),
            "posicoes": len(atualizadas),
        },
        "atualizadas": atualizadas,
        "novos_no_print": novos,
        "ausentes_do_print": ausentes,
        "carteira_proposta": carteira_proposta,
        "snapshots_propostos": snapshots,
    }


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--carteira", required=True, help="carteira.csv, ou - para stdin")
    p.add_argument("--print", dest="print_", required=True,
                   help="CSV `ativo;saldo[;quantidade]` com o que foi lido do print")
    p.add_argument("--data", required=True, help="AAAA-MM-DD do print (vira `atualizado_em`)")
    args = p.parse_args(argv)

    try:
        if len(args.data) != 10 or args.data[4] != "-" or args.data[7] != "-":
            raise ErroDeEntrada(
                f"--data {args.data!r} nao esta em AAAA-MM-DD. Ela vira `atualizado_em` na "
                f"carteira e a data do snapshot: errada, desalinha a serie historica que o "
                f"rendimento.py le."
            )
        carteira = indexar(
            ler_csv(args.carteira, ["ativo", "saldo"], "carteira.csv"), "ativo", "carteira.csv"
        )
        lido = indexar(
            ler_csv(args.print_, ["ativo", "saldo"], "print"), "ativo", "print"
        )
        resultado = comparar(carteira, lido, args.data)
    except ErroDeEntrada as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 1

    resultado["criterios"] = {
        "variacao": "saldo_depois - saldo_antes, e o percentual sobre o saldo ANTERIOR; saldo "
                    "anterior zero devolve null com motivo, nunca 0%",
        "ausente_do_print": "mantido na carteira proposta com saldo E data antigos, e SEM "
                            "snapshot — snapshot com saldo velho na data de hoje faria o "
                            "rendimento.py reportar 'estavel' onde a verdade e 'nao sei'",
        "novo_no_print": "sai fora da carteira proposta, com os campos de cadastro que faltam "
                         "nomeados; a skill manda propor cadastrar, e o print nao tem esses dados",
        "quantidade_mudou": "bandeira, nao conta: com a quantidade mudando, a variacao de saldo "
                            "mistura aporte com rendimento, e separar os dois e o rendimento.py",
        "formato": "os valores saem com PONTO decimal, que e o padrao do JSON no hestia. Ao "
                   "GRAVAR no CSV converta para virgula (tabela BRL <-> cru da skill): planilha "
                   "em pt-BR le '312.40' como 31240, e a carteira apareceria inflada no Drive",
    }
    resultado["simplificacoes"] = [
        "`patrimonio_depois` inclui as posicoes ausentes do print pelo saldo ANTIGO (porque nao "
        "sao removidas) — ou seja, mistura conferido com nao conferido. Para o numero limpo do "
        "que de fato mexeu, use `variacao_das_posicoes_confirmadas`",
        "o casamento de ativo e por texto exato, sem normalizar acento nem caixa: 'ivvb11' nao "
        "casa com 'IVVB11' e apareceria como ativo novo",
    ]

    json.dump(resultado, sys.stdout, ensure_ascii=False, indent=2)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())

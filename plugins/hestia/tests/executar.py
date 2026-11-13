"""Roda o `main()` dos scripts NO PROCESSO do pytest, em vez de por subprocess.

Por que isto existe, e por que a mudanca importa mais do que parece:

A primeira versao destes testes chamava os scripts por `subprocess.run([sys.executable, ...])`.
Funcionava, era end-to-end e parecia solido. Mas quando o mutation testing entrou, ficou claro
que aquele desenho tornava os testes **inmensuraveis**: o mutmut instrumenta o codigo com um
trampolim que le `MUTANT_UNDER_TEST` do processo, e um subprocess roda fora dessa instrumentacao.
Todo mutante "sobreviveria", o score sairia 0% e o gate central seria uma mentira educada.

A licao generaliza: **teste que atravessa fronteira de processo nao enxerga o mutante**. Se a
suite existe para sustentar a decisao de nao ler o diff, ela precisa ser mensuravel — e
mensurabilidade e propriedade do desenho do teste, nao da ferramenta.

O que se perde: a cobertura do `if __name__ == "__main__"` e do parse de argv pelo argparse.
O que se ganha: a suite inteira passa a ser visivel ao mutation testing, e roda ~10x mais
rapido. Alguns poucos testes de fronteira de CLI continuam por subprocess, marcados, e estao
conscientemente fora da medicao.
"""

from __future__ import annotations

import importlib
import io
import json
import sys
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))


def executar(script: str, *args: str) -> tuple[int, str, str]:
    """Invoca `main(argv)` do script e devolve (exit_code, stdout, stderr)."""
    modulo = importlib.import_module(script.removesuffix(".py"))
    saida, erro = io.StringIO(), io.StringIO()
    with redirect_stdout(saida), redirect_stderr(erro):
        codigo = modulo.main(list(args))
    return codigo, saida.getvalue(), erro.getvalue()


def rodar(script: str, *args: str) -> dict:
    """Executa esperando sucesso e devolve o JSON."""
    codigo, saida, erro = executar(script, *args)
    assert codigo == 0, f"{script} saiu {codigo}\nstderr: {erro}"
    return json.loads(saida)


def falhar(script: str, *args: str) -> str:
    """Executa esperando exit 1 e devolve o stderr, para conferir a mensagem."""
    codigo, _saida, erro = executar(script, *args)
    assert codigo == 1, f"esperado exit 1 de {script}, veio {codigo}"
    return erro

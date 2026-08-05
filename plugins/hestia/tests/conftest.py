"""Registra a flag `--golden-overwrite` no pytest.

Ela ja era a via documentada de atualizar golden nos tres arquivos de golden test — mas nao
existia: o pytest so aceita opcao registrada, e `pytest ... --golden-overwrite` morria em
`error: unrecognized arguments` antes de coletar um teste sequer. O caminho de atualizacao
estava escrito e nao funcionava, o que empurra quem precisa mexer num golden para apagar o
arquivo e deixar o teste recria-lo — que e a mesma coisa SEM o diff, ou seja, sem a revisao que
e o ponto inteiro do desenho.

O `conferir()` de cada arquivo continua lendo `sys.argv` direto, e nao a config do pytest. Isso
e de proposito: `conftest.py` e carregado so quando quem roda e o pytest, e a leitura de argv
mantem os testes rodaveis tambem fora dele. O que falta aqui e so o registro — sem ele o pytest
recusa o processo inteiro.
"""

from __future__ import annotations


def pytest_addoption(parser):
    parser.addoption(
        "--golden-overwrite",
        action="store_true",
        default=False,
        help="reescreve os arquivos .golden.json com a saida atual; o diff e a revisao",
    )

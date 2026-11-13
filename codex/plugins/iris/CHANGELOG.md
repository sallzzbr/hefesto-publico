# Changelog

## 0.1.2

Referências operacionais pessoais abstraídas e consumidores atualizados para o contrato de perfil local do autor.

## 0.1.1

- Registra observação do Codex CLI 0.155.1: contexto herdado com a flag v2 desligada e ligada; isolamento depende do schema exposto, preservando O8 como evidência histórica de código.

- Preserva a fronteira de aprovação para ações destrutivas e efeitos externos ao enxugar perguntas redundantes; teste de contrato após avaliação em sessão Codex real.

## 0.1.0 (2026-11-01)

Primeira distribuição Codex do Iris (fonte: plugin Claude 0.1.0). Skills nativas apontam para os contratos e referências em `shared/`.

O `shared/README.md` traz a integração com a forja: a forja Claude 4.1.0 declara a `iris` como
dependência. No Codex a forja não declara a dependência.

RUNTIME.md próprio, curto: o genérico do marketplace (com bridge, Hestia, Hermes e o MODELOS.md de papéis) mandava herdar modelo e dizia substituir as instruções de modelo dos contratos, que pedem recomendar `model`/`effort` ao destino. O próprio runtime diz que essa recomendação é conteúdo para o destino e não muda a sessão. O `defaultPrompt` deixa de nomear só a família ("para o Codex").

Decisão 19A do dono (2026-11-03): o `RUNTIME.md` ganha a seção "Perguntas ao usuário". Não se pergunta o que dá para verificar por leitura ou comando, o trabalho que não depende da resposta vem antes, a pergunta necessária é curta e completa, fecha a mensagem e encerra o turno, e nada continua executando depois dela; regra de pergunta da skill ou do contrato de domínio se soma. Vai no RUNTIME próprio do pacote, que não é cópia do genérico. Teste que trava a instrução escrita (não o comportamento): `codex/tests/runtime-pergunta.test.mjs`, que lê o RUNTIME de cada pacote do marketplace Codex.

Revisão da decisão 19A (2026-11-03): a regra restringe o fim do turno à pergunta direta; pela ferramenta de interação da sessão a resposta volta no mesmo turno, e nada continua executando antes de ela chegar. Mesma redação dos outros pacotes, para a regra comum não divergir: a sessão também pode ter ferramenta de interação. Caso novo por pacote em `codex/tests/runtime-pergunta.test.mjs`.

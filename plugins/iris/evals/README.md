# Evals do iris

Casos comportamentais no formato `evals/**/prompt.md + graders/criteria.md`, o mesmo usado pelo
Odin. Exigem sessão real com o plugin instalado: o julgamento é de um avaliador (LLM ou humano)
sobre a resposta. Dados e nomes são fictícios.

`tests/contratos.test.mjs` só trava a estrutura (cada caso tem prompt e critério com `## Esperado`
e `## Score`); não mede se o modelo se comporta como descrito.

Como rodar quando houver runner: `claude plugin eval plugins/iris`. Sem runner, rode cada
`prompt.md` numa sessão nova (Claude Code e Codex) e registre o resultado contra o `criteria.md`.

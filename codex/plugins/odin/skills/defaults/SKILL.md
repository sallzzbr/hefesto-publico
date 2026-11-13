---
name: defaults
description: "Configure or show Odin user defaults: mostra defaults, muda meu perfil de custo padrão, idioma padrão, paths padrão de desafios/SPECs/pendências. Use só para consultar ou persistir preferências locais explicitamente pedidas. Perfil nesta execução é dev-loop; entrega, status e placar não são configuração."
---

# defaults

Leia [RUNTIME.md](../../RUNTIME.md), [MODELOS.md](../../MODELOS.md), o [contrato do comando](../../shared/commands/defaults.md) e a [referência de defaults](../../shared/skills/entregar/references/defaults.md). O entrypoint nativo substitui `/defaults`; não execute SlashCommand nem presuma `$ARGUMENTS`. As adaptações abaixo substituem paths, tiering e protocolo históricos.

## Consulta e escrita

1. Resolva a raiz pessoal por `CODEX_HOME` quando explicitamente definido e não vazio; senão use `~/.codex`. Leia somente `<raiz-pessoal>/hefesto/odin/defaults.md` (fallback: `~/.codex/hefesto/odin/defaults.md`). Esta é a resolução canônica do RUNTIME para consulta e escrita, inclusive em ambiente isolado. Não reatribua `CODEX_HOME`, não procure outra raiz se o arquivo estiver ausente e não leia nem altere defaults Claude. Ausência significa sem preferências persistidas: mostre defaults documentados e continue sem criar arquivo. Consulta nunca grava, cria diretórios ou inicia entrega.
2. Campos persistíveis: `idioma` (pt-BR), `perfil_custo_padrao` (Econômico, Balanceado ou Máximo), `convencao_branch` (`feat/<entrega-slug>`), `local_desafios` (`docs/desafios/`), `local_specs` (`docs/plans/`), `local_pendencias` (`docs/pendencias.md`), `abrir_pr_padrao` (pr, commit-local ou perguntar). `local_missoes` é somente fallback de leitura legado. Paths são exemplos do default, não hardcode: resolva pela regra única do RUNTIME, com `AGENTS.md` prevalecendo sobre defaults pessoais.
3. Override da conversa vale para a rodada; persistência exige pedido explícito de torná-lo padrão. Mostre valor atual e proposta. Pedido inequívoco como “mude meu perfil padrão para Econômico” já confirma campo e valor; não repita confirmação. Se faltar campo, valor ou intenção de persistir, pergunte antes de gravar. Não faça nenhuma escrita de configuração real ao apenas executar exemplos/testes desta skill.
4. Valide enumerações e rejeite campos desconhecidos, tokens, senhas, credenciais e PII. Preserve campos/comentários preexistentes e altere apenas os campos autorizados; arquivo ilegível ou formato ambíguo exige resolver a leitura antes de sobrescrever. Só crie diretório/arquivo quando a atualização tiver sido pedida. Reporte caminho e diff dos campos efetivamente alterados.

## Modelos e autorização

Perfis alteram rigor e lotes, não modelo nem effort. Herde modelo e esforço da sessão. Não salve nem traduza `dev_loop_haiku`, `dev_loop_arquiteto`, `dev_loop_modelo_por_step`, `dev_loop_effort_por_step`, `tiering`, `modeloArquiteto` ou fallbacks Claude. Se esses campos existirem no arquivo, informe que são inoperantes no Codex e preserve-os sem aplicar; remoção exige pedido explícito. Preferências de modelo por papel são opcionais em `execucaoCodex.papeis` de um run, apenas quando solicitadas e disponíveis conforme MODELOS.md; não são campos deste arquivo.

`abrir_pr_padrao` e perfil são sugestões; não autorizam commit, push, PR, publicação ou custo. Reutilize autorizações já dadas no escopo da sessão e obtenha as decisões ainda ausentes no fluxo correspondente. Esta skill termina após consultar/atualizar defaults, sem iniciar entrega ou dev-loop.

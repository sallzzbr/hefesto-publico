---
name: atualizar-gdd
description: "Update a living game design document with traceable history. Use when pedir mudar mecânica, atualizar fase ou direção artística, registrar decisão aprovada, arquivar conteúdo substituído ou retomar atualização interrompida do GDD."
---

# Atualizar GDD

## Antes de agir
Leia `${CLAUDE_PLUGIN_ROOT}/references/contrato.md`, `${CLAUDE_PLUGIN_ROOT}/references/historico.md` e `${CLAUDE_PLUGIN_ROOT}/references/compartilhamento.md`. Consulte o GDD e histórico relacionados antes de nova tentativa; registre resultado relevante conforme o contrato comum.

## Input
Mudança solicitada, GDD vigente, requisitos/arquivos afetados e aprovação ou limite de autonomia explícito. Não confundir relato de playtest com autorização.

## Output
Aplicar a sequência de references/historico.md: DEC proposto sem alterar vigente quando aprovação ausente; DEC preparando antes de mutação aprovada; preservar antes/depois; atualizar seções e links; revisar tarefas/evidências afetadas; conferir consistência; incrementar versão central e finalizar DEC aplicado. Usar `${CLAUDE_PLUGIN_ROOT}/templates/registro.md`. Manter EXP/APR anteriores e marcar conclusão superada sem apagá-la.

Se existe DEC preparando, retomar esse registro, conferindo lista de arquivos e estado real; não iniciar outro ID nem repetir geração/build externa. Aprovação incerta ou alteração concorrente exige decisão, preservando evidências. Nunca prometer atomicidade de várias escritas.

Relatório final: versão origem/destino, aprovação usada, DEC, requisitos e arquivos, conteúdo retirado do vigente, localização do antes, tarefas em revisao_necessaria e próxima ação. Critério de conclusão: nenhuma regra antiga contradiz a vigente; todos os links resolvem; versão e estado DEC coerentes.

## Exemplo sintético
MEC-001 muda salto duplo para único por pedido aprovado: preservar regra anterior no DEC, revisar fases dependentes e critérios de teste, manter EXP de salto triplo ruim em telefone. Aprovação do salto único não prova sua jogabilidade.

## Resolução de paths
Pedido explícito > local_jogo no CLAUDE.md do workspace > defaults pessoais local_* > exatamente uma convenção descoberta no cwd > default documentado docs/jogo/. Paths citados são ilustrativos. Múltiplos candidatos exigem esclarecimento. No Codex, usar AGENTS.md e defaults do RUNTIME.md. Acervo só por configuração explícita e autorização.

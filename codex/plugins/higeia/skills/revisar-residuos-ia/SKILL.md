---
name: revisar-residuos-ia
description: "Review local Git worktrees and workflow leftovers. Use when o usuário pedir para arquivar worktrees abandonadas, conferir push antes de remover, revisar worktrees antigas, localizar temporários ou entender o que sobrou de sessões de IA."
---

# Revisar resíduos de IA

Leia [o runtime](../../RUNTIME.md) e [o contrato de diagnóstico](../../shared/skills/revisar-residuos-ia/CONTRATO.md). No workspace em análise, rode com Node.js 22+ o [coletor empacotado](../../shared/scripts/diagnostico.mjs) com `residuos --root "<diretório>"`. Resolva o arquivo relativamente a esta skill. Aplique os critérios de escopo, memória opcional, evidência e saída do contrato.

Para conferir uma execução, siga a seção “Conferir uma execução de workflow” do contrato. Use o coletor deste pacote e, para consultar o estado Codex, a instalação de origem indicada pelo cliente.

Para arquivamento solicitado, siga a seção “Arquivamento solicitado” do contrato usando o [executor do pacote](../../shared/scripts/arquivar-worktree.mjs). Comece com `prever` e aplique apenas ao alvo autorizado com sessão inativa confirmada.

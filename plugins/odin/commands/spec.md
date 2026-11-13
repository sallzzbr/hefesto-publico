---
description: Formalizar ou validar SPEC sem iniciar implementação
argument-hint: <entrega, plano ou descrição>
---

# /spec

Use a skill `entregar` até a aprovação da SPEC (Step 4), com a preparação local descrita em `${CLAUDE_PLUGIN_ROOT}/skills/entregar/references/steps-detalhados.md`, seção "Branch local no planejamento /spec". Antes de gravar a SPEC, detectar `branchBase`, propor `branchTrabalho` pelo nome da entrega e obter OK para criar e entrar na branch local. Carregar o template canônico `${CLAUDE_PLUGIN_ROOT}/skills/dev-loop/references/spec-template.md`.

Pedido inicial: $ARGUMENTS

Objetivo: produzir ou validar uma SPEC aprovada — critérios de aceite verificáveis, mapa
critério↔teste, non-goals, restrições, unidades paralelizáveis. NÃO iniciar implementação, NÃO
pedir opt-in multi-agente, fazer push ou abrir PR. Criação de branch local autorizada não inicia implementação; sem commit automático. Pode registrar um perfil de execução sugerido para
uso futuro; a decisão de executar fica para uma chamada posterior.

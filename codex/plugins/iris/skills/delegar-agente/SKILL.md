---
name: delegar-agente
description: "Write the delegation brief or agent definition for the model that will run it. Use when despachar um subagente, criar ou ajustar um agente, rotear tarefa entre agentes ou modelos, escrever prompt de delegação, ou preparar prompt de continuidade para outra sessão (Claude ou Codex)."
---

# delegar-agente

Leia [RUNTIME.md](../../RUNTIME.md) e o [contrato da skill](../../shared/skills/delegar-agente/CONTRATO.md), com [delegação](../../shared/references/delegacao.md) e o cartão do destino em `shared/references/destinos/`; `${CLAUDE_PLUGIN_ROOT}` nelas significa `shared/`.

Leia esta skill no agente principal e escreva o brief você mesmo: a leitura de skill não se delega a subagente. Escrever o brief não autoriza delegar; a delegação vem do pedido do usuário, do `AGENTS.md` ou da skill que chamou esta, e com ela decidida só se escreve o brief. Destino desconhecido em agente fixo, autônomo ou de longa duração: uma pergunta curta com o porquê, que encerra o turno. O subagente herda o modelo da sessão; não defina `model` no `spawn_agent` sem pedido explícito do usuário, e registre o modelo como herdado ou pedido (o resultado do spawn não informa o efetivo). Para revisor independente, confira o schema exposto: use `fork_turns: "none"` quando disponível; `fork_context` falso só se esse campo existir e sua semântica estiver confirmada. Não deduza isolamento pela flag de versão. Não repita no brief o que o `AGENTS.md` do workspace já diz. Agente customizado do Codex vive na configuração do usuário ou do projeto, não neste pacote: entregue descrição e instruções e diga onde configurá-las. Passagem para outra sessão fica de pé sozinha e separa implementado, verificado e pendente.

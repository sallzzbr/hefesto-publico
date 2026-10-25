---
name: planejar-prototipo
description: "Plan a game prototype. Use when pedir testar uma mecânica, reduzir incerteza de design, comparar alternativas de interação ou decidir o próximo experimento antes de ampliar produção."
---

# Planejar protótipo

## Antes de agir
Leia `${CLAUDE_PLUGIN_ROOT}/references/contrato.md`, `${CLAUDE_PLUGIN_ROOT}/references/historico.md`, `${CLAUDE_PLUGIN_ROOT}/references/continuidade.md` e `${CLAUDE_PLUGIN_ROOT}/references/compartilhamento.md`. Resolva local_jogo pelo contrato. Consulte GDD e tentativas anteriores por assunto/IDs; três resultados ruins não estabelecem abandono automático.

## Input
Pergunta de design, requisito/versão, incerteza, tentativas relevantes, ferramentas disponíveis, limites de autonomia/tempo/custo e decisor. Ausentes continuam pendentes. Pedido de planejamento autoriza plano documental, não build, geração paga ou recrutamento de participantes.

## Output
Criar producao/prototipos/<id>/README.md com `${CLAUDE_PLUGIN_ROOT}/templates/prototipo.md`; se já existir, reconciliar estado antes de repetir. Escolher a menor representação que responda à pergunta: papel, mock de interação ou trecho jogável. Comparar alternativas pela pergunta e custo quando houver mais de uma opção plausível, indicando recomendação e pressupostos. Não escolher engine só para preencher o plano.

Definir uma pergunta principal, hipótese falsificável, variável alterada, condições mantidas, observação necessária, método, população/condição quando aplicável, critério de decisão e limites da conclusão. Números sem autorização são propostas. Orçamento não definido é pendência da execução, não licença ilimitada nem bloqueio para documentar. Separar sandbox descartável de produção; declarar se algo poderá ser reaproveitado e qual revisão será necessária.

Consultar registros reais das tentativas relacionadas; justificar nova condição ou replicação. Se registros não existem/acesso falta, dizer “histórico não conferido”, nunca “nunca tentado”. Planejar EXP com resultado pendente. Produzir relação requisitos → tarefa experimental → evidência esperada; registrar autonomia existente sem pedir a mesma aprovação novamente.

Se execução for solicitada e autorizada, encaminhar código a titbits:planejar-producao para SPEC/Odin, assets aos briefs correspondentes e observação a titbits:avaliar-playtest. Só registrar resultado após evidência real. Decisão manter/alterar/abandonar vem da comparação com critério e seus limites; alteração de GDD segue titbits:atualizar-gdd. Para verificar integração de disciplinas e viabilidade do pipeline, usar fatia vertical em titbits:planejar-producao.

Entregar plano, pendências que impedem executar, critério/evidência, EXP planejado e próximo responsável em producao/estado.md. Não usar tamanho do documento, quantidade de tentativas ou assertions como substituto da resposta experimental.

## Resolução de paths
Pedido explícito > local_jogo no CLAUDE.md do workspace > defaults pessoais local_* > exatamente uma convenção descoberta no cwd > default documentado docs/jogo/. Paths citados são ilustrativos. Múltiplos candidatos exigem esclarecimento. No Codex, usar AGENTS.md e defaults do RUNTIME.md. Acervo só por configuração explícita e autorização.

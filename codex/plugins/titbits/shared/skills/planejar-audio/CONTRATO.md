---
name: planejar-audio
description: "Plan game audio direction and delivery contracts. Use when pedir música de jogo, efeitos sonoros, mapa de eventos, comportamento de mute, loops ou integração de áudio; entregar briefs e verificações sem presumir ferramentas de geração."
---

# Planejar áudio

## Antes de agir
Leia `${CLAUDE_PLUGIN_ROOT}/references/contrato.md`, `${CLAUDE_PLUGIN_ROOT}/references/historico.md` e `${CLAUDE_PLUGIN_ROOT}/references/compartilhamento.md`. Consulte o GDD e histórico relacionados antes de nova tentativa; registre resultado relevante conforme o contrato comum.

## Input
GDD, intenção emocional, eventos do jogo, plataforma e ferramentas efetivamente disponíveis. Identificar se repetir reinicia puzzle, instrução, cena ou música; ambiguidade fica pendente.

## Output
Usar `${CLAUDE_PLUGIN_ROOT}/templates/brief-audio.md` em producao/audio/<id>.md. Listar música, ambiente e efeitos por evento: função, gatilho, prioridade, variação, loop/transição, duração/formato, origem/licença, estado e verificação. Registrar fonte editável e exportação quando pertinentes, sem inventar formato definitivo antes das restrições técnicas.

Especificar comportamento em pause, reinício e troca de cena, evitando duplicar música; definir volumes, abrangência do mute e persistência. Se não decidido, propor alternativas e pedir decisão antes de implementação dependente. Protocolo de escuta cobre clipping, cortes de loop, sobreposição, prioridades e feedback que não dependa exclusivamente de som.

Sem gerador ou produção autorizada, entregar brief e inventário com assets pendentes. Não transformar texto em evidência de música produzida. Tentativas reais vão para EXP; alterações aprovadas da direção passam por titbits:atualizar-gdd.

## Exemplo sintético
Botão reiniciar puzzle, música e mute: proposta mantém uma única instância musical ao reiniciar e conserva mute; confirmação dessas regras permanece pendente até aprovação. Arquivos não produzidos, escuta não executada.

## Resolução de paths
Pedido explícito > local_jogo no CLAUDE.md do workspace > defaults pessoais local_* > exatamente uma convenção descoberta no cwd > default documentado docs/jogo/. Paths citados são ilustrativos. Múltiplos candidatos exigem esclarecimento. No Codex, usar AGENTS.md e defaults do RUNTIME.md. Acervo só por configuração explícita e autorização.

## Inventário integrado
Usar `${CLAUDE_PLUGIN_ROOT}/templates/assets.md` com arte e UX. Cada evento/asset deve apontar para requisito, revisão, origem/licença, entrega e evidência de integração. Planejar alternativas visuais/táteis para informação sonora relevante. Voz traduzida precisa de contexto, texto/idioma/revisão e sincronização quando aplicável, sem presumir gerador ou direitos. Declarar relações conforme `${CLAUDE_PLUGIN_ROOT}/references/continuidade.md`.

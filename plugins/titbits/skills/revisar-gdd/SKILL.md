---
name: revisar-gdd
description: "Review game design readiness. Use when pedir revisar GDD, achar contradições entre mecânicas e fases, verificar direção audiovisual ou decidir se um incremento pode entrar em produção, com achados e critérios rastreáveis."
---

# Revisar GDD

## Antes de agir
Leia `${CLAUDE_PLUGIN_ROOT}/references/contrato.md`, `${CLAUDE_PLUGIN_ROOT}/references/historico.md` e `${CLAUDE_PLUGIN_ROOT}/references/compartilhamento.md`. Consulte o GDD e histórico relacionados antes de nova tentativa; registre resultado relevante conforme o contrato comum.

## Input
GDD vigente e incremento pretendido, brief, decisões anteriores e artefatos disponíveis. A revisão é leitura do GDD; grava apenas o relatório e o estado de revisão, nunca corrige o design por conta própria.

## Output
Criar producao/revisao-gdd-v<versao>.md com versão e escopo, veredito pronto/bloqueado/pronto_com_hipoteses_autorizadas e tabela: achado, arquivo/seção e IDs, cenário concreto, evidência, impacto, responsável decisor e critério de liberação. Preservar revisão anterior com sufixo de rodada quando já existir.

Checar coerência de loop, controles, estados, vitória/derrota/reinício, recursos, fases solucionáveis, progressão, câmera, arte/áudio, UX/acessibilidade, restrições técnicas e critérios. Identificar referência quebrada, números conflitantes, hipótese apresentada como decisão, conteúdo antigo vigente e DEC preparando. Separar bloqueio causal do incremento de lacuna futura que não o impede. Placeholder explicitamente aprovado pode ser suficiente; não exigir arte final para protótipo.

Registrar dependências de cada tarefa. Trabalho independente pode ser proposto, mas não marcar todo incremento pronto só porque parte está clara. Sem evidência ou aprovação de hipótese, manter bloqueio correspondente. Encaminhar correções aprovadas para titbits:atualizar-gdd.

## Exemplo sintético
FAS-001 exige chave inexistente; ART-001 câmera lateral conflita com UX-001 top-down: duas decisões bloqueantes para a fase, com dono e critério de liberação. Relatório não escolhe câmera nem cria chave silenciosamente.

## Resolução de paths
Pedido explícito > local_jogo no CLAUDE.md do workspace > defaults pessoais local_* > exatamente uma convenção descoberta no cwd > default documentado docs/jogo/. Paths citados são ilustrativos. Múltiplos candidatos exigem esclarecimento. No Codex, usar AGENTS.md e defaults do RUNTIME.md. Acervo só por configuração explícita e autorização.

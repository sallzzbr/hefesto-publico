---
name: avaliar-playtest
description: "Analyze playtest evidence and propose game design changes. Use when pedir avaliar sessão de jogadores, interpretar dificuldade ou confusão, revisar balanceamento, separar bugs de preferências ou decidir a próxima rodada de teste."
---

# Avaliar playtest

## Antes de agir
Leia `${CLAUDE_PLUGIN_ROOT}/references/contrato.md`, `${CLAUDE_PLUGIN_ROOT}/references/historico.md` e `${CLAUDE_PLUGIN_ROOT}/references/compartilhamento.md`. Consulte o GDD e histórico relacionados antes de nova tentativa; registre resultado relevante conforme o contrato comum.

## Input
GDD, build/dispositivo quando disponíveis, protocolo e registros de observação/relatos. Ausência de dados não autoriza inventar participantes, métricas ou resultados.

## Output
Usar `${CLAUDE_PLUGIN_ROOT}/templates/playtest.md` em playtests/<id>.md. Registrar pergunta original, condições/amostra, evidência literal ou referência permitida e limitações. Cada achado recebe classe, impacto, reprodução/relato, hipótese de causa e próxima ação. Classes: defeito de implementação, compreensão, ritmo/balanceamento, preferência, hipótese de design.

Separar correção mecânica, inspeção audiovisual, experiência observada e mercado. Taxa de vitória ou três comentários não medem diversão universal nem demanda comercial. Sem build, entregar análise de relatos e protocolo para reprodução, não diagnóstico causal comprovado.

Para balanceamento: identificar objetivo, métrica contextual, possível estratégia dominante, recursos/duração e limites de amostra; propor alteração de uma variável ou conjunto justificado, condições comparáveis e critério de manter/reverter. Mudança passa por DEC proposto; se já existe faixa autorizada, registrar a regra concreta usada. Não alterar GDD vigente com base só em observação. Encaminhar aplicação autorizada a titbits:atualizar-gdd.

Registrar EXP/APR apenas com evidência correspondente e atualizar próximo passo único em estado. Respeitar privacidade de participantes: não copiar identidade ou dados pessoais desnecessários.

## Exemplo sintético
Três relatos de tutorial confuso e um travamento: compreensão e defeito relatado, reprodução pendente. Propor observar o ponto de confusão e reproduzir travamento; não declarar jogo comercialmente validado.

## Resolução de paths
Pedido explícito > local_jogo no CLAUDE.md do workspace > defaults pessoais local_* > exatamente uma convenção descoberta no cwd > default documentado docs/jogo/. Paths citados são ilustrativos. Múltiplos candidatos exigem esclarecimento. No Codex, usar AGENTS.md e defaults do RUNTIME.md. Acervo só por configuração explícita e autorização.

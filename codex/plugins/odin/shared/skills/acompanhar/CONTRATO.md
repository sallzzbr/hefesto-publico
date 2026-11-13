---
name: acompanhar
description: >-
  Use para revisar desafio em andamento: "como está o desafio" (ou "como está a missão"),
  "o placar andou?", "did the metric move?", "em que fase estamos", re-medir o KPI com a mesma
  régua, ler/analisar resultados de experimento ou A/B que rodou ("analisa os resultados do
  experimento"), checar fase do double diamond, detectar desafio virando lista de tarefas,
  decidir perseverar/pivotar/encerrar, ou post-mortem/encerramento. Inclui /acompanhar. Não use
  para estruturar desafio novo (descobrir/definir), executar entrega ou CONSTRUIR o mecanismo de
  acompanhamento — dashboard, alerta, automação são entregas (entregar) —, nem revisar
  documento/apresentação sobre o desafio (isso não é checkpoint de placar).
---

# Acompanhar — o placar andou?

## ⚡ Confirmação de ativação (OBRIGATÓRIO)

Primeira linha, antes de qualquer outra coisa:

```
📊 Skill `acompanhar` ATIVADA — revisando o desafio contra o placar.
```

## Overview

Revisão recorrente de um desafio. O objetivo é responder 5 perguntas com dado, não com sensação:

1. **Onde estamos no double diamond?** (fase registrada × fase real do trabalho)
2. **O placar andou?** (medir de novo, mesma régua)
3. **O que aprendemos?** (hipóteses validadas/refutadas)
4. **Estamos resolvendo o problema ou executando tarefas?** (teste anti-tarefa)
5. **Se encerrou, o aprendizado ficou publicado?** (post-mortem registrado)

**References (carregar sob demanda):** `../descobrir/references/capa-template.md` (contrato da capa e bloco 📍) · `../descobrir/references/contrato-de-conversa.md` (SEMPRE — 1 pergunta por vez, nunca re-perguntar o que a capa registra) · `references/metodologias-acompanhamento.md` (frameworks de medição: North Star + inputs, leading/lagging, experiment readout/A-B, OKR check-in).

**Resolução de paths:** resolver `dirDesafios`, `dirSpecs` e `arquivoPendencias` pela regra
única em `../descobrir/references/capa-template.md`. Os paths literais nesta skill são
ilustrativos do default, não hardcode.

## Fluxo

> **Frameworks de medição (carregar sob demanda):** `references/metodologias-acompanhamento.md` — North Star + inputs e leading/lagging (ler o placar antes do resultado final chegar), experiment readout/A-B (a alavanca funcionou mesmo?), OKR check-in (alinhamento com a área). **A IA é a guia, não o cardápio:** escolha UM método pela pergunta do roteador, recomende com o porquê, o humano confirma.

### 1. Recuperar o desafio e reportar a posição

Listar `<dirDesafios>/*/desafio.md` no projeto. Se o pedido cita o desafio (ou só há um ativo)
→ abrir a capa + `dossie.md` + `plano.md`; ambíguo → perguntar qual. Sem capa/dossiê → o
desafio nunca foi estruturado; não inventar checkpoint — oferecer rotear para
`descobrir`/`definir`.

Reportar a posição com o bloco 📍 (formato na reference). Se o trabalho real não bate com a fase registrada (ex.: capa diz DELIVER mas as entregas não testam hipótese), isso é achado do checkpoint — reportar.

### 2. Medir o placar de novo (você, IA)

Rodar a MESMA medição da régua fixada (fonte + janela + filtro + grão): fonte conectada na sessão (SQL/analytics/CLI via MCP) → a IA roda; fonte inacessível → pedir ao dono o export/print citando a régua exata (exceção explícita à regra "a IA levanta os dados" — registrar como tal).

**Re-medir também os guardrails e efeitos colaterais do dossiê §2** — a pergunta 2 completa é "o placar andou **sem quebrar guardrail**?". KPI subindo com guardrail degradando é achado, não vitória. Baseline marcado `AUSENTE` no §2 → checar se o plano de obtenção andou; quando o baseline chegar, promover o alvo de provisório a validado (registrar na tabela de Decisões).

Se a régua mudou ou "não dá mais pra medir igual", isso é um achado grave — reportar antes de qualquer outra coisa. Registrar a medição no **Diário do placar** do `dossie.md` (§8).

### 3. Atualizar hipóteses

Para cada hipótese: **validada / refutada / pendente** — com a evidência que mudou o estado. Hipótese parada há 2+ checkpoints sem teste é hipótese morta ou desafio travado: apontar.

### 4. Teste anti-tarefa (honestidade brutal, com respeito)

Sinais de que o desafio degenerou em lista de tarefas:

- Entregas saíram, mas **nenhuma estava ligada a hipótese**
- O placar **não é medido** desde o último checkpoint
- O trabalho da quinzena foi definido por **pedidos recebidos**, não pelo ranking de alavancas
- Apoio virou **espera por terceiros** ("tô esperando X" há 2 checkpoints)
- Ninguém consegue dizer **o que aprendemos** desde o último checkpoint

Se ≥2 sinais: dizer explicitamente, com os sinais encontrados, e propor o caminho de volta (geralmente: re-ranquear alavancas — skill `desenvolver`, §5 do dossiê).

### 5. Decisão de arquiteto

Apresentar o quadro e pedir a decisão do humano — cada decisão tem uma tradução espacial no diamond:

- **Perseverar** — placar reagindo ou hipóteses ainda com gás → seguir no DELIVER: próxima entrega do `plano.md` (skill `entregar`)
- **Pivotar** — hipóteses fortes refutadas → voltar ao **DEFINE** (skill `definir`, re-hipotetizar com o que foi aprendido) ou ao **DEVELOP** (skill `desenvolver` — hipóteses de pé, alavancas erradas)
- **Encerrar** — alvo atingido, problema deixou de existir, ou custo > retorno → sair do diamond consolidando o aprendizado

### 6. Registrar

1. Executar o **checklist de saída de fase** do `capa-template.md` (gate/confiança, artefatos, pendências, decisões, `Atualizada em`, bloco 📍) — no checkpoint ele vale mesmo sem mudança de fase: revisar a `Confiança da etapa` e as pendências é obrigatório.
2. **Pivotar dispara a cascata de invalidação (regra 5 da capa):** voltar a DEFINE ou DEVELOP muda problema/hipóteses/alavancas → marcar AGORA `alavancas.md`, `plano.md` e as entregas abertas como `⚠️ desatualizado` na tabela de Artefatos, registrando qual decisão invalidou. Sem essa marcação, a próxima sessão executa o plano que o pivô acabou de invalidar.
3. Registrar a medição no Diário do placar do dossiê (§8).
4. Desafio encerrado → fase ENCERRADO na capa + seção `## Post-mortem` no `desafio.md`: o que moveu o placar, o que não moveu, o que fica pro próximo desafio no tema.

## NUNCA fazer

- ❌ Aceitar "sinto que melhorou" como medição
- ❌ Trocar a régua do placar silenciosamente para o número ficar bonito
- ❌ Pular a decisão explícita (perseverar/pivotar/encerrar)
- ❌ Encerrar sem post-mortem registrado na capa

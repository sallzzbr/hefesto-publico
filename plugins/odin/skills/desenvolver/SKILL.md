---
name: desenvolver
description: >-
  Use para abrir o Diamante 2 com dossiê fechado (problema + placar + hipóteses): gerar e
  ranquear alavancas/opções que testam as hipóteses, priorizar por valor de aprendizado ×
  reversibilidade, decidir protótipo vs construção e fechar o plano da rodada com entregas em
  checklist. Inclui /desenvolver, "quais alavancas", "o que construir primeiro", "prioriza as
  opções", "monta o plano da rodada". Também para desenhar o teste barato de uma alavanca ANTES
  de ela virar entrega: fake door, concierge, Wizard of Oz, protótipo/experimento pra validar
  demanda ("monta um fake door pra testar X"). Não use sem problema/placar definidos
  (descobrir/definir), para executar uma entrega do plano (entregar), rodar loop com spec
  aprovada (dev-loop), nem para re-medir o desafio, ou "missão" (acompanhar).
---

# Desenvolver — DEVELOP: abrir alavancas e fechar o plano da rodada (Diamante 2)

## Overview

Primeira fase do Diamante 2 — diverge em alavancas que testam as hipóteses do dossiê e converge no plano da rodada. Existe para impedir dois anti-padrões: a solução pronta que fura o ranking, e o esforço decidindo sozinho o que construir quando construir ficou barato com IA.

**References (carregar sob demanda):** `../descobrir/references/capa-template.md` (SEMPRE — contrato da capa e bloco 📍) · `../descobrir/references/contrato-de-conversa.md` (SEMPRE — 1 pergunta por vez, mostrar o que mudou) · `references/metodologias-develop.md` (divergir e testar barato: Crazy 8s/SCAMPER, fidelity ladder, fake door/WoZ/concierge, RAT) · `references/priorizacao-ai-era.md` (convergir: ranquear por aprendizado × reversibilidade) · `../definir/references/dossie-template.md` (§5 Alavancas e §6 Alternativas; o §7 é só o ponteiro pro `plano.md`, sem tabela duplicada).

## ⚡ Confirmação de ativação (OBRIGATÓRIO)

A PRIMEIRA coisa a fazer, antes de qualquer outra resposta:

```
💎 Skill `desenvolver` ATIVADA — Diamante 2: alavancas que testam hipóteses.
```

## Gate de entrada

- **Ler a capa** (`desafio.md` no diretório de desafios — resolução no contrato da capa) — GATE 2 marcado e `dossie.md` com placar de régua fixada?
- **Faltando** → oferecer a skill `definir` (pulo só com decisão do dono registrada na tabela de Decisões da capa).
- **Fase adiante de DEVELOP** → oferecer rotear pra skill certa.

Imprimir o bloco 📍, no formato definido em `../descobrir/references/capa-template.md`.

## DEVELOP (divergir) — abrir alavancas que testam as hipóteses

> **Dois playbooks (carregar sob demanda):** `references/metodologias-develop.md` pra **divergir e testar barato** (ideação Crazy 8s/SCAMPER, fidelity ladder, fake door/Wizard of Oz/concierge, Riskiest Assumption Test) e `references/priorizacao-ai-era.md` pra **convergir** (rankear por aprendizado × reversibilidade). **A IA é a guia, não o cardápio:** escolha UM método pela pergunta, recomende com o porquê, o humano confirma.

1. Para cada hipótese forte, listar alavancas possíveis — de UI, de copy, de fluxo, de conteúdo/configuração, de CRM, de dado, de regra de negócio, de processo, de arquitetura, de observabilidade.
2. Carregar `references/priorizacao-ai-era.md` e ranquear primeiro por **valor de aprendizado × reversibilidade**. Impacto no placar continua obrigatório; custo/tempo/esforço entram como restrição para dimensionar a aposta, não como eixo principal quando construir ficou barato com IA.
3. Classificar cada alavanca na matriz 2x2: **Construa agora**, **Prototipe primeiro**, **Aposta reversível** ou **Prateleira**.
4. Se "tela nova", "BFF", "refactor", "design system" ou outra solução pronta aparecer, ela **compete no ranking como qualquer alavanca** — explicitar qual hipótese testa, quanto do placar pode mover, o que ensina, quão reversível é e qual alternativa menor foi descartada.
5. Protótipo barato pra testar hipótese antes de codar, quando reduzir risco — mock navegável, fake backend, piloto manual, feature flag.

## GATE 3 (DEVELOP→DELIVER)

*"Quais alavancas entram na primeira rodada — e por que ELAS (aprendizado/reversibilidade/impacto), não as outras? O humano escolheu?"*

Checkpoint de arquiteto: você apresenta o ranking, o humano escolhe.

## Plano da rodada (convergir)

Escrever, no diretório do desafio (ao lado da capa), `alavancas.md` (ranking completo, incluindo as descartadas com o porquê — consolidar também nos §§5-6 do dossiê) e `plano.md` EXATAMENTE neste formato:

```markdown
# Plano da rodada — <desafio> (rodada N)

| # | Entrega | Tipo | Hipótese que testa | Métrica observada | Critério de sucesso | Critério de abandono |
|---|---|---|---|---|---|---|

<!-- Tipo: software | prompt/skill/agente | script/consulta/automação | dashboard | documento/processo | experimento.
     O ESTADO de cada entrega vive apenas no arquivo dela (entregas/<slug>.md, campo Estado) —
     fonte única; este plano não duplica estado. -->

## Checklist de execução
- [ ] <entrega-slug> — `entregas/<entrega-slug>.md` (criado pela skill entregar; estado vive lá)

## Cadência
Próximo acompanhar: <data/condição>
```

## GATE 4 (DELIVER→execução)

*"Cada entrega testa UMA hipótese e tem critério de sucesso E de abandono? A cadência do acompanhar está marcada?"*

Fechado → atualizar a capa (GATE 3 e GATE 4 marcados, fase → DELIVER, Artefatos, Atualizada em) e rotear: código → skill `entregar` (uma entrega por vez); entrega não-software (dashboard, prompt, skill, script, consulta, documento, processo, experimento) → skill `entregar` também, na trilha por tipo (`../entregar/references/tipos-de-entrega.md`); análise contínua → queries/medições registradas no dossiê.

## NUNCA fazer

- ❌ Escolher alavanca pelo custo antes de perguntar o que ela ensina
- ❌ Deixar solução pronta furar o ranking (ela compete como qualquer alavanca)
- ❌ Plano sem critério de abandono
- ❌ Mudar de fase sem imprimir o bloco 📍
- ❌ Decidir a rodada sozinho (o humano escolhe)

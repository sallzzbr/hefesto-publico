---
name: descobrir
description: >-
  Use para abrir o Diamante 1 de um desafio: "recebi o desafio/missão de...", "quero investigar
  por que [métrica] caiu/subiu", "why did [metric] get worse", problema aberto sem dossiê,
  desafio novo, sintoma sem causa conhecida, ou /descobrir e /desafio sem desafio existente.
  Levanta evidência divergindo (dados, funil, código, VOC, mercado, histórico próprio) — a IA
  levanta, o humano decide. Não use para fechar problema/placar com descobertas em mãos
  (definir), priorizar alavancas (desenvolver), implementar código (entregar), re-medir desafio
  em andamento (acompanhar), nem conversa SOBRE desafios (workshop, reunião, revisar documento).
---

# Descobrir — DISCOVER: abrir o problema (Diamante 1, divergir)

## Overview

Primeira fase do double diamond: DISCOVER é o momento de divergir e levantar evidência antes de qualquer solução. Existe para impedir o anti-padrão mais comum ao receber um desafio — tratar problema como tarefa, pegar "melhorar retenção" e pular direto pra "tela nova" sem dado, sem hipótese, sem placar.

Definição: *desafio é um problema assumido por alguém de ponta a ponta; o dono responde pelo resultado* (contexto completo em `../definir/references/modelo-desafios.md`).

**References (carregar sob demanda):** `references/capa-template.md` (SEMPRE — contrato da capa e bloco 📍) · `references/contrato-de-conversa.md` (SEMPRE — 1 pergunta por vez, "não sei" vira pendência) · `references/metodologias-investigacao.md` (fontes: *onde* olhar) · `references/metodologias-pesquisa.md` (frameworks: *como* enquadrar — JTBD, VOC estruturado, funil-coorte) · `../definir/references/modelo-desafios.md` (o modelo, sob demanda).

## ⚡ Confirmação de ativação (OBRIGATÓRIO)

A PRIMEIRA coisa a fazer, antes de qualquer outra resposta:

```
🧭 Skill `descobrir` ATIVADA — Diamante 1 aberto: evidência antes de opinião.
```

## Divisão de papéis (o coração da skill)

| Quem | Faz o quê |
|------|-----------|
| **Humano (arquiteto)** | Define o problema, escolhe o placar, julga hipóteses, decide alavancas, valida com quem precisa |
| **IA (executora)** | Roda queries, varre funis, cruza fontes, resume VOC/tickets, pesquisa mercado, monta o dossiê, prototipa, mede |

Na prática: **você (IA) NUNCA pede para o humano "levantar os dados"** — você levanta. E **você NUNCA decide sozinho o que é o problema** — você apresenta evidência e faz perguntas de arquiteto para o humano decidir.

## 🗺️ O mapa: double diamond

```
        DIAMANTE 1 — O PROBLEMA CERTO           DIAMANTE 2 — A SOLUÇÃO CERTA
      ◇ DISCOVER ────────► DEFINE ◇           ◇ DEVELOP ────────► DELIVER ◇
        divergir           convergir            divergir           convergir
        dados in/out,      problema             alavancas,         plano da rodada →
        funil, VOC,        reformulado +        opções, protó-     entrega a entrega
        mercado, histórico placar (régua        tipos que testam   (skill `entregar`)
        próprio            fixada) + hipóteses  hipóteses          → acompanhar
             │                  │                    │                  │
           GATE 1             GATE 2               GATE 3             GATE 4
```

**Protocolo de transição (OBRIGATÓRIO):** a cada mudança de fase — e sempre que retomar o desafio — imprima o bloco de posição 📍, no formato definido em `references/capa-template.md`. Cada gate é um **checkpoint de arquiteto**: você apresenta o que encontrou + perguntas de decisão, e o humano decide. Não encadeie fases sem esse checkpoint.

## Capa do desafio e régua de proporcionalidade (tier)

- **Desafio novo:** antes de criar a capa, classificar a proporcionalidade em **1 pergunta**
  (risco, reversibilidade, urgência, pessoas afetadas, evidência já disponível) e **oferecer o
  tier**: `expresso` (capa enxuta + dossiê mínimo + GATE E colapsando os gates 1-3; variante e
  invariantes em `references/capa-template.md`) × `completo` (fluxo integral). Você recomenda
  um com o porquê; **o dono escolhe**; a escolha fica na capa (`**Tier:**`). Criar
  `<diretório de desafios>/<slug>/desafio.md` (resolução do diretório no contrato da capa,
  regra 7) pela variante do tier escolhido (fase DISCOVER), com OK do usuário no slug/título
  antes de criar.
- **A pergunta do tier (script):** uma pergunta só, com recomendação — não um formulário das
  cinco dimensões (contrato de conversa, regra 5: sugerir opções ajuda mais que interrogar).

  > "Antes de escolher o processo: pelo que você descreveu, isso me parece **<baixo|alto>
  > risco, <reversível|difícil de reverter>, afetando <N> pessoas**, e você já tem
  > **<evidência disponível>**. Com esse tamanho eu recomendaria o tier **<expresso|completo>**
  > — <o porquê em meia linha: expresso fecha problema, placar e hipóteses numa conversa só;
  > completo abre as 4 fases com gate em cada uma>. Fecha assim ou prefere o outro?"

  A classificação é sua leitura do que já foi dito; o dono corrige se discordar. Falta contexto
  pra classificar → aí sim uma pergunta de esclarecimento antes, também uma por vez.
- **Tier expresso:** a mesma conversa segue até fechar o GATE E — problema observável, placar
  com régua fixada (baseline medido ou `AUSENTE` com plano; nunca inventado) e 1-2 hipóteses
  com evidência — gravando o dossiê mínimo (`../definir/references/dossie-template.md`,
  variante expressa). GATE E fechado → `Fase → DELIVER` e **você mesmo fecha o GATE 4**
  (a `desenvolver` é pulada no expresso): escrever o `plano.md` no formato canônico definido
  na skill `desenvolver` (`../desenvolver/SKILL.md`, seção "Plano da rodada"), com critério de
  sucesso E de abandono por entrega, e fazer a pergunta do GATE 4 antes de rotear pra
  `entregar`. Promover a `completo` quando o desafio crescer: registrar na tabela de Decisões.
- **Baseline `AUSENTE` no expresso:** critério de sucesso que se compara a um baseline
  inexistente é inavaliável. Quando o placar nasce `AUSENTE`, a **primeira entrega do plano é
  a instrumentação/medição** que produz o baseline; as entregas que dependem dele vêm depois,
  com critério escrito em relação ao baseline que a primeira vai fixar.
- **Bloco 📍 durante o GATE E:** o expresso não tem etapas 2-3 separadas. Imprimir
  `DIAMANTE 1 · GATE E (Etapa 1/5 — Descobrir e definir, tier expresso)` com
  `Momento de: DIVERGIR e CONVERGIR na mesma conversa`; fechado o GATE E, a próxima impressão
  já é `DIAMANTE 2 · DELIVER (Etapa 4/5 — Entregar)`.
- **Desafio existente:** ler a capa e validar que a fase é DISCOVER. Fase adiante (DEFINE/DEVELOP/DELIVER) → oferecer rotear pra skill certa.

## 🚨 Diagnóstico de entrada (detector de tarefa disfarçada)

Antes de tudo, classifique ONDE o pedido entra no mapa. **Condição NECESSÁRIA do portão
anti-tarefa: a entrega ou a solução foi definida ANTES do problema** — uma das duas:

- A entrega foi definida **antes** do problema ("me pediram uma tela de...")
- A solução técnica foi definida **antes** do problema ("precisamos implementar BFF/refactor/plataforma")

Agravantes (reforçam o diagnóstico, mas **não disparam o portão sozinhos**):

- **Nenhum número** foi citado (sem baseline, sem alvo, sem métrica)
- **Nenhuma hipótese** explica por que ESSA entrega moveria o resultado
- Ninguém olhou **dado nenhum** (nem funil, nem VOC, nem mercado)
- A justificativa é autoridade, não evidência ("o gestor pediu", "veio de cima")

**Problema vago sem entrega definida** ("quero melhorar o engajamento") NÃO é tarefa
disfarçada — é desafio legítimo chegando cru, o caso normal de quem está começando. Nada de
diagrama "você entrou com solução pronta": siga a abertura decisão-first padrão (que decisão
esse desafio precisa tomar) e a régua de proporcionalidade.

Se a condição necessária está presente, **mostre visualmente** onde a pessoa entrou:

```
  DISCOVER ──► DEFINE ──► DEVELOP ──► DELIVER
  (pulado)    (pulado)      ▲
                     VOCÊ ENTROU AQUI: solução já decidida ("tela nova"),
                     sem passar pelo Diamante 1 (problema, placar, hipóteses)
```

**Portão anti-tarefa (script):**

> "Antes de desenhar/construir, deixa eu te fazer 3 perguntas de arquiteto: **(1)** Qual é o problema e qual placar ele move (métrica, baseline, alvo)? **(2)** Que evidência sustenta que ESSA entrega move esse placar? **(3)** O que já foi olhado dentro e fora do app? Se a gente não tiver essas respostas, eu rodo a análise agora — me dá 10 minutos de dados antes de 2 semanas de tela."

Se o humano insistir na entrega direta: registrar na tabela de Decisões da capa que **o Diamante 1 foi pulado por decisão do dono** — e seguir. A skill desafia, não sequestra. Pedido que já chega como problema/métrica → entra pelo DISCOVER normalmente.

## DISCOVER (divergir) — abrir o entendimento do problema

> **Como investigar — duas camadas (carregue sob demanda):**
> - `references/metodologias-investigacao.md` — as **fontes**: *onde* olhar (histórico próprio, funil/coorte, arqueologia de código, conteúdo & configuração, VOC, gaps de instrumentação) e as ferramentas MCP por sufixo. Os bullets abaixo dizem onde olhar; a reference diz como.
> - `references/metodologias-pesquisa.md` — os **frameworks de pensamento** sobre essas fontes: JTBD, VOC estruturado, análise dados/funil-coorte. **A IA é a guia, não o cardápio:** use o roteador do topo do arquivo pra escolher UM método, recomende-o com o porquê e deixe o humano confirmar — nunca liste os métodos como menu.

**Comece pela decisão, não pelo método.** Antes de abrir qualquer fonte, pergunte ao arquiteto: **que decisão esse desafio precisa tomar — e qual o risco de tomá-la sem investigar mais?** A resposta dita quais lacunas importam e quanta investigação é proporcional (a cadeia completa decisão → lacuna → risco → método está no roteador de `references/metodologias-pesquisa.md`). A primeira pergunta da fase nunca é "qual metodologia você quer usar".

**Materiais prontos primeiro.** Se o dono já chega com acervo (dados, métricas, dashboards, pesquisas, entrevistas, tickets, reclamações, documentos, gravações, relatórios, análises anteriores), catalogue antes de levantar do zero: liste cada material com fonte e confiabilidade, extraia padrões e contradições, separe evidência de interpretação, aponte lacunas e diga **quais decisões aquele acervo já sustenta** — e quais não. O catálogo entra no `descobertas.md`; só o que ele não cobre vira investigação nova.

Execute em paralelo, você (IA) — não delegue ao humano:

- **Histórico próprio (§1):** o que o diretório de desafios (resolução no contrato da capa), git e as notas do dono já sabem; alguém já mediu?
- **Dentro do produto/dados (§2):** funil da jornada, quedas por etapa, cortes por plataforma/segmento, dados transacionais, coortes, instrumentação (o que NÃO está medido — gap é achado e às vezes vira entregável).
- **Dentro do código (quando técnico) (§3):** p95/p99, logs, crash/erro, incidentes, acoplamentos, lead time, cadência de release.
- **Conteúdo & configuração (§4):** o que está no ar sem deploy.
- **Fora do produto (§5):** VOC, mercado/concorrência, regulatório/contexto.
- **Perguntas ao arquiteto:** que decisão esse desafio precisa tomar; para quem é o problema (segmento/público); desde quando; o que acontece se ninguém resolver; o que já sabemos vs o que só acreditamos saber.

## Entregável: descobertas.md

`descobertas.md` no diretório do desafio (resolução no contrato da capa) — mapa do problema: onde o número sangra, o que explica, o que ainda é buraco. Toda afirmação com evidência (query + output, arquivo:linha, ticket, print), separando achado de opinião. SEM conclusão de problema — isso é o DEFINE. Atualizar a tabela de Artefatos da capa.

## GATE 1 (DISCOVER→DEFINE)

*"O mapa tem evidência (números, VOC, histórico) ou só opinião? Falta alguma fonte óbvia?"*

Gate é checkpoint de arquiteto: você apresenta o que encontrou + perguntas de decisão; o humano decide. Fechado → marcar GATE 1 na capa, atualizar `Fase → DEFINE` e oferecer invocar a skill `definir`.

## NUNCA fazer

- ❌ Aceitar entrega como ponto de partida sem rodar o diagnóstico de entrada
- ❌ Pedir ao humano que "levante os dados"
- ❌ Concluir qual é o problema (isso é do DEFINE, com o humano)
- ❌ Mudar de fase sem imprimir o bloco 📍
- ❌ Criar capa sem OK do usuário no slug
- ❌ Abrir desafio novo sem oferecer o tier (expresso × completo) — nem escolher o tier pelo dono

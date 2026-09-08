---
name: definir
description: >-
  Use para fechar o Diamante 1: reformular o problema como fenômeno observável, fixar o placar
  (métrica, baseline, alvo, régua) e escrever hipóteses a partir de descobertas existentes.
  Também quando chegar solução técnica pronta sem placar ("implementar BFF", "refazer a
  arquitetura", "criar design system", refactor, plataforma, observabilidade) — desafio técnico
  (o usuário pode dizer "missão técnica") entra aqui para virar problema com placar técnico e
  métrica ponte. Inclui /definir, "fecha o problema", "fixa o placar", "escreve as hipóteses".
  Não use para levantar evidência do zero (descobrir), ranquear alavancas (desenvolver),
  implementar código (entregar), nem re-medir desafio em andamento (acompanhar).
---

# Definir — DEFINE: fechar problema, placar e hipóteses (Diamante 1, convergir)

## Overview

Segunda fase do Diamante 1, a convergência: transforma o mapa de descobertas do DISCOVER em três compromissos — problema reformulado, placar incontestável (régua fixada) e hipóteses falseáveis. É o gate mais importante do double diamond: sem ele não existe Diamante 2.

**References (carregar sob demanda):** `../descobrir/references/capa-template.md` (SEMPRE — contrato da capa e bloco 📍) · `../descobrir/references/contrato-de-conversa.md` (SEMPRE — os campos do dossiê são preenchidos em conversa, não em questionário) · `references/metodologias-definicao.md` (frameworks de convergência: Problem statement, How Might We, Opportunity Solution Tree, Hypothesis canvas) · `references/dossie-template.md` (ao montar/atualizar o dossiê) · `references/desafios-tecnicos.md` (quando o pedido envolver arquitetura, BFF, refactor, plataforma, performance, observabilidade, dívida técnica ou design system) · `references/modelo-desafios.md` (o porquê do modelo, sob demanda).

## ⚡ Confirmação de ativação (OBRIGATÓRIO)

A PRIMEIRA coisa a fazer, antes de qualquer outra resposta:

```
🎯 Skill `definir` ATIVADA — convergindo: problema, placar e hipóteses.
```

## Gate de entrada

- **Ler a capa** (`desafio.md` no diretório de desafios — resolução no contrato da capa) — existe `descobertas.md` com GATE 1 marcado?
- **Desafio não existe** → oferecer a skill `descobrir`. Se o dono insistir em definir direto, criar a capa registrando o pulo do DISCOVER na tabela de Decisões (a skill desafia, não sequestra).
- **Fase adiante de DEFINE** → oferecer rotear pra skill certa.

Imprimir o bloco 📍, no formato definido em `../descobrir/references/capa-template.md`.

## Antes da primeira pergunta: derivar

Leia o `descobertas.md` e a capa e **monte o rascunho do dossiê antes de abrir a boca**: §1 e
§3 são *derivados* das descobertas (§3 é transcrição estruturada do que já foi levantado —
nunca perguntado ao dono), e o §2 vai pro dono como **proposta preenchida com o que dá pra
inferir**, marcando palpite (`?`) vs. evidência. A fonte da métrica você procura sozinho
(fontes conectadas via MCP, repo, `descobertas.md`) antes de gastar um turno perguntando.
O dono corrige o rascunho; só o que não tem base vira pergunta, uma por vez (contrato de
conversa, regra 1). Um DEFINE bem conduzido fecha em poucos turnos, não em uma maratona.

## Os 3 entregáveis do DEFINE

> **Frameworks de convergência (carregar sob demanda):** `references/metodologias-definicao.md` — Problem statement (fenômeno sem solução), How Might We (reabrir o leque), Opportunity Solution Tree (placar→alavancas rastreável), Hypothesis canvas (hipótese testável com critério de abandono). **A IA é a guia, não o cardápio:** o roteador do topo escolhe UM método pela situação, você recomenda com o porquê e o humano confirma.

1. **Problema reformulado** como fenômeno observável, não entrega. ("Melhorar retenção de contratos" → "clientes com contrato ativo não voltam ao app / cancelam / não renovam — qual dos três?")
2. **Placar:** 1 KPI primário (máx. 2 de suporte); **medir o baseline agora** — pela fonte declarada na régua: SQL/analytics/CLI conectados via MCP, ou pedir o export citando a régua exata; **régua fixada** — fonte + janela + filtro + grão explícitos (a mesma transição pode medir 44% num painel e 78% noutro por régua solta); alvo com tradução de impacto, validado com o arquiteto. Declarar **guardrails** (o que não pode piorar) e efeitos colaterais a observar — guardrail precisa de fonte e janela (senão "caiu o NPS" vira discussão, não medição), mas não do filtro/grão completos do KPI primário: ele é observado, não perseguido. Baseline impossível de medir agora → **nunca inventar valor**: registrar `AUSENTE` com plano de obtenção e marcar o alvo como **provisório** até o baseline existir (aí vira validado). Em desafio técnico, declarar também a **métrica ponte** entre placar técnico e impacto de produto/negócio.
3. **Hipóteses H1..Hn:** cada uma = causa suspeita + evidência que a sustenta + como testar/medir. Classificar: forte / fraca / não-testável-hoje (e o que destravaria). O humano ranqueia, mata e adiciona — você desafia, inclusive a favorita dele.

## Desafios técnicos habilitadores

Regra completa, métricas exemplo e caso BFF: `references/desafios-tecnicos.md`.

Essencial: arquitetura, BFF, refactor, observabilidade, performance, design system, plataforma e dívida técnica **podem ser desafio**, mas nunca entram como solução garantida. Trate a implementação proposta como **alavanca candidata** até ela vencer o ranking do DEVELOP.

Ao receber algo como "implementar BFF no app", não procure argumento para justificar o BFF. Procure o problema observável que o BFF supostamente resolve melhor que alternativas menores. O placar técnico precisa de **métrica ponte**: por que mover esse número técnico importa para produto/negócio/aprendizado?

**Gate técnico extra (antes do DEVELOP):** *"A solução técnica proposta ainda é hipótese, ou já virou decisão? Temos placar técnico com régua e métrica ponte de negócio? Listamos alternativas menores que poderiam resolver primeiro?"*

## Saída: dossie.md

Escrever `dossie.md` no diretório do desafio (ao lado da capa) pelo template de `references/dossie-template.md` — §§1-4 preenchidos (em desafio técnico, semear o §6 com a alternativa menor considerada); §5 Alavancas e §6 Alternativas (descartadas do ranking) ficam pra skill `desenvolver`, que também materializa o `plano.md` apontado pelo §7.

Atualizar a capa (`desafio.md` do desafio): campo Placar preenchido, GATE 2 marcado após aprovação do humano e `Fase → DEVELOP`, tabela de Artefatos, `Atualizada em`.

## GATE 2 (DEFINE→DEVELOP — fecha o Diamante 1)

*"É ESSE o problema? O placar é incontestável (régua fixada)? As hipóteses estão escritas e priorizadas? Sem esses três, NÃO existe Diamante 2."*

Checkpoint de arquiteto: você apresenta, o humano decide. **Como apresentar:** um readout
curto — problema em 1 frase, o placar completo (KPI · régua · baseline · alvo · guardrails),
as hipóteses em lista, e as pendências abertas — seguido da pergunta do gate. Não despejar o
dossiê inteiro nem pedir leitura do arquivo. Fechado → oferecer invocar a skill `desenvolver`.

## NUNCA fazer

- ❌ Definir placar sem régua fixada (fonte + janela + filtro + grão)
- ❌ Aceitar solução técnica pronta sem ela virar hipótese com placar e métrica ponte
- ❌ Entrar no Diamante 2 com o GATE 2 aberto
- ❌ Decidir sozinho qual é o problema (o humano decide; você desafia com evidência)
- ❌ Mudar de fase sem imprimir o bloco 📍

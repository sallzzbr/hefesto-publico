---
description: "Synthesize a weekly ads briefing into 3 ranked actions — cruza as saídas de funil, fadiga criativa e eficiência de verba e produz exatamente 3 ações ranqueadas por impacto, cada uma com número-prova e próximo passo concreto. Use when o usuário pedir 'síntese do briefing', 'fecha o briefing semanal', 'o que fazer essa semana com os ads', ou como Fase final de um briefing. Recomendação, nunca execução."
---

# Síntese Semanal

> Paths do workspace (`marketing/`, `branding/`, `contexto/`, `financeiro/`, `scripts/`) resolvem pela regra única do plugin (`criativo-fluxo/references/defaults.md`: CLAUDE.md do workspace → defaults `local_*` → convenção descoberta no cwd → default documentado); as menções nesta skill são ilustrativas do default, não hardcode.

Fecha um briefing semanal: cruza as fases anteriores e entrega **exatamente 3 ações
ranqueadas por impacto**, prontas para o humano decidir na segunda-feira.

## Input

As saídas das fases do briefing (no workspace: `hermes:saude-do-funil`,
`hermes:fadiga-criativa` em `marketing/inteligencia/fadiga-criativa/`,
`hermes:otimizar-verba` em `marketing/inteligencia/budget-optimizer/`). Se alguma fase não
rodou no período, diga qual e o que a síntese perde sem ela — não invente números.

## Estrutura da síntese (obrigatória)

```
🔴 #1 — MAIOR IMPACTO (impacto: alto, esforço: variável)
Ação: [verbo + objeto + critério]
Por quê: [referência ao número de uma das fases]
Como: [3-5 passos práticos para o humano executar]
Próximo passo concreto: [1 comando ou 1 ação manual]

🟡 #2 — IMPACTO MÉDIO
[mesma estrutura]

🟢 #3 — QUICK WIN
[mesma estrutura — algo que dá pra fazer em < 30min]
```

## Regras da síntese

- Cada ação **cita** ao menos 1 número específico (CAC, ROAS, freq, score…), com fonte.
- Cada ação **aponta** o próximo passo executável (`hermes:sugerir-criativos`,
  `hermes:evoluir-vencedor`, command do workspace, ou ação manual no Gerenciador).
- Nada de vago: "melhorar o criativo" → ❌. "Pausar `<slug>` (CPA R$X / alvo R$Y do
  unit-economics citado) e rodar `hermes:evoluir-vencedor <slug-vencedor>` com 3 variações"
  → ✅.
- **Não recomendar KILL em learning phase** nem **escalar com poucas conversões** — as
  réguas exatas são das skills `fadiga-criativa` e `otimizar-verba`: referencie-as, não as
  copie (regra copiada desatualiza).

## Fechar o loop (junto com o humano)

1. **Registry:** para cada anúncio com dados suficientes, propor `resultado_resumo` e
   `classificacao` nos `_indice.csv` + espelhar em Resultado/Histórico dos `.md`. Se a
   recomendação não virou linha no registry, ela não aconteceu para o cockpit.
2. **Memória narrativa:** vencedor confirmado → entrada no arquivo de vencedoras do
   workspace (`marketing/referencias/`); aprendizado de teste → `backlog-testes.md`.
   **Cláusula de inferência (bloqueante)** — antes de registrar uma medição como regra ou
   aprendizado, responda: (1) **quantos casos** foram olhados, e com que **variância**? (2) a
   amostra cobre as **variantes relevantes** (cor/modelo/contexto)? (3) qual
   **contra-exemplo** barato refutaria — foi checado? Medição sem essas três respostas entra
   como OBSERVAÇÃO, não como regra.
3. **Relatório consolidado:** gravar o briefing em
   `marketing/inteligencia/briefings-semanais/AAAA-MM-DD.md` (fases + síntese + apêndices de
   lookup e updates aplicados), no formato dos anteriores do workspace.

## Regras

- Somente leitura no Meta; tudo é recomendação — o humano decide o quê e quando.
- Português BR.

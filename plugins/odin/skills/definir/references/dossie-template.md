# Template — Dossiê de Desafio

> Paths do workspace resolvem pela regra única em
> `../../descobrir/references/capa-template.md`; os literais neste template são ilustrativos
> do default, não hardcode.

> O dossiê vive em `docs/desafios/<slug>/dossie.md`, ao lado da capa (`desafio.md`). É a fonte de verdade do problema, do placar e das hipóteses — as skills `desenvolver`, `entregar` e `acompanhar` leem daqui.

```markdown
# Desafio: <nome curto>

**Dono:** <nome> · **Início:** <data>
**Tipo:** produto | técnica habilitadora | operacional
**Capa:** ./desafio.md

## 1. Problema
<Problema observável, para quem, desde quando, o que acontece se ninguém resolver.
NÃO é a entrega — é o fenômeno. Em desafio técnico, NÃO é "implementar BFF/refactor/design system";
é a lentidão, fragilidade, acoplamento, incidente ou custo observável.>

- **Público:** <segmento afetado — quem sente o problema>
- **Job/necessidade (JTBD):** <"Quando <situação>, quero <motivação>, para <resultado>" — ver metodologias-pesquisa §1>
- **Proposta de valor do desafio:** <resultado esperado pro usuário + pro negócio, em 1-2 linhas>
- **Escopo:** <o que o desafio cobre> · **Não escopo:** <o que fica de fora, de propósito>

## 2. Placar
> Cadeia que liga o problema à métrica: problema → resultado desejado → comportamento esperado
> → sinal observável → indicador → fonte → baseline → meta. Métrica que não desce essa cadeia
> é métrica de vaidade.
- **KPI primário:** <métrica> (leading | lagging)
- **Régua fixada:** fonte <tabela/painel> · janela <período> · filtro <condições> · grão <pessoa/contrato/sessão>
- **Baseline:** <valor medido em DATA | AUSENTE → plano de obtenção: consulta/instrumentação/coleta, quem, até quando, e qual decisão fica limitada sem ele>
- **Alvo:** <valor> (provisório | validado) (= <tradução de impacto: +X clientes/R$/pontos>)
- **KPIs de suporte (máx 2):** <...> (leading | lagging)
- **Guardrails (não podem piorar):** <métricas que o desafio não tem licença pra degradar — cada uma com fonte e janela, o mínimo pra ser auditável>
- **Efeitos colaterais a observar:** <efeitos indesejados plausíveis e onde apareceriam>
- **Métrica ponte (se técnica):** <como o placar técnico se conecta a produto/negócio/aprendizado>

## 3. Mapa do problema (visão holística)
<!-- DERIVADO do descobertas.md — transcrição estruturada do que já foi levantado.
     Não é seção de entrevista: nunca perguntar estes campos ao dono. -->

### Dentro do app/produto
<funil por etapa, quedas, cortes por plataforma/segmento, dados transacionais, coortes>
### Fora do app
<VOC/tickets/avaliações públicas/reviews, mercado/concorrência, contexto regulatório>
### Histórico próprio
<o que docs/desafios/ anteriores e o git já sabiam, decisões passadas, quem co-valida>
### Buracos
<o que não está medido/instrumentado — gaps que podem virar entregável>

## 4. Hipóteses
| # | Hipótese (causa suspeita) | Evidência | Como testar/medir | Força |
|---|---|---|---|---|
| H1 | | | | forte/fraca |

## 5. Alavancas (ranqueadas)
| # | Alavanca | Hipótese que testa | Impacto estimado no placar | Valor de aprendizado | Reversibilidade | Esforço/custo | Decisão 2x2 |
|---|---|---|---|---|---|---|---|

## 6. Alternativas consideradas
<Quais soluções perderam no ranking e por quê. Cite aprendizado esperado, reversibilidade e esforço/custo. Em desafio técnico, registre a alternativa menor descartada antes de escolher arquitetura/refactor/plataforma.>

## 7. Plano da rodada
> Fonte única: o `plano.md` deste desafio (materializado pela skill `desenvolver`, com tabela
> de entregas e checklist de execução). Esta seção é SÓ o ponteiro — não duplicar a tabela aqui.

## 8. Diário do placar

### Plano de mensuração (um por indicador do §2)
| Indicador | Fonte/evento | Fórmula | Quem mede | Frequência | Janela | Segmentos | Limitações/alertas |
|---|---|---|---|---|---|---|---|

### Diário
| Data | Fase do diamond | Valor do KPI | O que mudou | Decisão (perseverar/pivotar/encerrar) |
|---|---|---|---|---|
```

## Variante expressa (dossiê mínimo)

Para desafio com `Tier: expresso` na capa (régua de proporcionalidade em
`../../descobrir/references/capa-template.md`), o dossiê usa **apenas** as seções §1, §2, §4
e §8 — mesma numeração, pra nenhuma referência cruzada quebrar:

- **§1 Problema** — enxuto: fenômeno observável, público e o que acontece se ninguém resolver
  (JTBD/escopo opcionais). A evidência mínima entra aqui e no §4 (não existe `descobertas.md`).
- **§2 Placar** — integral, sem corte: régua fixada obrigatória; baseline medido agora ou
  `AUSENTE` com plano de obtenção (nunca inventado); guardrails quando existirem.
- **§4 Hipóteses** — 1-2 hipóteses com evidência e como testar/medir.
- **§8 Diário do placar** — nasce vazio; o `acompanhar` preenche a cada checkpoint.

§§3, 5, 6 e 7 são omitidos (sem `alavancas.md`; as entregas nascem direto no `plano.md`, cada
uma com critério de sucesso E de abandono). Se o desafio for promovido a `completo`, as seções
omitidas entram como pendências na capa.

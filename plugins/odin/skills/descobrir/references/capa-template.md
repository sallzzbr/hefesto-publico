# Capa do desafio — template e contrato

> A capa (`<diretório de desafios>/<slug>/desafio.md` no projeto do usuário — por default
> `docs/desafios/<slug>/desafio.md`, resolução na regra 7) é a fonte de verdade da
> posição no double diamond. Referência **compartilhada**: toda skill de fase a usa.

## Contrato de leitura/escrita (OBRIGATÓRIO para toda skill de fase)

1. **Ao entrar:** ler a capa (se existir), validar o gate de entrada da fase e imprimir o
   bloco de posição 📍. Desafio inexistente → só a skill `descobrir` cria capa nova.
2. **Ao sair:** atualizar `Fase` para a fase seguinte quando o gate de saída fechar (com
   aprovação do humano), marcar o gate na seção Gates, registrar decisões tomadas e atualizar
   `Atualizada em`.
3. **Pular gate é permitido** só com decisão do dono registrada na tabela de Decisões
   (ex.: "Pulou DISCOVER — dono já tem evidência de X"). A skill desafia, não sequestra.
4. **Slug:** lowercase, sem acentos, espaços viram hífen (ex.: "Melhorar recorrência" →
   `melhorar-recorrencia`). O diretório do desafio é `<diretório de desafios>/<slug>/` (regra 7).
5. **Cascata de invalidação:** quando uma decisão altera o problema (dossiê §1), o
   placar/régua (§2) ou as hipóteses (§4), marcar na tabela de Artefatos os artefatos
   **posteriores** na cadeia `descobertas → dossiê → alavancas/plano → entregas` com o
   estado `⚠️ desatualizado`, e registrar na tabela de Decisões qual decisão invalidou o quê.
   Artefato desatualizado precisa ser revisitado (ou aceito como está, com decisão registrada)
   antes de o desafio avançar de fase. **Quem executa:** a skill onde a decisão nasceu —
   inclusive o `acompanhar` ao pivotar (pivô muda problema/hipóteses → dispara a cascata).
6. **Tier:** toda skill de fase lê o campo `Tier` da capa. `completo` = fluxo integral deste
   template. `expresso` = variante enxuta (seção "Tier expresso" abaixo): gates 1-3 colapsados
   no GATE E, dossiê mínimo, sem `alavancas.md`. Capa sem campo `Tier` = `completo` (legado).
7. **Diretórios do odin (resolução única):** cada path se resolve nesta ordem — (1) campo
   correspondente na seção `## Paths do workspace` do `CLAUDE.md` do repo atual, se
   declarado; (2) campo dos defaults do usuário (`~/.claude/odin/defaults.md`):
   `local_desafios` (com `local_missoes` legado como fallback), `local_specs`,
   `local_pendencias`; (3) convenção descoberta no cwd; (4) default documentado —
   `docs/desafios/`, `docs/plans/` e `docs/pendencias.md`, respectivamente. Exatamente um
   candidato existente é usado; mais de um candidato concorrente exige perguntar; nenhum
   candidato cai no default documentado. Toda skill resolve por esta regra; os paths citados
   em templates e exemplos são ilustrativos do default, não hardcode.

## Checklist de saída de fase (TODA skill de fase e todo checkpoint executam, na ordem)

1. Gate fechado (ou pulado com decisão) marcado na seção Gates, **com a confiança anotada**
   (`· confiança: alta|média|baixa (porquê)`).
2. Campo `Confiança da etapa` da capa atualizado pra etapa que está COMEÇANDO (primeira
   leitura honesta; o `acompanhar` revisa a cada checkpoint).
3. Tabela de Artefatos: estados atualizados (incluindo uma linha por `entregas/<slug>.md`
   quando a entrega nasce) e a cascata da regra 5 aplicada se alguma decisão invalidou algo.
4. Tabela `Pendências e riscos abertos`: adicionar o que ficou aberto nesta fase, marcar
   `Bloqueante?`, e dar baixa no que resolveu. Pendência **bloqueadora do gate de prontidão**
   de uma SPEC também sobe pra cá.
5. Decisões da fase registradas (Data · Decisão · Por quê) e `Atualizada em` atualizado.
6. Bloco 📍 impresso com a nova posição.

## Jornada de 5 etapas (camada de leitura sobre o diamond)

O desafio é apresentado ao dono como uma jornada de 5 etapas; as fases do diamond mapeiam assim:

| Etapa | Nome | Fase(s) |
|---|---|---|
| 1 | Descobrir | DISCOVER |
| 2 | Definir | DEFINE |
| 3 | Explorar e especificar | DEVELOP (explorar) + SPEC da entrega (especificar) |
| 4 | Entregar | DELIVER (execução) |
| 5 | Acompanhar e aprender | cadência do `acompanhar` (transversal; vira a etapa ativa após a entrega) |

**Etapa impressa durante a `entregar`:** nos Steps 2-4 (arquivo da entrega, branch base,
SPEC — especificar) o bloco 📍 imprime **Etapa 3/5 — Explorar e especificar**; do Step 6 em
diante (branch, implementação, validações, commit/PR — execução) imprime **Etapa 4/5 —
Entregar**. O Step 5 (log do plano aprovado) fecha a etapa 3.

## Bloco de posição (imprimir a cada entrada e mudança de fase)

```
📍 Desafio <nome> — você está em: <DIAMANTE 1|2 · FASE> (Etapa <N>/5 — <nome da etapa>)
   Momento de: <DIVERGIR — abrir opções | CONVERGIR — decidir e cortar>
   Confiança da etapa: <alta|média|baixa — porquê em meia linha>
   Gate pra avançar: <a pergunta do gate>
```

## Template da capa

```markdown
# Desafio: <título>

- **Slug:** `<slug>` · **Dono:** <nome> · **Início:** YYYY-MM-DD
- **Tipo:** produto | técnica habilitadora | operacional · **Tier:** completo | expresso
- **Fase:** DISCOVER | DEFINE | DEVELOP | DELIVER | ENCERRADO
- **Placar:** <KPI: baseline → alvo> (régua: fonte · janela · filtro · grão) — `—` até o DEFINE
- **Confiança da etapa:** <alta|média|baixa — porquê em meia linha>
- **Atualizada em:** YYYY-MM-DD

## Gates
<!-- Ao fechar (ou pular) um gate, anote a confiança da etapa na própria linha:
     `· confiança: alta|média|baixa (porquê em 1 linha)` -->
- [ ] GATE 1 (DISCOVER→DEFINE): mapa do problema com evidência, não opinião
- [ ] GATE 2 (DEFINE→DEVELOP): problema reformulado + placar com régua fixada + hipóteses escritas
- [ ] GATE 3 (DEVELOP→DELIVER): alavancas da rodada escolhidas pelo humano, com o porquê
- [ ] GATE 4 (DELIVER→execução): cada entrega testa UMA hipótese, com critério de sucesso E de abandono

## Artefatos
<!-- Estado: `—` (não iniciado) · `em progresso` · `ok` · `⚠️ desatualizado` (ver regra 5,
     cascata de invalidação — anotar o que invalidou) -->
| Arquivo | Estado |
|---|---|
| `descobertas.md` | — |
| `dossie.md` | — |
| `alavancas.md` | — |
| `plano.md` | — |
| `entregas/<entrega-slug>.md` | — (uma linha por entrega, criada no Step 2 da `entregar`) |

## Pendências e riscos abertos
<!-- Divisão: pendência/risco do DESAFIO (bloqueia gate, decisão, dependência externa) vive
     AQUI, commitada. Débito técnico local do repo achado durante implementação vive em
     docs/pendencias.md (nunca commitado). Na dúvida: se perder o item trava o desafio, é aqui. -->
| Item | Etapa | Bloqueante? | Decisão |
|---|---|---|---|

## Decisões
| Data | Decisão | Por quê |
|---|---|---|
```

## Tier expresso (variante da capa)

Calibragem legítima de proporcionalidade, não desvio: desafio de risco baixo, reversível,
urgente, com poucas pessoas afetadas ou evidência já em mãos não precisa do processo completo.
A skill `descobrir` (e o `/desafio`) classifica a proporcionalidade em 1 pergunta ao abrir
desafio novo, recomenda um tier com o porquê e **o dono escolhe**.

**O que o expresso corta:** gates 1-3 colapsam no **GATE E** (uma conversa fecha problema +
placar + hipóteses), dossiê mínimo (§§1, 2, 4 e 8 — ver variante em
`../../definir/references/dossie-template.md`), sem `descobertas.md` (a evidência mínima entra
no próprio dossiê) e sem `alavancas.md` (as entregas nascem direto no `plano.md`).

**O que o expresso NÃO corta (invariantes):** régua fixada no placar; critério de sucesso E de
abandono por entrega (GATE 4 e `plano.md` continuam); evidência registrada antes de qualquer
estado `validado`; cascata de invalidação (regra 5).

**Quem executa o que:** no expresso a `descobrir` conduz a conversa inteira até o GATE E,
escreve o dossiê mínimo, **fecha também o GATE 4** e escreve o `plano.md` (formato canônico na
skill `desenvolver`, seção "Plano da rodada") — a `definir` e a `desenvolver` não são
invocadas. Da `entregar` em diante nada muda.

**Bloco 📍 no expresso:** durante o GATE E, `DIAMANTE 1 · GATE E (Etapa 1/5 — Descobrir e
definir, tier expresso)`, momento `DIVERGIR e CONVERGIR na mesma conversa`; fechado o GATE E,
`DIAMANTE 2 · DELIVER (Etapa 4/5 — Entregar)`. As etapas 2 e 3 não existem neste tier.

**Promoção:** o desafio pode ser promovido a `completo` a qualquer momento (o inverso não) —
registrar na tabela de Decisões, trocar o `Tier`, expandir gates/artefatos pro template
completo e tratar as seções que faltam como pendências.

```markdown
# Desafio: <título>

- **Slug:** `<slug>` · **Dono:** <nome> · **Início:** YYYY-MM-DD
- **Tipo:** produto | técnica habilitadora | operacional · **Tier:** expresso
- **Fase:** DISCOVER | DELIVER | ENCERRADO
- **Placar:** <KPI: baseline → alvo> (régua: fonte · janela · filtro · grão) — `—` até o GATE E
- **Confiança da etapa:** <alta|média|baixa — porquê em meia linha>
- **Atualizada em:** YYYY-MM-DD

## Gates
- [ ] GATE E (colapsa 1-3, DISCOVER→DELIVER): problema observável + placar com régua fixada + 1-2 hipóteses com evidência
- [ ] GATE 4 (DELIVER→execução): cada entrega testa UMA hipótese, com critério de sucesso E de abandono

## Artefatos
| Arquivo | Estado |
|---|---|
| `dossie.md` (mínimo) | — |
| `plano.md` | — |
| `entregas/<entrega-slug>.md` | — (uma linha por entrega) |

## Pendências e riscos abertos
| Item | Etapa | Bloqueante? | Decisão |
|---|---|---|---|

## Decisões
| Data | Decisão | Por quê |
|---|---|---|
```

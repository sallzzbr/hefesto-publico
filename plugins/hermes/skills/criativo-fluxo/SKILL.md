---
description: "Run the studio creative flow end-to-end for a performance ad. Use when the user wants to produce an ad creative from a brief — rodar o fluxo criativo, produzir um criativo com validação, gerar rotas visuais de um brief, tirar um render aprovável de um conceito."
---

# Criativo Fluxo (estúdio)

Orquestra o fluxo de estúdio de um criativo de anúncio em **dois portões humanos e dois
estágios**: portão de **ideia** (texto puro, antes de qualquer imagem) → `rotas` (brief
interrogado → prancheta → 2-3 rotas visuais → 1 rough barato por rota) → portão **visual**
(humano escolhe a rota vendo roughs) → `produzir` (rota aprovada → candidatos em paralelo →
seleção → composição → pre-flight → crítica adversarial → pacote). Desde a v1.0 do hermes o
miolo roda no **harness** `harness/criativo.mjs` — invariantes em código, não em prosa, no
padrão do dev-loop do odin e do gerar-curso do mimyr.

**Por que dois portões, com propósitos distintos:** o Portão 1 aprova a **ideia** (existe uma
verdade específica a dizer, e uma ordem de leitura pra dizê-la?) — ideia fraca morre em texto,
custo zero. O Portão 2 aprova a **execução visual**: o humano escolhe a rota **vendo roughs**,
não lendo direção abstrata. Não funda os dois: rough não é aprovação de ideia, e ficha de
ideia não é aprovação visual.

**Por que dois estágios:** conceito errado morre na rota, não na 6ª iteração de execução. É o
double diamond do estúdio: diverge em rotas → humano converge → diverge em candidatos →
crítica converge.

## Workspace (contrato de layout)

Esta skill opera sobre um workspace de marketing no layout hermes. Os diretórios-base se
resolvem pela **regra única** do plugin (`references/defaults.md`): (1) campos `local_*` na
seção `## Paths do workspace` do `CLAUDE.md` do workspace; (2) campos `local_*` dos defaults
do usuário (`~/.claude/hermes/defaults.md`); (3) convenção descoberta no cwd (os nomes
abaixo). Os paths citados nesta skill são ilustrativos do default, não hardcode. A
estrutura relativa a cada base é fixa:

- `branding/` — `principios-criativos.md`, `arquetipos-criativos.md`, `tom-de-voz-aplicado.md`
- `contexto/identidade-visual.md` — cores/fontes/formatos da marca
- `marketing/criativos/{briefs,base,renders}/` — briefs, imagens-base e renders finais
- `marketing/referencias/banco-visual/_indice.csv` — referências visuais (vencedoras primeiro)
- `marketing/registry/criativos/` — artefatos e reports (`__ideia.md`, `__rotas.md`, `__validacao_iterN.md`, `_validacoes.csv`)
- `marketing/producao/pacotes-aprovacao/` — pacotes de decisão humana
- `scripts/` — `gerar_imagem.py`, `compor_*.py`, `validar_criativo.py` (Pillow), com `.venv`

Se a base de branding ou o diretório de criativos **resolvidos** não existirem no cwd,
**PARE** e informe que o cwd não é um workspace de criativos — não invente layout. Chaves de
API de imagem (`.env` do workspace) e dados são do workspace; o plugin não carrega
credenciais.

## Pré-requisitos (validar ANTES de invocar o harness)

1. **Brief existe** — de `hermes:sugerir-criativos` ou escrito à mão, com produto, público,
   objetivo e UMA mensagem. Brief vago o diretor devolve bloqueado (por design). O brief é
   **insumo** do Portão 1 (abaixo), nunca substituto dele.
2. **Venv do workspace** — `.venv/bin/python` com Pillow instalado (os steps mecânicos rodam
   `compor_*.py` e `validar_criativo.py`; sem venv o run "falha" mentindo — defeito de setup,
   não de conteúdo). Sem venv: informe o bootstrap (`python3 -m venv .venv && .venv/bin/pip
   install pillow`) e pare.
3. **Banco visual populado** — ao menos a vencedora principal em
   `marketing/referencias/banco-visual/`. Vazio não bloqueia, mas degrada a ancoragem
   (o diretor sinaliza `baselinePath: null` e o critério D vira sinalização).
4. **Arquétipo com imagem IA** exige chave no `.env` do workspace (`OPENAI_API_KEY` ou
   `GEMINI_API_KEY`). Arquétipo `texto` roda com **zero API de imagem**.

## 🚦 Portão 1 — ideia (BLOQUEANTE, antes de qualquer imagem)

**Inversão obrigatória:** primeiro UMA ideia clara, depois a ordem de leitura, **só então** a
composição. Nunca comece pelo template/layout e encaixe uma frase dentro dele — é assim que
sai peça tecnicamente correta e sem ideia nenhuma.

Este portão é **texto puro**. Zero chamada de API de imagem antes do OK humano: nem rough "só
pra ilustrar", nem mockup, nem candidato. O estágio A **gera roughs** — invocar o harness com
este portão fechado é violação do fluxo, não atalho.

**Quem segura o portão é você, com uma rede embaixo:** o harness não lê a ficha, mas o
*briefing interrogado* do diretor recusa (`bloqueado`, antes de qualquer rough, custo zero) o
brief que chega sem observação humana, sem headline aprovada nos 4 testes ou sem hierarquia de
leitura. A rede pega o esquecimento; ela **não** substitui o OK humano na ficha — o diretor
julga o que está escrito no brief, não se um humano aprovou.

Apresente ao humano a **ficha da ideia**, estes 8 campos, nesta ordem (critério de aceite de
cada campo, testes de copy, teto de elementos e formato do artefato em
`references/portao-de-ideia.md`):

1. **Objetivo do anúncio** — efeito concreto que a peça precisa causar (não "vender mais").
2. **Estágio do funil** — topo/meio/fundo, e o que isso permite e proíbe na peça.
3. **Observação humana que fundamenta a ideia** — comportamento observável, situação
   cotidiana, contradição ou característica reconhecível. Cumplicidade sem verdade específica
   não é observação.
4. **Headline** — uma só, já aprovada nos quatro testes de copy (troca do termo definidor,
   fala humana, "e daí?", verdade comercial).
5. **Produto exibido** — qual produto real aparece e como.
6. **Hierarquia de leitura** — 1º/2º/3º: o que é entendido primeiro, o que completa ou muda o
   significado, onde entram produto e ação. A maior informação da peça carrega o significado
   principal — não se aumenta expressão vazia por parecer punchline.
7. **Esboço textual da composição** — wireframe em palavras (blocos, posições, ordem). Sem
   imagem.
8. **Justificativa de cada elemento** — por que cada bloco existe e ocupa o espaço que ocupa.
   Área que não destaca produto, mensagem ou ação sai do esboço.

Aprovado, grave a ficha em `marketing/registry/criativos/<stem-do-brief>__ideia.md`
(`aprovada_em` preenchido) **e** consolide os 8 campos no próprio brief (`briefPath`) — o
harness lê o brief; ideia que não está no brief não chega no diretor de arte.

Reprovou em qualquer campo → volta pra **ideia**, não pra composição. Campo vago = portão
fechado; não se avança "preenchendo depois".

## 💸 Plano de custo/rigor (OBRIGATÓRIO antes de invocar)

Leia os defaults do usuário (`~/.claude/hermes/defaults.md`, campos `criativo_*` — contrato
em `references/defaults.md`) e traduza TODOS os campos presentes:
`criativo_diretor: opus` → `tiering.modelos.rotas=opus` (desliga a promoção a Fable);
`criativo_haiku: desligado` → `roughs/composicao/preflight/pacote=sonnet`;
`criativo_produtor: opus` → `producao=opus` e `correcao=opus`;
`criativo_perfil` → vira o arg `perfil` do Workflow;
`criativo_modelo_por_step` / `criativo_effort_por_step` → entradas em `tiering.modelos` /
`tiering.efforts` tal qual (a whitelist do harness decide e registra recusas).
Arquivo/campos ausentes → **não pergunte nada e não monte `tiering`**: os defaults embutidos
do script já são o comportamento certo (diretor fable·high com fallback opus, produtor
sonnet, validador opus·high, mecânicos haiku·low, perfil balanceado).

| Perfil | Rotas | Candidatos/rodada | Quando sugerir |
|---|---|---|---|
| `economico` | 2 | 2 | variação simples de vencedor, arquétipo texto |
| `balanceado` (default) | 3 | 3 | caso comum |
| `maximo` | 3 | 4 | conceito novo, aposta cara, segmento novo |

Custo de imagem por run (arquétipo IA): roughs = 1 por rota; candidatos = N na rodada
inicial e N-1 (mín. 2) nas re-gerações — com o teto de 3 iterações, o teto de rodadas de
geração coincide com o de iterações. Estime e diga. Agentes: estágio A = 1 diretor + 1
mecânico por rota; estágio B = 1 portão + por iteração (até 3): [1 produtor + 1 seleção
SOMENTE quando a iteração gera candidatos — iteração de correção só-overlay não os chama] +
2 mecânicos (composição + pre-flight) + 1 crit (+1 confirmação por finding plausível) +
1 correção (iterações que não fecham) — e 1 pacote no fim (também nos escalados com
histórico). Faça a pergunta de **opt-in explícito**: *"posso orquestrar com multi-agentes?
(~N agentes, ~M chamadas de imagem)"*. Sem opt-in → fallback sequencial (abaixo).

Invariantes que NENHUM perfil remove (estão no script): portão de rota aprovada antes de
qualquer candidato — e a rota aprovada precisa ter **rough no disco** (a aprovação é VISUAL;
sem rough o portão bloqueia); em arquétipo com imagem IA o comando de overlay carrega o
placeholder **`{{BASE}}`** e a troca pelo candidato selecionado é feita em código (o mecânico
nunca edita comando); seleção pelo validador (nunca pelo produtor); pre-flight + crítica em
toda iteração — pre-flight que **quebra** (exit ≠ 0 sem falha nomeada) aborta o run, não
passa; **qualquer bloqueante confirmado = fail** (não existe "1 fail vira borderline");
finding plausível confirmado antes de virar retrabalho; teto de 3 iterações (o teto de
rodadas de geração coincide com ele no default); arquétipo `texto` **nunca** liga geração de
imagem (finding com custo `ia` é coergido a overlay, em código); falha de overlay recompõe
sem re-gerar (custo zero); correção que não muda nada **escala** em vez de queimar teto;
crit/confirmação/seleção/pacote que não retornam ABORTAM o run (fail-closed, reinvocável);
reports de validação gravados SEMPRE que houve iteração (verde ou escalado); e **Haiku
somente nos steps mecânicos whitelisted em código**.

## ▶️ Estágio A — rotas

Com brief + venv validados, **ficha da ideia aprovada** (Portão 1) e opt-in de custo, invoque
a tool **Workflow**. Sem `aprovada_em` na ficha, não invoque. A skill **sempre injeta**
em `dirs` as quatro bases resolvidas, inclusive quando coincidem com os defaults; só callers
legados podem omitir esse arg:

```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/skills/criativo-fluxo/harness/criativo.mjs",
  args: {
    estagio: "rotas",
    briefPath: "marketing/criativos/briefs/<AAAA-MM-DD>-<tema>-cN.md",
    python: ".venv/bin/python",
    hoje: "<data ISO de hoje>",
    perfil: "balanceado",             // ou o criativo_perfil dos defaults do usuário
    tiering: { ... },            // só quando os defaults do usuário divergem do embutido
    dirs: {
      marketing: "<local_marketing resolvido>",
      branding: "<local_branding resolvido>",
      contexto: "<local_contexto resolvido>",
      scripts: "<local_scripts resolvido>"
    }
  }
})
```

### 🚦 Portão 2 — visual (rota)

> **Nomes no runtime:** o harness só conhece este segundo portão — é a fase `Portão` dos logs e
> do campo `fase` dos desfechos. "Portão" sem número num relatório de run **sempre** é o de
> rota; o de ideia não aparece lá porque acontece antes de invocar o harness.

Desfecho `aguardando-rota` → **apresente os roughs ao humano**: Read em cada PNG de rough,
mostre lado a lado com nome/arquétipo/referência/porquê de cada rota (e `conflitoTrilho` se
veio), cada uma amarrada à hierarquia de leitura aprovada no Portão 1 — rota que trai a ficha
não vai pro humano, volta pro diretor. O humano escolhe VENDO. Grave então no frontmatter de
`<slug>__rotas.md`:
`rota_aprovada: <n>` e `aprovada_em: <data>`. **Nunca** grave sem escolha explícita do
humano — o portão do estágio B existe exatamente pra isso.

## ▶️ Estágio B — produzir

```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/skills/criativo-fluxo/harness/criativo.mjs",
  args: {
    estagio: "produzir",
    rotasPath: "marketing/registry/criativos/<slug>__rotas.md",   // com rota_aprovada gravada
    python: ".venv/bin/python",
    hoje: "<data ISO de hoje>",
    perfil: "balanceado",             // ou o criativo_perfil dos defaults do usuário
    dirs: {                      // obrigatório na invocação da skill; bases já resolvidas
      marketing: "<local_marketing resolvido>",
      branding: "<local_branding resolvido>",
      contexto: "<local_contexto resolvido>",
      scripts: "<local_scripts resolvido>"
    }
  }
})
```

Steps: `portao`, `producao`, `selecao`, `composicao`, `preflight`, `crit`, `confirmacao`,
`correcao`, `pacote` (estágio A: `rotas`, `roughs`). Fallbacks são do script: fable→opus no
diretor, promoção→piso no produtor, haiku→sonnet nos mecânicos — tudo registrado em
`fallbacks`, com desliga-pelo-run. **Não trate você o fallback** e não faça probe de modelo.

Trate os desfechos:

- **`verde`** → pacote pronto. Retome o pós-verde (abaixo).
- **`aguardando-rota`** (estágio A) → apresentar roughs, gravar `rota_aprovada`, estágio B.
- **`bloqueado`** → brief incompleto, rota não aprovada, ou render existente sem
  `reproduzir: true` no artefato. Resolva COM o humano e reinvoque — o harness não improvisa
  (e não gastou API de imagem).
- **`escalado`** → teto de iterações/rodadas de IA, geração/composição impossível (setup), ou
  rough zero. Apresente o pacote/diagnóstico e espere decisão — loop que não converge é sinal
  de rota/brief errado, não de falta de força bruta.
- **`erro`** → falha de infraestrutura de um agente (fail-closed); reinvocar com
  `resumeFromRunId` aproveita tudo que já completou.

## Pós-verde (fora do harness)

1. **Apresente o pacote ao humano**: render final (Read no PNG), rationale da seleção, grid
   (roughs + candidatos), copy final (marcando se foi corrigida no run), findings
   não-bloqueantes. A decisão é dele.
2. **Após OK humano**: grave o registry canônico do criativo
   (`marketing/registry/criativos/<slug>.md` com briefing/execução/copy + linha em
   `_indice.csv`, `status: aprovado`) — o harness deixou os reports de validação prontos.
3. Aprendizado novo no run (campo `aprendizado:` em report) → promova pra seção
   `## Aprendizados de produção` de `branding/principios-criativos.md`.
   **Cláusula de inferência (bloqueante)** — antes de uma medição do run virar regra
   promovida, responda: (1) **quantos casos** foram olhados, e com que **variância**? (2) a
   amostra cobre as **variantes relevantes** (cor/modelo/contexto)? (3) qual
   **contra-exemplo** barato refutaria — foi checado? Medição sem essas três respostas se
   promove como OBSERVAÇÃO, não como regra.
4. Próximo passo do workspace: montar campanha e subir (commands do workspace, ex.:
   `/campanha-montar`). Commit é do humano — **o harness nunca commita**.

**Subida tem regra própria por objetivo de campanha.** Subir o criativo aprovado via API não
é um POST genérico: cada objetivo de campanha tem exigências próprias (ex.: Catalog Sales
exige formato específico de creative e clonagem de conjunto, em vez de criação direta). O
pacote final deve **apontar para o playbook de subida do workspace** — o plugin não carrega
payloads, endpoints nem credenciais de subida.

## 🔁 Fallback sem multi-agente (sem opt-in ou sem a tool Workflow)

O protocolo não muda; só o paralelismo — e **os dois portões continuam obrigatórios**. Execute
você mesmo, sequencial: ficha da ideia (8 campos, texto puro) → OK humano → brief interrogado →
prancheta → rotas com roughs (`hermes:direcao-de-arte` como contrato) → humano escolhe vendo
→ candidatos (N conforme perfil) → seleção comparando com a baseline → composição →
pre-flight (`validar_criativo.py`) → crítica com os critérios A-J de
`hermes:validar-criativo` (postura de refutar; qualquer bloqueante = fail; plausível se
confirma relendo) → correção pela tabela fail→ação (overlay recompõe grátis; IA re-gera, máx
2; copy reescreve) → teto de 3 iterações → pacote com rationale + reports gravados SEMPRE.

## NUNCA fazer

- ❌ Gerar QUALQUER imagem (rough, candidato, mockup) antes do OK humano na ficha da ideia
- ❌ Começar pelo template/layout e encaixar a frase dentro dele — a ideia vem antes da composição
- ❌ Fundir os portões: rough não aprova ideia, ficha não aprova execução visual
- ❌ Invocar o harness sem brief, sem venv validado, sem ficha aprovada ou sem opt-in de custo
- ❌ Gravar `aprovada_em` na ficha ou `rota_aprovada` sem escolha explícita do humano (a rota, vendo os roughs)
- ❌ Produzir com o portão aberto ou "só desta vez" fora do fluxo
- ❌ Re-implementar o loop em prosa quando a tool Workflow existe — o script É o protocolo
- ❌ Pular validação "porque parece OK" (é exatamente o que furou na prosa)
- ❌ Marcar `status: aprovado` no registry sem OK humano no pacote
- ❌ Subir qualquer coisa pro Meta de dentro do fluxo (subida é do workspace, com playbook próprio)
- ❌ Commit/push por conta própria

## Output

Relato curto ao final: slug, path da ficha da ideia (Portão 1) e headline aprovada, rota
aprovada (n/nome, Portão 2), iterações e rodadas de IA, veredito,
path do pacote e do render, modelos efetivos por step (do relatório do harness), fallbacks e
recusas de tiering se houve, e o próximo passo concreto.

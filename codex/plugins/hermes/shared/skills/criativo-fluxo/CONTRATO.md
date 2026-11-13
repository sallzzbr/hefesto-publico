---
name: criativo-fluxo
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

Execute primeiro o preflight somente leitura do plugin, passando as mesmas bases já
resolvidas pela regra acima. Antes das rotas, omita `--capability` para exigir as duas; quando
o arquétipo já estiver definido, restrinja a checagem a `texto` ou `imagem-ia`:

```
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/verificar_workspace.py" \
  --workspace . \
  --marketing "<local_marketing resolvido>" \
  --branding "<local_branding resolvido>" \
  --contexto "<local_contexto resolvido>" \
  --scripts "<local_scripts resolvido>" \
  --manifesto "<local_manifesto resolvido>" \
  --perfil "<local_perfil resolvido>" \
  --venv "<venv resolvido>" \
  --python "<python do venv resolvido>"
```

Na checagem específica, acrescente `--capability texto` ou `--capability imagem-ia`.
O manifesto de scripts (`manifesto-scripts.json`, path por `local_manifesto`) é obrigatório: ausente, JSON inválido ou sem a lista `scripts` entra em `missing` como `scripts.manifesto`, antes de qualquer rough pago. O perfil do negócio (`perfil-do-negocio.md`, path por `local_perfil` na mesma regra única; formato em `${CLAUDE_PLUGIN_ROOT}/references/perfil-do-negocio.md`) é
validado junto: campo ausente ou inválido entra em `missing` como `perfil.<campo>`. O JSON devolve
o perfil lido em `perfil`; dele sai a lista `segmentos` que a skill injeta no harness como `args.segmentos`.
`--venv` e `--python` precisam descrever o mesmo ambiente: o primeiro localiza o pacote PIL;
o segundo localiza o executável que o harness receberá.

Qualquer exit diferente de `0` ou saída que não seja JSON válido bloqueia o fluxo. Quando houver
JSON com `missing`, apresente todos os itens e pare antes de qualquer chamada paga. Exit `0`
confirma apenas presença e layout do contrato; não valida credenciais, qualidade visual nem
funcionamento interno dos scripts. O verificador não executa scripts do workspace, não instala
dependências e não cria diretórios. Para conferir ou montar um fixture seguro, use o contrato
sintético em `references/workspace-minimo.md`. Ele documenta interfaces; não é um gerador de
imagem fornecido pelo plugin.

1. **Brief existe** — de `hermes:sugerir-criativos` ou escrito à mão, com produto, público,
   objetivo e UMA mensagem. Brief vago o diretor devolve bloqueado (por design). O brief é
   **insumo** do Portão 1 (abaixo), nunca substituto dele.
2. **Venv do workspace** — Python do venv resolvido com Pillow instalado (os steps mecânicos rodam
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
geração coincide com o de iterações. Cada comando tem **uma tentativa**, sem retry
automático. Falha ou retorno incerto interrompe o fluxo; preserve recibos, logs e arquivos,
reconcilie o efeito real com o humano e revise a estimativa antes de autorizar outra
tentativa. Re-geração por crítica é uma rodada distinta, dentro do teto e orçamento
autorizados; não é retry de comando falho. Isso vale também no modo Solo. Estime e diga. Agentes: estágio A = 1 diretor + 1
mecânico por rota; estágio B = 1 portão + por iteração (até 3): [1 produtor + 1 seleção
SOMENTE quando a iteração gera candidatos — iteração de correção só-overlay não os chama] +
2 mecânicos (composição + pre-flight) + 1 crit (+1 confirmação por finding plausível; com a
headline travada, +1 confirmação de promessa por `headline_tem_ideia` na headline) +
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
finding plausível confirmado antes de virar retrabalho, e **refutação sem porque** não o
descarta (o schema do veredito exige `porque` não vazio e o controlador recusa `porque` só com
espaços ou caracteres invisíveis, como U+200B: o finding segue bloqueante, com o motivo em `findingsJulgados`); teto de 3 iterações (o teto de
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
antigos podem omitir esse arg:

```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/skills/criativo-fluxo/harness/criativo.mjs",
  args: {
    estagio: "rotas",
    briefPath: "marketing/criativos/briefs/<AAAA-MM-DD>-<tema>-cN.md",
    python: ".venv/bin/python",
    hoje: "<data ISO de hoje>",
    segmentos: <perfil.segmentos do preflight, o array>,   // lista permitida; cada rota escolhe um (renders/<segmento>/<slug>.png)
    perfil: "balanceado",             // ou o criativo_perfil dos defaults do usuário
    tiering: { ... },            // só quando os defaults do usuário divergem do embutido
    dirs: {
      marketing: "<local_marketing resolvido>",
      branding: "<local_branding resolvido>",
      contexto: "<local_contexto resolvido>",
      scripts: "<local_scripts resolvido>",
      manifesto: "<local_manifesto resolvido>"
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

## Contrato estruturado de ações e manifesto de scripts

O harness **não executa comando de shell escrito por agente**: toda rota traz `acoes` (obrigatório,
e o `segmento` da peça, um dos `segmentos` do perfil do negócio, que nomeia `renders/<segmento>/<slug>.png`). O agente só
preenche campos; o harness monta o argv, cita todo valor (aspas simples, um argumento cada) e
entrega ao mecânico o comando pronto num bloco `sh`. Rota sem `acoes` (comando em texto livre) encerra
o run em `erro` nomeando `acoes`, antes de qualquer rough ou composição.

```
gerar:   {op:"gerar",   prompt, saida, referencias:[path], tamanho, provedor?}
compor:  {op:"compor",  compositor:"<nome do manifesto>", base?:"{{BASE}}", saida,
          textos:{chave:valor}, formato, opcoes:{chave:escalar}, sobrescrever:bool}
validar: {op:"validar", render?, formato?, arquetipo?, textoEsperado?, logRender?, baseline?}
```

No máximo uma ação de cada `op` por rota. `gerar` vira `<python> <scripts>/gerar_imagem.py <prompt>
<saida> [--edit <ref>]... [--tamanho T] [--provedor P]`; é dela que sai o rough (estágio A) e os
candidatos (estágio B). `compor` exige `base: "{{BASE}}"` em arquétipo com imagem IA; o harness
troca pelo candidato selecionado. `validar` é opcional e sobrepõe formato, arquétipo, texto,
baseline e log da rota. Rota de arquétipo `texto` ou `semGeracao: true` pode trazer `acoes` só com
`compor` (e `validar`): não há rough a gerar nem gasto, o portão devolve `roughExiste=true` e o
render composto é o primeiro preview. Rota com imagem IA exige a ação `gerar` no estágio A; no
estágio B, `acoes` sem `gerar` gera os candidatos com o `promptIa` da rota, montado em código.

**Manifesto** `manifesto-scripts.json` — path em `dirs.manifesto` (default
`<dirs.scripts>/manifesto-scripts.json`, resolvido pela regra única de paths). O harness não lê
arquivo: o operário do portão lê e devolve o conteúdo em `manifesto`.

```json
{ "scripts": [ {
  "nome": "compor_texto", "executavel": "compor_texto.py",
  "campos": {
    "saida":   { "flag": "--saida" },
    "base":    { "flag": "--base" },
    "formato": { "flag": "--formato" },
    "textos":  { "titulo": { "flag": "--titulo" } },
    "opcoes":  { "fonte":  { "flag": "--fonte" } }
  },
  "sobrescrever": "--sobrescrever",
  "logRender": "logs/render.jsonl"
} ] }
```

Cada campo mapeia para `{flag}` ou `{posicao: n}` (posicionais vêm antes das flags). Compositor
fora do manifesto, opção/texto/campo não declarado, ou ação `compor` sem manifesto: o run
retorna **`bloqueado`** nomeando o item, antes de gastar geração. A saída do render é o campo
`saida` da ação, nunca "o último argumento que não seja flag".

**Validação de entrada** (erro antes de qualquer agente): `hoje` é `AAAA-MM-DD` de calendário
real; `briefPath`, `rotasPath`, `dirs.*` e saídas das ações são relativos ao cwd (sem `..`, sem
caminho absoluto, sem espaço nas bordas, sem `-` inicial; os paths que entram crus na prosa dos
prompts, como `rotasPath`, `briefPath`, `dirs.*`, o artefato de rotas e a baseline, também sem `$`);
`slug` e o `segmento` da rota (com ou sem `args.segmentos`; com o arg, a rota com segmento fora da lista é recusada, e `args.segmento` no singular é recusado sem alias) só `^[a-z0-9][a-z0-9_-]{0,80}$`; a saída da ação `compor` é exatamente `<marketing>/criativos/renders/<segmento>/<slug da rota>.png`, sem subpasta, com outro slug nem outra extensão (fora disso o portão bloqueia antes de gerar), e o `renderJaExiste` do portão olha esse arquivo. `python` é UM executável (o venv do workspace): comando
composto como `uv run python` ou `python -m x` é recusado com mensagem clara (crie um wrapper
executável); caminho com espaço no meio é aceito quando começa como caminho (`/dir com espaço/py`,
`./meu venv/bin/python`). O portão também devolve `symlinksForaDoCwd` (paths do workspace que
resolvem para fora do cwd): não vazio encerra em erro.

Valor que começa com `-` não vira opção do script: em flag longa o argv leva `--flag=valor`; em
posição ou flag curta a ação é recusada (`erro`); path que começa com `-` é recusado. Valor com
quebra de linha segue entre aspas (um argumento só) e cada comando de geração chega ao mecânico
em bloco `sh` próprio. O diretor de arte recebe este contrato e o caminho do manifesto no estágio
A, e devolve `acoes` quando o workspace declara o manifesto.

**`--log-render`:** com texto esperado, o validador recebe `--log-render` (do `logRender` da ação
`validar`, ou do manifesto do compositor). O `logRender` aceita os marcadores `{slug}`, `{segmento}` e `{hoje}` (data ISO), expandidos em código: um log datado ou nomeado por peça (`logs/{segmento}/{hoje}-{slug}.jsonl`) cabe no manifesto sem caminho fixo. Rota com texto esperado **sem** `logRender`
declarado é `bloqueado` no portão, antes de gerar. O pre-flight devolve `checks` (o mecânico é
instruído a devolvê-lo sempre; o schema ainda o aceita ausente). Pre-flight sem `checks`, ou com
`checks` sem o check `texto_fiel` em `pass`/`warn` (ausente, `skip` ou outro status), **não fecha
verde**: vira veredito `unknown` e escala com pacote. Posições do manifesto (`posicao`) são únicas
e sem buraco (0..n-1); a ação que omite um posicional do meio é recusada.

## ▶️ Estágio B — produzir

```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/skills/criativo-fluxo/harness/criativo.mjs",
  args: {
    estagio: "produzir",
    rotasPath: "marketing/registry/criativos/<slug>__rotas.md",   // com rota_aprovada gravada
    python: ".venv/bin/python",
    hoje: "<data ISO de hoje>",
    segmentos: <perfil.segmentos do preflight, o array>,
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
diretor, promoção→piso na correção, haiku→sonnet nos demais steps mecânicos.
**Roughs e produção não recebem fallback**, pois a ausência de retorno pode esconder uma
geração já paga. Os fallbacks permitidos ficam registrados em `fallbacks`, com
desliga-pelo-run. **Não trate você o fallback** e não faça probe de modelo.

### Invocação sem cópia do cache (scriptPath recusado)

Se o `scriptPath` apontando para o cache do plugin for recusado pela tool Workflow, não copie o
harness para o workspace: ler o `.mjs` (Read em
`${CLAUDE_PLUGIN_ROOT}/skills/criativo-fluxo/harness/criativo.mjs`) e passar o conteúdo
inteiro em `script` no lugar de `scriptPath`, com os mesmos `args`. O harness é autocontido
(começa com `export const meta`, sem `import`/`require`), então roda assim sem ajuste.

### Roteiro de reexecução (render já existe, rota ou headline mudam)

Reexecutar o estágio B sobre um slug que já tem render exige decisão humana, nunca é padrão:

- **Trocar de rota:** grave a nova `rota_aprovada: <n>` no frontmatter de `<slug>__rotas.md`
  (o humano escolhe vendo os roughs) e reinvoque o estágio B com `args.reproduzir: true`;
  sem ele o portão bloqueia o render existente.
- **Headline nova:** reinvoque com `args.headline: "<texto>"`. Copy estruturada (rótulos
  `Headline`, `Subheadline`, `Body`/`Corpo`, `Descrição`, `CTA`): o harness troca SÓ o valor do rótulo
  `Headline` (ancorado no início ou após `|`, `/`, quebra de linha ou ". "; nunca dentro de
  `Subheadline`), até o próximo rótulo, `|` ou quebra de linha, e preserva o resto. Copy SEM nenhum
  rótulo reconhecido é só a headline e é trocada inteira. Copy com rótulos mas sem `Headline` ganha
  `Headline: <texto> | ` na frente. Vale para todo o run (crit, correção, pacote e resultado).
  Combine com `args.reproduzir: true` se o render do slug já existe.
- **Headline que não pode mudar:** `headlineTravada: true` na rota (ou em `args`). Finding do
  crit com `alvo: 'headline'` (sem diferença de caixa ou espaço) de REDAÇÃO (`custoCorrecao:
  'copy'` ou critério `voz_da_marca` / `mensagem_completa` / `headline_tem_ideia` /
  `tres_segundos` / `coerencia_imagem_copy`) deixa de bloquear e vai para `sinalizacoes`
  (resultado e pacote, com o motivo); **exceção: `verdade_comercial` com alvo headline nunca é
  sinalizada**, qualquer que seja o custo, e conta como bloqueante mesmo que o crit a declare
  `nao-bloqueante` (a coerção fica em `severidadeCoagida` no histórico da iteração). Ela segue a
  confirmação normal e, confirmada, encerra o run como `bloqueado` (fase Crit) logo depois da
  confirmação, sem iteração de correção e com os reports gravados: a copy travada não se
  reescreve, então não há correção possível no run. A ação é do dono: destravar a headline, ou
  trocá-la por uma verdadeira com `args.headline`, e reinvocar com `args.reproduzir: true`.
  `headline_tem_ideia` com alvo headline, em qualquer severidade e confiança, passa antes por uma
  **confirmação de promessa** (chamada própria `promessa:i<N>` do validador, com a pasta de
  contexto resolvida e lookup do catálogo): a crítica aponta promessa de produto, variação, serviço
  ou condição que o negócio não oferece? `promessaFalsa: true` é verdade comercial confirmada na
  headline travada: mesmo fim `bloqueado`, com o detalhe dizendo que veio de `headline_tem_ideia`
  reclassificado (registro em `reclassificados` no histórico). `promessaFalsa: false` com `porque`
  segue o tratamento de sempre (sinalização, ou não-bloqueante quando o crit o declara assim, com
  o `porquePromessa` anexado); com justificativa inválida, o run termina `erro` de resposta, sem afirmar promessa falsa
  nem liberar entrega. Confirmador de promessa que não retorna é erro. Sem a trava, essa chamada não existe. Com a
  trava, `copyCorrigida` da correção é descartada com registro (entrada `tipo: 'copyCorrigida'` em
  `sinalizacoes` e aviso na correção) e a copy final fica como está. Defeito de RENDER com alvo
  headline (ex.: "headline cortada", `texto_correto`/`legibilidade_thumbnail`, e também
  `miniatura`/`desfoque`/`exclusao`, com custo overlay ou ia) NÃO é suprimido: segue o fluxo
  normal. Verdade comercial sem a trava, ou na imagem (sem alvo headline), segue o fluxo normal de
  bloqueante e correção, com a copy corrigida aceita quando não há trava.
  **Limitação:** a trava protege a copy, não o texto já
  embutido nas `acoes` — uma correção de overlay pode reescrever os `textos` da ação `compor`; o
  pre-flight `--texto-esperado` é a única barreira.
- **Rota sem geração de imagem fora do arquétipo `texto`** (ex.: `produtotexto` sobre mockup):
  `semGeracao: true` e `promptIa: null` na rota; as `acoes` dela não têm `gerar`
  (render determinístico do mockup, custo zero); sem o campo, rota não-texto sem `{{BASE}}`
  continua bloqueada.
- **Composição que só regrava com flag:** `sobrescrever: true` na ação `compor` (a flag vem do
  manifesto, `sobrescrever` do compositor). O harness a anexa a partir da iteração 2 e, no reuso de
  render existente (liberado por `reproduzir`), já na iteração 1.

Trate os desfechos:

- **`verde`** → pacote pronto. Retome o pós-verde (abaixo).
- **`aguardando-rota`** (estágio A) → apresentar roughs, gravar `rota_aprovada`, estágio B.
- **`bloqueado`** → brief incompleto, rota não aprovada, ou render existente sem
  `reproduzir: true` no artefato nem `args.reproduzir`. Resolva COM o humano e reinvoque — o harness não improvisa
  (e não gastou API de imagem). O único `bloqueado` depois da crítica é a headline travada com
  `verdade_comercial` confirmada (fase Crit), inclusive o `headline_tem_ideia` reclassificado pela
  confirmação de promessa: o render já foi composto e os reports estão
  gravados; apresente o finding e a ação (destravar ou trocar a headline) ao dono.
- **`escalado`** → teto de iterações/rodadas de IA, estado de geração inválido ou
  composição impossível. Apresente o pacote/diagnóstico e espere decisão — loop que não converge é sinal
  de rota/brief errado, não de falta de força bruta.
- **`erro`** → preserve o relatório e os artefatos. Com `requerReconciliacao: true`,
  examine `parcial` e confronte comandos, arquivos e recibos com o efeito real antes de
  retomar. Não reenvie geração pela falta de arquivo ou resposta, nem troque o executor
  para contornar a interrupção. Só uma decisão humana após reconciliação e revisão de
  orçamento permite outra tentativa. Nos demais erros, `resumeFromRunId` aproveita
  respostas já concluídas; nunca presume que uma chamada sem resposta não teve efeito.

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
exige formato específico de creative, e o conjunto de anúncios se cria do zero: clonar um
conjunto herda o produto promovido, que é imutável). O
pacote final deve **apontar para o playbook de subida do workspace** — o plugin não carrega
payloads, endpoints nem credenciais de subida.

## 🔁 Fallback sem multi-agente (sem opt-in ou sem a tool Workflow)

O protocolo não muda; só o paralelismo — e **os dois portões continuam obrigatórios**. Execute
você mesmo, sequencial: ficha da ideia (8 campos, texto puro) → OK humano → brief interrogado →
prancheta → rotas com roughs (`hermes:direcao-de-arte` como contrato) → humano escolhe vendo
→ candidatos (N conforme perfil) → seleção comparando com a baseline → composição →
pre-flight (`validar_criativo.py`) → crítica com os critérios A-Q de
`hermes:validar-criativo`, cada um pelo slug próprio (postura de refutar; qualquer bloqueante =
fail; plausível se confirma relendo; headline travada segue a mesma regra do harness) → correção pela tabela fail→ação (overlay recompõe grátis; IA re-gera, máx
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

## Justificativa dos vereditos

O campo `porque` exige no mínimo 20 caracteres, desconsiderando espaços e caracteres invisíveis, e pelo menos uma letra ou número (Unicode). Explique o problema apontado e por que a evidência sustenta a confirmação ou a refutação. A checagem de tamanho não garante a qualidade do argumento. Refutação inválida não descarta nem rebaixa o achado; a regra vale também para `promessaFalsa: false`. O schema recusa texto bruto menor que 20; o controlador confere a contagem sem espaços/invisíveis e a presença de letra ou número antes de aceitar uma refutação.

## Formato dos achados

Cada item de `findings` aceita somente `criterio`, `resumo`, `evidencia`, `cenario`, `severidade`, `confianca` e `custoCorrecao` (obrigatórios), mais `acaoSugerida` e `alvo` (opcionais). O schema recusa qualquer campo extra. Metadados como `criterioOriginal`, `reclassificacao` e `porquePromessa` pertencem ao controlador e não podem ser enviados pelo crítico. No bridge Codex, resposta recusada não altera o estado; corrija a resposta da solicitação pendente, sem repetir efeitos já executados.

## Resposta inválida no confirmador de promessa

`promessaFalsa: false` com justificativa inválida encerra como `erro`, natureza `resposta_invalida`, identificando a solicitação `promessa:i<N>`. Não reclassifique o achado como verdade comercial, não gere correção ou pacote e não libere a entrega. Corrija a justificativa antes de retomar. O mínimo continua sendo 20 caracteres sem espaços/invisíveis e pelo menos uma letra ou número, com explicação da evidência. Uma promessa falsa confirmada continua bloqueando.

# AGENTS.md — Guia de manutenção para IAs

> Este arquivo existe pra IAs que forem mexer no repo `hefesto` (humanos também podem ler, mas o público alvo é outro agente de IA). Ele resume o contrato do repo, as convenções e as armadilhas comuns. **Leia antes de editar qualquer coisa.**

## Propósito do repo

`hefesto` é um **marketplace Claude Code** que publica seis **plugins**: `hefesto` (forja de plugins: criar, validar e versionar plugins e skills), `bragir` (escrita/voz e editorial: escrever-como-antonio, analisar-voz, gerenciar-personas, planejar-agenda, analisar-metricas), `mimyr` (cursos e didática: 5 skills + scripts Python + harness gerar-curso), `hestia` (economia doméstica: orçamento, análise de gastos, mercado e investimentos com dados no Google Drive do usuário), `hermes` (marketing de performance e criativos: 16 skills + 4 agents + harness criativo.mjs) e `odin` (desafios pelo double diamond: 6 skills + 9 comandos). O objetivo é ser instalável com dois comandos, funcionar em qualquer SO e ser compartilhável com amigos sem precisar de setup manual.

> Rumo do repo: o backlog mestre da reorganização do ecossistema (forja, bragir, mimyr, hestia, odin v2.3, hermes) está em `docs/superpowers/specs/2026-07-22-megaplano-ecossistema-plugins.md`.

## Layout canônico

```
hefesto/                                    # raiz = marketplace
├── .claude-plugin/
│   └── marketplace.json                      # manifesto do marketplace
├── plugins/
│   ├── hefesto/                              # forja de plugins
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json                   # manifesto do plugin
│   │   ├── commands/
│   │   │   └── <comando>.md                  # atalhos das skills da forja
│   │   └── skills/
│   │       └── <skill>/
│   │           ├── SKILL.md
│   │           ├── references/               # opcional
│   │           └── scripts/                  # opcional (ex.: validar.mjs)
│   ├── bragir/                               # plugin de escrita/voz
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json
│   │   ├── perfil-de-voz.md                  # recurso do plugin (fallback da voz)
│   │   └── skills/
│   │       └── <skill>/SKILL.md
│   ├── mimyr/                                # plugin de cursos e didática
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json
│   │   ├── skills/
│   │   │   └── <skill>/SKILL.md
│   │   ├── scripts/                          # scripts Python compartilhados pelas skills
│   │   │   └── requirements.txt              # deps documentadas (bootstrap de venv pelo usuário)
│   │   └── tests/                            # contratos das skills + testes dos scripts (pytest)
│   ├── hestia/                               # plugin de economia doméstica
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json
│   │   ├── README.md
│   │   ├── commands/                         # comandos hestia
│   │   └── skills/                           # orçamento, análise de gastos, mercado, investimentos
│   ├── hermes/                               # plugin de marketing e criativos (harness de estúdio)
│   └── odin/                                 # plugin de desafios (double diamond)
│       ├── .claude-plugin/
│       │   └── plugin.json                   # manifesto do plugin
│       ├── commands/
│       │   └── <comando>.md
│       ├── docs/
│       │   └── roteamento-matrix.md
│       └── skills/
│           └── <skill>/
│               ├── SKILL.md
│               └── references/
├── AGENTS.md
├── PLUGINS-TERCEIROS.md
├── README.md
├── LICENSE
└── .gitignore
```

Regras duras:

1. **`.claude-plugin/plugin.json` do plugin fica em `plugins/<plugin>/.claude-plugin/`**, nunca na raiz do plugin e nunca na raiz do marketplace.
2. **`.claude-plugin/marketplace.json` fica só na raiz do repo**, nunca dentro do plugin.
3. **Skills vivem em `plugins/<plugin>/skills/<nome>/SKILL.md`**. O nome do diretório é o nome da skill.
4. **`source` em `marketplace.json` tem que ser path relativo string** (`"./plugins/hefesto"`) ou um objeto de fonte remota. `"source": "."` **não é válido**.

## Convenções de nomenclatura

- **Plugin e marketplace** compartilham o nome `hefesto`. Se for renomear, renomeie nos dois manifestos + no diretório `plugins/<nome>/` + em todas as URLs do README + no campo `source` do marketplace.json.
- **Skill directory**: kebab-case, em português quando faz sentido (`escrever-como-antonio`, `gerenciar-personas`). Evite inglês-só se o público-alvo é PT-BR.
- **Persona file**: slugify determinístico — lowercase, acentos removidos via `NFD` + strip de diacríticos, espaços e pontuação viram hífen, hífens repetidos colapsam. Ex.: `Maria José` → `maria-jose`.

## Paths e portabilidade

- **NUNCA** use paths absolutos de SO (`E:\...`, `C:\...`, `/Users/...`) em SKILL.md, perfil de voz, persona ou qualquer arquivo versionado. Quebra em qualquer máquina que não seja a do autor.
- Para referenciar arquivos **dentro do plugin** a partir de uma skill, use `${CLAUDE_PLUGIN_ROOT}`. Exemplo: `${CLAUDE_PLUGIN_ROOT}/perfil-de-voz.md`. Essa variável é resolvida pelo runtime do Claude Code em conteúdo de skill.
- Para referenciar arquivos **do projeto do usuário**, use paths relativos ao cwd: `./personas/`, `./perfil-de-voz.md`. Nunca assuma estrutura além do cwd.
- **Path de domínio é resolvido, nunca hardcoded** (regra da Fase 8): quando uma skill opera sobre estrutura de workspace consumidor (pasta do Drive no hestia, `marketing/` no hermes, `./courses/` no mimyr, `docs/desafios|plans|pendencias` no odin, agenda/métricas/voz no bragir), o path se resolve por uma **regra única**, nesta ordem: (1) campo `local_*` na seção `## Paths do workspace` do `CLAUDE.md` do repo atual; (2) campo `local_*` dos defaults do usuário (`~/.claude/<plugin>/defaults.md`); (3) convenções descobertas no cwd; (4) default documentado. Na descoberta, exatamente um candidato existente é usado; mais de um candidato concorrente exige perguntar ao usuário; nenhum candidato cai no default documentado. Recurso obrigatório ausente no path resolvido faz a skill parar, salvo scaffold explícito. Paths citados em exemplos/templates são **ilustrativos do default, não hardcode** — toda skill que assume estrutura declara essa cláusula ou delega explicitamente à referência canônica (o `validar.mjs` cobra isso por arquivo). Harness nunca lê config de path: a skill resolve e injeta via args (padrão `dirs` do hermes, igual ao `tiering`).

## Contrato de personas (CRÍTICO)

Personas são do **projeto do usuário**, nunca do plugin. Isso é decisão de design, não sugestão:

- Cada projeto (mimyr, cursos, clientes do Antonio, e qualquer amigo que instalar) tem personas diferentes.
- O plugin não pode carregar personas internas porque engessaria o uso.
- `escrever-como-antonio` descobre personas em `./personas/*.md` (preferido) ou `./personas.md` (fallback). Se não achar e o usuário pediu audiência, ofereça invocar `gerenciar-personas`.
- `gerenciar-personas` **sempre** escreve em `./personas/` do cwd, **nunca** em `${CLAUDE_PLUGIN_ROOT}`.

Se for propor mudança nisso, pense duas vezes.

## SKILL.md — como escrever

**Frontmatter mínimo**:

```yaml
---
description: "<verbo> <o que>. Use when <gatilho 1>, <gatilho 2>, <gatilho 3>."
---
```

Regras de `description`:

- Comece com verbo em inglês (`Write`, `Analyze`, `Create`, `Generate`) — o matcher favorece isso.
- Inclua **gatilhos concretos**: termos que o usuário provavelmente usará quando precisar da skill ("na minha voz", "analisa esses docx", "cria uma persona").
- Máx 1024 chars, mas apunte pra 200–400 úteis. Descrições vagas não disparam auto-invocação.
- Misture PT e EN quando a base de usuários é bilíngue — os dois disparam.

**Campos opcionais úteis**: `allowed-tools`, `argument-hint`, `paths` (glob pra auto-load condicional), `disable-model-invocation`.

**Corpo da skill**:

- Estrutura clara: `## Input`, `## Before X`, `## Output`, `## Important`.
- Liste pré-requisitos e dependências externas (ex.: `analisar-voz` precisa da skill oficial `docx` pra ler `.docx`).
- Seja específico em instruções de I/O. "Escreva `./foo.md`" é melhor que "salve em algum lugar".
- Quando uma skill delega pra outra, diga o nome exato e quando invocar.

## Versionamento

- `marketplace.json.metadata.version` versiona o **marketplace** (bump minor ao adicionar plugin ou skill nova); cada `plugins[].version` no marketplace.json alinha com o `plugin.json` do plugin correspondente.
- Semver: bump `minor` quando adicionar skill nova; `patch` pra ajustes em skill existente; `major` pra quebra de contrato (ex.: mudar onde personas ficam).

## Commits

Estilo usado no repo:

```
<tipo>: <resumo curto>

<corpo explicando o "por quê", não só o "o quê">
```

Tipos comuns: `feat`, `fix`, `docs`, `restructure`, `chore`, `refactor`. Mensagens em português estão OK — o repo é bilíngue.

## Coisas que IAs frequentemente quebram aqui

1. **Recriar `personas.md` dentro do plugin** — não faça. Personas são do projeto.
2. **Adicionar `"source": "."`** no marketplace.json — não é spec-válido. Use path relativo string.
3. **Colocar `plugin.json` na raiz do repo** — o runtime não reconhece. Fica em `plugins/<plugin>/.claude-plugin/`.
4. **Hardcodar caminhos de Windows ou Mac** — use `${CLAUDE_PLUGIN_ROOT}` ou paths relativos ao cwd.
5. **Remover o `perfil-de-voz.md`** do plugin bragir ou mover pra fora dele — `escrever-como-antonio` depende dele via `${CLAUDE_PLUGIN_ROOT}`. (Era `voice-profile.md` no plugin hefesto até a v2.x; projetos consumidores com o nome legado são lidos com fallback.)
6. **Adicionar backwards-compat shims** quando renomear (ex.: manter `minhas-skills` como alias). Não faça. Se renomeou, renomeou em tudo.
7. **Comentar código/seções "por enquanto"**. Delete ou implemente — não deixe texto morto.
8. **Adicionar emojis** a qualquer SKILL.md ou perfil de voz sem pedido explícito. O perfil de voz do Antonio proíbe emojis; skills devem respeitar o tom. Exceção registrada: o plugin `odin` herda emojis **funcionais** (📍 🆘 🔴 etc.) do seu design de origem — não adicione novos, mas não os remova.
9. **Adicionar build step ou install automático**. Scripts standalone são permitidos por plugin quando a skill precisa de determinismo (precedentes: `plugins/odin/skills/dev-loop/harness/loop.mjs`, `plugins/hefesto/skills/validar-plugin/scripts/validar.mjs`). Dependências pip são permitidas **desde que** o script tenha `requirements.txt` no plugin e a skill documente o bootstrap de venv no primeiro uso, degradando com mensagem clara sem o venv (precedente: `plugins/mimyr/scripts/`). O plugin nunca instala nada sozinho e nunca tem build step.

## Adicionar uma skill nova

Prefira usar a forja: `criar-skill` scaffolda, `versionar-plugin` faz o bump, `validar-plugin` confere. O passo a passo manual equivalente:

1. Crie `plugins/<plugin>/skills/<nome>/SKILL.md` com frontmatter válido (no plugin certo: `hefesto` = forja; `bragir` = escrita/voz; `mimyr` = cursos/didática; `hestia` = economia doméstica; `hermes` = marketing/criativos; `odin` = desafios).
2. Atualize a tabela de skills no `README.md` (raiz) e, no caso do odin, no `plugins/odin/README.md`.
3. Bump `version` no `plugin.json` do plugin + na entrada correspondente de `marketplace.json.plugins[]` + em `marketplace.json.metadata.version` (minor bump).
4. Se a skill lê/escreve recursos do plugin, coloque-os em `plugins/<plugin>/<recurso>` e referencie via `${CLAUDE_PLUGIN_ROOT}`.
5. Se a skill depende de skill externa (ex.: `docx`), documente no corpo do SKILL.md.
6. Commit: `feat: nova skill <nome>`.

## Remover ou renomear skill

1. Delete/renomeie o diretório em `plugins/<plugin>/skills/`.
2. Atualize todos os SKILL.md que referenciam o nome antigo.
3. Atualize `README.md`.
4. Major bump se a skill era invocada por outras skills (quebra de contrato).

## Verificação antes de commitar

**Tudo abaixo roda sozinho no CI (`.github/workflows/ci.yml`) e fica vermelho.** Rodar local é
para não descobrir vermelho depois do push — não é opcional nem substituível por leitura.
Vermelho **não impede merge**: isso exigiria os 4 jobs como *required status checks*, que
dependem de branch protection ou ruleset — indisponíveis em repositório privado neste plano.
É fato do ambiente, não pendência: a esteira informa, o humano lê, e é assim que fica. Está dito
assim no topo do `ci.yml` também — não escreva aqui que o CI reprova o PR enquanto isso não
for ligado, que é a mesma prosa afirmando enforcement inexistente que este trabalho combate.

```bash
npm run validar     # manifestos, versões, frontmatter, paths (+ os 2 greps de repo, no CI)
npm test            # as suítes node (todo plugin com tests/) + as pytest (hermes, mimyr)
npm run mutation    # mutation testing do validar.mjs (~15-20 min em 4 vCPU)
```

> **Os comandos NÃO são reproduzidos aqui de propósito.** A fonte única deles é o
> `package.json` (`scripts`), que é o que o CI invoca. Copiar o comando para cá foi tentado e
> divergiu em menos de uma hora — a cópia do `grep` ficou sem os `--exclude` que o CI ganhou e
> passou a reprovar por falso positivo. Ao mudar um comando, mude no `package.json`.

O que este arquivo guarda é a **explicação** — o porquê de cada comando ter a forma que tem:

- **A regra que governa toda guarda aqui: meça o EFEITO, não o INDÍCIO.** Custou dois furos
  para ser aprendida, os dois achados pelo Codex e verificados rodando. Contar arquivo de teste
  não prova que teste rodou — arquivo vazio "passa", e esvaziar os dois `.test.mjs` do odin
  mantinha o piso de arquivos satisfeito com todos os contratos desligados. O exit 0 do Stryker
  não prova que ele mutilou algo — `// Stryker disable all` no topo do `validar.mjs` zerava os
  mutantes, o score virava `NaN`, e `NaN < 28` é falso. Ao escrever guarda nova, pergunte o que
  ela mede; se for a existência de um arquivo, ela ainda não é uma guarda.
- **`npm run test:node` é o `scripts/testes-node.mjs`**, não um glob de shell. Ele descobre
  **recursivamente** em `plugins/*/tests/**` (glob de shell não desce em subpasta: um teste
  quebrado em `tests/integracao/` saía 0), e cobra três pisos — arquivos totais, arquivos
  do hefesto e **testes efetivamente executados** lidos do `# pass` da saída TAP (os números
  vivem só no script; aqui só a regra).
  O piso de testes fica **exatamente na contagem atual**, sem folga: contagem de teste é
  determinística, então qualquer queda é perda real. Com folga o furo reabre — no piso 25,
  esvaziar dois arquivos dava 23 reais + 2 passes de arquivo vazio = 25, e passava.
- **Harness tem teste COMPORTAMENTAL, não só grep de marcador.** `plugins/odin/tests/
  harness-dev-loop.test.mjs` embrulha o corpo do `loop.mjs` num `AsyncFunction` com os globals
  do Workflow (`args`, `agent`, `parallel`, `phase`, `log`) e um `agent` falso por `label`;
  cada invariante "em código" tem um caso que o vê rodando. Invariante novo no harness entra
  com caso novo ali — grep de string no `.mjs` trava declaração, não efeito. mimyr
  (`harness-gerar-curso.test.mjs`) e hermes (`harness-criativo-fluxo.test.mjs`) seguem o mesmo
  molde desde 2026-09-02; o contrato por marcador + `node --check` continua como segunda camada.
- **Não enumere plugins na descoberta**: lista de plugins apodrece e o que ficar de fora tem a
  suíte ignorada em silêncio. Duas consequências que vêm junto e não são de graça: (a) o
  diretório precisa se chamar `tests` — `tests_node/` e afins seguem invisíveis, então suíte
  node de plugin novo vai em `tests/`; (b) `Suítes node` é check compartilhado, logo teste
  lento ou instável em QUALQUER plugin bloqueia PR de todos. Preço aceito.
- **`npm run mutation` tem guarda antes e depois.** `premutation` checa que o alvo existe;
  `postmutation` (`scripts/verificar-mutantes.mjs`) lê o relatório JSON e cobra um piso de
  mutantes **contabilizáveis** (≥900 sobre baseline de 1154). O `thresholds.break` protege
  contra score baixo e **nunca** contra score ausente — as duas portas para `NaN` são o alvo
  sumir e os mutantes serem ignorados, e cada uma tem a sua guarda.
- **Por que a descoberta aqui é recursiva e no `stryker.conf.json` são paths literais** (os
  dois rodam `node --test`, e a doutrina é oposta de propósito): o runner do CI precisa
  **abrir** — suíte que não entra é cobertura perdida em silêncio. O runner do Stryker precisa
  **fechar** — se o alvo some, glob vazio sai 0 e todo mutante "sobrevive" por não ter sido
  testado, produzindo score falso; path literal ausente sai 1 e aborta o dry-run. Aberto onde o
  risco é omissão, fechado onde o risco é número mentiroso.
- **Os 2 greps de repo usam código de saída, não `!`.** `! grep ...` converte QUALQUER exit
  diferente de 0 em sucesso, e o grep sai **2** em erro (path inexistente, permissão): renomear
  `plugins/odin/` desligava o gate em silêncio. Só exit 1 ("não achou") aprova.
  **Limitação conhecida e aceita:** `--exclude=AGENTS.md --exclude=ci.yml` remove os arquivos
  INTEIROS da varredura, não só as citações autorreferenciais — um uso real do termo proibido
  dentro deles passaria. As alternativas testadas (casar só ocorrências "entre crases", cobrar
  contagem fixa) são frágeis ou apodrecem, e gate frágil vira gate desligado. Fica registrado
  em vez de fingido: quem editar esses dois arquivos verifica o termo a olho.
- **`npm run cobertura:hestia`** cobra piso de **90%** sobre baseline real de 94,58% nos scripts
  do `hestia` — o código que mexe com dinheiro. Exige `pytest-cov` (o CI instala pinado; local,
  `pip install pytest-cov`). Cobertura é sinal **fraco**: diz que a linha rodou, não que o teste
  perceberia ela mudando. Está aqui porque o sinal forte, mutation testing, **não tem hoje
  ferramenta Python confiável** — a tentativa inteira, com os números e os dois diagnósticos
  errados no caminho, está no design doc do cerco. Gate fraco e honesto vale mais que gate forte
  e mentiroso. Verificado fechando: piso alto reprova, e alvo de cobertura inexistente reprova
  com 0,00% em vez de sair 0 — que é o oposto do que as ferramentas de mutation fazem.
- **`Plugin alterado tem bump de versão`** (`scripts/verificar-bump.mjs`) cobra o que a regra
  de semver acima só pedia por escrito. Diff sob `plugins/<p>/` exige bump do `plugin.json`
  daquele plugin — `tests/` fica de fora porque não é contrato publicado. Roda no job
  `validar`, diffando contra a base do PR (ou o commit anterior, em push).
- **hermes e mimyr rodam separados**: os dois têm um `test_skill_contracts.py` e uma invocação
  única de pytest quebra na coleta com "import file mismatch". mimyr exige as deps de
  `scripts/requirements.txt` e **Python ≥ 3.10** (os scripts usam `X | None` no type hint; no
  3.9 a suíte nem coleta). O CI usa 3.11; se o `python3` do seu sistema for antigo — o do macOS
  é 3.9 —, `npm test` quebra localmente por ambiente, não por regressão.
- **Os 2 greps de repo** (nome antigo `minhas-skills`; odin sem contexto de origem) são steps
  do job `validar` no CI. Rode-os por lá ou pelo workflow — a versão que vale tem exclusões
  (`node_modules`, `reports`, `AGENTS.md`, `ci.yml`) sem as quais o gate reprova na própria
  definição, porque os arquivos que proíbem o termo também o citam.
- **Mutation testing** mutila o `validar.mjs` e conta quantos mutantes a suíte mata. Coverage
  diz que o código rodou; isto diz se os testes *perceberiam* o código mudando. O piso vive em
  `stryker.conf.json` (`thresholds.break`) e reprova o job sozinho — não é métrica de vitrine.
  Ao mexer no `validar.mjs`, rode antes de abrir PR.

Tudo passando + diff review humano = seguro commitar.

## O que NÃO cabe neste repo

- Código executável (TS, Python, shell) além do indispensável.
- Personas do Antonio ou de qualquer projeto específico.
- Arquivos binários grandes.
- Documentação de outros plugins (usa `PLUGINS-TERCEIROS.md`).
- Dependências instaladas automaticamente ou build step. (Deps pip com bootstrap de venv documentado na skill são a exceção controlada — ver regra 9 acima.)

> **Exceção RATIFICADA pelo Antonio em 2026-07-28: `package.json` + `package-lock.json` na
> raiz.** Dizer a verdade sobre o que ela é: a regra da linha acima é sobre **o repo**, e o
> `npm ci` do job de mutation testing a viola — 163 pacotes transitivos instalados
> automaticamente. A regra 9 ("o plugin nunca instala nada sozinho"), essa sim, continua
> intacta e não é o ponto. A exceção foi escrita no mesmo commit que precisava dela — o que a
> seção "Quando em dúvida" manda não fazer sem perguntar —, ficou marcada como proposta, e o
> dono ratificou antes do merge do PR #1. É regra do repo agora, não proposta.
>
> **Limite da exceção, para não virar precedente aberto:** vale para ferramenta de
> **verificação** que (a) entra como `devDependency`, (b) roda só no CI ou sob `npm run`
> explícito, e (c) não é lida por nenhum plugin publicado nem por nenhum harness. Linter,
> formatter, bundler e afins **não** estão cobertos — o repo é markdown, e "é da esteira"
> não é passe livre. Se um dia um plugin precisar de `node_modules` para rodar, a regra 9
> caiu junto e aí não há exceção que sirva.
>
> A justificativa P10 da dependência (por que P1–P5 falharam) vive em `package.json`, campo
> `_ponytail_P10` — no manifesto, que é onde ela serve para quem vier depois.

## Release e espelho público

O repo público `sallzzbr/hefesto-publico` é um **snapshot sanitizado do commit taggeado** do
privado, gerado por `scripts/publicar-espelho.sh`. Regras que o script impõe (não são pedido):

1. **Release = bump + CHANGELOG + CI verde + `scripts/publicar-espelho.sh`.** O script recusa
   árvore suja, snapshota `HEAD` (nunca a working tree), e recusa republicar uma versão já
   taggeada com conteúdo diferente — a tag `vX.Y.Z` nos dois repos aponta para o que foi
   publicado. Use `--dry-run` para ver o que sairia sem tocar o público.
2. **Todo plugin mantém `CHANGELOG.md`** (desde 2026-09-02) e o gate de bump cobra a entrada
   `## <versão>`. O espelho nasce sem histórico de commits; o CHANGELOG é o que sobrevive à
   travessia e vira as notas da GitHub Release.
3. **O que fica de fora:** `docs/superpowers/`, `reports/`, o próprio publicador. **Scrubs**
   determinísticos: IDs/nomes do workspace de origem na fixture do hermes, o token de origem
   no grep do CI, as réguas reais de CAC no CHANGELOG do hermes, o CODEOWNERS (o do público não
   cita paths que não existem lá). **Guard bloqueante** por grep no stage; o nome da marca de
   origem do hermes é retenção deliberada (provenance) e o guard só o aceita no `README.md`
   raiz e no `plugins/hermes/CHANGELOG.md` — em qualquer outro arquivo, aborta.
4. O stage roda `validar.mjs`, as suítes node, o pytest do hermes e o gate de bump antes de
   qualquer push. Vermelho no stage = nada publicado.

`CLAUDE.md` na raiz só importa este arquivo (`@AGENTS.md`): o Claude Code carrega `CLAUDE.md`,
não `AGENTS.md`. Não duplique conteúdo lá.

## Quando em dúvida

Releia esse arquivo. Se não cobriu sua dúvida, prefira **não** mudar o contrato e perguntar ao humano responsável (Antonio).

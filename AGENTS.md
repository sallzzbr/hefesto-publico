# AGENTS.md — Guia de manutenção para IAs

> Este arquivo existe pra IAs que forem mexer no repo `hefesto` (humanos também podem ler, mas o público alvo é outro agente de IA). Ele resume o contrato do repo, as convenções e as armadilhas comuns. **Leia antes de editar qualquer coisa.**

## Propósito do repo

`hefesto` é um **marketplace Claude Code** que publica oito **plugins**: `hefesto` (forja de plugins: criar, validar e versionar plugins e skills), `bragir` (12 skills: escrita/voz, editorial, carreira e comunicação visual; catálogo no README do plugin), `mimyr` (cursos e didática: 5 skills + scripts Python + harness gerar-curso), `hestia` (economia doméstica: orçamento, análise de gastos, mercado e investimentos com dados no Google Drive do usuário), `hermes` (marketing de performance e criativos: 18 skills + 4 agents + harness criativo.mjs), `odin` (desafios pelo double diamond: 6 skills + 9 comandos) e `iris` (prompts e briefs de delegação adequados ao modelo de destino: 2 skills, referências datadas com fontes). O objetivo é ser instalável com dois comandos, funcionar em qualquer SO e ser compartilhável com amigos sem precisar de setup manual. `titbits` (game design, GDD vivo e produção: 11 skills; dados privados fora do pacote).

> Rumo do repo: o backlog mestre da reorganização do ecossistema (forja, bragir, mimyr, hestia, odin v2.3, hermes) está em `docs/superpowers/specs/2026-07-22-megaplano-ecossistema-plugins.md`.

## Layout canônico

### Distribuição Codex

`codex/` é uma raiz de marketplace separada: `.agents/plugins/marketplace.json` e oito pacotes `codex/plugins/<nome>/.codex-plugin/plugin.json`. As regras de layout e variáveis Claude abaixo continuam aplicáveis à distribuição `plugins/` da raiz, não aos entrypoints Codex. Skills nativas leem o `RUNTIME.md` do pacote e usam links relativos reais. Defaults Codex vivem em `<CODEX_HOME>/hefesto/<plugin>/defaults.md` quando a variável estiver definida e não vazia, com fallback para `~/.codex/hefesto/<plugin>/defaults.md` apenas quando não houver raiz explícita e configuração do workspace em `AGENTS.md`.

Recursos de domínio são copiados para `shared/` pelo inventário `codex/resources.json`; `SKILL.md` legado vira `CONTRATO.md`. Não editar cópias geradas. Materializar com `npm --prefix codex run sync` e verificar com `npm --prefix codex test`. Os pacotes são autocontidos e instaláveis sem build. As entradas Codex `odin:desafio` e `odin:defaults` adaptam comandos Claude, com contratos em `shared/commands/`, somando oito skills Odin e 66 no Codex. As demais skills mantêm paridade com as skills fonte. Fonte e cópia divergentes reprovam o checker. O CI privado e o público executam o check Codex; os arquivos de `codex/` aprovados no inventário integram o espelho. Não tratar smoke técnico como avaliação comportamental concluída.

### Distribuição Claude

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
│   ├── iris/                                 # plugin de prompts adequados ao modelo de destino
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
├── README.md
├── LICENSE
└── .gitignore
```

Regras duras:

1. **`.claude-plugin/plugin.json` do plugin fica em `plugins/<plugin>/.claude-plugin/`**, nunca na raiz do plugin e nunca na raiz do marketplace.
2. **`.claude-plugin/marketplace.json` fica só na raiz do repo**, nunca dentro do plugin.
3. **Skills vivem em `plugins/<plugin>/skills/<nome>/SKILL.md`**. O nome do diretório é o nome da skill.
4. **`source` em `marketplace.json` tem que ser path relativo string** (`"./plugins/hefesto"`), apontando para pasta local deste repo; o `validar.mjs` reprova objeto de fonte remota. `"source": "."` **não é válido**.

## Convenções de nomenclatura

- **Plugin e marketplace** compartilham o nome `hefesto`. Se for renomear, renomeie nos dois manifestos + no diretório `plugins/<nome>/` + em todas as URLs do README + no campo `source` do marketplace.json.
- **Skill directory**: kebab-case, em português quando faz sentido (`escrever-como-autor`, `gerenciar-personas`). Evite inglês-só se o público-alvo é PT-BR.
- **Persona file**: slugify determinístico — lowercase, acentos removidos via `NFD` + strip de diacríticos, espaços e pontuação viram hífen, hífens repetidos colapsam. Ex.: `Maria José` → `maria-jose`.

## Paths e portabilidade

- **NUNCA** use paths absolutos de SO (`E:\...`, `C:\...`, `/Users/...`) em SKILL.md, perfil de voz, persona ou qualquer arquivo versionado. Quebra em qualquer máquina que não seja a do autor.
- Para referenciar arquivos **dentro do plugin** a partir de uma skill, use `${CLAUDE_PLUGIN_ROOT}`. Exemplo: `${CLAUDE_PLUGIN_ROOT}/README.md`. Essa variável é resolvida pelo runtime do Claude Code em conteúdo de skill.
- Para referenciar arquivos **do projeto do usuário**, use paths relativos ao cwd: `./personas/`, `./perfil-de-voz.md`. Nunca assuma estrutura além do cwd.
- **Path de domínio é resolvido, nunca hardcoded** (regra da Fase 8): quando uma skill opera sobre estrutura de workspace consumidor (pasta do Drive no hestia, `marketing/` no hermes, `./courses/` no mimyr, `docs/desafios|plans|pendencias` no odin, agenda/métricas/voz no bragir), o path se resolve por uma **regra única**, nesta ordem: (1) campo `local_*` na seção `## Paths do workspace` do `CLAUDE.md` do repo atual; (2) campo `local_*` dos defaults do usuário (`~/.claude/<plugin>/defaults.md`); (3) convenções descobertas no cwd; (4) default documentado. Na descoberta, exatamente um candidato existente é usado; mais de um candidato concorrente exige perguntar ao usuário; nenhum candidato cai no default documentado. Recurso obrigatório ausente no path resolvido faz a skill parar, salvo scaffold explícito. Paths citados em exemplos/templates são **ilustrativos do default, não hardcode** — toda skill que assume estrutura declara essa cláusula ou delega explicitamente à referência canônica (o `validar.mjs` cobra isso por arquivo). Harness nunca lê config de path: a skill resolve e injeta via args (padrão `dirs` do hermes, igual ao `tiering`).

## Contrato de personas (CRÍTICO)

Personas são do **projeto do usuário**, nunca do plugin. Isso é decisão de design, não sugestão:

- Cada projeto (mimyr, cursos, clientes do autor, e qualquer amigo que instalar) tem personas diferentes.
- O plugin não pode carregar personas internas porque engessaria o uso.
- `escrever-como-autor` descobre personas em `./personas/*.md` (preferido) ou `./personas.md` (fallback). Se não achar e o usuário pediu audiência, ofereça invocar `gerenciar-personas`.
- `gerenciar-personas` **sempre** escreve em `./personas/` do cwd, **nunca** em `${CLAUDE_PLUGIN_ROOT}`.

Se for propor mudança nisso, pense duas vezes.

## SKILL.md — como escrever

**Frontmatter mínimo**:

```yaml
---
name: nome-da-skill
description: "<verbo> <o que>. Use when <gatilho 1>, <gatilho 2>, <gatilho 3>."
---
```

`name` é obrigatório na convenção do Hefesto: kebab-case, até 64 caracteres e igual ao diretório. O validador exige presença, formato e correspondência também nos plugins externos que ele valida; arquivos legados precisam acrescentar o campo.

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
5. **Perfis de voz são do usuário, fora do pacote.** `escrever-como-autor` exige um perfil preenchido; sem ele oferece `analisar-voz`. Nunca distribua perfil pessoal nem fallback de outra pessoa.
6. **Adicionar backwards-compat shims** quando renomear (ex.: manter `minhas-skills` como alias). Não faça. Se renomeou, renomeou em tudo.
7. **Comentar código/seções "por enquanto"**. Delete ou implemente — não deixe texto morto.
8. **Adicionar emojis** a qualquer SKILL.md ou perfil de voz sem pedido explícito. O perfil de voz do autor proíbe emojis; skills devem respeitar o tom. Exceção registrada: o plugin `odin` herda emojis **funcionais** (📍 🆘 🔴 etc.) do seu design de origem — não adicione novos, mas não os remova.
9. **Adicionar build step ou install automático**. Scripts standalone são permitidos por plugin quando a skill precisa de determinismo (precedentes: `plugins/odin/skills/dev-loop/harness/loop.mjs`, `plugins/hefesto/skills/validar-plugin/scripts/validar.mjs`). Dependências pip são permitidas **desde que** o script tenha `requirements.txt` no plugin e a skill documente o bootstrap de venv no primeiro uso, degradando com mensagem clara sem o venv (precedente: `plugins/mimyr/scripts/`). O plugin nunca instala nada sozinho e nunca tem build step.

## Adicionar uma skill nova

Prefira usar a forja: `criar-skill` scaffolda, `versionar-plugin` faz o bump, `validar-plugin` confere. O passo a passo manual equivalente:

1. Crie `plugins/<plugin>/skills/<nome>/SKILL.md` com frontmatter válido (no plugin certo: `hefesto` = forja; `bragir` = escrita/voz, carreira e comunicação; `mimyr` = cursos/didática; `hestia` = economia doméstica; `hermes` = marketing/criativos; `odin` = desafios; `iris` = prompts e delegação a modelos).
2. Atualize a tabela de skills no `README.md` (raiz) e no `README.md` do plugin (seção de inventário que o `validar` confere).
3. Bump `version` no `plugin.json` do plugin + na entrada correspondente de `marketplace.json.plugins[]` + em `marketplace.json.metadata.version` (minor bump), com entrada `## <versão>` no CHANGELOG do plugin (o gate de bump cobra).
4. Se a skill lê/escreve recursos do plugin, coloque-os em `plugins/<plugin>/<recurso>` e referencie via `${CLAUDE_PLUGIN_ROOT}`.
5. Se a skill depende de skill externa (ex.: `docx`), documente no corpo do SKILL.md.
6. **Distribuição Codex** (o check reprova sem isto): skill nativa em `codex/plugins/<plugin>/skills/<nome>/SKILL.md` apontando para `../../RUNTIME.md` e para o contrato em `shared/`; entradas em `codex/resources.json` para o `SKILL.md` (vira `CONTRATO.md`) e recursos novos; `npm --prefix codex run sync`; bump e CHANGELOG do pacote Codex; ajuste das contagens fixas de `codex/scripts/check.mjs` e `codex/scripts/smoke-install.mjs` (e `codex/tests/distribution.test.mjs`).
7. **Espelho público:** acrescente cada arquivo publicável novo (Claude e Codex) em `scripts/espelho-publico.json` depois de revisar o conteúdo. O caso "inventário do espelho classifica todo arquivo do HEAD" da suíte privada reprova arquivo não classificado.
8. Commit: `feat: nova skill <nome>`. Plugin novo segue os mesmos passos, mais as entradas nos dois `marketplace.json` e as linhas de inventário de plugins do `README.md` e deste arquivo.

## Remover ou renomear skill

1. Delete/renomeie o diretório em `plugins/<plugin>/skills/`.
2. Atualize todos os SKILL.md que referenciam o nome antigo.
3. Atualize `README.md`.
4. Major bump se a skill era invocada por outras skills (quebra de contrato).

## Verificação antes de commitar

**Tudo abaixo roda sozinho no CI (`.github/workflows/ci.yml`) e fica vermelho.** Rodar local é
para não descobrir vermelho depois do push — não é opcional nem substituível por leitura.
Vermelho **não impede merge**: isso exigiria os 5 jobs como *required status checks*, que
dependem de branch protection ou ruleset — indisponíveis em repositório privado neste plano.
É fato do ambiente, não pendência: a esteira informa, o humano lê, e é assim que fica. Está dito
assim no topo do `ci.yml` também — não escreva aqui que o CI reprova o PR enquanto isso não
for ligado, que é a mesma prosa afirmando enforcement inexistente que este trabalho combate.

```bash
npm run validar     # manifestos, versões, frontmatter, paths (+ os 2 greps de repo, no CI)
npm test            # as suítes node (todo plugin com tests/) + as pytest (hermes, mimyr, hestia)
npm --prefix codex test   # distribuição Codex: check de pacotes/sync + suítes de codex/ com piso
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
- **`npm --prefix codex test` usa `codex/scripts/testes.mjs`**, com a mesma regra: descoberta
  recursiva em `codex/tests/` e `codex/plugins/*/tests/` e piso exato de testes executados lido
  do TAP. Antes era um glob fixo de dois diretórios, e esvaziar uma suíte deixava o job verde.
- **Inventário do espelho no PR.** A suíte privada roda `espelho.mjs exportar` sobre o HEAD
  real: arquivo commitado sem classificação em `espelho-publico.json` reprova no PR, não só na
  publicação.
- **Teste do publicador é privado.** O `test:node` privado passa `--publicacao` ao runner,
  que acrescenta `scripts/tests/publicacao.test.mjs` por path literal e soma seu piso de
  execução ao das suítes públicas. Ausência, arquivo vazio ou queda de casos reprova.
  O scrub retira essa opção somente do package do stage, pois publicador e teste não são
  distribuídos. Não decidir executar ou pular a suíte pela existência do arquivo-alvo.
- **Harness tem teste COMPORTAMENTAL, não só grep de marcador.** `plugins/odin/tests/
  harness-dev-loop.test.mjs` embrulha o corpo do `loop.mjs` num `AsyncFunction` com os globals
  do Workflow (`args`, `agent`, `parallel`, `phase`, `log`) e um `agent` falso por `label`;
  cada invariante "em código" tem um caso que o vê rodando. Invariante novo no harness entra
  com caso novo ali — grep de string no `.mjs` trava declaração, não efeito. mimyr
  (`harness-gerar-curso.test.mjs`) e hermes (`harness-criativo-fluxo.test.mjs`) seguem o mesmo
  molde desde 2026-09-02; o contrato por marcador + `node --check` continua como segunda camada (exceto no harness criativo.mjs do hermes, cujo formato Workflow usa `return` no topo: `node --check` direto sai com erro; vale o embrulho AsyncFunction dos testes).
- **Não enumere plugins na descoberta**: lista de plugins apodrece e o que ficar de fora tem a
  suíte ignorada em silêncio. Duas consequências que vêm junto e não são de graça: (a) o
  diretório precisa se chamar `tests` — `tests_node/` e afins seguem invisíveis, então suíte
  node de plugin novo vai em `tests/`; (b) `Suítes node` é check compartilhado, logo teste
  lento ou instável em QUALQUER plugin bloqueia PR de todos. Preço aceito.
- **`npm run mutation` tem guarda antes e depois.** `premutation` checa que o alvo existe;
  `postmutation` (`scripts/verificar-mutantes.mjs`) lê o relatório JSON e cobra um piso de
  mutantes **contabilizáveis** (≥900 sobre baseline de 1154): somente Killed, Timeout,
  Survived e NoCoverage. Ignored, CompileError e RuntimeError ficam fora do denominador;
  Pending, status ausente/desconhecido e estrutura inválida reprovam o relatório. O guard
  exige score finito e volume, enquanto `thresholds.break` continua responsável por score
  baixo. Erro operacional não comprova mutation executada, mesmo se Stryker sair 0.
- **O job de mutation no CI roda só quando o diff toca o alvo** (cota de CI): um passo inicial
  calcula os arquivos alterados contra a base do PR (ou o evento anterior, em push) e os passos
  pesados têm `if`. Mudando `plugins/hefesto/skills/validar-plugin/scripts/validar.mjs`,
  `plugins/hefesto/tests/**` ou `stryker.conf.json`, roda inteiro; sem essa mudança o job continua
  existindo, registra "sem mudança em validar.mjs/testes/stryker.conf.json: mutation dispensada" e termina
  em sucesso; sem base comparável ou em disparo manual, roda. O piso do score segue em
  `stryker.conf.json`. Localmente, `npm run mutation` continua obrigatório ao mexer no `validar.mjs`.
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
- **Manutenção portátil:** os scripts npm de pytest, cobertura e premutation usam `scripts/manutencao.mjs`, sem shell Unix. O runner mantém as variáveis de isolamento do pytest e os códigos de erro. Usa `python3` em POSIX e `python` no Windows; `PYTHON` pode indicar o caminho de um interpretador existente (um executável, sem argumentos adicionais). Ative o venv antes de rodar ou selecione seu executável com essa variável. Não há instalação nem tentativa silenciosa de outro Python. A publicação continua com seu fluxo próprio; testes no Mac e planos de argumentos Windows não comprovam execução nativa em Windows.
- **hermes e mimyr rodam separados**: os dois têm um `test_skill_contracts.py` e uma invocação
  única de pytest quebra na coleta com "import file mismatch". mimyr exige as deps de
  `plugins/mimyr/scripts/requirements.txt` e **Python ≥ 3.10** (os scripts usam `X | None` no type hint; no
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
- Personas do autor ou de qualquer projeto específico.
- Arquivos binários grandes.
- Documentação de outros plugins.
- Dependências instaladas automaticamente ou build step. (Deps pip com bootstrap de venv documentado na skill são a exceção controlada — ver regra 9 acima.)

> **Exceção RATIFICADA pelo autor em 2026-07-28: `package.json` + `package-lock.json` na
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
3. **Inventário positivo:** `scripts/espelho-publico.json` lista cada arquivo aprovado, os caminhos internos excluídos e os arquivos que o scrub gera. `scripts/espelho.mjs exportar` lê a política e os blobs do commit, recusa arquivo não classificado, entrada ausente, symlink ou submódulo e só então cria o stage. Ao adicionar arquivo publicável, revise seu conteúdo e acrescente o path ao inventário; não gere a lista automaticamente no publicador.
   **Plugin fora da distribuição** (diretórios `plugins/<nome>/` e `codex/plugins/<nome>/` listados em `internos` no inventário): nada deste mecanismo é passo manual, o publicador deriva tudo dessa lista e da árvore do commit. Nos arquivos que listam plugins (`package.json`, os dois `marketplace.json`, `codex/resources.json`) o stage recebe a versão filtrada do commit: sai o script cujo comando cita o nome, a entrada cujo `name` ou `source` o cita e o recurso Codex do pacote; um arquivo que consta ao mesmo tempo em `internos` e em `gerados` segue essa derivação. As contagens fixas de plugins e de skills Codex são reescritas no stage. O guard deriva as proibições do nome do plugin e dos nomes das suas skills e scripts (separador e caixa livres, camelCase, hífens Unicode, nome partido em linhas e as formas codificadas), sem lista manual. Quem exclui um plugin só o lista em `internos` e, nos arquivos acima, também em `gerados`; a menção ao nome em texto distribuído reprova o guard.
4. **Scrubs** continuam determinísticos para CI e templates (fixtures e marcas de origem não dependem mais de scrub nem de retenção: o conteúdo é limpo no privado, com bump). O guard `scripts/espelho.mjs verificar` exige inventário completo e lê todos os arquivos; erro de leitura reprova. Ele examina o texto e formas derivadas (normalização Unicode, homóglifos, dígito no lugar de letra, `[at]`/`[dot]`, percent-encoding, entidades, escapes, hex e base64 quebrado ou aninhado) e roda os detectores com validação listados em `validadores` (e-mail, CPF, CNPJ, telefone), que precisam de código por exigirem dígito verificador, contexto ou isenção ancorada. Retenção vale só para linha exata de arquivo autorizado, com justificativa: autoria e licença, e dados sintéticos de teste do filtro de dados pessoais (chave `@<validador>` para os detectores). O guard verifica nomes, conteúdo final do stage e o arquivo final das notas antes de qualquer mutação remota. Política e guard são lidos do mesmo commit do snapshot, sem reler a working tree durante a execução. Retenções de arquivo não valem em nomes ou notas. O diagnóstico lista todas as regras violadas e a contagem de arquivos, sem nome de arquivo nem trecho; só `ESPELHO_DIAGNOSTICO_LOCAL=1` em terminal sem `CI` acrescenta arquivo e linha. Os termos reais (pessoas, loja, fornecedor, nicho) vivem só na política interna e na suíte privada, montados por pedaços lá; os testes públicos de cada plugin usam valores fictícios. O guard não prova ausência de todo dado pessoal possível: revisar conteúdo de arquivos aprovados e retenções ainda faz parte da publicação. O guard é rede contra descuido, não contra ofuscação deliberada, e a revisão humana do conteúdo novo (arquivos aprovados e retenções) é parte da publicação. Cobre: nomes e termos da política em texto, homóglifos, dígito no lugar de letra, codificações comuns e base64 acima do limiar; e-mail, CPF com separadores canônicos ou com a palavra CPF por perto, CNPJ, telefone em formas fortes (`(DD) 9xxxx-xxxx`, `+55`, `wa.me`, `DD 9xxxx xxxx`, fixo com hífen) e demais formas com palavra de contexto. Não cobre, de propósito (alargar a regex custaria falso positivo): CPF só com dígitos e sem a palavra CPF, mesmo com dígito verificador válido, ou com separadores exóticos; celular só com dígitos e sem palavra de contexto; telefone em formas raras; nome com substituição de letras além das tabelas; base64 em colunas mínimas ou concatenado em código; e-mail por extenso ("arroba", "at/dot" fora dos formatos tratados); e-mail partido antes do `@`, CNPJ alfanumérico e hex com separadores. Isenção de e-mail só vale para a forma de destino remoto (`git@` com host de git conhecido; usuário de serviço colado a `:caminho` ou logo após `ssh`/`scp`/`rsync`), nunca pela palavra na linha. As regras de vocabulário de nicho são lista de palavras (separador, caixa, camelCase, plural, hífen, lista e array são cobertos; a forma singular de uma palavra que a normalização de acentos confunde com outra vale só sobre o texto original, por prefixo `(?o)` da regra). A sigla de produto sob demanda só vale com palavra de contexto de comércio na mesma linha; dimensionamento ágil por tamanho e cor hexadecimal (a forma com dígito no lugar de letra não se aplica a token hexadecimal) são isentos. Ficam de fora, por produzirem falso positivo na árvore pública real ou por não haver regra viável, o singular de palavra que também é categoria de orçamento (o plural vale) e os termos ambíguos que também são palavra comum (categoria de orçamento, comando de shell, palavra de uso geral); nomes próprios do nicho fora da lista e frases que descrevem o nicho sem usar palavra da lista não são detectados. Documento publicado que descreve migração de nomenclatura usa termos descritivos: não há retenção para identificador antigo de nicho, e o mapa literal vive só no repositório de desenvolvimento. Palavra solta do comércio (loja, frete, o termo que nomeia o produto vendido) não é proibida: o que o guard barra são o plugin excluído e seus derivados, não o vocabulário comum. Ao aparecer um termo novo, acrescente à política interna com teste na suíte privada.
5. O stage roda `npm run validar`, `npm test` (todas as suítes Node e Python), `npm --prefix codex test` e o gate de bump das duas distribuições antes de qualquer push. Não instala dependências automaticamente: use o ambiente de desenvolvimento já preparado. Vermelho no stage = nada publicado.
6. Sem mudança de conteúdo, a retomada confere tags públicas/privadas e Release e conclui
   somente o que falta. Tags divergentes e falhas operacionais de consulta ou push abortam.
   O dry-run relata pendências sem alterar refs privadas ou remotas; pode criar commit no
   clone descartável para o gate de bump. Comparação de conteúdo usa checksum, não apenas
   tamanho e horário. A retomada requer o mesmo HEAD privado da versão e faz parte de uma
   publicação autorizada; um dry-run ou teste de fixture não concede essa autorização.
7. **Pré-condições da publicação (nesta ordem, antes do guard):** (a) branch `master`; (b) HEAD igual a `origin/master`, consultada com `git ls-remote` (sem `fetch`, logo sem mutar refs locais, nem no `--dry-run`); (c) CI do commit verde, via `gh`. Erro de consulta nunca vale como aprovado. Única exceção, a retomada: se a publicação parou entre o push público e a tag privada e a `origin/master` avançou, HEAD pode ser ancestral dela (master local atrasada ou HEAD solto) quando o público já tem o mesmo conteúdo e a tag da versão; esse caminho só completa tag privada e Release e nunca publica commit antigo por cima da master. Sem o objeto de `origin/master` no clone local o script aborta pedindo `git fetch origin`.

`CLAUDE.md` na raiz só importa este arquivo (`@AGENTS.md`): o Claude Code carrega `CLAUDE.md`,
não `AGENTS.md`. Não duplique conteúdo lá.

## Quando em dúvida

Releia esse arquivo. Se não cobriu sua dúvida, prefira **não** mudar o contrato e perguntar ao humano responsável (autor).

## TitBits e dados privados
TitBits distribui método, não jogos/memórias/aprendizados de consumidores. O acervo interno privado/jogos/aprendizados/ é uma exceção explícita aprovada pelo dono para dados de aprendizados em Markdown neste repositório. Não incluir assets, credenciais ou cópias integrais de memórias. Essa área é interna no espelho, fora de plugins/ e codex/. Nenhum conteúdo real dela entra no público, mesmo anonimizado. Grupo e autorização são configurados por humano; ainda ausentes na estrutura inicial. Um checkout legível não autoriza redistribuição. Revisão do pacote exportado continua obrigatória.

# Hefesto

> Forja pessoal de skills do Antonio para Claude Code. O nome vem do deus grego da metalurgia e do artesanato — este repo é onde as ferramentas são marteladas, afiadas e distribuídas.

O repo é um **marketplace** que publica seis plugins: **hefesto** (a forja de plugins), **bragir** (voz, escrita e editorial), **mimyr** (cursos e didática), **hestia** (economia doméstica), **hermes** (marketing de performance e criativos) e **odin** (desafios pelo double diamond).

> **Migração v3**: as skills de voz (`escrever-como-antonio`, `analisar-voz`, `gerenciar-personas`) saíram do plugin `hefesto` e agora vivem no plugin `bragir`. Se você as usava, rode `/plugin install bragir@hefesto`. O artefato de perfil de voz agora se chama `perfil-de-voz.md` (projetos com `voice-profile.md` legado continuam funcionando; a skill oferece renomear).

## Como instalar (você ou um amigo)

Dentro do Claude Code:

    /plugin marketplace add sallzzbr/hefesto-publico
    /plugin install hefesto@hefesto     # forja de plugins
    /plugin install bragir@hefesto      # voz e escrita
    /plugin install mimyr@hefesto       # cursos e didática
    /plugin install hestia@hefesto      # economia doméstica
    /plugin install hermes@hefesto      # marketing de performance e criativos
    /plugin install odin@hefesto        # double diamond de desafios

A primeira linha registra o marketplace; as demais instalam os plugins que você quiser (sintaxe `<plugin>@<marketplace>`). Verifique com `/plugin`.

## Plugin hefesto — forja de plugins

| Skill | O que faz |
|---|---|
| `criar-plugin` | Scaffolda um plugin novo num repo-marketplace (manifesto, README, registro no `marketplace.json`). Oferece scaffoldar o próprio marketplace se não existir. |
| `criar-skill` | Scaffolda um SKILL.md com frontmatter válido, gatilhos concretos e corpo no padrão da casa. |
| `validar-plugin` | Valida marketplace e plugins via script determinístico (`validar.mjs`): manifestos, versões em sincronia, frontmatter, portabilidade de paths. |
| `versionar-plugin` | Bump semver sincronizado nos três lugares (plugin.json, entrada e metadata do marketplace.json). |

Cada skill tem um command atalho homônimo: `/criar-plugin`, `/criar-skill`, `/validar-plugin`, `/versionar-plugin`.

## Plugin bragir — voz, escrita e editorial

| Skill | O que faz |
|---|---|
| `escrever-como-antonio` | Escreve na voz do Antonio. Resolve o perfil na ordem `local_voz` (CLAUDE.md do workspace) → `./perfil-de-voz.md` (projeto) → `./voz/perfil-de-voz.md` (workspace de conteúdo) → `./voice-profile.md` (legado, só leitura) → `${CLAUDE_PLUGIN_ROOT}/perfil-de-voz.md` (default Antonio). Perfil só-scaffold conta como ausente. Descobre personas em `./personas/`. |
| `analisar-voz` | Analisa documentos de um autor e gera `./perfil-de-voz.md` no projeto consumidor (default). Pode atualizar o perfil default do plugin se pedido explicitamente. |
| `gerenciar-personas` | Cria, lista e edita personas de audiência em `./personas/` do projeto atual. |
| `planejar-agenda` | Planeja o ciclo do calendário editorial (12 slots, 3 posts/semana) a partir de ideias e rascunhos do workspace. Sem a estrutura no cwd, PARA. |
| `analisar-metricas` | Analisa o CSV de métricas do workspace, ranqueia posts e gera relatório datado; propõe aprendizados para o perfil de voz. Só leitura no CSV. |

### Como usar

- "Escreve um post sobre X na minha voz" → aciona `escrever-como-antonio`
- "Agora pensando no meu cliente X" → a skill procura `./personas/<nome>.md` no projeto. Se não existir, oferece criar.
- "Cria uma persona nova pra esse projeto" → aciona `gerenciar-personas`
- "Analisa esses 3 docx e gera um perfil de voz" → aciona `analisar-voz` (requer a skill oficial `docx` instalada)

### Onde ficam as personas

Personas são **do projeto**, não do plugin. A skill procura nesta ordem no diretório atual:

1. `./personas/<nome>.md` (preferido — um arquivo por persona)
2. `./personas.md` (fallback — tudo num arquivo)

Se não existir, a skill se oferece pra criar via `gerenciar-personas`. Cada projeto tem suas próprias personas sem editar o plugin.

### Onde fica o perfil de voz

Mesma filosofia das personas. `escrever-como-antonio` resolve o perfil nesta ordem:

1. Campo `local_voz` na seção `## Paths do workspace` do `CLAUDE.md` do projeto, se declarado.
2. `./perfil-de-voz.md` no cwd — perfil específico do projeto, gerado por `analisar-voz`. Permite tunar a voz por contexto.
3. `./voz/perfil-de-voz.md` no cwd — convenção de workspaces de conteúdo que organizam a voz em `voz/` (ex.: o repo bragir).
4. `./voice-profile.md` no cwd — nome legado, só leitura; a skill oferece renomear.
5. `${CLAUDE_PLUGIN_ROOT}/perfil-de-voz.md` — fallback: voz default do Antonio, distribuída com o plugin.

Perfil que seja só scaffold (placeholders `<!-- -->`) conta como **ausente** e a cadeia segue para o próximo nível — um workspace recém-scaffoldado nunca escreve com perfil vazio.

`analisar-voz`, por padrão, escreve em `./perfil-de-voz.md` (projeto). Para atualizar o default global, peça explicitamente ("atualiza o perfil de voz do bragir").

## Plugin mimyr — cursos e didática

| Skill | O que faz |
|---|---|
| `gerar-curso` | Orquestra um mini-curso completo em `./courses/<curso>/`: fontes, personas, diagnósticos, módulos, capítulos, revisão e SEO. |
| `gerar-modulo` | Gera um módulo (índice + capítulos) a partir de transcrições, docx e diagnósticos. |
| `escrever-capitulo` | Escreve ou reescreve uma página de capítulo na voz do autor, com exercícios e checagem rápida. |
| `revisar-capitulo` | Revisa um capítulo antes da publicação: voz, personas, estrutura, links, acessibilidade, SEO. |
| `analise-de-aula` | Cruza docx + transcrição de uma unidade e produz diagnóstico pedagógico em `./diagnostics/`. |

As skills operam sobre um **workspace de curso** (o repo mimyr é o canônico) e consomem o plugin `bragir` para voz e personas. O plugin também traz scripts Python (transcrição Whisper, extração de docx/áudio, checagens de acentos/SVG/SEO/a11y) com bootstrap de venv documentado — nada é instalado automaticamente. Detalhes em [plugins/mimyr/README.md](plugins/mimyr/README.md).

Até a v3.1 do marketplace, essas skills eram locais do repo mimyr; foram promovidas a plugin na v3.2.

## Plugin hestia — economia doméstica

| Skill / Command | O que faz |
|---|---|
| `orcamento` (skill) | O livro: despesas E receitas em CSVs mensais (`AAAA-MM.csv`, coluna `tipo`) em `Financas/hestia/orcamento/` no Google Drive + cadastro `recorrencias.csv`. Somas do mês e do cadastro por script determinístico (`resumo_mes.py`, `recorrencias.py`), sob golden test. BRL na tela, formato cru no arquivo, confirmação antes de toda escrita, zero conselho de investimento. |
| `analisar-gastos` (skill) | O entendimento: evolução por categoria, variações fora do padrão (média + desvio), recorrências × realidade — tudo por script determinístico (`scripts/gastos.py`), sob golden test. 100% leitura; descreve, não prescreve. |
| `/hestia:lancar` | Registra despesa ou receita (evita categorias duplicadas, confirma antes de gravar). |
| `/hestia:abrir-mes` | Lança as recorrências do mês em lote, com uma confirmação e sem duplicar. |
| `/hestia:recorrencias` | Gerencia contas fixas, assinaturas e parcelamentos. |
| `/hestia:status` | Receitas, despesas, saldo do mês, quebra por categoria e comprometido restante. |
| `/hestia:analisar` | Análise histórica dos gastos — só leitura. |
| `/hestia:fechar-mes` | Fechamento do mês com saldo e taxa de poupança — só leitura. |
| `mercado` (skill) | Registra notas de supermercado (foto/PDF/ditado) em `Financas/hestia/mercado/`, com catálogo vivo de produtos (`produtos.csv`) e lançamento no orçamento agrupado por categoria — agrupamento, conferência de extração e total da nota por script determinístico (`nota.py`), sob golden test. |
| `analisar-mercado` (skill) | Preço unitário por produto/marca ao longo do tempo, quantidades fora do padrão semanal, pesquisa de preço online sob demanda. 100% leitura. |
| `/hestia:nota` | Registra uma nota de mercado e oferece o lançamento agrupado. |
| `/hestia:catalogo` | Gerencia o catálogo de produtos. |
| `/hestia:mercado` | Análise das compras de mercado — só leitura. |
| `/hestia:preco` | Pesquisa preço online e compara com o que você pagou. |
| `investimentos` (skill) | Carteira em `Financas/hestia/investimentos/`: movimentos, posições por print da corretora (com snapshots), ativos e metas. Antes/depois das posições por script determinístico (`posicoes.py`), sob golden test. Guardrail explícito: educa/calcula/simula, opina só sob pedido e só entre classes — nunca recomenda ativo. |
| `analisar-investimentos` (skill) | Visão da carteira, proventos & rendimento, evolução, acompanhamento de metas e simulações em 3 cenários com premissas explícitas. |
| `/hestia:carteira` | Registra movimentos e atualiza posições. |
| `/hestia:meta` | Metas de investimento com planejamento de aporte. |
| `/hestia:investimentos` | Análise dos investimentos — só leitura. |
| `/hestia:simular` | Projeções e objetivos com juros compostos. |

Requer um conector do Google Drive ativo. Era o plugin `economia-domestica` (skill `budget`); quem tem dados no caminho antigo (`Financas/economia-domestica/budget/`) é lido por fallback com oferta de migração. Filosofia da fase atual: entender antes de controlar — sem metas/limites impostos; sugestões virão do histórico. Detalhes em [plugins/hestia/README.md](plugins/hestia/README.md).

## Plugin hermes — marketing de performance e criativos

Destilado do cockpit da Seja Feloiz na Fase 7 do megaplano: a metodologia generalizável virou
plugin; a operação acoplada a dados/credenciais ficou no workspace.

| Skill | O que faz |
|---|---|
| `criativo-fluxo` | Fluxo de estúdio multi-agente via harness `criativo.mjs` (2 estágios): rotas visuais em rough → humano escolhe VENDO → candidatos em paralelo → seleção → composição → pre-flight → crítica adversarial fail-closed → pacote com rationale. |
| `direcao-de-arte` | Rotas e decisões estéticas ancoradas em referência, com princípios de design de estúdio. |
| `sugerir-criativos` | Portfólio de 5 conceitos (escalar vencedor · dor · resultado · prova social · não testado). |
| `validar-criativo` | Crítica adversarial avulsa (critérios A-J: inclui PT-BR correto, legibilidade em thumbnail, completude da mensagem, voz da copy) — qualquer bloqueante = fail. |
| `evoluir-vencedor` | 3 variações controladas de um vencedor sustentado — 1 variável por variação. |
| `analisar-criativos` | Hook × framework × formato × tom vs performance + ângulos não testados. |
| `unit-economics` | Margens, CAC breakeven/alvo, ROAS alvo + cenários de verba — fonte canônica das réguas. |
| `pnl-mensal` | DRE simplificada do mês + CAC/ROAS reais vs régua. |
| `fadiga-criativa` | Fadiga (→ ITERATE) × fraqueza (→ KILL) com plano por anúncio. |
| `otimizar-verba` | Efficiency Score, realocação com a matemática à mostra, pacing. |
| `auditoria-de-estrutura` | Scorecard de 9 dimensões da estrutura da conta. |
| `auditoria-cro` | Checklist CRO de 10 itens com evidência, P1/P2/P3. |
| `analise-diaria` | Ritual diário de leitura do portfólio: 3 níveis, série dia-a-dia, réguas por lookup, veredito fechado. |
| `saude-do-funil` | Funil topo/meio/fundo com benchmark citado e gargalo nomeado. |
| `sintese-semanal` | Fecha o briefing semanal: 3 ações ranqueadas com número-prova e próximo passo. |
| `diagnostico-site-funil` | SITE ou ANÚNCIO? Comportamento × custo × registry × ledger, veredito por destino + AOV. |

4 agents de papel fixo (`diretor-de-arte` fable, `produtor-de-criativo`, `validador-de-criativo`,
`mecanico-de-criativo`) com tiering por step whitelisted em código, no padrão odin/mimyr. Sem
dependência do bragir (voz da marca ≠ voz pessoal — deliberado). Detalhes em
[plugins/hermes/README.md](plugins/hermes/README.md).

## Plugin odin

**O plugin É o double diamond** — cada fase é uma skill; desafios (design challenges) documentados em `docs/desafios/` do projeto. Pro usuário, tudo é apresentado como uma jornada de 5 etapas (Descobrir · Definir · Explorar e especificar · Entregar · Acompanhar e aprender) roteada pelo `/desafio`.

Até a v1.x o vocabulário era 'missão' (`/missao`, `docs/missoes/`). O `/desafio` detecta `docs/missoes/` legado e oferece migrar.

Desde a v2.1, desafio novo passa por uma **régua de proporcionalidade**: a IA classifica o tamanho (risco, reversibilidade, urgência, pessoas afetadas, evidência disponível) e oferece o tier — `expresso` (uma conversa fecha problema, placar e hipóteses) ou `completo` (as 4 fases com gate em cada uma). O dono escolhe; o expresso não corta os invariantes (régua fixada, critério de sucesso e abandono, evidência antes de "validado").

| Skill | O que faz |
|---|---|
| `descobrir` | Diamante 1 · DISCOVER: levanta evidência antes de opinião, mapeia o problema sem dossiê ainda. |
| `definir` | Diamante 1 · DEFINE: fecha problema, placar e hipóteses a partir das descobertas. |
| `desenvolver` | Diamante 2 · DEVELOP: ranqueia alavancas (aprendizado × reversibilidade) e fecha o plano da rodada. |
| `entregar` | Diamante 2 · DELIVER: leva a entrega do plano — software ou não (dashboard, prompt, documento, processo, experimento) — até SPEC, execução validada e PR/publicação; retoma entrega interrompida sem duplicar trabalho. |
| `dev-loop` | Diamante 2 · DELIVER (execução): roda o harness operário × arquiteto até a spec ficar verde. |
| `acompanhar` | Cadência transversal: re-mede o placar e força perseverar/pivotar/encerrar. |

Documentação completa em [plugins/odin/README.md](plugins/odin/README.md).

## Desenvolvimento local

    git clone git@github.com:sallzzbr/hefesto-publico.git
    # No Claude Code, adicione pelo caminho absoluto do clone (ajuste ao seu OS):
    /plugin marketplace add /caminho/para/hefesto

### Verificação

    npm run validar     # validador de marketplace/plugins
    npm test            # as suítes node (todo plugin com tests/) + as pytest
    npm run mutation    # mutation testing do validar.mjs

O CI roda esses três em todo PR (`.github/workflows/ci.yml`) **mais dois greps de repo** que
só existem como steps do workflow — então local verde não equivale a CI verde. Pré-requisitos
(inclusive Python ≥ 3.10 para o mimyr), armadilhas e o que cada gate significa estão em
[AGENTS.md](AGENTS.md), seção "Verificação antes de commitar" — fonte única, para não divergir
daqui.

## Estrutura

    hefesto/                               # raiz = marketplace
    ├── .claude-plugin/
    │   └── marketplace.json               # manifesto do marketplace
    ├── plugins/
    │   ├── hefesto/                       # forja de plugins (4 skills + 4 commands)
    │   │   ├── .claude-plugin/plugin.json
    │   │   ├── commands/                  # /criar-plugin, /criar-skill, /validar-plugin, /versionar-plugin
    │   │   └── skills/
    │   │       ├── criar-plugin/          # + references/layout-canonico.md
    │   │       ├── criar-skill/           # + references/convencoes-skill.md
    │   │       ├── validar-plugin/        # + scripts/validar.mjs
    │   │       └── versionar-plugin/
    │   ├── bragir/                        # voz, escrita e editorial (5 skills)
    │   │   ├── .claude-plugin/plugin.json
    │   │   ├── perfil-de-voz.md           # perfil de voz canônico do Antonio (fallback)
    │   │   └── skills/
    │   │       ├── escrever-como-antonio/
    │   │       ├── analisar-voz/
    │   │       └── gerenciar-personas/
    │   ├── mimyr/                         # cursos e didática (5 skills + scripts Python)
    │   │   ├── .claude-plugin/plugin.json
    │   │   ├── skills/                    # gerar-curso, gerar-modulo, escrever-capitulo,
    │   │   │                              #   revisar-capitulo, analise-de-aula
    │   │   ├── scripts/                   # transcrição, extração, checagens (+ requirements.txt)
    │   │   └── tests/                     # contratos das skills + testes dos scripts (pytest)
    │   ├── hestia/                        # economia doméstica (orçamento, mercado e investimentos; dados no Drive do usuário)
    │   │   ├── .claude-plugin/plugin.json
    │   │   ├── commands/                  # /lancar, /status, /fechar-mes
    │   │   └── skills/orcamento/
    │   ├── hermes/                        # marketing e criativos (16 skills, 4 agents, harness criativo.mjs)
    │   │   ├── .claude-plugin/plugin.json
    │   │   ├── agents/                    # diretor-de-arte, produtor, validador, mecanico
    │   │   ├── skills/                    # criativo-fluxo (+harness), direcao-de-arte, ... (12)
    │   │   └── tests/                     # contratos do harness e das skills (pytest)
    │   └── odin/                          # double diamond de desafios (6 skills, 9 comandos)
    ├── AGENTS.md                          # boas práticas para IAs que mantêm o repo
    ├── PLUGINS-TERCEIROS.md               # catálogo de plugins que o Antonio usa
    └── README.md

## Atualizar

    /plugin marketplace update hefesto

## Desenvolvimento e espelho

O desenvolvimento acontece num repositório privado (histórico completo, specs e
planos internos em `docs/superpowers/`). Este repositório público é o **espelho
publicado** do marketplace — gerado a cada release por snapshot sanitizado, via
script de publicação do repo privado. Issues e sugestões são bem-vindas aqui; PRs
diretos não são aceitos (o espelho é regenerado a cada versão).

---

<!-- Para IAs: antes de fazer qualquer manutenção neste repo (adicionar skill,
editar SKILL.md, bump de versão, refatoração), leia AGENTS.md. Ele contém as
regras de layout, convenções de nomenclatura, como evitar paths hard-coded e
o contrato entre skills. -->

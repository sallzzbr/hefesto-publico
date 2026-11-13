# hermes

> Paths de workspace citados neste README resolvem pela regra única do plugin
> (`skills/criativo-fluxo/references/defaults.md`); os literais abaixo são ilustrativos do
> default, não hardcode.

Marketing de performance e criativos para e-commerce: o **fluxo de estúdio** de produção de
criativos (multi-agente, com aprovação visual humana e crítica adversarial) + as
metodologias analíticas (unit economics, fadiga
criativa, verba, auditoria de conta e de site).

Nasceu na Fase 7 do megaplano do ecossistema
(`docs/superpowers/specs/2026-07-25-hermes-fase7-diagnostico-e-design.md`): o diagnóstico da
geração criativa (validador que nunca reprovava, geração de amostra única, invariantes de
prosa furados) virou um harness no padrão odin/mimyr, e os 23 commands do workspace foram
classificados — a metodologia generalizável mora aqui; a operação acoplada a dados fica no
workspace.

## Configuração do workspace

O plugin não carrega dado de nenhum negócio. O workspace do consumidor declara:

- **Perfil do negócio** (`perfil-do-negocio.md`, path por `local_perfil`): moeda, segmentos permitidos, eixos de
  análise e demais campos; formato e validação em `references/perfil-do-negocio.md`, conferido pelo
  preflight `scripts/verificar_workspace.py`.
- **Manifesto de scripts** (`manifesto-scripts.json`, path por `local_manifesto`): obrigatório para o
  `criativo-fluxo`; o preflight reprova sem ele.
- **Heurísticas da régua** (pisos, janelas, intervalos): seção `## Réguas de decisão` do CLAUDE.md ou
  defaults; a origem de cada regra está em `references/regras-origem.md`.
- **Conectores** por categoria (plataforma de anúncios, ledger, analytics): `CONNECTORS.md` e os
  adaptadores em `references/adaptadores/`. As skills não nomeiam tool de fornecedor.

## Skills

### Fluxo criativo (estúdio)

| Skill | O que faz |
|---|---|
| `criativo-fluxo` | Orquestra o fluxo completo em 2 estágios via **harness** `criativo.mjs`, abrindo pelo **Portão 1 de ideia** (texto puro, bloqueante — nenhuma imagem antes do OK humano na ficha) → rotas visuais com roughs (humano escolhe VENDO) → candidatos em paralelo → seleção → composição → pre-flight → crítica adversarial fail-closed → pacote com rationale |
| `direcao-de-arte` | Rotas e decisões estéticas ancoradas em referência, com os princípios de design de estúdio (hierarquia, contraste, 1 mensagem, squint test) |
| `sugerir-criativos` | Portfólio de 5 conceitos (escalar vencedor · dor · resultado · prova social · não testado) com hipótese, arte, copy e critério de teste |
| `validar-criativo` | Crítica adversarial avulsa: pre-flight determinístico + critérios A-Q — acabamento (texto PT-BR correto, legibilidade em thumbnail, mensagem completa, voz da copy) e ideia (6 testes pós-render + headline) — qualquer bloqueante = fail |
| `evoluir-vencedor` | 3 variações controladas de um vencedor sustentado — 1 variável por variação |
| `analisar-criativos` | Disseca anúncios rodando por hook × framework × formato × tom vs performance; lista ângulos não testados |

### Analíticas

| Skill | O que faz |
|---|---|
| `unit-economics` | Margens, CAC breakeven/alvo, ROAS alvo + cenários de verba — a **fonte canônica das réguas** (as demais skills fazem lookup daqui, nunca usam número de memória) |
| `pnl-mensal` | DRE simplificada do mês + CAC/ROAS reais confrontados com a régua |
| `analisar-produto` | Algum eixo do perfil do negócio decide a venda? Teste estatístico com controle de confusão, junção de nomes, blocos Produzir/Investir/Rever, lacunas de portfólio e candidatas a re-estética (script Node, sem PII) |
| `regua-decisao` | Fonte única da árvore pausar / manter / escalar / reverter degrau, calculada por script (Node, sem dependências): pisos de gasto com papel, janela mínima de 7 dias, réguas por lookup e lucro do período com lucro por real investido |
| `fadiga-criativa` | Fadiga (audience-side → ITERATE) × fraqueza (concept-side → KILL), com as 3 condições operacionais e plano por anúncio |
| `otimizar-verba` | Efficiency Score por campanha, plano de realocação com a matemática à mostra, pacing do mês |
| `auditoria-de-estrutura` | Scorecard de 9 dimensões da ESTRUTURA da conta (não performance) |
| `auditoria-cro` | Auditoria CRO por modo (`proprio` ou `concorrente`), celular a 390 px primeiro, checklist operacional de loja (margem por pedido, descontos, frete, prazo, site próprio) e estado do achado entre rodadas, com evidência, P1/P2/P3 e CONFIGURÁVEL × TRAVADO |

### Rituais (promovidas do workspace na Fase 8)

| Skill | O que faz |
|---|---|
| `analise-diaria` | Ritual diário de leitura: portfólio ativo nos 3 níveis, série dia-a-dia, réguas por lookup, veredito fechado MANTER/OBSERVAR/RÉGUA ATINGIDA e alertas de fadiga/pacing |
| `saude-do-funil` | Fase de funil do briefing: topo/meio/fundo com benchmark citado ao lado de cada número e o gargalo nomeado |
| `sintese-semanal` | Fecha o briefing: exatamente 3 ações ranqueadas por impacto, cada uma com número-prova e próximo passo concreto |
| `diagnostico-site-funil` | "O problema é o SITE ou o ANÚNCIO?" — comportamento (GA4) × custo (Meta) × registry × ledger, veredito por destino + alavancas de AOV |

## Agents (papéis fixos do harness)

| Agent | Modelo (piso) | Papel |
|---|---|---|
| `diretor-de-arte` | opus (promovido a **fable** por default) | Briefing interrogado, prancheta, rotas |
| `produtor-de-criativo` | sonnet | Portão de rota, geração de candidatos, correção pela tabela |
| `validador-de-criativo` | opus | Seleção, crítica adversarial (critérios A-Q: acabamento + semântica), confirmação de findings |
| `mecanico-de-criativo` | haiku | Roughs, composição, pre-flight, pacote (steps whitelisted em código) |

Roughs e produção não têm retry nem fallback automático após falha: o fluxo preserva
resultados parciais e exige reconciliação antes de outra tentativa.

Tiering por step com whitelist em código, fallbacks com desliga-pelo-run e relatório de
modelos efetivos — padrão das Fases 5 (odin 2.3.x) e 6 (mimyr 1.1.0). Defaults do usuário em
`~/.claude/hermes/defaults.md` (contrato em `skills/criativo-fluxo/references/defaults.md`).

## Contrato de workspace

As skills operam sobre um workspace de marketing (a estrutura de pastas abaixo é
a convenção de referência), relativo ao cwd: `branding/` (princípios, arquétipos, tom de voz),
`contexto/identidade-visual.md`, `marketing/criativos/{briefs,base,renders}/`,
`marketing/referencias/banco-visual/`, `marketing/registry/criativos/`,
`marketing/producao/pacotes-aprovacao/`, `scripts/` (Pillow: `gerar_imagem.py`,
`compor_*.py`, `validar_criativo.py`) com `.venv`.

**O plugin não carrega dados, credenciais, IDs de conta nem scripts** — chaves de API de
imagem, MCP de ads, registry e `.venv` são do workspace. Commands operacionais acoplados
(subida de campanha, importação financeira, registro de anúncio, rituais diários) ficam no
workspace.

## Dependências

- **bragir: NENHUMA — deliberado.** O megaplano previa `hermes → bragir (copy)`, mas o
  workspace de marketing proíbe a voz pessoal do fundador na copy da marca: a voz é da marca
  (`branding/tom-de-voz-aplicado.md`), validada pelo critério `voz_da_marca` do validador —
  não pelas skills de voz pessoal do bragir.
- Tool **Workflow** (Claude Code) para o harness; sem ela, a skill `criativo-fluxo` degrada
  pro fallback sequencial documentado.

## Testes

`plugins/hermes/tests/` — contratos do harness (whitelist de steps, invariantes em código,
pisos de modelo/effort, critérios do validador) e das skills (frontmatter, portabilidade,
réguas por lookup, versões sincronizadas). Rodar: `python3 -m pytest plugins/hermes/tests/`.

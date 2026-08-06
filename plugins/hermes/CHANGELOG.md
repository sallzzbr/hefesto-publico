# Changelog — hermes

## 1.3.1 — 2026-08-06 (URLs do repositório público)

Patch de metadado: `homepage`/`repository` do plugin.json apontam para o espelho
público `sallzzbr/hefesto-publico` (rename do marketplace). Sem mudança de
comportamento nas skills.

## 1.3.0 — 2026-07-31 (a sessão de operação de 30/07 vira metodologia)

Uma sessão real de operação gerou 18 aprendizados; a auditoria de cobertura mostrou que só 1
já morava no plugin. Sobe o que é metodologia; payloads de API e números do negócio ficam no
workspace, por contrato.

- **Recorte de superfície (área de leitura 1:1)**: superfícies de feed recortam formato mais
  alto que quadrado para o quadrado central — a margem se mede da BANDA, não da borda do
  quadro. Regra de composição em `direcao-de-arte` + check nomeado e bloqueante na Camada 1
  de `validar-criativo` (cálculo delegado ao pre-flight do workspace), espelhados nos agents.
  Inclui a limitação conhecida do detector: silhueta de produto sobre fundo claro é lida como
  glifo → produto recortado respeita a mesma margem do texto.
- **Produção sobre produto** (`direcao-de-arte`): fotografia de produto (recorte de
  e-commerce é catálogo, não anúncio; sombra de contato; mockup da fonte oficial; template
  único em coleção; peça escura não sobrepõe peça escura), estampa sobre cena (geometria de
  impressão é atributo do PRODUTO medido — nunca média de loja; conteúdo ≠ canvas: bbox antes
  de escalar; textura modulada por luminância suavizada; posição medida, nunca estimada),
  quadro montado vence cena recortada, e portfólio sem argumento repetido.
- **Cláusula de inferência** (bloqueante) nos 3 pontos onde medição vira regra — promoção de
  aprendizado do `criativo-fluxo`, prancheta da `direcao-de-arte`, registro da
  `sintese-semanal`: (1) quantos casos, com que variância? (2) a amostra cobre as variantes
  relevantes? (3) qual contra-exemplo barato refutaria — foi checado? Sem as três respostas,
  a medição entra como observação, não como regra. Travada por teste de contrato.
- **Boost fora da régua** nas 5 skills analíticas (`analise-diaria`, `saude-do-funil`,
  `otimizar-verba`, `pnl-mensal`, `analisar-criativos`): tráfego que não otimiza por
  conversão sai de CPA/ROAS/CTR e de qualquer veredito, identificado por `optimization_goal`
  (nunca pelo nome da entidade); o gasto real sobrevive em linha própria, rotulada. Teste de
  contrato novo.
- **Janela de leitura**: métrica acumulada do período (ex.: frequência MTD) cresce por
  definição e nunca é proxy de diária — fadiga só em janelas iguais e adjacentes
  (`fadiga-criativa`, `analise-diaria`). E pós-ativação em lote, conferência NOMINAL do que
  voltou a ACTIVE — lote ressuscita pausado de propósito (`analise-diaria`).
- **Estrutura**: conjunto nasce com ≥2 anúncios, e o trade-off explícito "anúncio novo em
  conjunto compatível × conjunto novo" — reset de learning e verba total na mesa
  (`auditoria-de-estrutura`, `otimizar-verba`).
- **Voz**: travessão e meia-risca como sinal literal de "soa máquina" em copy PT-BR, e
  oferta nunca abreviada a ponto de ler como preço (`sugerir-criativos` teste 2, critérios
  G/J de `validar-criativo` e do agent validador).
- **Aviso de subida por objetivo** no pacote do `criativo-fluxo`: subida via API tem regra
  própria por objetivo (ex.: Catalog Sales exige formato de creative e clonagem de conjunto
  específicos) — o pacote aponta para o playbook do workspace; o plugin segue sem payloads.
- Higiene: README atualizado (critérios A-Q, Portão 1 na linha do fluxo), entradas 1.2.1 e
  1.2.2 restauradas ao CHANGELOG (o squash do PR #2 as tinha engolido), gate de bump do CI
  passa a cobrar entrada de CHANGELOG, e teste anti-vazamento ampliado (nomes de
  negócio/pessoa, escopo `.md`+`.mjs`, CHANGELOG na whitelist) com as limpezas
  correspondentes. 33 testes de contrato (+2).

## 1.2.2 — 2026-07-28 (agents de julgamento read-only por configuração)

Fase 2 do cerco do marketplace, na parte que toca o hermes: restrição declarada vira
restrição verificada.

- **`validador-de-criativo` ganha `disallowedTools`** (Write/Edit/NotebookEdit/Task/Agent —
  Task e Agent porque spawnar subagent é escrever por procuração): a regra "você não corrige
  nada e não escreve arquivos" era só prosa; agora é configuração honrada pelo runtime
  (verificado despachando agent restrito em sessão limpa) e travada por teste.
- **Testes de contrato novos** (`tests/test_contratos_de_agente.py`), com a lista por
  **exceção**: o teste varre `agents/` e cobra a restrição de todo agent que não esteja na
  lista de quem PRODUZ artefato — agent novo de julgamento não nasce sem restrição com a
  suíte verde. `mecanico-de-criativo`, `produtor-de-criativo` e `diretor-de-arte` mantêm
  escrita, com o porquê de cada um escrito no próprio teste (a leitura do contrato de cada
  agente decidiu, não a simetria dos nomes).
- No marketplace (fora do plugin, mas cobrando-o): **gate de bump** no CI
  (`scripts/verificar-bump.mjs`) — mudança em arquivo do plugin sem bump de versão reprova;
  `tests/` fica de fora por não ser contrato publicado.

## 1.2.1 — 2026-07-28 (categoria de headline no portão de copy)

Patch: corrige a aplicação cega do teste de **troca do termo definidor**, que reprovava
headline de afirmação direta — o formato que costuma sustentar conta de nicho. A 1.2.0
encodou os 4 testes de copy tratando toda headline como hook; são duas categorias com
funções distintas.

- **Passo 0 novo no contrato canônico** (`sugerir-criativos`): declarar a categoria da
  headline antes de testar. **Hook** (cria reconhecimento/dor/desejo) → o teste 1 VALE.
  **Afirmação direta** (diz o que é e para quem, nomeando o produto) → o teste 1 NÃO vale:
  sobreviver à troca é a função — a frase é um molde que serve a cada segmento com o termo
  trocado, e a especificidade vem da segmentação e do produto mostrado, não da frase.
- **A trava que impede a brecha:** afirmação direta tem de NOMEAR o produto. Frase que só
  convida pro clube ("se você tem um X, você entende") não nomeia nada — continua sendo hook
  e continua reprovada, que era o caso que originou a 1.2.0.
- Propagado nos cinco pontos que cobram os testes (versão divergente é bug, não variação
  local): o contrato em `sugerir-criativos`, o Portão 1 em `portao-de-ideia`, o critério Q de
  `validar-criativo`, o agent `validador-de-criativo` e o agent `diretor-de-arte`.
  `evoluir-vencedor` passa a declarar a categoria junto da hipótese.

> **Compatibilidade:** sem mudança de contrato de entrada nem de saída das skills — quem já
> usa a 1.2.0 não precisa mudar nada.

## 1.2.0 — 2026-07-27 (o cockpit passa a ter critério de ideia, não só de acabamento)

Causa raiz: os criativos nasciam do **template** com uma frase encaixada dentro, e os
validadores mediam só acabamento (contraste, zona segura, fidelidade tipográfica). Uma peça
cuja headline sobrevivia à troca do termo definidor passava com todos os checks verdes. O
fluxo não tinha, em ponto nenhum, um critério de **ideia**.

- **Portão 1 — ideia** (novo, bloqueante, em `criativo-fluxo`): gate de **texto puro** antes
  de qualquer chamada de API de imagem, com 8 campos (objetivo, estágio do funil, observação
  humana, headline, produto exibido, hierarquia de leitura, esboço textual da composição,
  justificativa por elemento). Contrato completo em
  `criativo-fluxo/references/portao-de-ideia.md`; artefato `<stem>__ideia.md`. O portão visual
  dos roughs continua existindo e vira **Portão 2** — são dois portões distintos, e rough não
  aprova ideia.
- **Rede de segurança no harness**: o *briefing interrogado* do diretor passa a recusar
  (`bloqueado`, antes de gerar qualquer rough, custo zero) o brief que chega sem observação
  humana, sem headline aprovada nos 4 testes ou sem hierarquia de leitura. Vale também no
  caminho avulso da `direcao-de-arte`.
- **4 testes de copy** obrigatórios em `sugerir-criativos` (contrato canônico) e cobrados em
  `evoluir-vencedor`, no Portão 1 e na validação: troca do termo definidor · fala humana ·
  "e daí?" · verdade comercial. Regra central: headline que cria **cumplicidade sem entregar
  verdade específica** é reprovada. Em `evoluir-vencedor`, a headline do vencedor deixa de ser
  herança automática — performance valida a peça, não a frase.
- **Hierarquia semântica** em `direcao-de-arte` e no agent `diretor-de-arte`: a maior
  informação da peça carrega o principal significado (proibido ampliar expressão vazia), teto
  de elementos por peça (1 headline + 1 linha complementar + produto + 1 oferta/CTA +
  assinatura), painel opaco grande proibido como estrutura automática, e 4 alternativas
  legítimas de contraste (caixa ajustada, gradiente localizado, área negativa, card pequeno).
- **6 testes pós-render** como critérios de primeira classe em `validar-criativo` e no agent
  `validador-de-criativo` (K-Q): 3 segundos, miniatura, desfoque, exclusão, coerência
  imagem-copy, verdade comercial, mais a headline. **Ausência de erro técnico não aprova
  peça**: peça tecnicamente impecável e semanticamente vazia é reprovada.

> **Compatibilidade:** brief que passava na 1.1.x pode ser recusado agora no briefing
> interrogado se não trouxer observação humana, headline aprovada nos 4 testes e hierarquia de
> leitura. É o contrato funcionando, não falha de infraestrutura — nenhuma API de imagem é
> gasta na recusa. Correção: rodar o Portão 1 e consolidar os 8 campos no brief.

## 1.1.2 — 2026-07-27 (padronização da regra de paths)

- As skills passam a citar a cadeia completa de quatro níveis (`CLAUDE.md` do workspace →
  defaults `local_*` → convenção descoberta no cwd → default documentado) e a chamar os
  paths literais de ilustrativos **do default**, não da convenção — o texto abreviado
  contradizia a referência canônica que ele mesmo aponta.
- O README do plugin declara a delegação à regra única, agora que o validador o cobre.

> **Compatibilidade da 1.1.1:** o campo `raca` virou obrigatório nas rotas do
> `ROTAS_SCHEMA`, e o portão do estágio `produzir` recusa rota aprovada sem ele. Artefato
> `__rotas.md` gerado antes da 1.1.1 não tem o campo e será bloqueado com `status: erro` na
> fase Portão — isso é o contrato funcionando, não falha de infraestrutura. Correção:
> acrescentar `raca` à rota aprovada no artefato (o valor é o segmento temático usado na
> subpasta de renders) e reinvocar.

## 1.1.1 — 2026-07-27 (correções pós-review da Fase 8)

- `analise-diaria` volta a cobrir o modo snapshot absorvido de `/meta-snapshot`: períodos
  válidos, consolidação `level=account`, top 5 `level=campaign`, gasto mínimo configurável,
  separação de dados insuficientes e relatório persistido. Erros de permissão deixam de
  trocar silenciosamente o período pedido.
- O harness fecha o contrato entre a chave histórica `raca` e o segmento temático genérico:
  o diretor a preenche por rota e o portão recusa resposta aprovada sem o valor.
- A regra única de paths passa a exigir os quatro níveis por arquivo, com descoberta
  determinística no cwd e delegação explícita a referências canônicas.

## 1.1.0 — 2026-07-27 (Fase 8: paths resolvidos + rituais promovidos do workspace)

- **Regra única de resolução de paths**: os diretórios-base (`marketing/`, `branding/`,
  `contexto/`, `financeiro/`, `scripts/`) deixam de ser hardcode — resolvem por
  CLAUDE.md do workspace (`## Paths do workspace`) → defaults do usuário (`local_*`) →
  convenção do cwd. Campos novos no contrato de defaults; toda skill carrega a cláusula
  ("exemplos são ilustrativos da convenção").
- **Harness recebe paths prontos**: arg opcional `dirs` no `criativo.mjs` (mesmo padrão do
  `tiering`) — a skill resolve, o harness nunca lê config. Prompts internos usam as bases
  injetadas; ausência = convenção canônica (retrocompatível).
- **4 skills novas (rituais promovidos do workspace hermes)**: `analise-diaria` (portfólio
  3 níveis, série dia-a-dia, réguas por lookup, veredito fechado), `saude-do-funil`
  (topo/meio/fundo com benchmark citado), `sintese-semanal` (3 ações ranqueadas com
  número-prova) e `diagnostico-site-funil` (SITE × ANÚNCIO × DESTINO + alavancas de AOV).
  Tudo genérico: zero ID de conta, zero número decorado — réguas sempre por lookup do
  unit-economics vigente.
- Suposição de domínio `<raca>` removida do agent `diretor-de-arte` (vira `<segmento>`
  definido pelo workspace).

## 1.0.1 — 2026-07-26 (endurecimento pós-revisão adversarial dupla: Opus 5 + Codex)

Findings adjudicados de dois revisores externos independentes (espelho do odin 2.3.1).
Bloqueantes corrigidos no harness `criativo.mjs`:

- **Pre-flight fail-closed de verdade**: `pf.ok` agora é lido — exit ≠ 0 sem falha nomeada
  (crash do script ≠ reprovação) aborta o run reinvocável em vez de fechar verde sem checks.
- **Portão do estágio B endurecido**: `renderJaExiste`/`reproduzir`/`roughExiste` viram
  `required` no schema (omissão não anula mais a proteção de sobrescrita) e `portao.rota` é
  guardado antes do deref (resposta parcial não mata mais o run sem relatório).
- **Recusa de brief é resposta conforme**: `ROTAS_SCHEMA` exige só `ok` — brief vago volta
  como `bloqueado` com o que falta, não como falso erro de infra; ok=true incompleto vira
  erro nomeado.
- **"Zero API em texto" em código**: finding com custo `ia` em arquétipo `texto` é coergido
  a overlay (registrado no histórico) + belt no bloco de geração — nunca mais geração com
  prompt `null`.
- **`{{BASE}}` substituído em código**: o comando de overlay carrega o placeholder (validado
  no portão; exigido do diretor e da correção) e o harness troca pelo candidato selecionado —
  o mecânico nunca mais recebe pedido em prosa pra editar comando.

Enforcement adicional: aprovação de rota é VISUAL em código (rota aprovada sem rough no
disco = bloqueado); escalado de meio de loop com iteração no histórico passa pelo pacote
(reports SEMPRE) via `escaladoComPacote`; correção no-op escala em vez de queimar teto;
`criterio` do crit virou **enum** no schema; relatório de modelos passa a registrar a
execução real por step (fallback tardio não re-rotula step que já rodou); texto livre em
comando de shell ganhou escape; teto de rodadas de IA documentado como derivado do teto de
iterações no default. SKILL.md traduz TODOS os campos dos defaults (`criativo_produtor`,
`criativo_perfil` e os overrides por step estavam órfãos) e corrige a contagem de agentes e
o afunilamento N-1 no plano de custo. +5 testes de contrato (23 no total) fixando cada fix.

No workspace hermes (commit próprio): réguas hardcoded removidas dos commands vivos
(lookup obrigatório do unit-economics), `docs/guia-de-uso.md` e `docs/arquitetura.md`
reescritos pro modelo 9 commands + plugin, e varredura das referências mortas aos 14
commands removidos (READMEs de pasta, meta-ads, estratégia, brief ativo).

## 1.0.0 — 2026-07-25 (Fase 7 do megaplano)

Plugin novo, destilado do cockpit da Seja Feloiz a partir do diagnóstico da geração criativa
(`docs/superpowers/specs/2026-07-25-hermes-fase7-diagnostico-e-design.md`).

- **Harness `criativo.mjs`** (skill `criativo-fluxo`), padrão odin 2.3.x / mimyr 1.1.0, em
  2 estágios com aprovação visual humana no meio:
  - Estágio A: briefing interrogado (portão de brief) → prancheta → 2-3 rotas visuais →
    1 rough barato por rota → humano escolhe VENDO (não lendo direção abstrata).
  - Estágio B: portão de `rota_aprovada` em código (sem API de imagem com portão aberto) →
    N candidatos em paralelo (correção da geração de amostra única) → seleção pelo validador
    contra a baseline → composição → pre-flight → crítica adversarial fail-closed →
    confirmação de finding plausível → correção pela tabela fail→ação com política de custo
    em código (overlay recompõe grátis; IA re-gera, teto de rodadas) → pacote com rationale
    e reports gravados SEMPRE.
  - Teto de 3 iterações e 3 rodadas de IA em código; tiering por step com whitelist,
    recusas registradas, fallbacks com desliga-pelo-run (fable→opus, promoção→piso,
    haiku→sonnet); relatório com modelos efetivos em todo desfecho.
- **4 agents de papel fixo**: `diretor-de-arte` (piso opus, promoção fable default —
  espelho do arquiteto do odin), `produtor-de-criativo` (sonnet), `validador-de-criativo`
  (opus), `mecanico-de-criativo` (haiku, só steps whitelisted).
- **Validador endurecido** (correção do diagnóstico "22 validações, 0 fail"): postura de
  refutar, critérios novos bloqueantes G `texto_correto` (concordância/ortografia — caso
  "CHEGAM"), H `legibilidade_thumbnail` (squint test), I `mensagem_completa` (oferta/prazo/
  CTA), J `voz_da_marca` (copy vs tom de voz — antes ninguém validava copy); D
  `fidelidade_referencia` vira bloqueante com baseline; **qualquer bloqueante = fail** (fim
  do "1 fail = borderline").
- **12 skills**: 6 do fluxo criativo (`criativo-fluxo`, `direcao-de-arte`,
  `sugerir-criativos`, `validar-criativo`, `evoluir-vencedor`, `analisar-criativos`) + 6
  analíticas (`unit-economics` com cenários de verba, `pnl-mensal`, `fadiga-criativa`,
  `otimizar-verba`, `auditoria-de-estrutura`, `auditoria-cro`). Réguas de decisão viram
  **lookup do unit-economics mais recente** (mata os hardcodes inconsistentes R$56 × R$63,57
  do workspace).
- **Testes de contrato** em `tests/` (harness, agents, skills, portabilidade, versões).
- Sem dependência do bragir (deliberado — voz da marca ≠ voz pessoal; documentado no README).

export const meta = {
  name: 'odin-dev-loop',
  description: 'Harness do dev-loop: portão TDD, operários por unidade, revisão adversarial e teto de iterações — invariantes em código, não em prosa',
  whenToUse: 'Invocado pela skill dev-loop do odin com SPEC aprovada, perfil de custo escolhido e opt-in multi-agente do usuário. Não usar sem esses três.',
  phases: [
    { title: 'Spec', detail: 'validar formato, mapa critério↔teste e gate de prontidão' },
    { title: 'TDD', detail: 'testes escritos e vermelhos pelo motivo certo, antes de qualquer implementação' },
    { title: 'Implementar', detail: 'um operário por unidade de trabalho; consultas ao arquiteto com teto' },
    { title: 'Validar', detail: 'validações do projeto (lint/typecheck/test/build)' },
    { title: 'Auditar', detail: 'auditoria ponytail do diff: dependência nova sem justificativa é bloqueante automático' },
    { title: 'Revisar', detail: 'lentes adversariais sequenciais; findings bloqueantes confirmados antes de retrabalho' },
  ],
}

log('odin-dev-loop: revisão de contratos 2026-11-02-r8')

// ── args esperados (montados pela skill dev-loop) ────────────────────────────
// {
//   workspaceRoot: string — raiz absoluta física do projeto (pwd -P)
//   scriptsDir: string — diretório absoluto skills/dev-loop/scripts deste plugin
//   specPath:  string  — path do arquivo que contém a ## SPEC (entrega ou avulsa)
//   branch:    string  — branch de trabalho JÁ criada (o harness não cria branch)
//   perfil:    'economico' | 'balanceado' | 'maximo' (acento e caixa são normalizados; outro
//                     valor é erro de args antes de qualquer agente)
//   validacoes:string[] — comandos de validação do projeto (ex.: "npm test", "npm run lint").
//                     Lista vazia NÃO pula a validação: os testes da SPEC rodam sempre.
//   hoje:      string  — data ISO passada de fora (Date.now não existe aqui)
//   tiering?:  { modelos?: {step: modelo}, efforts?: {step: effort} } — OPCIONAL. Montado pela
//                     SKILL a partir de ~/.claude/odin/defaults.md (este script NÃO lê arquivo —
//                     Workflow não tem filesystem; quem lê defaults é a sessão). Steps e valores
//                     aceitos: ver MODELOS_STEP. A regra é enforcement em código, não convenção:
//                     promoção só dentro do papel (consulta: opus→fable), rebaixamento só nos
//                     steps mecânicos whitelisted (validar; spec sob opt-in) e só pra haiku.
//                     Pedido fora disso é IGNORADO e registrado em `modelos.recusados` — nunca
//                     aplicado em silêncio. Efforts: low|medium|high|xhigh, qualquer step.
//   modeloArquiteto?: 'fable' — LEGADO (pré-2.3). Equivale a tiering.modelos.consulta='fable';
//                     tiering explícito tem precedência. Mesma semântica de fallback: se a
//                     chamada promovida não retornar, o script cai pro piso (opus), DESLIGA o
//                     override pelo resto do run e registra a queda em `fallbacks`.
//   autorizacoesTdd?: [{ criterios: [id], evidencia, autorizacao, autorizadoPor,
//                       registradaEm: 'AAAA-MM-DD', motivo? }]
//                     — exceção HUMANA ao portão (2.5.0): só cobre ausência de vermelho (reprodução
//                     que nasce verde ou suíte sem reprodução) nos critérios do escopo. Nunca cobre
//                     evidência inválida nem controle vermelho. Ausente = nenhuma exceção: o script
//                     não presume autorização de lugar nenhum. Vale só para este run.
//                     `autorizacao` é a citação LITERAL do dono; o script confere presença, não
//                     autenticidade. Exige perfil maximo (2.6.0): a continuidade sem vermelho é
//                     compensada pelas três lentes. Chave fora dessa lista é erro de args.
//   rebaselineTdd?:   { criteriosAprovados: [id], motivo, autorizadoPor, registradaEm,
//                       validacaoAnterior?: { impressao, comandos: [..], verde, reaproveitada?, excluidos?,
//                                             excluidosNaoRastreados? } }
//                     Retomada tardia: reprodução já verde num critério aprovado é implementação
//                     anterior declarada, não bloqueio. `validacaoAnterior` (o `validacaoFinal` de
//                     um relatório verde, inteiro) permite não repetir as validações longas sem
//                     mudança. Chave fora dessas listas é erro de args.
//   baseRef?: string. Commit ANTERIOR à implementação desta entrega: o SHA completo (40 ou 64
//                     hex) de `git merge-base <branchBase> HEAD`, gravado no Log. Qualquer outra
//                     forma (nome de ref, tag, SHA abreviado) é erro de Args antes de qualquer
//                     agente (decisão 24 do dono, 2026-11-03); de uma ref, o SHA sai de
//                     `git rev-parse --verify '<ref>^{commit}'`. Maiúsculas valem como minúsculas:
//                     o script normaliza, e comandos e relatório levam a forma minúscula. O NOME
//                     da branchBase não serve: ela anda depois do fork e traria trabalho alheio
//                     para o diff e para a cópia da base. Com ela, auditoria e lentes leem a
//                     worktree contra a base (inclusive commits da entrega) e o portão mede
//                     alterações desde a base. O script não roda git: repassa o SHA aos helpers,
//                     que o revalidam.
//   vermelhoNaBase?: true. Mede o vermelho numa cópia descartável de baseRef com os testes atuais
//                     sobrepostos (scripts/copia-base.mjs). Para retomada tardia: a implementação
//                     já existe na worktree e NUNCA é revertida. Exige baseRef.
//   pendenciasPath?: string. Arquivo de pendências RESOLVIDO pela skill (relativo ao workspace ou
//                     sob workspaceRoot), que nunca é commitado. É registro, não código: fica fora
//                     da detecção de implementação anterior ao portão quando a base não o tem, e
//                     fora da impressão da worktree só como não rastreado
//                     (`validacaoFinal.excluidosNaoRastreados`); o arquivo da SPEC sai do diff
//                     (`validacaoFinal.excluidos`). Pendências rastreadas fazem o script recusar a
//                     impressão (sem reuso). Passe o MESMO valor em todo run da entrega: as listas
//                     entram no hash da impressão, e outra lista nunca confere. Arquivo de unidade
//                     não serve.
// }

const PERFIS = {
  economico:  { paralelo: false, lentes: ['corretude'] },
  balanceado: { paralelo: true,  lentes: ['corretude', 'seguranca-bordas'] },
  maximo:     { paralelo: true,  lentes: ['corretude', 'seguranca-bordas', 'ponytail-arquitetura'] },
}

const MAX_ITERACOES = 3
const MAX_CONSULTAS_POR_UNIDADE_ITERACAO = 2
// Teto de concorrência dos operários (perfis balanceado/máximo). `parallel()` sem lote
// despachava TODAS as unidades de uma vez — SPEC de 8 unidades = 8 operários simultâneos, sem
// nada no plano de custo dizendo isso. Achado da auditoria de 2026-09-01; testado em
// tests/harness-dev-loop.test.mjs.
const PARALELO_MAX = 4

// ── tiering de modelo/effort por step (v2.3) ─────────────────────────────────
// A unidade de configuração é o STEP, não o agente: cada chamada do harness pertence a um step
// nomeado, com papel fixo, modelo default e lista FECHADA de modelos permitidos. É esta tabela
// que torna verdade a regra "promove só dentro do papel, rebaixa só step mecânico whitelisted":
// `permitidos` é a whitelist — pedido fora dela é recusado com registro, nunca aplicado.
// Haiku só aparece em `validar` (default) e `spec` (opt-in via defaults: o step tem julgamento
// — ok=false, SPEC-lite, disjunção de unidades — e erro nele envenena o run inteiro, então o
// default fica no piso do papel). TDD/implementação nunca rebaixam; revisão/auditoria são Opus
// sempre — julgamento adversarial não justifica o teto (fable) nem aceita o porão (haiku).
// effort: null = herda da sessão (não passa o campo). effortPiso: o effort também tem whitelist
// nos steps de julgamento — a revisão adversarial (2026-07-23, Opus F1) mostrou que travar só o
// MODELO deixa o effort como alavanca destravada: `auditoria=low` passava e enfraquecia o gate
// mantendo aparência nominal no relatório. Piso `high` em consulta/auditoria/lente/confirmacao;
// pedido abaixo do piso é recusado com registro, igual modelo fora da whitelist.
const MODELOS_STEP = {
  spec:        { papel: 'operario',  padrao: 'sonnet', permitidos: ['sonnet', 'haiku'], effort: null },
  tdd:         { papel: 'operario',  padrao: 'sonnet', permitidos: ['sonnet'],          effort: null },
  impl:        { papel: 'operario',  padrao: 'sonnet', permitidos: ['sonnet'],          effort: null },
  consulta:    { papel: 'arquiteto', padrao: 'fable',  permitidos: ['opus', 'fable'],   effort: 'xhigh', effortPiso: 'high' },
  validar:     { papel: 'mecanico',  padrao: 'haiku',  permitidos: ['haiku', 'sonnet'], effort: 'low' },
  auditoria:   { papel: 'revisor',   padrao: 'opus',   permitidos: ['opus'],            effort: 'high', effortPiso: 'high' },
  lente:       { papel: 'revisor',   padrao: 'opus',   permitidos: ['opus'],            effort: 'high', effortPiso: 'high' },
  confirmacao: { papel: 'revisor',   padrao: 'opus',   permitidos: ['opus'],            effort: 'high', effortPiso: 'high' },
}
const EFFORTS_VALIDOS = ['low', 'medium', 'high', 'xhigh']
const EFFORT_RANK = { low: 0, medium: 1, high: 2, xhigh: 3 }

const LENTE_PROMPT = {
  'corretude': 'Lente R1 — corretude vs SPEC: cada critério de aceite é atendido de verdade? Há overfit ao teste (código que passa no teste sem atender o critério)?',
  'seguranca-bordas': 'Lente R2 — segurança & bordas: entradas hostis, estados-limite, erros engolidos, dados sensíveis expostos.',
  'ponytail-arquitetura': 'Lente R3 — ponytail & arquitetura: código que não precisava existir, duplicação do codebase, abstração prematura, contrato entre unidades quebrado. Código demais tem peso de bug.',
}

// Revisores leem mudanças desde a base da entrega (baseRef) ou, sem ela, desde HEAD, e o índice
// sem alterá-lo. Contra HEAD, implementação já commitada na branch (checkpoint do Solo, run
// anterior) não aparece: por isso a base vai no comando quando existe. Novos arquivos são
// incluídos somente quando relatados no trabalho/testes; demais nomes ficam explícitos
// para conferir contra a SPEC. Isso não substitui autorização nem revela efeitos omitidos.
const COMO_VER_O_DIFF = arquivos => `Inspecione o trabalho sem alterar arquivos ou índice, da raiz física do workspace:
\`\`\`sh
node ${shellQuote(ARGS.scriptsDir + '/inspecionar-git.mjs')} diff ${shellQuote(JSON.stringify(arquivos))}${ARGS.baseRef ? ` ${shellQuote(ARGS.baseRef)}` : ''}
\`\`\`
Leia rastreados (working tree contra ${ARGS.baseRef ? `a base ${ARGS.baseRef}, inclusive commits da entrega` : 'HEAD'}), staged (índice contra HEAD) e o conteúdo dos novos incluídos. Resolva declaradosNaoInspecionados (paths relatados mas ignorados/ausentes) e confira novosNaoIncluidos contra a SPEC: nome listado não é conteúdo revisado; se houver arquivo novo autorizado faltando, repita a inspeção com sua lista explícita, sem incluir notas locais/segredos. Binário exige inspeção própria. Erro do helper não é diff vazio. Revisão nunca executa staging, commit ou limpeza do índice.`

// ── schemas ──────────────────────────────────────────────────────────────────
const SPEC_SCHEMA = { type: 'object', additionalProperties: false, required: ['ok', 'criterios', 'unidades', 'pendenciasBloqueadoras'], properties: {
  ok: { type: 'boolean' }, motivo: { type: 'string' }, specLite: { type: 'boolean' },
  criterios: { type: 'array', items: { type: 'object', required: ['id', 'texto'], properties: { id: { type: 'string' }, texto: { type: 'string' }, verificacaoComplementar: { type: 'string' } } } },
  unidades: { type: 'array', items: { type: 'object', required: ['id', 'titulo', 'arquivos', 'criterios'], properties: { id: { type: 'string' }, titulo: { type: 'string' }, arquivos: { type: 'string' }, contrato: { type: 'string' }, criterios: { type: 'array', items: { type: 'string' } } } } },
  validacoesDaSpec: { type: 'array', items: { type: 'string' } },
  pendenciasBloqueadoras: { type: 'array', items: { type: 'string' } },
} }

// Portão 2.5.0: cada teste diz se é REPRODUÇÃO (falha antes, passa depois) ou PRESERVAÇÃO
// (controle: verde antes e depois) e traz comando próprio, porque a execução independente roda um
// teste por vez. Até a 2.4.12 o portão exigia que TODO teste novo falhasse e um exit único da
// suíte não distinguia 4 regressões vermelhas de 6 controles verdes: o caso real travou ali.
// Verificação que não é teste (lint, revisão, preview) tem lista própria e nunca conta como teste.
const TDD_SCHEMA = { type: 'object', additionalProperties: false, required: ['vermelhoConfirmado', 'testes'], properties: {
  vermelhoConfirmado: { type: 'boolean' },
  testes: { type: 'array', items: { type: 'object', required: ['criterio', 'path', 'tipo', 'comando', 'motivoFalha'], properties: {
    criterio: { type: 'string' }, path: { type: 'string' }, tipo: { enum: ['reproducao', 'preservacao'] },
    comando: { type: 'string', minLength: 1 }, motivoFalha: { type: 'string' },
  } } },
  complementares: { type: 'array', items: { type: 'object', required: ['criterio', 'verificacao', 'motivo'], properties: {
    criterio: { type: 'string' }, verificacao: { type: 'string' }, motivo: { type: 'string' },
  } } },
  implementacaoAnterior: { type: 'object', required: ['detectada'], properties: {
    detectada: { type: 'boolean' }, evidencias: { type: 'array', items: { type: 'string' } },
  } },
  problemas: { type: 'array', items: { type: 'string' } },
  // Helpers e fixtures que o portão criou ou editou para os testes (2.6.0): não contam como
  // implementação anterior e entram na cópia da base. Não são protegidos por hash.
  apoio: { type: 'array', items: { type: 'string' } },
} }

const IMPL_SCHEMA = { type: 'object', additionalProperties: false, required: ['status', 'resumo'], properties: {
  status: { enum: ['concluida', 'bloqueada'] },
  resumo: { type: 'string' },
  // Relato de escada (P1-P7): um item por função/arquivo/dependência criado. NÃO é required: um
  // schema que rejeita `bloqueada` sem escada mata a consulta ao arquiteto (o agente devolve null
  // e a unidade escala) por causa de um campo que só interessa à auditoria. O enforcement existe,
  // mas é na fase Auditar: unidade `concluida` com arquivosTocados e escada vazia vira bloqueante.
  escada: { type: 'array', items: { type: 'object', required: ['item', 'degrau', 'porque'], properties: {
    item: { type: 'string' }, degrau: { type: 'number', minimum: 1, maximum: 7 }, porque: { type: 'string' },
  } } },
  // `semCriacao: true` (2.6.0) é a declaração explícita de "só modifiquei o que existia" (linha,
  // texto, comando, configuração). Sem ela, a unidade que corrige um README seguindo o prompt
  // ("escada: []") era bloqueada nas três iterações pela resposta que o prompt mandou dar. É
  // autodeclaração: a auditoria confronta o diff com a escada (`criacoesSemRelato`).
  semCriacao: { type: 'boolean' },
  arquivosTocados: { type: 'array', items: { type: 'string' } },
  consulta: { type: 'object', properties: { contexto: { type: 'string' }, decisaoNecessaria: { type: 'string' }, opcoes: { type: 'array', items: { type: 'string' } } } },
  pendencias: { type: 'array', items: { type: 'string' } },
} }

const CONSULTA_SCHEMA = { type: 'object', additionalProperties: false, required: ['decisao', 'porque'], properties: {
  decisao: { type: 'string' }, porque: { type: 'string' }, restricoes: { type: 'array', items: { type: 'string' } },
  furoNaSpec: { type: 'boolean' },
} }

// `hashesDosTestes` é required: é a prova, em código, de que os testes da SPEC saíram da
// implementação como entraram no TDD (comparados com os hashes do `tdd:vermelho`). Sem o
// campo, "o operário não edita teste" volta a ser só uma frase no prompt.
// Desde a 2.5.0 a validação também reporta UMA execução por teste da SPEC: reprodução vermelha
// ou controle vermelho depois da implementação vira bloqueante em código, e `verde` declarado sem
// essas execuções não fecha. `impressaoWorktree` (opcional) registra a árvore validada.
// `casos` = casos que o comando executou: filtro de nome que não casa nada sai 0 sem rodar teste
// algum, e isso não é verde (achado da revisão adversarial da 2.5.0).
// `moduloAusente` só existe na medição sobre a cópia da base (vermelhoNaBase): o path do módulo
// cuja ausência causou o erro de import. Ele só vale como vermelho se a entrega CRIA esse arquivo
// (adicionado contra a base, medido por inspecionar-git); o controlador confere, o mecânico relata.
const execucoesSchema = (ids, naBase = false) => ({ type: 'array', items: { type: 'object', additionalProperties: false, required: ['teste', 'exitZero', 'tipoFalha', 'casos', 'resumo'], properties: {
  teste: ids.length ? { enum: ids } : { type: 'string' }, exitZero: { type: 'boolean' },
  tipoFalha: { enum: ['assercao', 'infra', 'nenhuma'] }, casos: { type: 'integer', minimum: 0 }, resumo: { type: 'string' },
  ...(naBase ? { moduloAusente: { type: 'string' } } : {}),
} } })
// Alterações antes da implementação (inspecionar-git.mjs alteracoes): o que mudou desde a base (ou
// HEAD) e o que a base não tem. `erro` = o helper falhou; a detecção fica indeterminada, nunca vazia.
// `comparadoCom` não é obrigatório: na falha o prompt manda listas vazias e o erro, sem ele.
const ALTERACOES_SCHEMA = { type: 'object', required: ['alterados', 'adicionados'], properties: {
  comparadoCom: { type: 'string' }, sha: { type: 'string' },
  alterados: { type: 'array', items: { type: 'string' } }, adicionados: { type: 'array', items: { type: 'string' } },
  erro: { type: 'string' },
} }
// Cópia descartável da base (scripts/copia-base.mjs): hashes dos testes calculados quando a cópia
// nasce, antes de rodar. Provam que ela partiu dos bytes congelados na worktree; uma edição do
// teste dentro da cópia, depois disso, não é detectada.
const COPIA_BASE_SCHEMA = { type: 'object', required: ['sha', 'hashesDosTestes', 'removida'], properties: {
  sha: { type: 'string' }, hashesDosTestes: { type: 'object', additionalProperties: { type: 'string' } },
  removida: { type: 'boolean' }, vinculados: { type: 'array', items: { type: 'string' } },
} }
const IMPRESSAO_SCHEMA = { type: 'object', additionalProperties: false, required: ['impressao'], properties: { impressao: { type: 'string' } } }

// Recoleta dos hashes quando a evidência transportada não confere (ver `hashesConferidos`).
const HASHES_SCHEMA = { type: 'object', additionalProperties: false, required: ['hashesDosTestes'], properties: {
  hashesDosTestes: { type: 'object', additionalProperties: { type: 'string' } },
} }

const REVIEW_SCHEMA = { type: 'object', additionalProperties: false, required: ['findings'], properties: {
  findings: { type: 'array', items: { type: 'object', required: ['arquivo', 'resumo', 'cenario', 'severidade', 'confianca'], properties: {
    arquivo: { type: 'string' }, linha: { type: 'number' }, resumo: { type: 'string' }, cenario: { type: 'string' },
    severidade: { enum: ['bloqueante', 'nao-bloqueante'] }, confianca: { enum: ['confirmado', 'plausivel'] },
  } } },
} }
// Os únicos campos do finding de lente que vêm da lente (2.6.0, decisão 13): ver a revisão.
const CAMPOS_DA_LENTE = Object.keys(REVIEW_SCHEMA.properties.findings.items.properties)

const VEREDITO_SCHEMA = { type: 'object', additionalProperties: false, required: ['real'], properties: { real: { type: 'boolean' }, porque: { type: 'string' } } }
// Sinal da auditoria ponytail: a severidade dele nunca foi julgada por ninguém (nasce de uma
// constante na montagem do finding), então o confirmador responde as DUAS perguntas em campos
// separados. Com um booleano só, "o fato existe, mas não bloqueia" virava `real=true` e
// retrabalho: nas duas rodadas de 2026-10-03/04 os 27 sinais confirmados diziam "não
// bloqueante" no `porque`. Finding de lente fica no schema acima — a severidade dele já foi
// classificada pela lente, e o confirmador não ganha poder de rebaixá-la.
const VEREDITO_AUDITORIA_SCHEMA = { type: 'object', additionalProperties: false, required: ['real', 'bloqueante'], properties: { real: { type: 'boolean' }, bloqueante: { type: 'boolean' }, porque: { type: 'string' } } }

// Auditoria ponytail: sinais MECÂNICOS no diff (não é julgamento de arquitetura — isso é a lente R3).
// `onde`/`arquivo` são PEDIDOS no prompt mas NÃO required: um schema estrito aqui faz o retorno
// inteiro ser rejeitado por um campo faltante, e retorno rejeitado = auditoria vazia = regra P10
// desarmada em silêncio. Localização feia é melhor que portão desligado; o `!aud` é que é erro.
const AUDITORIA_SCHEMA = { type: 'object', additionalProperties: false, required: ['dependenciasNovas', 'duplicacoes', 'abstracoesUsoUnico', 'forasDeEscopo', 'linhasAdicionadasAcumuladas'], properties: {
  dependenciasNovas: { type: 'array', items: { type: 'object', required: ['nome', 'justificativaEncontrada'], properties: {
    nome: { type: 'string', minLength: 1 }, justificativaEncontrada: { type: 'boolean' }, onde: { type: 'string' },
  } } },
  duplicacoes: { type: 'array', items: { type: 'object', required: ['oQue', 'ondeJaExiste'], properties: { oQue: { type: 'string' }, ondeJaExiste: { type: 'string' }, arquivo: { type: 'string' }, linha: { type: 'number' } } } },
  // `buscaChamadores` (2.6.0): comando e contagem da busca que sustenta o "uso único". Opcional:
  // required derrubaria a auditoria inteira por um campo; o confirmador refaz a busca de todo jeito.
  abstracoesUsoUnico: { type: 'array', items: { type: 'object', required: ['oQue', 'unicoChamador'], properties: { oQue: { type: 'string' }, unicoChamador: { type: 'string' }, buscaChamadores: { type: 'string' }, arquivo: { type: 'string' }, linha: { type: 'number' } } } },
  forasDeEscopo: { type: 'array', items: { type: 'object', required: ['oQue', 'arquivo'], properties: { oQue: { type: 'string' }, arquivo: { type: 'string' } } } },
  // Confronto do diff com a escada DECLARADA (2.6.0): `semCriacao` é autodeclaração, e a checagem
  // do relato só mede presença. Opcional pelo mesmo motivo de `onde`; vira sinal julgado.
  criacoesSemRelato: { type: 'array', items: { type: 'object', required: ['oQue', 'arquivo'], properties: { oQue: { type: 'string' }, arquivo: { type: 'string' }, linha: { type: 'number' }, unidade: { type: 'string' } } } },
  // Acumulado contra a base (baseRef) ou, sem ela, contra HEAD; nunca recortado por iteração.
  linhasAdicionadasAcumuladas: { type: 'number' },
} }

// O Workflow não importa módulos: estes schemas descrevem transporte; parsing e medidas
// pertencem aos helpers canônicos. As guardas abaixo recusam evidência incompleta.
const qualityText = { type: 'string', minLength: 1 }
const qualityPaths = { type: 'array', minItems: 1, items: qualityText }
const QUALITY_SCHEMA = { type: 'object', additionalProperties: false, required: ['version', 'profiles', 'conventions', 'checks', 'decomposition'], properties: {
  version: { enum: [1] }, profiles: qualityPaths,
  conventions: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false, required: ['source', 'decision'], properties: { source: qualityText, decision: qualityText } } },
  checks: { type: 'array', minItems: 7, items: { type: 'object', additionalProperties: false, required: ['id', 'applicability', 'reason', 'paths', 'verification', 'command'], properties: {
    id: qualityText, applicability: { enum: ['required', 'not-applicable'] }, reason: qualityText, paths: qualityPaths, verification: { enum: ['review', 'command'] }, command: { type: 'string' },
  } } },
  decomposition: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['path', 'trigger', 'decision', 'verification'], properties: { path: qualityText, trigger: qualityText, decision: qualityText, verification: qualityText } } },
} }
const QUALITY_EXECUTIONS_SCHEMA = { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'command', 'paths', 'exitCode', 'output'], properties: { id: qualityText, command: qualityText, paths: qualityPaths, exitCode: { type: 'integer' }, output: qualityText } } }
const QUALITY_INVENTORY_SCHEMA = { type: 'object', additionalProperties: false, required: ['files', 'uninspected', 'errors'], properties: {
  files: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['path', 'lines', 'bytes', 'status'], properties: { path: qualityText, lines: { type: 'integer', minimum: 0 }, bytes: { type: 'integer', minimum: 0 }, status: { enum: ['text', 'binary', 'deleted', 'symlink'] } } } },
  uninspected: { type: 'array', items: qualityText }, errors: { type: 'array', items: qualityText },
} }
const QUALITY_REVIEW_SCHEMA = { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'status', 'evidence', 'finding'], properties: {
  id: qualityText, status: { enum: ['satisfied', 'issue', 'not-applicable'] },
  evidence: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false, required: ['path', 'line', 'observation'], properties: { path: qualityText, line: { type: 'integer', minimum: 1 }, observation: qualityText } } },
  finding: { type: 'object', additionalProperties: false, properties: { summary: qualityText, scenario: qualityText } },
} } }
AUDITORIA_SCHEMA.required.push('qualityReview')
AUDITORIA_SCHEMA.properties.qualityReview = QUALITY_REVIEW_SCHEMA

// ── helpers ──────────────────────────────────────────────────────────────────
const OPERARIO = { agentType: 'odin:operario' }
const ARQUITETO = { agentType: 'odin:arquiteto' }
const REVISOR = { agentType: 'odin:revisor' }
const MECANICO = { agentType: 'odin:mecanico' }   // haiku no frontmatter — só steps whitelisted chegam aqui

async function emSequencia(itens, fn) {
  const out = []
  for (const item of itens) out.push(await fn(item))
  return out
}

// Paralelo com teto (PARALELO_MAX por lote). `parallel()` devolve null pro thunk que lançou;
// `seNulo(item)` transforma isso em erro NOMEADO — sumir com a unidade fechava verde com uma
// unidade nunca implementada.
async function emLotes(itens, fn, seNulo) {
  const out = []
  for (let i = 0; i < itens.length; i += PARALELO_MAX) {
    const lote = itens.slice(i, i + PARALELO_MAX)
    const r = await parallel(lote.map(x => () => fn(x)))
    out.push(...r.map((v, j) => v || seNulo(lote[j])))
  }
  return out
}

// Modelo EFETIVO por step, registrado no momento de cada execução — não inferido de flags
// globais no fim do run: um fallback tardio não pode re-rotular steps que já rodaram no tier
// certo (finding #5 do Codex na revisão hermes 1.0.1, portado pra cá em 2026-09-02). Última
// execução vence (steps repetem por iteração); step que nunca rodou reporta o configurado.
const execucoesPorStep = {}
const registrarExec = (step, modelo) => { execucoesPorStep[step] = modelo }

// Fable é tier restrito: cravar no frontmatter quebraria o spawn de quem não tem acesso.
// Piso garantido = Opus (frontmatter do agente); Fable entra por override de runtime (desde a
// 2.3 dirigido pelos defaults — MODELOS_STEP.consulta.padrao — em vez de arg manual por sessão),
// e o fallback mecânico cobre quem não tem o tier. TODA chamada ao arquiteto passa por aqui —
// não invoque ARQUITETO direto.
const fallbacksModelo = []
let overrideArquitetoMorto = false   // memoiza: não paga spawn morto a cada chamada

// "Nunca 2 arquitetos em paralelo" é invariante do protocolo — mas com operários em paralelo
// (perfil balanceado/máximo) duas unidades bloqueadas chamavam o arquiteto ao mesmo tempo.
// Fila em código: cada chamada espera a anterior terminar. É o que torna a promessa verdadeira.
let filaArquiteto = Promise.resolve()
async function chamarArquiteto(prompt, opts) {
  const anterior = filaArquiteto
  let liberar
  filaArquiteto = new Promise(resolve => { liberar = resolve })
  await anterior.catch(() => {})
  try {
    return await consultarArquiteto(prompt, opts)
  } finally {
    liberar()
  }
}

// agent() devolve null tanto por indisponibilidade quanto por schema inválido/timeout — e pode
// LANÇAR. Exceção aqui vira null: todo call site já trata null como desfecho estruturado
// (erro/bloqueio/fallback), e um throw sem rede mataria o workflow sem status, sem fallbacks e
// sem modelos (revisão adversarial 2026-07-23, Codex #2). Morrer sem relatório não é opção.
const tentar = async (prompt, opts) => { try { return await agent(prompt, opts) } catch (e) { return null } }

async function consultarArquiteto(prompt, opts) {
  const t = TIERING.consulta
  const base = { ...ARQUITETO, ...(t.effort ? { effort: t.effort } : {}), ...opts }
  if (t.modelo !== 'fable' || overrideArquitetoMorto) {
    registrarExec('consulta', t.modelo === 'fable' ? 'opus (promoção desligada no run)' : t.modelo)
    return await tentar(prompt, base)
  }

  // O registro do fallback NÃO afirma que a culpa foi do Fable — as causas são indistinguíveis.
  const r = await tentar(prompt, { ...base, model: 'fable' })
  if (r) { registrarExec('consulta', 'fable'); return r }
  overrideArquitetoMorto = true
  fallbacksModelo.push({ step: 'consulta', chamada: base.label, de: 'fable', para: 'opus (frontmatter)', causa: 'a chamada com override não retornou (tier indisponível, schema inválido ou timeout — indistinguíveis aqui); override desligado para o resto do run' })
  registrarExec('consulta', 'opus (fallback da promoção)')
  return await tentar(prompt, base)
}

// Espelho do fallback do arquiteto, na outra ponta do tiering: step rebaixado pra haiku roda no
// agente mecanico; se a chamada não retornar, repete UMA vez no piso do papel (operario/sonnet),
// desliga o haiku pelo resto do run e registra em `fallbacks` — o tier barato nunca vira motivo
// de aborto. Um null JÁ NO PISO segue o tratamento normal do step (erro/bloqueio de quem chamou).
// Steps sonnet passam direto por aqui só pra ganhar o effort configurado.
let haikuMorto = false
async function chamarOperario(step, prompt, opts) {
  const t = TIERING[step]
  const base = { ...OPERARIO, ...(t.effort ? { effort: t.effort } : {}), ...opts }
  if (t.modelo !== 'haiku' || haikuMorto) {
    registrarExec(step, t.modelo === 'haiku' ? 'sonnet (haiku desligado no run)' : t.modelo)
    return await tentar(prompt, base)
  }
  const r = await tentar(prompt, { ...base, ...MECANICO })
  if (r) { registrarExec(step, 'haiku'); return r }
  haikuMorto = true
  fallbacksModelo.push({ step, chamada: base.label, de: 'haiku (mecanico)', para: 'sonnet (operario)', causa: 'a chamada rebaixada não retornou (agente indisponível, schema inválido ou timeout — indistinguíveis aqui); haiku desligado para o resto do run' })
  registrarExec(step, 'sonnet (fallback do haiku)')
  return await tentar(prompt, base)
}

// Revisor é opus SEMPRE (MODELOS_STEP não permite outro modelo) — só o effort é configurável.
const chamarRevisor = (step, prompt, extra) => { registrarExec(step, 'opus'); return tentar(prompt, { ...REVISOR, ...(TIERING[step].effort ? { effort: TIERING[step].effort } : {}), ...extra }) }

// ── Fase 0: args válidos (falha barata antes de gastar agente) ───────────────
// A tool Workflow pode entregar args como string JSON — normalizar antes de validar.
let ARGS = args
if (typeof ARGS === 'string') {
  try { ARGS = JSON.parse(ARGS) } catch {
    return { status: 'erro', fase: 'Args', detalhe: 'args chegou como string e não é JSON válido', acao: 'reinvocar o Workflow com args objeto: {specPath, branch, perfil, validacoes, hoje, workspaceRoot, scriptsDir}' }
  }
}
if (!ARGS || typeof ARGS !== 'object' || Array.isArray(ARGS)) {
  return { status: 'erro', fase: 'Args', detalhe: `args deve ser um objeto JSON, recebi ${Array.isArray(ARGS) ? 'array' : typeof ARGS}`, acao: 'reinvocar o Workflow com args objeto: {specPath, branch, perfil, validacoes, hoje, workspaceRoot, scriptsDir}' }
}
const argsFaltando = ['specPath', 'branch', 'perfil', 'workspaceRoot', 'scriptsDir'].filter(k => typeof ARGS[k] !== 'string' || !ARGS[k].trim())
if (argsFaltando.length > 0) {
  return { status: 'erro', fase: 'Args', detalhe: `args obrigatórios ausentes ou não textuais: ${argsFaltando.join(', ')}`, acao: 'reinvocar o Workflow com args completos: {specPath, branch, perfil, validacoes, hoje, workspaceRoot, scriptsDir}' }
}

if (['workspaceRoot', 'scriptsDir'].some(k => !/^(\/|[A-Za-z]:[\\/])/.test(ARGS[k]))) return { status: 'erro', fase: 'Args', detalhe: 'workspaceRoot e scriptsDir devem ser caminhos absolutos' }

// Perfil é a escolha de custo/rigor do dono. Valor fora do enum ("Máximo", o rótulo da tabela de
// perfis, ou "maximum") caía em silêncio no econômico: 1 lente, operários sequenciais e verde sem
// registro da troca; "constructor" achava propriedade herdada e o run lançava TypeError na revisão.
// Acento e caixa são normalizados; qualquer outro valor é erro antes de gastar agente.
const PERFIL_ID = ARGS.perfil.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
if (!Object.prototype.hasOwnProperty.call(PERFIS, PERFIL_ID)) return { status: 'erro', fase: 'Args', detalhe: `perfil desconhecido: ${JSON.stringify(ARGS.perfil)} (use economico, balanceado ou maximo)`, acao: 'reinvocar com o perfil escolhido pelo dono no plano de custo/rigor' }

// Exceção humana e retomada tardia (2.5.0): a FORMA é conferida aqui, antes de gastar agente; os
// IDs, depois da SPEC. Autorização é dado de entrada do run, registrada pelo dono, e não algo que o
// script infira de prosa, de `problemas` do operário ou de um relatório anterior. Por isso ela
// entra por args de um run novo: nada edita o controlador nem o estado, e um relatório antigo
// bloqueado continua bloqueado. Chave desconhecida é erro (2.6.0): um typo em `validacaoAnterior`
// repetia a suíte longa em silêncio, e um campo que sugere permissão maior era aceito e ignorado.
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/
const textoCheio = v => typeof v === 'string' && v.trim().length > 0
const listaDeIds = v => Array.isArray(v) && v.length > 0 && v.every(textoCheio)
const objetoPlano = v => !!v && typeof v === 'object' && !Array.isArray(v)
const dataIso = v => typeof v === 'string' && DATA_ISO.test(v)
const chavesDesconhecidas = (obj, nome, permitidas) => Object.keys(obj).filter(k => !permitidas.includes(k)).map(k => `${nome}.${k}`)

// Base da entrega, medição na base e arquivo de pendências (2.6.0). Ref malformada morria só na
// revisão, depois de TDD e implementação, ou lançava TypeError. Decisão 24 do dono (2026-11-03):
// a baseRef é só o SHA completo, 40 hex (SHA-1) ou 64 (SHA-256), que o git sempre lê como nome de
// objeto. Uma tag de data como 20261103 era lida como SHA abreviado e parava o run por engano na
// conferência da cópia, e um SHA abreviado não separava dois commits com o mesmo prefixo. Fora
// disso, erro aqui, antes de qualquer agente. Maiúsculas são normalizadas (o git lê hex sem
// diferenciar caixa e os helpers devolvem minúsculas): daqui em diante ARGS.baseRef é minúscula.
const SHA_COMPLETO = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/
{
  const erros = []
  if (ARGS.baseRef != null && !(typeof ARGS.baseRef === 'string' && SHA_COMPLETO.test(ARGS.baseRef.toLowerCase()))) erros.push(`baseRef deve ser o SHA completo do commit da base (40 ou 64 caracteres hex), recebi ${JSON.stringify(ARGS.baseRef)}: nome de ref, tag e SHA abreviado não valem`)
  if (ARGS.vermelhoNaBase != null && typeof ARGS.vermelhoNaBase !== 'boolean') erros.push('vermelhoNaBase deve ser booleano')
  if (ARGS.vermelhoNaBase === true && ARGS.baseRef == null) erros.push('vermelhoNaBase exige baseRef (o commit anterior à implementação)')
  // Checagem autocontida: pathNoWorkspace depende de constantes declaradas mais abaixo (TDZ).
  if (ARGS.pendenciasPath != null) {
    const raiz = ARGS.workspaceRoot.replace(/\\/g, '/').replace(/\/$/, '')
    const p = typeof ARGS.pendenciasPath === 'string' ? ARGS.pendenciasPath : ''
    const rel = p.startsWith(raiz + '/') ? p.slice(raiz.length + 1) : p
    const partes = rel.split('/').filter(x => x && x !== '.')
    if (!p.trim() || p !== p.trim() || /[\x00-\x1f\\:]/.test(rel) || rel.startsWith('/') || rel.endsWith('/') || partes.length === 0 || partes.some(x => x === '..' || x === '.git')) erros.push('pendenciasPath deve ser o arquivo de pendências dentro do workspace (relativo ou sob workspaceRoot, sem "..", ":" ou "\\")')
  }
  if (erros.length) return { status: 'erro', fase: 'Args', detalhe: erros.join('; '), acao: "corrigir os args de retomada e reinvocar em run novo; baseRef é o SHA completo do commit da base: o de git merge-base <branchBase> HEAD, gravado no Log da entrega, ou, para uma ref, o de git rev-parse --verify '<ref>^{commit}'" }
}
if (ARGS.baseRef != null) ARGS = { ...ARGS, baseRef: ARGS.baseRef.toLowerCase() }

const CAMPOS_AUTORIZACAO = ['criterios', 'evidencia', 'autorizacao', 'autorizadoPor', 'registradaEm', 'motivo']
const AUTORIZACOES = ARGS.autorizacoesTdd == null ? [] : ARGS.autorizacoesTdd
{
  const erros = []
  if (!Array.isArray(AUTORIZACOES)) erros.push('autorizacoesTdd deve ser lista')
  else AUTORIZACOES.forEach((a, i) => {
    const nome = `autorizacoesTdd[${i}]`
    if (!objetoPlano(a)) { erros.push(`${nome} deve ser objeto`); return }
    if (!listaDeIds(a.criterios)) erros.push(`${nome}.criterios deve ser lista não vazia de IDs`)
    for (const k of ['evidencia', 'autorizacao', 'autorizadoPor']) if (!textoCheio(a[k])) erros.push(`${nome}.${k} obrigatório`)
    if (!dataIso(a.registradaEm)) erros.push(`${nome}.registradaEm deve ser AAAA-MM-DD`)
    if (a.motivo !== undefined && !textoCheio(a.motivo)) erros.push(`${nome}.motivo, se houver, deve ser texto`)
    erros.push(...chavesDesconhecidas(a, nome, CAMPOS_AUTORIZACAO).map(c => `${c} desconhecido`))
  })
  if (erros.length) return { status: 'erro', fase: 'Args', detalhe: `autorizacoesTdd malformado: ${erros.join('; ')}. Cada autorização exige criterios (lista não vazia de IDs), evidencia, autorizacao (citação literal do dono), autorizadoPor e registradaEm (AAAA-MM-DD); motivo é opcional`, acao: 'registrar a autorização do dono com escopo, evidência e a frase literal dele em autorizacao, e reinvocar em run novo; sem autorização registrada não há exceção. Autorização registrada no formato 2.5.0, sem citação: pergunte uma vez ao dono dizendo por quê, nunca reconstrua a frase' }
}
// Controle compensatório (decisão do dono, 2026-11-02): a exceção humana só roda no perfil máximo,
// com as três lentes revisando o que seguiu sem vermelho. O perfil checado é o MESMO resolvido que
// escolhe as lentes (PERFIL_ID), para a checagem e a revisão nunca divergirem.
if (AUTORIZACOES.length > 0 && PERFIL_ID !== 'maximo') {
  return { status: 'erro', fase: 'Args', detalhe: `autorizacoesTdd exige perfil maximo (perfil efetivo: ${PERFIL_ID}): a exceção ao portão é compensada pelas três lentes de revisão`, acao: 'reinvocar em run novo com perfil maximo' }
}
const CAMPOS_REBASELINE = ['criteriosAprovados', 'motivo', 'autorizadoPor', 'registradaEm', 'validacaoAnterior']
// `reaproveitada` e as listas de excluídos precisam estar aqui: a retomada passa o `validacaoFinal`
// inteiro. As listas só documentam o que foi usado: elas já entram no hash da impressão (outra
// lista, outra impressão).
const CAMPOS_VALIDACAO_ANTERIOR = ['impressao', 'comandos', 'verde', 'reaproveitada', 'excluidos', 'excluidosNaoRastreados']
const listaDeTexto = l => l === undefined || (Array.isArray(l) && l.every(textoCheio))
const REBASELINE = ARGS.rebaselineTdd == null ? null : ARGS.rebaselineTdd
if (REBASELINE !== null) {
  const va = objetoPlano(REBASELINE) ? REBASELINE.validacaoAnterior : undefined
  // impressao null é o validacaoFinal de um run verde sem impressão conferida: aceito, sem reuso.
  const vaOk = va === undefined || (objetoPlano(va) && (va.impressao === null || impressaoConferida(va.impressao) !== null) && Array.isArray(va.comandos) && va.comandos.every(textoCheio) && typeof va.verde === 'boolean' && (va.reaproveitada === undefined || typeof va.reaproveitada === 'boolean') && listaDeTexto(va.excluidos) && listaDeTexto(va.excluidosNaoRastreados))
  const desconhecidas = objetoPlano(REBASELINE) ? [...chavesDesconhecidas(REBASELINE, 'rebaselineTdd', CAMPOS_REBASELINE), ...(objetoPlano(va) ? chavesDesconhecidas(va, 'rebaselineTdd.validacaoAnterior', CAMPOS_VALIDACAO_ANTERIOR) : [])] : []
  if (!objetoPlano(REBASELINE) || !listaDeIds(REBASELINE.criteriosAprovados) || !textoCheio(REBASELINE.motivo) || !textoCheio(REBASELINE.autorizadoPor) || !dataIso(REBASELINE.registradaEm) || !vaOk || desconhecidas.length) {
    return { status: 'erro', fase: 'Args', detalhe: `rebaselineTdd malformado${desconhecidas.length ? ` (campos desconhecidos: ${desconhecidas.join(', ')})` : ''}: exige criteriosAprovados (lista não vazia de IDs), motivo, autorizadoPor, registradaEm (AAAA-MM-DD) e, se houver, validacaoAnterior { impressao <sha256>-<conferência> que confere, comandos [..], verde, reaproveitada?, excluidos?, excluidosNaoRastreados? }`, acao: 'corrigir o rebaseline e reinvocar em run novo' }
  }
}
const naBase = ARGS.vermelhoNaBase === true

// Resolução do tiering: defaults da tabela + pedido dos args, com a whitelist decidindo. Pedido
// recusado NÃO degrada o run — o step roda no default e a recusa vai pro relatório E pro log
// (senão um typo nos defaults do usuário viraria silêncio até alguém ler o relatório verde).
const tieringRecusado = []
const TIERING = {}
{
  // Mapa que não é objeto plano (string, array, null) vira {} com UMA recusa nomeada — sem a
  // guarda, uma string espalhada gerava chaves numéricas espúrias, uma por caractere.
  const mapaOuRecusa = (valor, nome) => {
    if (valor == null) return {}
    if (typeof valor !== 'object' || Array.isArray(valor)) {
      tieringRecusado.push({ step: `(${nome})`, pedido: valor, causa: `${nome} deve ser objeto {step: valor}, recebi ${Array.isArray(valor) ? 'array' : typeof valor}` })
      return {}
    }
    return valor
  }
  const pedidoModelos = { ...mapaOuRecusa(ARGS.tiering && ARGS.tiering.modelos, 'tiering.modelos') }
  if (ARGS.modeloArquiteto && !pedidoModelos.consulta) pedidoModelos.consulta = ARGS.modeloArquiteto  // legado pré-2.3
  const pedidoEfforts = mapaOuRecusa(ARGS.tiering && ARGS.tiering.efforts, 'tiering.efforts')
  for (const [step, cfg] of Object.entries(MODELOS_STEP)) {
    let modelo = cfg.padrao
    const m = pedidoModelos[step]
    if (m && m !== modelo) {
      if (cfg.permitidos.includes(m)) modelo = m
      else tieringRecusado.push({ step, pedido: m, mantido: modelo, causa: `modelo fora da whitelist do step (permitidos: ${cfg.permitidos.join(', ')})` })
    }
    let effort = cfg.effort
    const e = pedidoEfforts[step]
    if (e && e !== effort) {
      if (!EFFORTS_VALIDOS.includes(e)) tieringRecusado.push({ step, pedido: e, mantido: effort, causa: `effort inválido (permitidos: ${EFFORTS_VALIDOS.join(', ')})` })
      else if (cfg.effortPiso && EFFORT_RANK[e] < EFFORT_RANK[cfg.effortPiso]) tieringRecusado.push({ step, pedido: e, mantido: effort, causa: `effort abaixo do piso do step (piso: ${cfg.effortPiso}) — julgamento adversarial/arquitetura não aceita o porão` })
      else effort = e
    }
    TIERING[step] = { modelo, effort }
  }
  // hasOwnProperty, não truthy check: `__proto__`/`toString` acham propriedade herdada em
  // MODELOS_STEP e escapavam do registro. Set deduplica step presente nos dois mapas.
  for (const step of new Set([...Object.keys(pedidoModelos), ...Object.keys(pedidoEfforts)])) {
    if (!Object.prototype.hasOwnProperty.call(MODELOS_STEP, step)) tieringRecusado.push({ step, pedido: pedidoModelos[step] ?? pedidoEfforts[step], causa: `step desconhecido (existem: ${Object.keys(MODELOS_STEP).join(', ')})` })
  }
}
log(`Tiering por step: ${Object.entries(TIERING).map(([s, t]) => `${s}=${t.modelo}${t.effort ? `(${t.effort})` : ''}`).join(' · ')}`)
if (tieringRecusado.length > 0) log(`Tiering: ${tieringRecusado.length} pedido(s) recusado(s) pela whitelist — ver modelos.recusados no relatório`)

// Modelos/efforts PEDIDOS ao runtime por step, registrados na chamada que retornou (execucoesPorStep),
// não de flags globais no fim: um fallback tardio não pode re-rotular step que já rodou no tier
// certo. Step que nunca rodou reporta o configurado. O detalhe de qual chamada caiu fica em
// `fallbacks`. Vai em TODO desfecho pós-resolução (verde, escalado, bloqueado, erro), não só no
// verde: num run escalado é justamente aqui que se lê com que modelo cada step foi pedido.
// agent() devolve só o resultado, não o modelo resolvido: a `nota` diz isso no relatório em vez de
// afirmar identidade (causas conferidas em plugins/iris/references/delegacao.md).
const relatorioModelos = () => ({
  porStep: Object.fromEntries(Object.keys(MODELOS_STEP).map(s => {
    const t = TIERING[s]
    return [s, { modelo: execucoesPorStep[s] ?? t.modelo, effort: t.effort || 'herdado da sessão' }]
  })),
  recusados: tieringRecusado,
  nota: 'modelo registrado = pedido ao runtime na chamada que retornou, não observado: o efetivo pode diferir (apelido da família da sessão resolve para o modelo exato da sessão; CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1; mod com hook agent.spawn)',
})

// Normaliza apenas identidades dentro da raiz conhecida. Não aceita sufixo arbitrário
// (outro projeto/tests/a.js), valores não SHA-256 ou duas provas conflitantes.
const pathCanonico = p => p.split('/').filter(parte => parte && parte !== '.').join('/');
// Identidade de um path relatado por agente: tolera o prefixo da raiz e anotação de :linha.
// null = não dá pra afirmar que é arquivo deste workspace.
function pathNoWorkspace(relatado) {
  const root = ARGS.workspaceRoot.replace(/\\/g, '/').replace(/\/$/, '');
  let key = relatado.trim().replace(/:\d+(?:-\d+)?(?:\s+\([^\n]*\))?$/, '');
  if (key.startsWith(root + '/')) key = key.slice(root.length + 1);
  else if (key.startsWith('/')) return null;
  if (/[:\\]/.test(key) || key.split('/').includes('..')) return null;
  return pathCanonico(key);
}
// CRC-32 (IEEE) em JS puro — o sandbox não tem crypto nem Buffer. Mesmo algoritmo, byte a byte,
// do `crc32` de `scripts/hashes-testes.mjs` (este script não importa nada): unidade UTF-16
// abaixo de 256 entra como um byte, as demais como byte baixo e byte alto.
function crc32(texto) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < texto.length; i++) {
    const u = texto.charCodeAt(i);
    for (const b of u < 256 ? [u] : [u & 0xFF, u >>> 8]) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
    }
  }
  return ((c ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0');
}
// Cada valor chega como `<sha256>-<conferência>`, emitido pelo script de hashes. Quem transporta
// é um modelo copiando 64 caracteres: em 2026-10-04 uma troca de dois deles ("c3d" por "d3c")
// virou "teste alterado" num arquivo que nunca mudou. A conferência (CRC-32 de `path\nsha`) é
// recalculada aqui; valor que não confere é erro de TRANSPORTE, nunca prova de alteração.
function normalizarHashes(mapa, paths) {
  if (!mapa || typeof mapa !== 'object' || Array.isArray(mapa)) throw new Error('mapa de hashes ausente');
  const esperado = new Map(paths.map(p => [pathCanonico(p), p]));
  const out = {};
  for (const [chave, valor] of Object.entries(mapa)) {
    const key = pathNoWorkspace(chave);
    if (key === null) throw new Error(`hash refere path fora da raiz ou inválido: ${chave}`);
    const original = esperado.get(key);
    if (!original) throw new Error(`hash refere arquivo fora da lista: ${chave}`);
    const c = conferido(original, valor);
    if (c === undefined) throw new Error(`hash fora do formato <sha256>-<conferência>: ${chave}`);
    if (c === null) throw new Error(`hash não confere com a própria conferência (erro de transcrição): ${chave}`);
    if (out[original] && out[original] !== c) throw new Error(`hashes conflitantes: ${original}`);
    out[original] = c;
  }
  for (const p of paths) if (!out[p]) throw new Error(`sem hash para ${p}`);
  return out;
}
// `<sha256>-<conferência>` com a conferência = CRC-32 de `<rótulo>\n<sha>`: devolve o sha se
// confere, null se o formato está certo e a conferência não, undefined se nem o formato bate.
function conferido(rotulo, valor) {
  const m = typeof valor === 'string' && /^([a-f0-9]{64})-([a-f0-9]{8})$/.exec(valor.trim().toLowerCase());
  if (!m) return undefined;
  return crc32(`${rotulo}\n${m[1]}`) === m[2] ? m[1] : null;
}
const shellQuote = s => "'" + s.replace(/'/g, "'\"'\"'") + "'";
const comandoHashes = paths => `cd ${shellQuote(ARGS.workspaceRoot)} && node ${shellQuote(ARGS.scriptsDir + '/hashes-testes.mjs')} ${shellQuote(JSON.stringify(paths))}`;
// As listas de excluídos vão no comando: a do diff (a SPEC, `EXCLUIDOS_IMPRESSAO`) e a só dos não
// rastreados (as pendências, `EXCLUIDOS_NAO_RASTREADOS`). O script as põe no hash, então só confere
// quem recalcula com as mesmas listas.
const comandoImpressao = () => `cd ${shellQuote(ARGS.workspaceRoot)} && node ${shellQuote(ARGS.scriptsDir + '/hashes-testes.mjs')} --impressao${EXCLUIDOS_IMPRESSAO.length || EXCLUIDOS_NAO_RASTREADOS.length ? ` ${shellQuote(JSON.stringify(EXCLUIDOS_IMPRESSAO))}` : ''}${EXCLUIDOS_NAO_RASTREADOS.length ? ` ${shellQuote(JSON.stringify(EXCLUIDOS_NAO_RASTREADOS))}` : ''}`;
// Impressão da worktree: mesmo formato e mesma conferência dos hashes (CRC-32 de `worktree\n<sha>`).
// null = ausente ou transcrição errada: nunca autoriza reuso de validação.
function impressaoConferida(valor) {
  const sha = conferido('worktree', valor);
  return sha ? `${sha}-${crc32(`worktree\n${sha}`)}` : null;
}

// ── Fase 1: Spec ─────────────────────────────────────────────────────────────
phase('Spec')
log(`Validando SPEC em ${ARGS.specPath} (perfil ${PERFIL_ID}, branch ${ARGS.branch})`)

const preflight = await chamarOperario('validar',
  `Execute somente este comando, sem editar a SPEC:
    \`\`\`bash
    cd ${shellQuote(ARGS.workspaceRoot)} && node ${shellQuote(ARGS.scriptsDir + '/spec-ids.mjs')} ${shellQuote(ARGS.specPath)} --quality
    \`\`\`
  Devolva o JSON literal do stdout (inclusive quando exit 1). Não reinterprete nem deduplique IDs.
  Falha sem JSON: retorne ok=false, ids=[], erros com o erro operacional, verificacoesComplementares={} e tipos={}.`,
  { label: 'spec:ids', schema: { type: 'object', additionalProperties: false, required: ['ok','ids','erros','verificacoesComplementares','tipos'], properties: {
    ok: { type: 'boolean' }, ids: { type: 'array', items: { type: 'string' } }, erros: { type: 'array', items: { type: 'string' } },
    verificacoesComplementares: { type: 'object', additionalProperties: { type: 'string' } },
    tipos: { type: 'object', additionalProperties: { enum: ['reproducao', 'preservacao'] } },
    quality: QUALITY_SCHEMA,
  } } }
)
if (!preflight) return { status: 'erro', fase: 'Spec', detalhe: 'preflight da tabela original não retornou' }
if (!preflight.ok || preflight.erros.length || !preflight.ids.length || preflight.ids.some(id=>!id.trim()) || new Set(preflight.ids).size !== preflight.ids.length) return { status: 'bloqueado', fase: 'Spec', detalhe: preflight.erros.join('; ') || 'IDs originais vazios ou repetidos' }
if (!preflight.verificacoesComplementares || typeof preflight.verificacoesComplementares !== 'object' || Array.isArray(preflight.verificacoesComplementares) || Object.entries(preflight.verificacoesComplementares).some(([id, texto]) => !preflight.ids.includes(id) || typeof texto !== 'string')) return { status: 'erro', fase: 'Spec', detalhe: 'mapa de verificações complementares ausente ou inválido no preflight' }
const qualityContract = preflight.quality
const qualityProfiles = {
  base: ['Q-NAMES', 'Q-COMMENTS', 'Q-BOUNDARIES', 'Q-TESTABILITY', 'Q-COHESION', 'Q-ERRORS', 'Q-PROJECT'],
  typescript: ['TS-TYPES', 'TS-IMPORTS', 'TS-ASYNC'], frontend: ['FE-STATE', 'FE-EFFECTS', 'FE-ACCESSIBILITY'], backend: ['BE-BOUNDARIES', 'BE-CONSISTENCY', 'BE-MIGRATIONS'],
}
const isQualityPath = p => textoCheio(p) && pathNoWorkspace(p) === p && !/[\x00-\x1f\x7f]/.test(p) && !p.split('/').some(part => part.toLowerCase() === '.git' || /[*?{}]/.test(part))
const qualityIds = Array.isArray(qualityContract?.profiles) ? qualityContract.profiles.flatMap(p => qualityProfiles[p] || []) : []
if (!objetoPlano(qualityContract) || qualityContract.version !== 1 || !Array.isArray(qualityContract.profiles) || !qualityContract.profiles.includes('base') || qualityContract.profiles.some(p => !Object.hasOwn(qualityProfiles, p)) || new Set(qualityContract.profiles).size !== qualityContract.profiles.length ||
    !Array.isArray(qualityContract.checks) || qualityContract.checks.length !== qualityIds.length || new Set(qualityContract.checks.map(c => c?.id)).size !== qualityIds.length || qualityContract.checks.some(c => !objetoPlano(c) || !qualityIds.includes(c.id) || !['required', 'not-applicable'].includes(c.applicability) || !textoCheio(c.reason) || !Array.isArray(c.paths) || !c.paths.length || c.paths.some(p => !isQualityPath(p)) || !['review', 'command'].includes(c.verification) || typeof c.command !== 'string' || /[\r\n]/.test(c.command) || (c.verification === 'command' ? !textoCheio(c.command) : c.command !== '') || (['Q-NAMES', 'Q-COMMENTS', 'Q-TESTABILITY', 'Q-COHESION', 'Q-PROJECT'].includes(c.id) && c.applicability !== 'required')) ||
    !Array.isArray(qualityContract.conventions) || !qualityContract.conventions.length || qualityContract.conventions.some(c => !objetoPlano(c) || !textoCheio(c.source) || !textoCheio(c.decision)) || !Array.isArray(qualityContract.decomposition) || qualityContract.decomposition.some(d => !objetoPlano(d) || !isQualityPath(d.path) || !textoCheio(d.trigger) || !textoCheio(d.decision) || !textoCheio(d.verification))) {
  return { status: 'bloqueado', fase: 'Spec', detalhe: 'Contrato de qualidade ausente ou inválido: confira perfis, IDs, aplicabilidade, convenções e decomposição com spec-ids --quality.' }
}
log('odin-dev-loop: contrato de qualidade v1')
const qualityHistory = []
const qualityReport = { contract: qualityContract, iterations: qualityHistory, limitations: ['Schemas e medidas provam completude; conclusões semânticas dependem da inspeção independente registrada.'] }
const qualityPrompt = `Contrato de qualidade aprovado (todos os perfis de custo): ${JSON.stringify(qualityContract)}. Leia quality-contract.md e especialidades selecionadas; confronte convenções, perfis e decomposição com o conteúdo real. Não reabra decisões aprovadas por preferência pessoal.`
// Tipo de cada critério (2.6.0) vem da coluna Tipo da tabela original (spec-ids.mjs), um por ID,
// aprovado pelo dono com a SPEC. O operário do TDD não o escolhe: rotular de "preservação" um teste
// que nasce verde num critério de mudança abria o portão sem nada demonstrar a mudança.
const TIPOS = preflight.tipos
if (!objetoPlano(TIPOS) || Object.keys(TIPOS).length !== preflight.ids.length || preflight.ids.some(id => !Object.prototype.hasOwnProperty.call(TIPOS, id) || !['reproducao', 'preservacao'].includes(TIPOS[id]))) return { quality: qualityReport, status: 'erro', fase: 'Spec', detalhe: 'mapa de tipos (reprodução/preservação) ausente ou inválido no preflight', acao: 'o preflight devolve tipos com um valor por ID da tabela (spec-ids.mjs); reinvocar em run novo' }

const spec = await chamarOperario('spec',
  `Leia o arquivo ${ARGS.specPath} e valide a seção ## SPEC contra o formato canônico do odin:
  critérios de aceite todos verificáveis, cada um mapeado pra teste executável (ou verificação
  complementar explícita), unidades de trabalho com contratos e arquivos DISJUNTOS entre si,
  non-goals presentes.
  A coluna Verificação complementar é distinta da coluna de teste executável; nunca copie
  path de teste para verificacaoComplementar. Valores extraídos da coluna original:
  ${JSON.stringify(preflight.verificacoesComplementares)}.
  Extraia também as "Pendências bloqueadoras" do Gate de prontidão
  (seção pode não existir em spec legada — aí retorne lista vazia, não é erro).
  Se a SPEC for a variante não-software "SPEC-lite" (título "# SPEC-lite", ou tabela de
  critérios com "forma de verificação" no lugar de teste executável), marque specLite=true
  — não é erro de formato, é sinal de que a entrega não roda neste harness.
  ok=false apenas se o formato impedir o loop (critério sem verificação, unidades com arquivos
  sobrepostos sem contrato de quem cria/quem consome). Retorne o objeto estruturado.`,
  { label: 'spec:validar', schema: SPEC_SCHEMA }
)

if (!spec) return { quality: qualityReport, status: 'erro', fase: 'Spec', detalhe: 'agente de validação não retornou', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
if (!spec.ok) return { quality: qualityReport, status: 'bloqueado', fase: 'Spec', detalhe: spec.motivo, acao: 'corrigir a SPEC na skill entregar (Step 4c) e reinvocar', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
if (spec.specLite) return { quality: qualityReport, status: 'bloqueado', fase: 'Spec', detalhe: 'SPEC na variante lite (entrega não-software)', acao: 'entrega não-software roda Solo na skill entregar — o harness é exclusivo de software', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
if (spec.pendenciasBloqueadoras.length > 0) return { quality: qualityReport, status: 'bloqueado', fase: 'Spec', detalhe: `Gate de prontidão com pendências bloqueadoras: ${spec.pendenciasBloqueadoras.join('; ')}`, acao: 'resolver ou aceitar por escrito no gate antes do loop', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
if (spec.criterios.length === 0 || spec.criterios.some(c => !c.id.trim() || !c.texto.trim())) return { quality: qualityReport, status: 'bloqueado', fase: 'Spec', detalhe: 'SPEC funcional precisa de pelo menos um critério com id e texto não vazios', acao: 'completar os critérios na skill entregar (Step 4c) e reinvocar', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
const idsCriteriosDaSpec = spec.criterios.map(c => c.id)
const idsCriteriosRepetidos = [...new Set(idsCriteriosDaSpec.filter((id, i) => idsCriteriosDaSpec.indexOf(id) !== i))]
if (idsCriteriosRepetidos.length > 0) return { quality: qualityReport, status: 'bloqueado', fase: 'Spec', detalhe: `IDs de critério repetidos: ${idsCriteriosRepetidos.join(', ')}`, acao: 'cada critério precisa de identidade única para seu teste ou verificação manual', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
if (idsCriteriosDaSpec.length !== preflight.ids.length || preflight.ids.some(id => !idsCriteriosDaSpec.includes(id))) return { quality: qualityReport, status: 'bloqueado', fase: 'Spec', detalhe: 'IDs extraídos pelo agente diferem da tabela original; não reinterpretar identidades' }
// A coluna original decide a pendência: o julgamento do agente não pode inventá-la nem apagá-la.
for (const c of spec.criterios) c.verificacaoComplementar = Object.prototype.hasOwnProperty.call(preflight.verificacoesComplementares, c.id) ? preflight.verificacoesComplementares[c.id] : ''
if (spec.unidades.length === 0 || spec.unidades.some(u => !u.id.trim() || !u.titulo.trim() || !u.arquivos.trim() || u.criterios.length === 0)) return { quality: qualityReport, status: 'bloqueado', fase: 'Spec', detalhe: 'SPEC funcional precisa de unidades não vazias com id, título, arquivos e critérios', acao: 'completar as unidades na skill entregar (Step 4c) e reinvocar', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
const idsUnidades = spec.unidades.map(u => u.id)
const idsUnidadesRepetidos = [...new Set(idsUnidades.filter((id, i) => idsUnidades.indexOf(id) !== i))]
if (idsUnidadesRepetidos.length > 0) return { quality: qualityReport, status: 'bloqueado', fase: 'Spec', detalhe: `IDs de unidade repetidos: ${idsUnidadesRepetidos.join(', ')}`, acao: 'cada unidade precisa de ID único porque o ID identifica sua execução', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
const idsCriteriosConhecidos = new Set(idsCriteriosDaSpec)
const refsDeUnidadeInvalidas = [...new Set(spec.unidades.flatMap(u => u.criterios).filter(id => !idsCriteriosConhecidos.has(id)))]
if (refsDeUnidadeInvalidas.length > 0) return { quality: qualityReport, status: 'bloqueado', fase: 'Spec', detalhe: `unidades referem critérios inexistentes: ${refsDeUnidadeInvalidas.join(', ')}`, acao: 'corrigir o vínculo unidade-critério antes do TDD', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
const refsDeExcecaoInvalidas = [...new Set([...AUTORIZACOES.flatMap(a => a.criterios), ...(REBASELINE ? REBASELINE.criteriosAprovados : [])])].filter(id => !idsCriteriosConhecidos.has(id))
if (refsDeExcecaoInvalidas.length > 0) return { quality: qualityReport, status: 'bloqueado', fase: 'Spec', detalhe: `autorizacoesTdd/rebaselineTdd referem critérios inexistentes na SPEC: ${refsDeExcecaoInvalidas.join(', ')}`, acao: 'o escopo da exceção ou do rebaseline usa os IDs da SPEC aprovada; corrigir e reinvocar em run novo', fallbacks: fallbacksModelo, modelos: relatorioModelos() }

const criteriosManuais = spec.criterios.filter(c => c.verificacaoComplementar && c.verificacaoComplementar.trim())
const idsManuais = new Set(criteriosManuais.map(c => c.id))

const perfil = PERFIS[PERFIL_ID]
const validacoes = (ARGS.validacoes && ARGS.validacoes.length ? ARGS.validacoes : spec.validacoesDaSpec) || []
const PENDENCIAS = ARGS.pendenciasPath == null ? null : pathNoWorkspace(ARGS.pendenciasPath)
// Arquivos de cada unidade de trabalho, um token por path (diretório termina em '/').
const arquivosDeUnidade = spec.unidades.flatMap(u => u.arquivos.split(/[\s,;]+/).map(x => x.replace(/^[`'"(]+|[`'")]+$/g, '')).filter(Boolean))
const emArquivoDeUnidade = p => arquivosDeUnidade.some(a => {
  const area = pathCanonico(a)
  return a.endsWith('/') ? area === '' || p.startsWith(area + '/') : area === p
})
// Impressão da worktree sem os arquivos que o fluxo grava DEPOIS da validação (2.6.0): o Log e o
// relatório no arquivo da SPEC, e as pendências. Sem isso, gravar o relatório mudava a impressão e
// o reuso de `validacaoAnterior` nunca conferia no fluxo documentado (falha fechada, suíte longa
// repetida sempre). A SPEC sai do diff; as pendências saem só dos não rastreados, e o script
// recusa a impressão se elas estiverem rastreadas: é o efeito medido que impede um pendenciasPath
// apontado para código rastreado (área de unidade em diretório, módulo fora das unidades) de
// esconder código e reaproveitar a validação longa sobre ele.
// Pendências iguais a um arquivo de unidade são erro antes do portão, porque é configuração errada
// visível já aqui. Só igualdade exata: unidade cuja área é um diretório não pode barrar o arquivo
// de pendências que mora nele (o default documentado pela skill fica num diretório de docs).
if (PENDENCIAS !== null && arquivosDeUnidade.some(a => !a.endsWith('/') && pathCanonico(a) === PENDENCIAS)) return { quality: qualityReport, status: 'erro', fase: 'Spec', detalhe: `pendenciasPath aponta para arquivo de unidade de trabalho: ${PENDENCIAS}`, acao: 'pendenciasPath é o arquivo local de pendências que a skill resolveu (local_pendencias ou o default documentado), nunca código; corrigir e reinvocar em run novo', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
// Diretório de unidade pode conter pendências legítimas, mas também código novo. Sem
// prova de separação não se reaproveita verde e o path conta na detecção de implementação.
const pendenciasNaAreaDeTrabalho = PENDENCIAS !== null && emArquivoDeUnidade(PENDENCIAS)
const EXCLUIDOS_IMPRESSAO = [pathNoWorkspace(ARGS.specPath)].filter(Boolean)
const EXCLUIDOS_NAO_RASTREADOS = PENDENCIAS !== null && !EXCLUIDOS_IMPRESSAO.includes(PENDENCIAS) ? [PENDENCIAS] : []
const rotuloTipo = id => TIPOS[id] === 'preservacao' ? 'preservação' : 'reprodução'
// Escopo que os args deste run declaram para exceção humana ou rebaseline. O que de fato fica
// coberto é decidido depois da execução independente (`cobertos`), pelo que foi medido.
const escopoDosArgs = [...new Set([...AUTORIZACOES.flatMap(a => a.criterios), ...(REBASELINE ? REBASELINE.criteriosAprovados : [])])]

// ── Fase 2: Portão TDD ───────────────────────────────────────────────────────
phase('TDD')
log(`Portão TDD: escrevendo testes pros ${spec.criterios.length} critérios — nada implementa antes do vermelho`)

// Instrução de retomada: sem rebaseline, nunca fabricar vermelho desfazendo trabalho; com
// rebaseline explícito, preservar a worktree e declarar o que já estava implementado.
const instrucaoRetomada = REBASELINE ? `
  RETOMADA COM REBASELINE EXPLÍCITO (critérios aprovados: ${REBASELINE.criteriosAprovados.join(', ')}; motivo: ${REBASELINE.motivo}).
  A implementação pode já existir na worktree. NÃO reverta, NÃO faça stash, NÃO limpe nem descarte
  mudanças: preserve a worktree como está. Escreva ou complete os testes contra o comportamento
  esperado; reprodução de critério aprovado pode já passar. Declare em implementacaoAnterior
  { detectada, evidencias } o que você encontrou já implementado.` : `
  NUNCA reverta, faça stash ou descarte implementação existente para fabricar vermelho: se o
  comportamento já existe, declare em implementacaoAnterior e em problemas.`
// Retomada sobre a base (2.6.0): o vermelho é medido numa cópia descartável de baseRef, então
// nesta worktree as reproduções passam. Nesse modo vermelhoConfirmado tem UMA definição (testes
// prontos e cobrindo os critérios), sem a regra genérica de asserção, que contradizia esta: o "não"
// do autor do teste é o sinal que distingue teste que não cobre o critério, porque na base o
// import de módulo criado pela entrega já conta como vermelho, sejam quais forem as asserções.
const instrucaoBase = naBase ? `
  RETOMADA COM VERMELHO NA BASE: a implementação já existe nesta worktree e NÃO deve ser revertida,
  stashada nem editada. As reproduções vão passar aqui; o vermelho será medido de forma
  independente numa cópia descartável da base ${ARGS.baseRef}. Escreva ou reaproveite os testes e
  responda vermelhoConfirmado=true quando estiverem prontos e cobrirem os critérios; registre em
  problemas[] o que não ficou pronto.` : ''
// Escopo de exceção ou rebaseline: o operário julga vermelhoConfirmado pelo que está fora dele,
// mas toda reprodução que falha, inclusive as do escopo, ainda precisa falhar por asserção.
const instrucaoEscopo = escopoDosArgs.length ? `
  Critérios no escopo da exceção humana ou do rebaseline deste run: ${escopoDosArgs.join(', ')}.
  Eles podem nascer verdes, e isso não conta contra vermelhoConfirmado. Toda reprodução que falha,
  inclusive as desses critérios, ainda precisa falhar por asserção, e todo controle precisa passar.` : ''
const ACAO_SEM_VERMELHO = `teste que nasce verde é suspeito: critério já atendido (cortar), teste inútil (reescrever) ou implementação anterior à retomada; neste último caso não reverta a worktree para fabricar vermelho: reinvoque em run novo com baseRef (SHA completo do merge-base com a branchBase) e vermelhoNaBase=true, que mede o vermelho numa cópia descartável da base, ou, se a base não puder ser medida, com rebaselineTdd explícito (critérios aprovados). Continuar sem vermelho só com autorização registrada do dono em autorizacoesTdd (escopo, evidência, citação literal, autor e data, em perfil maximo)${ARGS.baseRef ? '' : '. Sem baseRef, implementação já commitada na branch (checkpoint do Solo, run anterior) não aparece na detecção de implementação anterior nem na revisão'}`
const comEnum = (schemaItem, campo) => ({ ...schemaItem, items: { ...schemaItem.items, properties: { ...schemaItem.items.properties, [campo]: { type: 'string', enum: idsCriteriosDaSpec } } } })

const tdd = await chamarOperario('tdd',
  `Portão TDD do dev-loop (branch ${ARGS.branch}). SPEC: ${ARGS.specPath}.
  Escreva os testes executáveis que cobrem TODOS os critérios de aceite: ${spec.criterios.map(c => `${c.id} [${rotuloTipo(c.id)}]`).join(', ')},
  seguindo os padrões de teste do projeto. NÃO implemente nada de produção.
  O Tipo de cada critério (entre colchetes) vem da coluna Tipo da SPEC aprovada; não o reclassifique.
  Critério de reprodução tem pelo menos um teste "reproducao" (controle extra no mesmo critério é
  permitido); critério de preservação só tem testes "preservacao". Classifique cada teste em testes[].tipo:
  - "reproducao": prova o comportamento pedido; precisa FALHAR agora por asserção (funcionalidade
    ausente ou quebrada) e passar depois da implementação.
  - "preservacao": controle que protege comportamento que já existe; pode passar agora e precisa
    continuar passando.
  Em testes[].criterio retorne somente o ID literal, sem descrição, prefixo ou sufixo.
  Em testes[].path retorne somente o caminho relativo do arquivo, sem :linha ou nome do caso.
  Em testes[].comando dê o comando que roda SÓ aquele teste, a partir da raiz do workspace (ex.:
  filtro pelo nome do caso): a execução independente roda um teste por vez. Num arquivo com
  reprodução e controle, o comando precisa isolar o caso: rodar o arquivo inteiro mede os dois juntos.
  O comando precisa citar o caminho relativo do arquivo do teste, escrito como em testes[].path:
  é esse arquivo que fica protegido por hash, e comando que não o cita é recusado antes da medição,
  com o run inteiro bloqueado. Vale mesmo quando o costume do projeto é outro:
  no unittest, a forma por módulo pontilhado é recusada; use o caminho do arquivo com -k.
  Exemplos: node --test tests/x.test.js --test-name-pattern=caso; pytest tests/x.py::caso;
  python -m unittest tests/x.py -k Classe.caso (caminho sem ./ na frente).
  Em testes[].motivoFalha: na reprodução, por que falha agora; no controle, que regressão ele pega.
  Verificação que não é teste (lint, revisão, preview) vai em complementares[] com critério e
  motivo; ela nunca conta como teste.
  Arquivos de apoio que você criar ou editar para os testes (helpers, fixtures) vão em apoio[], com
  path relativo; arquivo de produção nunca é apoio.
  ${naBase ? `Rode os testes e confirme que executam (sem erro de sintaxe nem de import do próprio teste)
  e que os controles passam; as reproduções podem passar nesta worktree.` : `Rode os testes e confirme: reprodução falha por asserção (erro de sintaxe, import ou
  infraestrutura nunca conta como vermelho) e controle passa.`}
  Critério puramente visual/manual com verificacaoComplementar explícita na SPEC não exige teste;
  ele ficará pendente de evidência manual no relatório final e não deve entrar em problemas[].${naBase ? '' : `
  vermelhoConfirmado=true SOMENTE se todas as reproduções falharam por asserção e todos os controles passaram.`}${instrucaoEscopo}${instrucaoRetomada}${instrucaoBase}`,
  { label: 'tdd:portao', schema: { ...TDD_SCHEMA, properties: { ...TDD_SCHEMA.properties,
    testes: comEnum(TDD_SCHEMA.properties.testes, 'criterio'),
    complementares: comEnum(TDD_SCHEMA.properties.complementares, 'criterio'),
  } } }
)

// Agente que não retorna é falha de INFRA (`erro`, reinvocável), não spec ruim (`bloqueado`) —
// mesmo tratamento que o agente de spec recebe acima.
if (!tdd) return { quality: qualityReport, status: 'erro', fase: 'TDD', detalhe: 'agente do portão TDD não retornou', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
// O "não" do operário (2.6.0) só para o run ANTES da medição quando não há teste a medir. Com
// testes, a execução independente roda primeiro e o desfecho diz a causa (evidência inválida,
// controle vermelho, sem vermelho, implementação anterior); o veto volta depois, se nada medido o
// explicar. Antes, o "não" saía sem medir nada, com quatro hipóteses e sem relatório, e o agente
// não distinguia ambiente de reprodução verde. Tudo o que bloqueia depois daqui leva o relato.
const problemasDoOperario = (Array.isArray(tdd.problemas) ? tdd.problemas : []).join('; ')
const ressalvaDoOperario = tdd.vermelhoConfirmado ? '' : ` [o operário não confirmou o vermelho: ${problemasDoOperario || 'sem detalhe'}]`
const ACAO_NAO_CONFIRMADO = 'o operário não confirmou o vermelho e não há teste a medir: leia problemas. Se a implementação já existe na worktree, NÃO reverta nem faça stash: reinvocar em run novo com baseRef + vermelhoNaBase ou com rebaselineTdd. Ambiente, import ou sintaxe quebrados → corrigir e repetir o portão; teste que nasce verde → cortar o critério ou escrever o teste que falta'
if (!tdd.vermelhoConfirmado && tdd.testes.length === 0) {
  return { quality: qualityReport, status: 'bloqueado', fase: 'TDD', motivo: 'nao-confirmado', detalhe: problemasDoOperario || 'vermelho não confirmado', acao: ACAO_NAO_CONFIRMADO, fallbacks: fallbacksModelo, modelos: relatorioModelos() }
}

// Todo bloqueio do portão leva o relato do operário quando ele não confirmou o vermelho: com o
// veto deslocado para depois da medição, o bloqueio estrutural não pode apagar o que ele disse.
const bloqueioTdd = campos => ({ quality: qualityReport, status: 'bloqueado', fase: 'TDD', ...campos, detalhe: `${campos.detalhe}${ressalvaDoOperario}`, fallbacks: fallbacksModelo, modelos: relatorioModelos() })
const testesDaSpec = [...new Set(tdd.testes.map(t => pathCanonico(t.path)))]
const idsCriterios = new Set(spec.criterios.map(c => c.id))
const refsInvalidas = tdd.testes.filter(t => {
  const p = t.path.trim()
  return !p || p.includes('\\') || p.startsWith('/') || /^[A-Za-z]:/.test(p) || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(p) || p.split('/').includes('..')
})
if (refsInvalidas.length > 0) return bloqueioTdd({ detalhe: `referência de teste inválida: ${refsInvalidas.map(t => t.path || '(vazia)').join(', ')}`, acao: 'usar paths relativos, não vazios e contidos no projeto' })
const testesMalformados = tdd.testes.filter(t => !['reproducao', 'preservacao'].includes(t.tipo) || !textoCheio(t.comando))
if (testesMalformados.length > 0) return bloqueioTdd({ detalhe: `teste sem tipo (reproducao ou preservacao) ou sem comando próprio: ${testesMalformados.map(t => t.path).join(', ')}`, acao: 'cada teste declara se reproduz ou preserva e o comando que roda só ele; a execução independente roda um por vez' })
// O comando vai para o prompt do mecânico: quebra de linha ou crase o tirariam do trecho de código
// e virariam instrução. E ele precisa rodar o arquivo que recebe hash: senão o oráculo executado
// fica fora da regra dos testes intactos. Comando repetido faria um exit decidir dois testes.
const comandosInseguros = tdd.testes.filter(t => /[\r\n`]/.test(t.comando))
if (comandosInseguros.length > 0) return bloqueioTdd({ detalhe: `comando com quebra de linha ou crase: ${comandosInseguros.map(t => t.path).join(', ')}`, acao: 'cada teste traz um comando de uma linha, sem crase' })
const semVinculo = tdd.testes.filter(t => !t.comando.includes(t.path.trim()) && !t.comando.includes(pathCanonico(t.path)))
if (semVinculo.length > 0) return bloqueioTdd({ detalhe: `comando que não roda o próprio arquivo protegido por hash: ${semVinculo.map(t => `${t.path} (comando: ${t.comando.trim()})`).join('; ')}`, acao: 'o comando de cada teste cita o path do arquivo do teste (ex.: node --test <path> --test-name-pattern=<caso>, pytest <path>::<caso>, python -m unittest <path> -k <caso>); módulo pontilhado do unittest (pasta.mod.Classe.caso) não cita o arquivo: troque pelo caminho com -k' })
// Comparação normalizada (2.6.0): espaços colapsados e `./<path do teste>` igual a `<path>`.
// Variantes triviais rodavam a mesma coisa e passavam como comandos distintos: duas reproduções
// no mesmo arquivo eram decididas por um exit só. Heurística: não pega uma flag a mais nem filtro
// que casa tudo (isso aparece na medição, como controle vermelho em arquivo dividido).
const normalizarComando = t => t.comando.trim().split(/\s+/).map(x => x === `./${pathCanonico(t.path)}` ? pathCanonico(t.path) : x).join(' ')
const vistosComandos = new Map()
for (const t of tdd.testes) vistosComandos.set(normalizarComando(t), (vistosComandos.get(normalizarComando(t)) || 0) + 1)
const comandosRepetidos = [...vistosComandos].filter(([, n]) => n > 1).map(([c]) => c)
if (comandosRepetidos.length > 0) return bloqueioTdd({ detalhe: `comando repetido entre testes: ${comandosRepetidos.join('; ')}`, acao: 'cada teste precisa de comando que rode só ele (filtro pelo caso); um exit não pode decidir dois testes' })
const complementares = Array.isArray(tdd.complementares) ? tdd.complementares : []
const criteriosDesconhecidos = [...tdd.testes, ...complementares].filter(t => !idsCriterios.has(t.criterio))
if (criteriosDesconhecidos.length > 0) return bloqueioTdd({ detalhe: `testes referenciam critérios inexistentes: ${criteriosDesconhecidos.map(t => t.criterio).join(', ')}`, acao: 'corrigir o mapeamento critério-teste antes da implementação' })
// Tipo do teste coerente com o Tipo da SPEC (2.6.0), antes de medir: critério de reprodução
// precisa de pelo menos uma reprodução (controle extra é permitido); critério de preservação não
// tem reprodução. É o que impede abrir o portão rotulando de controle o teste que nasce verde.
const tiposDivergentes = [...new Set(tdd.testes.map(t => t.criterio))].filter(c => TIPOS[c] === 'reproducao'
  ? !tdd.testes.some(t => t.criterio === c && t.tipo === 'reproducao')
  : tdd.testes.some(t => t.criterio === c && t.tipo === 'reproducao'))
if (tiposDivergentes.length > 0) return bloqueioTdd({ motivo: 'tipo-divergente', detalhe: `tipo dos testes diverge do Tipo da SPEC: ${tiposDivergentes.map(c => `${c} (SPEC: ${rotuloTipo(c)}; testes: ${[...new Set(tdd.testes.filter(t => t.criterio === c).map(t => t.tipo === 'reproducao' ? 'reprodução' : 'preservação'))].join(' e ')})`).join(', ')}`, acao: 'o Tipo de cada critério é o da coluna Tipo da SPEC aprovada; só ela conta (sufixo "(R)"/"(P)" no texto do critério não é lido; coluna ausente ou célula vazia vale reprodução). Critério de reprodução precisa de pelo menos um teste de reprodução; critério de preservação só tem controles. Teste com o tipo errado: reescrever no tipo da SPEC. Tipo errado na SPEC: mudar a coluna Tipo é decisão do dono (entregar, Step 4c) e vale em run novo; o operário não reclassifica' })
const criteriosComTeste = new Set(tdd.testes.map(t => t.criterio))
const semProva = spec.criterios.filter(c => !criteriosComTeste.has(c.id) && !idsManuais.has(c.id))
if (semProva.length > 0) return bloqueioTdd({ detalhe: `critérios sem teste executável nem verificacaoComplementar explícita: ${semProva.map(c => c.id).join(', ')}`, acao: 'mapear cada critério funcional a um teste; validação genérica não substitui esse vínculo' })
// Apoio do portão (2.6.0): helpers e fixtures de teste. Fica fora da detecção de implementação
// anterior e entra na cópia da base. Path que não é do workspace sai da lista (conta como
// implementação: falha fechada). Apoio declarado num arquivo de unidade é produção, não apoio:
// sem esta checagem, declará-lo escondia código da detecção.
const apoioDoTdd = [...new Set((Array.isArray(tdd.apoio) ? tdd.apoio : []).map(p => typeof p === 'string' ? pathNoWorkspace(p) : null).filter(p => p && !testesDaSpec.includes(p)))]
const apoioEmUnidade = apoioDoTdd.filter(emArquivoDeUnidade)
if (apoioEmUnidade.length > 0) return bloqueioTdd({ detalhe: `apoio do portão declarado em arquivo de unidade de trabalho: ${apoioEmUnidade.join(', ')}`, acao: 'o portão TDD não implementa produção: apoio é helper ou fixture de teste. Retirar o path de apoio (ou mover o helper para fora da unidade) e repetir o portão em run novo' })

// Identidade de cada teste no run: T1..Tn na ordem do portão. É ela que liga a execução
// independente, a validação de cada iteração e o relatório ao critério e ao tipo do teste.
const testesNumerados = tdd.testes.map((t, i) => ({ id: `T${i + 1}`, criterio: t.criterio, path: pathCanonico(t.path), tipo: t.tipo, comando: t.comando.trim(), motivoFalha: t.motivoFalha }))
const idsTestes = testesNumerados.map(t => t.id)
const listaDeTestes = testesNumerados.map(t => `  - ${t.id} (critério ${t.criterio}, ${t.tipo}): \`${t.comando}\``).join('\n')
// Natureza de uma falha de validação (2.6.0). Só pode PARAR o run (tudo ambiente) ou informar o
// operário e o humano; nunca aprova nada.
const NATUREZAS_FALHA = ['funcional', 'ambiente', 'indeterminada']
const INSTRUCAO_TIPO_FALHA = `tipoFalha: "nenhuma" quando saiu 0; "assercao" SOMENTE para falha funcional (asserção sobre
  comportamento ausente ou quebrado); "infra" para sintaxe, import, módulo ausente, configuração,
  timeout ou ambiente. Erro de import, sintaxe ou infraestrutura nunca conta como vermelho.`

// Uma execução por teste, lida do mesmo jeito no portão e na validação: falta, repetição ou id
// desconhecido vira problema nomeado; o mapa só guarda execução única.
function lerExecucoes(execucoes) {
  const mapa = new Map()
  const problemas = []
  const repetidos = new Set()
  for (const e of Array.isArray(execucoes) ? execucoes : []) {
    if (!e || !idsTestes.includes(e.teste)) { problemas.push(`execução de teste desconhecido: ${e && e.teste}`); continue }
    if (mapa.has(e.teste) || repetidos.has(e.teste)) { repetidos.add(e.teste); mapa.delete(e.teste); continue }
    mapa.set(e.teste, e)
  }
  for (const id of repetidos) problemas.push(`execução repetida para ${id}`)
  const faltando = idsTestes.filter(id => !mapa.has(id) && !repetidos.has(id))
  if (faltando.length) problemas.push(`sem execução independente para ${faltando.join(', ')}`)
  return { mapa, problemas }
}
// Por que um resultado não serve de evidência (null = serve): exit 0 só com "nenhuma" e com pelo
// menos um caso executado; exit≠0 só com asserção (que pressupõe caso executado) ou infra.
function semValor(r) {
  if (!['assercao', 'infra', 'nenhuma'].includes(r.tipoFalha) || typeof r.exitZero !== 'boolean' || !Number.isInteger(r.casos) || r.casos < 0) return 'resultado incoerente'
  if (r.exitZero) return r.tipoFalha !== 'nenhuma' ? 'resultado incoerente' : r.casos === 0 ? 'saiu 0 sem executar nenhum caso' : null
  if (r.tipoFalha === 'nenhuma' || (r.tipoFalha === 'assercao' && r.casos === 0)) return 'resultado incoerente'
  return r.tipoFalha === 'infra' ? 'erro de import, sintaxe ou infraestrutura' : null
}

// Relatório do portão: o que foi MEDIDO fica como foi medido. Exceção e rebaseline entram em
// `continuidade`; `vermelhoConfirmado` e `violacoes` nunca são reescritos por eles.
// Desde a 2.6.0 o relatório também guarda o resultado medido de cada teste (`execucoes`: o Log de
// um run verde mostrava que houve vermelho, não qual nem com que comando), onde foi medido (`modo`,
// `baseRef`, `copia`), o que já mudara antes da implementação (`implementacaoPreexistente`, medido
// por git) e a declaração do operário, que nunca decide nada mas não pode sumir do Log.
let violacoesDoPortao = []
let continuidadeDoPortao = null
let execucoesDoPortao = []
let implementacaoPreexistente = null
let copiaDaBase = null
const relatorioTdd = () => ({
  testes: testesNumerados.length, paths: testesDaSpec,
  // Sem teste nenhum (SPEC só de verificação manual) nada foi medido: não é vermelho confirmado.
  vermelhoConfirmado: testesNumerados.length > 0 && violacoesDoPortao.length === 0,
  reproducoes: testesNumerados.filter(t => t.tipo === 'reproducao').map(t => ({ teste: t.id, criterio: t.criterio, path: t.path })),
  preservacoes: testesNumerados.filter(t => t.tipo === 'preservacao').map(t => ({ teste: t.id, criterio: t.criterio, path: t.path })),
  complementares,
  violacoes: violacoesDoPortao,
  continuidade: continuidadeDoPortao,
  modo: naBase ? 'base' : 'worktree', baseRef: ARGS.baseRef ?? null, copia: copiaDaBase,
  execucoes: execucoesDoPortao,
  implementacaoPreexistente,
  apoio: apoioDoTdd,
  declaracaoDoOperario: { vermelhoConfirmado: tdd.vermelhoConfirmado, problemas: Array.isArray(tdd.problemas) ? tdd.problemas : [] },
})

// VERMELHO VERIFICADO, não declarado. Até 2026-09-02 `vermelhoConfirmado` era a palavra do
// mesmo agente que escreveu os testes. Desde a 2.5.0 o mecânico (step `validar`) roda CADA teste
// pelo próprio comando e o controlador classifica: reprodução vermelha por asserção é vermelho
// válido; reprodução verde e suíte sem reprodução são ausência de vermelho; controle vermelho e
// infraestrutura bloqueiam sem exceção possível. Os hashes que ele devolve são a baseline do
// check de testes intactos, comparada em código a cada iteração (abaixo, na auditoria).

// Evidência de hash que não confere NÃO vira "teste alterado": o que falhou foi o transporte,
// não o arquivo. Recolhe UMA vez no piso do papel (operário/sonnet), em chamada própria e sem
// mais nada no contexto do agente; se ainda assim não conferir, é erro de evidência. Vale para a
// base do portão e para cada validação — transcrição errada na BASE fazia toda validação correta
// divergir até o teto. A recoleta vai pro relatório em `fallbacks`, não acontece em silêncio.
async function hashesConferidos(transportado, label, fase) {
  try { return normalizarHashes(transportado, testesDaSpec) }
  catch (primeira) {
    log(`Evidência de hashes não conferiu (${primeira.message}) — recoleta única em ${label}`)
    fallbacksModelo.push({ step: 'validar', chamada: label, de: execucoesPorStep.validar, para: 'sonnet (operario)', causa: `evidência de hashes não conferiu: ${primeira.message}; recoleta única, sem relação com disponibilidade de modelo` })
    registrarExec('validar', 'sonnet (recoleta de hashes)')
    const r = await tentar(
      `Execute somente este comando, sem editar nada:
      \`\`\`bash
      ${comandoHashes(testesDaSpec)}
      \`\`\`
      Copie o JSON do stdout em hashesDosTestes, caractere por caractere. Cada valor tem a forma
      <sha256>-<conferência>: o controlador recalcula a conferência e recusa transcrição errada.
      Se o comando falhar, não invente valores.`,
      { ...OPERARIO, ...(TIERING.validar.effort ? { effort: TIERING.validar.effort } : {}), label, phase: fase, schema: HASHES_SCHEMA }
    )
    if (!r) throw new Error(`${primeira.message}; a recoleta não retornou`)
    try { return normalizarHashes(r.hashesDosTestes, testesDaSpec) }
    catch (segunda) { throw new Error(`${primeira.message}; recoleta: ${segunda.message}`) }
  }
}

let hashesBase = {}
if (testesNumerados.length > 0) {
  const comandoAlteracoes = `cd ${shellQuote(ARGS.workspaceRoot)} && node ${shellQuote(ARGS.scriptsDir + '/inspecionar-git.mjs')} alteracoes${ARGS.baseRef ? ` ${shellQuote(ARGS.baseRef)}` : ''}`
  const comandoCopiaBase = naBase ? `cd ${shellQuote(ARGS.workspaceRoot)} && node ${shellQuote(ARGS.scriptsDir + '/copia-base.mjs')} criar ${shellQuote(ARGS.baseRef)} ${shellQuote(JSON.stringify(testesDaSpec))}${apoioDoTdd.length ? ` --apoio ${shellQuote(JSON.stringify(apoioDoTdd))}` : ''}` : ''
  const passoDaBase = naBase ? `
    O vermelho desta rodada é medido na BASE ${ARGS.baseRef}, não na worktree: a implementação já existe nela e NÃO deve ser revertida, stashada nem editada.
    A. Crie a cópia descartável da base com os testes atuais:
    \`\`\`bash
    ${comandoCopiaBase}
    \`\`\`
    Se o runner precisar das dependências do projeto, repita o comando acrescentando --vincular '["<dir de dependências>"]' (ex.: node_modules ou .venv). Diretório temporário sem escrita: acrescente --pai <dir gravável fora do workspace>. Rode o comando de CADA teste abaixo, sem mudá-lo, DENTRO do diretório "dir" devolvido, e confira que o código importado vem da cópia (install editável ou pacote de workspace apontam para a implementação). Na base, módulo NOVO desta entrega ainda não existe: quando o teste falha porque um import não acha um arquivo, use tipoFalha "infra" e ponha em moduloAusente o path desse arquivo relativo à raiz do workspace; o controlador confere se a entrega o cria. Depois remova a cópia com "remover <dir>" do mesmo script e copie em copiaBase: sha e hashesDosTestes do JSON da cópia, vinculados, e removida=true só se a remoção saiu 0.` : ''
  const vermelho = await chamarOperario('validar',
    `Execução INDEPENDENTE do portão TDD na branch ${ARGS.branch}: rode CADA teste da SPEC
    separadamente, ${naBase ? 'dentro da cópia da base (passo A)' : 'da raiz do workspace'}, com o comando indicado, e devolva um item de execucoes por teste:${passoDaBase}
${listaDeTestes}
    exitZero=true se o comando saiu 0; false se saiu diferente de 0. ${INSTRUCAO_TIPO_FALHA}
    casos = quantos casos de teste o comando de fato executou, lido do resumo do runner (0 se o
    filtro não casou nenhum caso).
    Resuma a saída em resumo. Não corrija nada. Para os hashes, execute exatamente:
    \`\`\`bash
    ${comandoHashes(testesDaSpec)}
    \`\`\`
    Copie o JSON do script em hashesDosTestes sem trocar chaves nem acrescentar :linha.
    Cada valor tem a forma <sha256>-<conferência>: copie o valor inteiro, caractere por
    caractere — o controlador recalcula a conferência e recusa transcrição errada.
    O SHA é calculado pelo Node. Se o comando falhar, não invente hashes.
    Para as alterações anteriores à implementação, execute exatamente, da raiz do workspace:
    \`\`\`bash
    ${comandoAlteracoes}
    \`\`\`
    Copie o JSON em alteracoes. Se o comando falhar, devolva alterados e adicionados vazios e a
    mensagem em erro; não invente nomes.`,
    { label: 'tdd:vermelho', phase: 'TDD', schema: { type: 'object', additionalProperties: false, required: ['execucoes', 'hashesDosTestes', 'alteracoes', ...(naBase ? ['copiaBase'] : [])], properties: {
      execucoes: execucoesSchema(idsTestes, naBase), hashesDosTestes: { type: 'object', additionalProperties: { type: 'string' } },
      alteracoes: ALTERACOES_SCHEMA, ...(naBase ? { copiaBase: COPIA_BASE_SCHEMA } : {}),
    } } }
  )
  if (!vermelho) return { quality: qualityReport, status: 'erro', fase: 'TDD', detalhe: 'a execução independente dos testes da SPEC não retornou', acao: 'sem ela o vermelho é só declarado; reinvocar com resumeFromRunId', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
  const lidas = lerExecucoes(vermelho.execucoes)
  if (lidas.problemas.length > 0) return { quality: qualityReport, status: 'erro', fase: 'TDD', detalhe: `evidência da execução independente incompleta: ${lidas.problemas.join('; ')}`, acao: 'cada teste da SPEC precisa de exatamente uma execução reportada; repetir o portão em run novo (resumeFromRunId devolveria a mesma resposta)', fallbacks: fallbacksModelo, modelos: relatorioModelos() }

  // Implementação anterior ao portão, MEDIDA por git (2.6.0): reprodução verde tem duas causas,
  // critério já atendido ou implementação feita antes do portão, e só a lista de arquivos alterados
  // as separa. A SPEC (commitada só depois, na entregar), o apoio do portão e as pendências não são
  // implementação. Helper que falhou deixa a detecção indeterminada (null), nunca "nada mudou".
  // As pendências só saem quando a base não as tem (adicionadas): o arquivo de pendências nunca é
  // commitado, e um pendenciasPath que a base já tem é código rastreado, que conta.
  const alt = objetoPlano(vermelho.alteracoes) ? vermelho.alteracoes : null
  const altOk = !!alt && !textoCheio(alt.erro) && Array.isArray(alt.alterados) && Array.isArray(alt.adicionados)
  const listaDoGit = l => [...new Set(l.filter(textoCheio).map(p => pathCanonico(p)))]
  const adicionadosDesdeABase = new Set(altOk ? listaDoGit(alt.adicionados) : [])
  const naoImplementacao = new Set([...testesDaSpec, ...apoioDoTdd, pathNoWorkspace(ARGS.specPath), PENDENCIAS !== null && !pendenciasNaAreaDeTrabalho && adicionadosDesdeABase.has(PENDENCIAS) ? PENDENCIAS : null].filter(Boolean))
  const alteradosAntes = altOk ? listaDoGit(alt.alterados).filter(p => !naoImplementacao.has(p)) : []
  implementacaoPreexistente = { detectada: altOk ? alteradosAntes.length > 0 : null, comparadoCom: alt && typeof alt.comparadoCom === 'string' ? alt.comparadoCom : null, arquivos: alteradosAntes,
    ...(altOk ? {} : { erro: alt && textoCheio(alt.erro) ? alt.erro : 'alterações não reportadas pela execução independente' }) }
  if (naBase) copiaDaBase = objetoPlano(vermelho.copiaBase) ? { sha: vermelho.copiaBase.sha, vinculados: Array.isArray(vermelho.copiaBase.vinculados) ? vermelho.copiaBase.vinculados : [], removida: vermelho.copiaBase.removida === true } : null

  // Decisão do dono (2026-11-02): na cópia da base, reprodução que falha por import de um arquivo
  // que a entrega CRIA (adicionado contra a base, medido por git) é o comportamento ausente, ou
  // seja, vermelho válido. Qualquer outro import, sintaxe ou infra continua evidência inválida.
  const moduloCriadoPelaEntrega = (t, r) => {
    if (!naBase || t.tipo !== 'reproducao' || r.exitZero !== false || r.tipoFalha !== 'infra' || !textoCheio(r.moduloAusente)) return false
    const k = pathNoWorkspace(r.moduloAusente)
    return !!k && adicionadosDesdeABase.has(k) && !naoImplementacao.has(k)
  }
  execucoesDoPortao = testesNumerados.map(t => {
    const r = lidas.mapa.get(t.id)
    return { teste: t.id, criterio: t.criterio, tipo: t.tipo, comando: t.comando, exitZero: r.exitZero, tipoFalha: r.tipoFalha, casos: r.casos, resumo: typeof r.resumo === 'string' ? r.resumo : '',
      ...(textoCheio(r.moduloAusente) ? { moduloAusente: r.moduloAusente, moduloCriadoPelaEntrega: moduloCriadoPelaEntrega(t, r) } : {}) }
  })
  for (const t of testesNumerados) {
    const r = lidas.mapa.get(t.id)
    const base = { teste: t.id, criterio: t.criterio, path: t.path, resumo: typeof r.resumo === 'string' ? r.resumo : '' }
    if (moduloCriadoPelaEntrega(t, r)) continue
    const razao = semValor(r)
    if (razao) violacoesDoPortao.push({ tipo: 'evidencia-invalida', razao, ...base })
    else if (t.tipo === 'reproducao' && r.exitZero) violacoesDoPortao.push({ tipo: 'reproducao-verde', ...base })
    else if (t.tipo === 'preservacao' && !r.exitZero) violacoesDoPortao.push({ tipo: 'controle-vermelho', ...base })
  }
  // Suíte sem NENHUM vermelho válido (Apêndice 4): nada na suíte prova que a mudança é necessária,
  // então todo critério com teste entra como ausência de vermelho, inclusive os só de controle.
  // Reprodução verde num critério também entra (`reproducao-verde`, acima).
  const vermelhosValidos = testesNumerados.filter(t => t.tipo === 'reproducao' && !violacoesDoPortao.some(v => v.teste === t.id) && lidas.mapa.get(t.id).exitZero === false)
  if (vermelhosValidos.length === 0) {
    for (const criterio of [...new Set(testesNumerados.map(t => t.criterio))]) violacoesDoPortao.push({ tipo: 'suite-sem-vermelho', criterio })
  }
  // Base de hashes do check de testes intactos e, na base, os bytes que a cópia executou. Na
  // worktree roda depois dos bloqueios do portão; na base, junto da conferência do sha da cópia,
  // antes deles (abaixo). Devolve o relatório de erro, ou null quando conferiu.
  const conferirHashesDoPortao = async () => {
    try { hashesBase = await hashesConferidos(vermelho.hashesDosTestes, 'tdd:hashes', 'TDD') }
    catch (e) { return { quality: qualityReport, status: 'erro', fase: 'TDD', detalhe: e.message, acao: 'a base de hashes não conferiu nem na recoleta, e sem base verificada não há como provar testes intactos; nada foi implementado ainda: iniciar run novo (resumeFromRunId devolveria as mesmas respostas do cache)', tdd: relatorioTdd(), fallbacks: fallbacksModelo, modelos: relatorioModelos() } }
    if (!naBase) return null
    // A cópia precisa ter executado os MESMOS bytes de teste que ficam congelados na worktree.
    let hashesDaCopia
    try { hashesDaCopia = normalizarHashes(vermelho.copiaBase && vermelho.copiaBase.hashesDosTestes, testesDaSpec) }
    catch (e) { return { quality: qualityReport, status: 'erro', fase: 'TDD', detalhe: `evidência da cópia da base não conferiu: ${e.message}`, acao: 'iniciar run novo com os mesmos args; a worktree não foi alterada e nada foi implementado', tdd: relatorioTdd(), fallbacks: fallbacksModelo, modelos: relatorioModelos() } }
    const divergentes = testesDaSpec.filter(p => hashesDaCopia[p] !== hashesBase[p])
    if (divergentes.length) return { quality: qualityReport, status: 'erro', fase: 'TDD', detalhe: `a cópia da base não executou os testes atuais da worktree: ${divergentes.join(', ')}`, acao: 'iniciar run novo; o vermelho precisa ser medido com os mesmos bytes de teste que ficam congelados na worktree', tdd: relatorioTdd(), fallbacks: fallbacksModelo, modelos: relatorioModelos() }
    return null
  }
  // Origem da cópia conferida (2.6.0, decisão 13, furo 3): o schema exigia copiaBase.sha, mas nada
  // o comparava com a base pedida, e uma cópia de outro commit passava, com o vermelho (ou a
  // ausência dele) medido nela valendo como medido na base. Divergência é erro de transporte, antes
  // de qualquer bloqueio: diagnóstico "na base" tirado de outra cópia mandaria cortar critério ou
  // pedir autorização pelo motivo errado. O relatório leva a medição como foi feita.
  // Revisão da decisão 13: alteracoes só confere a cópia se mediu a MESMA baseRef: o helper
  // devolve em comparadoCom a ref que recebeu, e com outra ref no comando a detecção de
  // implementação anterior foi medida contra outra base.
  // Decisão 24 do dono (2026-11-03): a baseRef é o SHA completo, em minúsculas desde Args, e os
  // helpers devolvem o sha em minúsculas. O sha da cópia e o de alteracoes, quando vem, são IGUAIS a
  // ela, sem diferença de caixa; a leitura por prefixo, que não separava commits com o mesmo
  // prefixo quando alteracoes vinha sem sha, deixou de existir. Resta o SHA de tag anotada, que o
  // git descasca até o commit: os dois shas concordam entre si e não com a baseRef.
  if (naBase) {
    const shaCopia = objetoPlano(vermelho.copiaBase) ? vermelho.copiaBase.sha : undefined
    const razoes = []
    if (altOk && alt.comparadoCom !== ARGS.baseRef) razoes.push(`alteracoes mediu outra base: comparadoCom ${JSON.stringify(alt.comparadoCom ?? null)}, não a baseRef ${ARGS.baseRef}`)
    if (altOk && typeof alt.sha === 'string' && alt.sha !== ARGS.baseRef) razoes.push(`alteracoes resolveu a base para ${alt.sha || '(vazio)'}, não para a baseRef ${ARGS.baseRef}`)
    if (typeof shaCopia !== 'string' || !SHA_COMPLETO.test(shaCopia)) razoes.push(`copiaBase.sha ausente ou malformado (${JSON.stringify(shaCopia ?? null)}): esperado hex de 40 ou 64 caracteres minúsculos, como copia-base.mjs devolve`)
    else if (shaCopia !== ARGS.baseRef) razoes.push(`copiaBase.sha ${shaCopia} não é a baseRef ${ARGS.baseRef} (se ela é SHA de tag anotada, o git a resolve para o commit, que sai de git rev-parse --verify '${ARGS.baseRef}^{commit}')`)
    if (razoes.length) return { quality: qualityReport, status: 'erro', fase: 'TDD', detalhe: `a cópia da base não confere com a base pedida ${ARGS.baseRef}: ${razoes.join('; ')}. O vermelho medido nela não vale como vermelho na base`, acao: 'repetir o portão em run novo com a mesma baseRef e vermelhoNaBase=true (resumeFromRunId devolveria as mesmas respostas do cache), conferindo a cópia: copia-base.mjs criar e inspecionar-git.mjs alteracoes rodam com essa baseRef e o sha de cada JSON é copiado inteiro, caractere por caractere. Se a baseRef é SHA de tag anotada, o run novo leva a mesma base pelo SHA do commit (git rev-parse --verify \'<baseRef>^{commit}\'). A worktree NÃO é revertida nem stashada; nada foi implementado', tdd: relatorioTdd(), fallbacks: fallbacksModelo, modelos: relatorioModelos() }
    // A outra prova de que a cópia é a certa, os bytes de teste que ela executou, também vem antes
    // de qualquer bloqueio: cópia com o sha certo e outros bytes que mediu a reprodução verde saía
    // "sem vermelho na base" e mandava cortar o critério ou pedir autorização.
    const erroDosHashes = await conferirHashesDoPortao()
    if (erroDosHashes) return erroDosHashes
  }
  const descrever = vs => vs.map(v => v.teste ? `${v.teste} (${v.criterio})${v.razao ? `: ${v.razao}` : ''}${v.resumo ? ` — ${v.resumo}` : ''}` : v.criterio).join('; ')

  const invalidas = violacoesDoPortao.filter(v => v.tipo === 'evidencia-invalida')
  if (invalidas.length > 0) return bloqueioTdd({ motivo: 'evidencia-invalida', detalhe: `evidência inválida na execução independente: erro de import, sintaxe ou infraestrutura nunca conta como vermelho, nem resultado incoerente${naBase ? ' (na base, só conta o import de arquivo que a entrega cria, relatado em moduloAusente e adicionado contra a base)' : ''}. ${descrever(invalidas)}`, acao: 'corrigir o ambiente ou o próprio teste e repetir o portão em run novo, antes de qualquer implementação; nenhuma autorização cobre evidência inválida', tdd: relatorioTdd() })
  const controlesVermelhos = violacoesDoPortao.filter(v => v.tipo === 'controle-vermelho')
  // Controle vermelho num arquivo que também tem reprodução: o primeiro suspeito é o comando que
  // roda o arquivo inteiro e mede a reprodução junto. A ação manda conferir isso antes; com o Tipo
  // vindo da SPEC, "reclassificar" não é saída do operário.
  const dividem = controlesVermelhos.map(v => [v, testesNumerados.filter(t => t.tipo === 'reproducao' && t.path === v.path)]).filter(([, rs]) => rs.length)
  const notaDivide = dividem.map(([v, rs]) => `${v.teste} divide ${v.path} com a reprodução ${rs.map(r => r.id).join(', ')}`).join('; ')
  if (controlesVermelhos.length > 0) return bloqueioTdd({ motivo: 'controle-vermelho', detalhe: `controle de preservação vermelho antes da implementação: ${descrever(controlesVermelhos)}${notaDivide ? ` (${notaDivide})` : ''}`, acao: `${dividem.length ? 'controle precisa nascer verde. Primeiro confira se o comando do controle isola o caso (filtro pelo nome): comando que roda o arquivo inteiro mede a reprodução junto; aí se corrige o comando ou se separam os arquivos, sem mudar o tipo. Se o comando isola, o comportamento a preservar já está quebrado ou o teste prova comportamento novo' : 'controle precisa nascer verde: o comportamento a preservar já está quebrado ou o teste prova comportamento novo'}; corrigir antes de implementar. O Tipo é da SPEC: se o critério é de reprodução, mudar a coluna Tipo é decisão do dono (Step 4c), em run novo. Nenhuma autorização cobre controle vermelho`, tdd: relatorioTdd() })

  // Ausência de vermelho: coberta por rebaseline (critério aprovado: reprodução já verde =
  // implementação anterior à retomada, declarada; controle verde numa suíte toda verde =
  // comportamento preservado) ou por autorização do dono com o critério no escopo. Qualquer
  // critério descoberto bloqueia; nada é presumido. Na cópia da base a reprodução verde NÃO é
  // implementação anterior (lá ela não existe): o rebaseline não a cobre, só autorização.
  const reproducoesVerdes = violacoesDoPortao.filter(v => v.tipo === 'reproducao-verde')
  const semVermelho = [...new Set(violacoesDoPortao.filter(v => v.tipo === 'reproducao-verde' || v.tipo === 'suite-sem-vermelho').map(v => v.criterio))]
  const porRebaseline = REBASELINE ? semVermelho.filter(c => REBASELINE.criteriosAprovados.includes(c) && !(naBase && reproducoesVerdes.some(v => v.criterio === c))) : []
  const autorizacoesUsadas = AUTORIZACOES
    .map(a => ({ criterios: a.criterios, evidencia: a.evidencia, autorizacao: a.autorizacao, ...(a.motivo !== undefined ? { motivo: a.motivo } : {}), autorizadoPor: a.autorizadoPor, registradaEm: a.registradaEm, aplicadaEm: ARGS.hoje, criteriosCobertos: semVermelho.filter(c => a.criterios.includes(c) && !porRebaseline.includes(c)) }))
    .filter(a => a.criteriosCobertos.length > 0)
  const cobertos = new Set([...porRebaseline, ...autorizacoesUsadas.flatMap(a => a.criteriosCobertos)])
  const descobertos = semVermelho.filter(c => !cobertos.has(c))
  if (descobertos.length > 0) {
    const partes = []
    if (reproducoesVerdes.length) partes.push(`os testes de reprodução ${reproducoesVerdes.map(v => `${v.teste} (${v.criterio})`).join(', ')} passaram ${naBase ? `na base ${ARGS.baseRef}` : 'antes de qualquer implementação'}`)
    if (violacoesDoPortao.some(v => v.tipo === 'suite-sem-vermelho')) partes.push('a suíte não tem nenhum vermelho válido (nenhuma reprodução falhando por asserção)')
    const detalhe = `sem vermelho válido nos critérios ${descobertos.join(', ')}: ${partes.join('; ')}`
    // O operário disse "não" e a medição não mostra o que ele relatou: reconciliar vem antes de
    // cortar, reescrever ou pedir autorização (o relato pode ser import quebrado que o mecânico não viu).
    const reconciliar = tdd.vermelhoConfirmado || naBase ? '' : 'o operário não confirmou o vermelho e a medição não mostra o que ele relatou: reconcilie primeiro, rodando de novo o comando de cada teste e comparando com o relato (tdd.declaracaoDoOperario); só depois disso vale o que segue. '
    if (!naBase && implementacaoPreexistente.detectada === true && reproducoesVerdes.some(v => descobertos.includes(v.criterio))) {
      return bloqueioTdd({ motivo: 'implementacao-preexistente', detalhe: `${detalhe}; e há arquivos fora dos testes, do apoio, da SPEC e das pendências alterados antes da implementação (contra ${implementacaoPreexistente.comparadoCom}): ${implementacaoPreexistente.arquivos.join(', ')}`, acao: `${reconciliar}NÃO reverta a worktree nem faça stash. Se a implementação antecede o portão (retomada tardia), reinvoque em run novo com baseRef = SHA completo do merge-base com a branchBase e vermelhoNaBase=true: o vermelho é medido numa cópia descartável da base e a worktree fica intacta. Se a base não puder ser medida, reinvoque com rebaselineTdd explícito (critérios aprovados pelo dono). Se o critério já estava atendido antes desta entrega, cortá-lo da SPEC; se o teste não exercita o critério, reescrevê-lo`, tdd: relatorioTdd() })
    }
    const acaoNaBase = `na base ${ARGS.baseRef} a reprodução passou: o teste não exercita o critério (reescrever), o critério já estava atendido na base (cortar) ou a cópia importou a implementação do workspace (dependência vinculada que aponta para ele: install editável ou pacote de workspace). Na base, rebaselineTdd não cobre reprodução verde; continuar sem vermelho só com autorização registrada do dono em autorizacoesTdd (escopo, evidência, citação literal, autor e data, em perfil maximo)`
    return bloqueioTdd({ motivo: 'sem-vermelho', detalhe, acao: `${reconciliar}${naBase && reproducoesVerdes.length ? acaoNaBase : ACAO_SEM_VERMELHO}`, tdd: relatorioTdd() })
  }
  if (porRebaseline.length > 0 || autorizacoesUsadas.length > 0) {
    const ia = objetoPlano(tdd.implementacaoAnterior) ? tdd.implementacaoAnterior : {}
    continuidadeDoPortao = {
      rebaseline: porRebaseline.length > 0 ? {
        criteriosAprovados: REBASELINE.criteriosAprovados, motivo: REBASELINE.motivo, autorizadoPor: REBASELINE.autorizadoPor,
        registradaEm: REBASELINE.registradaEm, aplicadaEm: ARGS.hoje, criteriosCobertos: porRebaseline,
        // `declaradaPeloOperario` é a palavra dele; `detectadaPorGit` e `arquivos`, o que o git mediu.
        // Evidência lado a lado, sem reclassificar critério.
        implementacaoAnterior: { criterios: porRebaseline.filter(c => reproducoesVerdes.some(v => v.criterio === c)), declaradaPeloOperario: ia.detectada === true, evidencias: Array.isArray(ia.evidencias) ? ia.evidencias : [], detectadaPorGit: implementacaoPreexistente.detectada, arquivos: implementacaoPreexistente.arquivos },
      } : null,
      autorizacoes: autorizacoesUsadas,
    }
    log(`Portão TDD sem vermelho em ${[...cobertos].join(', ')}: continuidade explícita registrada (${porRebaseline.length ? 'rebaseline' : ''}${porRebaseline.length && autorizacoesUsadas.length ? ' + ' : ''}${autorizacoesUsadas.length ? 'autorização do dono' : ''})`)
  }
  // O "não" do operário (2.6.0) só é ignorado quando TODO critério com teste ficou coberto por
  // exceção ou rebaseline medidos: cobrir C2 não desligava o veto sobre C1 (motivo errado que o
  // exit não mostra). Sem exceção, vale depois da medição, que não achou violação que o explique.
  // Na cópia da base também vale: lá o "não" diz que os testes não estão prontos ou não cobrem os
  // critérios (a única definição do prompt nesse modo), e o vermelho medido na cópia não mostra isso.
  const foraDaCobertura = [...new Set(testesNumerados.map(t => t.criterio))].filter(c => !cobertos.has(c))
  if (!tdd.vermelhoConfirmado && foraDaCobertura.length > 0) {
    const porque = cobertos.size ? `a exceção cobre ${[...cobertos].join(', ')}; o não vale para ${foraDaCobertura.join(', ')}` : naBase ? `o operário declarou que os testes não estão prontos ou não cobrem ${foraDaCobertura.join(', ')}; o vermelho medido na base ${ARGS.baseRef} não mostra se o teste cobre o critério` : 'a execução independente mediu vermelho válido; a divergência está no que o operário relatou'
    const acao = naBase
      ? `na retomada sobre a base o "não" do operário diz que os testes não estão prontos ou não cobrem os critérios (leia problemas): completar ou reescrever os testes e repetir o portão em run novo com os mesmos baseRef e vermelhoNaBase. A worktree NÃO é revertida nem stashada; a implementação continua nela`
      : 'o operário não confirmou o vermelho e a execução independente não mediu nada que explique (o resultado de cada teste está em tdd.execucoes): leia problemas. Se o comportamento já existe na worktree, NÃO reverta nem faça stash: reinvocar em run novo com baseRef + vermelhoNaBase ou com rebaselineTdd. Teste que não exercita o caso ou que falha pelo motivo errado → reescrever o teste e repetir o portão em run novo'
    return { quality: qualityReport, status: 'bloqueado', fase: 'TDD', motivo: 'nao-confirmado', detalhe: `${problemasDoOperario || 'vermelho não confirmado'} (${porque})`, acao, tdd: relatorioTdd(), fallbacks: fallbacksModelo, modelos: relatorioModelos() }
  }
  if (!naBase) {
    const erroDosHashes = await conferirHashesDoPortao()
    if (erroDosHashes) return erroDosHashes
  } else if (!copiaDaBase || !copiaDaBase.removida) log('Cópia da base não foi removida pelo mecânico: ver tdd.copia no relatório')
  if (implementacaoPreexistente.detectada) log(`Portão TDD: ${implementacaoPreexistente.arquivos.length} arquivo(s) fora dos testes alterado(s) antes da implementação: ver tdd.implementacaoPreexistente`)
}

// ── Fases 3-5: loop implementar → validar → revisar ─────────────────────────
const consultasLog = []
const arquivosParaRevisao = new Set(testesDaSpec)
const historicoFalhas = []
const escadaReportada = []
const auditoriasLog = []
const dependenciasDecididas = []
const pendenciasForaDeEscopo = []
const pendenciasEmTestesDaSpec = []
const duplicacoesEAbstracoesJulgadas = []

// Usada nos QUATRO desfechos (escalada por unidade, erro de validação, escalada por teto, verde).
// Numa escalada por dependência barrada, é este bloco que explica por que o loop não convergiu —
// omiti-lo justamente aí seria esconder o diagnóstico.
const ponytailAteAgora = () => ({
  escada: escadaReportada,                                 // em que degrau cada coisa criada parou
  auditorias: auditoriasLog,                               // linhas são ACUMULADAS da branch (P13)
  dependencias: dependenciasDecididas,                     // P10: uma entrada por dependência, com a decisão VIGENTE
  duplicacoesEAbstracoes: duplicacoesEAbstracoesJulgadas,  // com o veredito de cada uma (fato E severidade), não só a alegação
  pendenciasForaDeEscopo,                                  // P14: reportado, nunca retrabalhado
  pendenciasEmTestesDaSpec,                                // P2/P11 em teste congelado: reportado sem julgamento, nunca retrabalhado
})
// Reuso de validação (2.5.0): registro do que NÃO rodou de novo, e da última árvore validada.
const validacoesReaproveitadas = []
let ultimaValidacao = { impressao: null, reaproveitada: false }
let iteracao = 0
let verde = false
let findingsAbertos = []
let houveTrabalhoNaBranch = false   // latch: alguma unidade já produziu diff? (guarda de auditoria cega)

while (iteracao < MAX_ITERACOES && !verde) {
  iteracao++
  phase('Implementar')
  log(`Iteração ${iteracao}/${MAX_ITERACOES} — ${spec.unidades.length} unidade(s), ${perfil.paralelo ? 'paralelo' : 'sequencial'}`)

  const correcoes = iteracao === 1 ? '' : `\nCORREÇÕES DESTA ITERAÇÃO (obrigatórias): ${JSON.stringify(historicoFalhas[historicoFalhas.length - 1])}`

  // agent() pode LANÇAR, não só devolver null. Sem esta rede, uma exceção no ramo sequencial
  // (perfil Econômico; perfil inválido é erro de args desde a 2.6.0) mata o workflow
  // inteiro: sem status, sem histórico, sem ponytail, e sem o trabalho das unidades que já
  // fecharam. `parallel` já converte exceção em null; o ramo sequencial não tinha nada.
  const implementarUnidade = async (u) => {
    try {
      return await executarUnidade(u)
    } catch (e) {
      return { unidade: u.id, status: 'erro', motivo: `exceção durante a execução da unidade: ${e && e.message ? e.message : String(e)}` }
    }
  }

  const executarUnidade = async (u) => {
    let consultasUsadas = 0
    let orientacao = ''
    for (;;) {
      const r = await chamarOperario('impl',
        `Implemente a unidade ${u.id} — "${u.titulo}" da SPEC ${ARGS.specPath} (branch ${ARGS.branch}).
        ${qualityPrompt}
        Recorte desta unidade: ${u.arquivos}; aplique os checks pertinentes sem dispensar o piso global.
        Arquivos/área: ${u.arquivos}. Contrato com as outras unidades: ${u.contrato || 'n/a'}.
        Critérios cobertos: ${u.criterios.join(', ')}. Faça os testes desses critérios passarem SEM editá-los
        (teste de reprodução passa a verde; controle de preservação continua verde).
        Toque APENAS nos arquivos da sua unidade (P14: fora de escopo vira pendência, não diff).${orientacao}${correcoes}
        RELATO DE ESCADA (obrigatório, campo "escada"): para CADA função, arquivo ou dependência
        que você criar, um item com o que é, em que degrau da escada ponytail (1-7) você parou e
        por quê. Degrau 5 (dependência já instalada) ou dependência NOVA exigem o porquê escrito
        de por que os degraus 1-5 falharam — cite fonte acessível (arquivo:linha ou URL com âncora) e contexto; a auditoria confere P10.
        Só modificou o que já existia (corrigir linha, texto, comando, configuração), sem criar
        função, arquivo ou dependência → escada: [] e semCriacao: true. Tocou arquivos com
        escada vazia SEM semCriacao: true é relato ausente e bloqueia a unidade; a auditoria
        confronta o diff com a escada, inclusive em unidade que declarou semCriacao.
        Falha de validação com natureza "ambiente" nas correções (cache, temporário, permissão,
        ferramenta ausente) NÃO se corrige mudando código nem teste: reporte como pendência.
        Decisão de arquitetura necessária → status "bloqueada" com a consulta preenchida.`,
        { label: `impl:${u.id}`, phase: 'Implementar', schema: IMPL_SCHEMA }
      )
      if (!r) return { unidade: u.id, status: 'erro' }
      if (r.status === 'concluida') return { unidade: u.id, ...r }
      if (consultasUsadas >= MAX_CONSULTAS_POR_UNIDADE_ITERACAO) {
        return { unidade: u.id, status: 'escalada', motivo: 'teto de consultas atingido', consulta: r.consulta }
      }
      consultasUsadas++
      const resposta = await chamarArquiteto(
        `Consulta de arquitetura do operário na unidade ${u.id} (SPEC ${ARGS.specPath}):
        Contexto: ${r.consulta?.contexto}\nDecisão necessária: ${r.consulta?.decisaoNecessaria}\nOpções vistas: ${(r.consulta?.opcoes || []).join(' | ')}
        Decida (regras ponytail como critério default — P1..P7 são a escada, P10 barra dependência
        nova sem justificativa escrita) sem ampliar o escopo da SPEC. Se a consulta revela furo na SPEC, marque furoNaSpec=true.`,
        { label: `consulta:${u.id}`, phase: 'Implementar', schema: CONSULTA_SCHEMA }
      )
      if (!resposta) return { unidade: u.id, status: 'erro' }
      consultasLog.push({ iteracao, unidade: u.id, pergunta: r.consulta?.decisaoNecessaria, decisao: resposta.decisao })
      if (resposta.furoNaSpec) return { unidade: u.id, status: 'escalada', motivo: `furo na SPEC: ${resposta.porque}` }
      orientacao = `\nDECISÃO DO ARQUITETO (siga): ${resposta.decisao}. Por quê: ${resposta.porque}. Restrições: ${(resposta.restricoes || []).join('; ')}`
    }
  }

  // parallel() devolve null pro thunk que lançou. `.filter(Boolean)` sumia com a unidade: ela
  // não entrava em `escaladas`, o loop seguia com menos unidades do que a SPEC tem e podia
  // fechar verde com uma unidade nunca implementada. Null vira erro nomeado, não silêncio.
  const resultados = perfil.paralelo
    ? await emLotes(spec.unidades, implementarUnidade, (u) => ({ unidade: u.id, status: 'erro', motivo: 'a execução da unidade lançou exceção — nenhum resultado' }))
    : await emSequencia(spec.unidades, implementarUnidade)

  const escaladas = resultados.filter(r => r.status === 'escalada' || r.status === 'erro')
  if (escaladas.length > 0) {
    return { quality: qualityReport, status: 'escalado', fase: 'Implementar', iteracao, detalhe: escaladas, consultas: consultasLog, fallbacks: fallbacksModelo, modelos: relatorioModelos(), ponytail: ponytailAteAgora(), tdd: relatorioTdd(), acao: 'decisão humana necessária — o harness não improvisa' }
  }

  // Latch: uma vez que qualquer unidade tocou arquivos, a branch TEM diff. Fica true para sempre —
  // em iterações seguintes o operário pode não tocar nada (arquivosTocados vazio) e o diff acumulado
  // continua existindo. É o sinal que a guarda de auditoria cega (abaixo) cruza contra o 0 da auditoria.
  if (resultados.some(r => (r.arquivosTocados || []).length > 0)) houveTrabalhoNaBranch = true

  for (const r of resultados) for (const p of (r.arquivosTocados || [])) arquivosParaRevisao.add(p)
  const qualityTargets = [...new Set([...qualityContract.checks.filter(c => c.applicability === 'required').flatMap(c => c.paths), ...[...arquivosParaRevisao].filter(p => !testesDaSpec.includes(p))])]
  const qualitySpecPath = pathNoWorkspace(ARGS.specPath)
  const qualityInventoryPaths = [...new Set([...qualityTargets, ...testesDaSpec, ...apoioDoTdd, ...(qualitySpecPath === null ? [] : [qualitySpecPath])])]
  const qualityPendingPath = PENDENCIAS !== null && !pendenciasNaAreaDeTrabalho && !qualityInventoryPaths.includes(PENDENCIAS) ? PENDENCIAS : null

  phase('Validar')
  // Reuso da validação longa (retomada tardia): só com `rebaselineTdd.validacaoAnterior` verde,
  // os mesmos comandos e a impressão da worktree IGUAL e conferida, medida por script nesta
  // iteração. Sem mudança na árvore, repetir a suíte longa não informa nada; com qualquer dúvida
  // (impressão ausente, que não confere, diferente), roda tudo. Os testes da SPEC rodam sempre.
  let reaproveitar = false
  let impressaoAtual = null
  const anterior = REBASELINE && REBASELINE.validacaoAnterior
  if (!pendenciasNaAreaDeTrabalho && anterior && anterior.impressao !== null && validacoes.length > 0) {
    const r = await chamarOperario('validar',
      `Execute somente este comando, sem editar nada:
      \`\`\`bash
      ${comandoImpressao()}
      \`\`\`
      Copie o valor de "impressao" do JSON em impressao, caractere por caractere. O valor tem a
      forma <sha256>-<conferência>: o controlador recalcula a conferência. Se o comando falhar,
      não invente valores.`,
      { label: `impressao:i${iteracao}`, phase: 'Validar', schema: IMPRESSAO_SCHEMA }
    )
    impressaoAtual = r ? impressaoConferida(r.impressao) : null
    const mesmosComandos = JSON.stringify([...new Set(anterior.comandos)].sort()) === JSON.stringify([...new Set(validacoes)].sort())
    reaproveitar = impressaoAtual !== null && impressaoAtual === impressaoConferida(anterior.impressao) && mesmosComandos && anterior.verde === true
    if (!reaproveitar) log(`Validação anterior não reaproveitada na iteração ${iteracao}: ${impressaoAtual === null ? 'impressão ausente ou que não confere' : !mesmosComandos ? 'comandos diferentes' : anterior.verde !== true ? 'a validação anterior não foi verde' : 'a worktree mudou'}`)
  }
  // Projeto sem comandos de validação NÃO vira `{verde:true}` hardcoded: os testes da SPEC
  // sempre rodam, cada um pelo próprio comando. Verde sem nada executado é a pior mentira que
  // este harness poderia contar. SPEC só de critérios visuais tem validações e nenhum teste.
  const alvosDaValidacao = [
    validacoes.length && !reaproveitar ? `as validações do projeto: ${validacoes.join(' && ')}` : null,
    // Quebra de linha literal no template (não a sequência barra-n): o validar.mjs lê "letra,
    // dois-pontos, barra" como path de Windows.
    testesNumerados.length ? `CADA teste da SPEC separadamente, com o comando indicado, devolvendo um item de execucoes por teste:
${listaDeTestes}
   ` : null,
  ].filter(Boolean).join(' e TAMBÉM ') || 'apenas os comandos de evidência abaixo (não há validação nem teste da SPEC a executar)'
  const notaReuso = reaproveitar ? `
    As validações do projeto (${validacoes.join(' && ')}) NÃO rodam nesta iteração: a impressão da
    worktree é igual à da validação anterior verde (reaproveitada e registrada no relatório). Não as execute.` : ''
  const val = await chamarOperario('validar',
    `Rode na branch ${ARGS.branch} ${alvosDaValidacao} e confirme que passam.${notaReuso}
    Não corrija nada — só execute e reporte. verde=true SOMENTE se tudo o que você executou passou.
    Em cada execução de teste: exitZero, casos (quantos casos o comando executou, do resumo do
    runner), ${INSTRUCAO_TIPO_FALHA}
    Toda falha, inclusive de teste da SPEC (com o comando dele), entra em falhas com natureza, um
    campo DISTINTO de tipoFalha e com só estes valores: "ambiente" quando a causa é do ambiente e
    não do código (cache, temporário ou diretório de estado sem permissão de escrita, ferramenta ou
    binário ausente, rede), citando em evidencia o path ou a variável que a controla (ex.:
    UV_CACHE_DIR, TMPDIR) e a mensagem de erro do sistema; "funcional" quando falha pelo
    comportamento do código; "indeterminada" se não dá para afirmar.
    Não reescreva comandos para contornar ambiente.
    Para os hashes execute exatamente:
    \`\`\`bash
    ${comandoHashes(testesDaSpec)}
    \`\`\`
    Copie o JSON em hashesDosTestes sem reformatar chaves;
    não calcule hashes por conta própria nem acrescente anotações de linha.
    Cada valor tem a forma <sha256>-<conferência>: copie o valor inteiro, caractere por
    caractere — o controlador recalcula a conferência e recusa transcrição errada.
    Para registrar a árvore validada, execute também:
    \`\`\`bash
    ${comandoImpressao()}
    \`\`\`
    Copie o valor de "impressao" em impressaoWorktree, caractere por caractere (se o comando
    falhar, omita o campo).
    ${qualityPrompt}
    Execute nesta iteração, SEM cache, cada check required/command. Copie id, command e paths
    exatamente do contrato em qualityExecutions, com exitCode inteiro e output não vazio que
    identifique alvo e resultado. Exit 0 sem alvo/relatório não prova qualidade.
    Falha de comando de qualidade também entra em falhas, com natureza e evidencia: funcional
    segue correção; ambiente exige causa operacional; relato ausente/incoerente é erro de evidência.
    Cole em qualityInventory o JSON literal deste inventário seguro; reconcilie uninspected,
    sem omitir erro nem inventar medida. A lista inclui arquivos autorizados, testes, apoio e SPEC;
    extras exigem reconciliação explícita com o escopo. Nunca inclua notas privadas automaticamente.
    Não execute filtros ou conversores Git.
    \`\`\`bash
    cd ${shellQuote(ARGS.workspaceRoot)} && node ${shellQuote(ARGS.scriptsDir + '/inspecionar-git.mjs')} quality ${shellQuote(JSON.stringify(qualityInventoryPaths))}${ARGS.baseRef || qualityPendingPath !== null ? ' ' + shellQuote(ARGS.baseRef || 'HEAD') : ''}${qualityPendingPath !== null ? ' ' + shellQuote(qualityPendingPath) : ''}
    \`\`\``,
    { label: `validar:i${iteracao}`, phase: 'Validar', schema: { type: 'object', additionalProperties: false, required: [...(idsTestes.length ? ['verde', 'execucoes', 'hashesDosTestes'] : ['verde', 'hashesDosTestes']), 'qualityExecutions', 'qualityInventory'], properties: {
      qualityExecutions: QUALITY_EXECUTIONS_SCHEMA, qualityInventory: QUALITY_INVENTORY_SCHEMA,
      verde: { type: 'boolean' },
      // `natureza` (2.6.0) separa ambiente de regressão nas validações do projeto, que `tipoFalha`
      // (só dos testes da SPEC) não cobre. Opcional: ausente vira indeterminada no controlador.
      falhas: { type: 'array', items: { type: 'object', required: ['comando', 'resumo'], properties: { comando: { type: 'string' }, resumo: { type: 'string' }, natureza: { enum: NATUREZAS_FALHA }, evidencia: { type: 'string' } } } },
      execucoes: execucoesSchema(idsTestes),
      hashesDosTestes: { type: 'object', additionalProperties: { type: 'string' } },
      impressaoWorktree: { type: 'string' },
    } } }
  )
  if (!val) return { quality: qualityReport, status: 'erro', fase: 'Validar', iteracao, tdd: relatorioTdd(), consultas: consultasLog, fallbacks: fallbacksModelo, modelos: relatorioModelos(), ponytail: ponytailAteAgora() }
  const qualityIteration = { iteration: iteracao, executions: val.qualityExecutions, inventory: val.qualityInventory, review: [], confirmations: [], errors: [] }
  qualityHistory.push(qualityIteration)
  if (reaproveitar) validacoesReaproveitadas.push({ iteracao, impressao: impressaoAtual, comandos: [...validacoes] })
  ultimaValidacao = { impressao: pendenciasNaAreaDeTrabalho ? null : reaproveitar ? impressaoAtual : impressaoConferida(val.impressaoWorktree), reaproveitada: reaproveitar }

  let hashesAgora;
  try { hashesAgora = await hashesConferidos(val.hashesDosTestes, `hashes:i${iteracao}`, 'Validar') }
  catch (e) { return { quality: qualityReport, status: 'erro', fase: 'Validar', iteracao, tdd: relatorioTdd(), detalhe: e.message, acao: 'a evidência de hashes não conferiu nem na recoleta; isto não prova alteração do teste. resumeFromRunId devolveria as mesmas respostas do cache: conferir os testes da SPEC à mão (script de hashes contra o estado do portão) e decidir como seguir', consultas: consultasLog, fallbacks: fallbacksModelo, modelos: relatorioModelos(), ponytail: ponytailAteAgora() } }

  const qualityErrors = qualityIteration.errors
  const expectedCommands = qualityContract.checks.filter(c => c.applicability === 'required' && c.verification === 'command')
  const executedQuality = val.qualityExecutions
  if (!Array.isArray(executedQuality) || executedQuality.length !== expectedCommands.length || new Set(executedQuality.map(e => e?.id)).size !== expectedCommands.length || expectedCommands.some(c => {
    const e = executedQuality?.find(e => e?.id === c.id)
    return !e || e.command !== c.command || JSON.stringify(e.paths) !== JSON.stringify(c.paths) || !Number.isInteger(e.exitCode) || !textoCheio(e.output)
  })) qualityErrors.push('qualityExecutions: exige uma execução completa de cada comando aprovado, com mesmos paths e output do alvo.')
  if (qualityErrors.length) return { status: 'erro', fase: 'Validar', iteracao, detalhe: qualityErrors, quality: qualityReport, tdd: relatorioTdd(), acao: 'Completar evidência de execução; resultado funcional não é evidência ausente.' }

  // Natureza normalizada: fora do enum ou ausente vira indeterminada. É esta lista, não a crua,
  // que vai para o histórico, as CORREÇÕES do operário e o resumo da escalada.
  const falhasDaValidacao = (Array.isArray(val.falhas) ? val.falhas : []).map(f => ({ ...f, natureza: NATUREZAS_FALHA.includes(f.natureza) ? f.natureza : 'indeterminada' }))
  for (const execution of executedQuality) {
    if (execution.exitCode !== 0 && !falhasDaValidacao.some(f => f.comando === execution.command)) falhasDaValidacao.push({ comando: execution.command, resumo: `${execution.id}: ${execution.output}`, natureza: 'indeterminada', evidencia: execution.paths.join(', ') })
  }
  // 2.6.0 (decisão 13, furo 2): verde=true com falha listada fechava o run verde. O prompt pede
  // verde=true só se tudo passou, mas `val.verde` era lido cru na saída por ambiente, no histórico
  // e no fechamento. Normalizado uma vez aqui; daqui em diante só `validacaoVerde` é lido. A falha
  // listada segue o fluxo normal de falha e a incoerência fica no log e no histórico.
  const verdeDeclaradoComFalhas = val.verde === true && falhasDaValidacao.length > 0
  const validacaoVerde = val.verde === true && falhasDaValidacao.length === 0
  if (verdeDeclaradoComFalhas) log(`Validação incoerente na iteração ${iteracao}: declarou verde=true e listou ${falhasDaValidacao.length} falha(s); tratada como não verde`)

  // PARADA POR AMBIENTE (2.6.0). Falha que é TODA de ambiente não volta como CORREÇÕES: o operário
  // mexia em código ou teste para contornar permissão de cache ou temporário, ou o run gastava as
  // três iterações e escalava sem dizer que era ambiente. Para só quando TUDO isto vale: validação
  // não verde; toda falha com natureza ambiente; uma execução válida por teste da SPEC; cada teste
  // verde, ou infra com uma falha de ambiente do MESMO comando trazendo erro do sistema (só a
  // palavra do mecânico não basta: implementação que quebra import também sai infra); e nenhum
  // teste da SPEC alterado, decidido depois da conferência dos hashes, porque teste alterado não
  // se esconde atrás de ambiente e segue para o bloqueante. A classificação só encerra o run, nunca
  // o fecha verde; qualquer dúvida segue o loop normal.
  {
    const lidas = lerExecucoes(val.execucoes)
    const ERRO_DO_SISTEMA = /EPERM|EACCES|EROFS|ENOSPC|PermissionError|permission denied|read-only file system|no space left|command not found|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i
    const espacos = c => String(c || '').trim().split(/\s+/).join(' ')
    const comandosDeAmbiente = new Set(falhasDaValidacao.filter(f => f.natureza === 'ambiente' && ERRO_DO_SISTEMA.test(`${f.resumo || ''} ${f.evidencia || ''}`)).map(f => espacos(f.comando)))
    const testesExplicados = testesNumerados.every(t => {
      const r = lidas.mapa.get(t.id)
      if (!r) return false
      const razao = semValor(r)
      return r.exitZero === true ? razao === null : r.tipoFalha === 'infra' && razao === 'erro de import, sintaxe ou infraestrutura' && comandosDeAmbiente.has(espacos(t.comando))
    })
    const testesAlterados = testesDaSpec.filter(p => hashesAgora[p] !== hashesBase[p])
    if (!validacaoVerde && falhasDaValidacao.length > 0 && falhasDaValidacao.every(f => f.natureza === 'ambiente') && lidas.problemas.length === 0 && testesExplicados && testesAlterados.length === 0) {
      historicoFalhas.push({ iteracao, validacaoVerde, ...(verdeDeclaradoComFalhas ? { verdeDeclaradoComFalhas: true } : {}), validacoes: falhasDaValidacao, findings: [] })
      return { quality: qualityReport, status: 'erro', fase: 'Validar', motivo: 'ambiente', iteracao, detalhe: falhasDaValidacao, ...(verdeDeclaradoComFalhas ? { verdeDeclaradoComFalhas: true } : {}), historico: historicoFalhas, tdd: relatorioTdd(), validacoesReaproveitadas, consultas: consultasLog, fallbacks: fallbacksModelo, modelos: relatorioModelos(), ponytail: ponytailAteAgora(),
        acao: 'corrigir o ambiente (cache, temporário ou estado graváveis, ferramenta ausente; ver evidencia de cada falha) e iniciar run novo: resumeFromRunId devolveria esta mesma validação do cache. A implementação já está na worktree: NÃO reverta nem faça stash. O run novo leva baseRef (SHA completo do merge-base com a branchBase) com vermelhoNaBase=true, ou rebaselineTdd com os critérios aprovados, cujos autorizadoPor e registradaEm vêm de quem aprovou de fato, nunca preenchidos pelo agente; sem validacaoAnterior, porque esta validação não fechou verde. Não é regressão demonstrada da entrega, e também não foi descartada: a validação não rodou até o fim.' }
    }
  }

  const inventory = val.qualityInventory
  if (!objetoPlano(inventory) || !Array.isArray(inventory.files) || !Array.isArray(inventory.uninspected) || inventory.uninspected.length || !Array.isArray(inventory.errors) || inventory.errors.length || inventory.files.some(f => !objetoPlano(f) || !isQualityPath(f.path) || !Number.isInteger(f.lines) || f.lines < 0 || !Number.isInteger(f.bytes) || f.bytes < 0 || !['text', 'binary', 'deleted', 'symlink'].includes(f.status) || (f.status !== 'text' && f.lines !== 0) || (f.status === 'deleted' && f.bytes !== 0) || (f.status === 'symlink' && f.bytes === 0)) || new Set(inventory.files.map(f => f.path)).size !== inventory.files.length || qualityInventoryPaths.some(p => !inventory.files.some(f => f.path === p))) qualityErrors.push('qualityInventory: inventário ausente, inválido, com omissões ou erros; reconcilie todos os arquivos relatados.')
  if (!qualityErrors.length) for (const file of inventory.files) {
    if (file.status === 'text' && file.lines > 400 && !qualityContract.decomposition.some(d => d.path === file.path)) qualityErrors.push(`quality decomposition: ${file.path} tem ${file.lines} linhas; falta decisão explícita e verificável de coesão/decomposição.`)
  }
  if (qualityErrors.length) return { status: 'erro', fase: 'Validar', iteracao, detalhe: qualityErrors, quality: qualityReport, tdd: relatorioTdd(), acao: 'Completar evidência de qualidade; não converter omissão em sucesso.' }

  // ── Auditoria ponytail (todos os perfis, 1 agente) ───────────────────────────
  // Checagem MECÂNICA de sinais no diff — barata, roda sempre. Não confundir com a lente R3
  // (perfil Máximo), que é julgamento adversarial de arquitetura sobre o mesmo diff.
  phase('Auditar')
  const escadaDaIteracao = resultados.flatMap(r => (r.escada || []).map(e => ({ iteracao, unidade: r.unidade, ...e })))
  escadaReportada.push(...escadaDaIteracao)
  // Rastro do semCriacao (2.6.0): a declaração entra na escada do relatório e no confronto da auditoria.
  const semCriacaoDaIteracao = resultados.filter(r => r.status === 'concluida' && r.semCriacao === true && (r.escada || []).length === 0 && (r.arquivosTocados || []).length > 0).map(r => ({ iteracao, unidade: r.unidade, semCriacao: true, arquivos: r.arquivosTocados }))
  escadaReportada.push(...semCriacaoDaIteracao)
  // O que nasce no portão TDD não passa pela escada dos operários: fica fora do confronto.
  const nascidosNoPortao = [...testesDaSpec, ...apoioDoTdd]

  // O diff não se recorta por iteração: com baseRef o agente enxerga a entrega inteira desde a
  // base (inclusive o já commitado); sem ela, só o que está fora do HEAD. O prompt diz qual dos
  // dois em vez de prometer a branch inteira sem base para mostrá-la.
  const aud = await chamarRevisor('auditoria',
    `Auditoria ponytail da branch ${ARGS.branch} (iteração ${iteracao}). ${COMO_VER_O_DIFF([...arquivosParaRevisao])}
    ${qualityPrompt}
    Inventário efetivamente inspecionado: ${JSON.stringify(inventory)}.
    Execuções de qualidade recebidas literalmente: ${JSON.stringify(executedQuality)}.
    Confronte execuções e saída com cada alvo aprovado e seu relatório/resultado concreto;
    exit 0 com zero testes ou sem efeito verificável não comprova o check. Reporte issue com
    cenário quando a saída revelar ausência de verificação, sem preencher satisfied por protocolo.
    Preencha qualityReview exatamente uma vez por check: status satisfied/issue/not-applicable,
    evidence não vazia vinculada a cada path aprovado do check, line textual válida e observation concreta.
    Citação de outro arquivo inventariado não cobre o alvo. A SPEC citada precisa constar medida
    como texto no inventário, com linha dentro do limite, inclusive para dispensa e nontext.
    Dispensa só a aprovada no contrato; cite a SPEC como fonte. Para arquivo binary/deleted/symlink,
    documente classificação, limitação e forma de inspeção na SPEC, sem inventar linha textual.
    Para symlink, registre também destino literal observado (ou bytes escapados/hex identificados)
    e resolução interna para arquivo regular; a evidência nontext cita essa linha real da SPEC.
    Para texto intencionalmente vazio (text, lines=0 e bytes=0), cite a SPEC local medida com
    observação explícita do vazio, justificativa e inspeção realizada; não invente linha no alvo
    nem use essa alternativa para texto com conteúdo.
    Issue exige finding.summary e finding.scenario; nos outros status finding é {}.
    Confronte perfis selecionados e cada decisão de decomposition com o conteúdo e a testabilidade.
    Você audita o diff ACUMULADO (${ARGS.baseRef ? `toda a entrega desde a base ${ARGS.baseRef}, inclusive commits` : 'tudo o que não está no HEAD; sem baseRef, trabalho já commitado na branch não aparece'}; não só a última iteração), contra as regras P1-P18
    (skills/dev-loop/references/escada-ponytail.md). Reporte SINAIS, não opiniões:
    - dependenciasNovas: todo pacote/lib adicionado a manifesto ou lockfile. Para cada um,
      justificativaEncontrada=true SOMENTE após ler texto acessível na SPEC, plano, ADR, PR ou
      código explicando por que P1-P5 falharam. Preencha onde com arquivo:linha ou URL com
      âncora, seguido do contexto do porquê observado. Booleano ou nome de manifesto não basta.
      Não imponha comentário de processo no código; fonte ausente ou inacessível = false.
    - duplicacoes: código introduzido que já existe no codebase (cite arquivo, linha e onde já existe).
    - abstracoesUsoUnico: wrapper/helper/interface/factory criado com UM único chamador (arquivo+linha).
      "Uso único" é afirmação mecânica: antes de reportar, busque TODOS os chamadores no workspace
      (ex.: git grep -n -w '<nome>' a partir da raiz física; inclua testes, reexports e imports
      dinâmicos) e ponha em buscaChamadores o comando e a contagem. Dois ou mais chamadores reais:
      não reporte. Um consumidor pode justificar fronteira de I/O, responsabilidade ou testabilidade:
      contagem sozinha não prova defeito; inclua no sinal o custo concreto e a fronteira examinada.
    - forasDeEscopo: reformatação/refatoração de código que a SPEC não pedia (arquivo).
    - criacoesSemRelato: função, arquivo ou dependência que o diff ACUMULADO cria e que não aparece
      em NENHUMA escada declarada (de qualquer iteração, lista abaixo), inclusive em unidade que
      declarou semCriacao. Cite oQue, arquivo, linha e unidade. Testes da SPEC e apoio do portão
      TDD nascem no portão, não numa unidade, e ficam fora deste confronto: ${JSON.stringify(nascidosNoPortao)}.
    - linhasAdicionadasAcumuladas: total de linhas adicionadas no diff da branch.
    O que os operários declararam ter criado nesta iteração: ${JSON.stringify(escadaDaIteracao)}.
    Unidades que declararam nesta iteração só modificar o existente (semCriacao): ${JSON.stringify(semCriacaoDaIteracao)}.
    Escada declarada em TODAS as iterações (base do confronto de criacoesSemRelato): ${JSON.stringify(escadaReportada)}.
    Liste vazio quando não houver sinal — não invente para parecer diligente.`,
    { label: `ponytail:i${iteracao}`, phase: 'Auditar', schema: AUDITORIA_SCHEMA }
  )
  // Auditoria que não retorna NÃO degrada pra "nada encontrado": isso desligaria a regra P10 em
  // silêncio e deixaria a iteração fechar verde com dependência injustificada. Todo outro agente
  // null aborta o run; este também. Portão que falha aberto não é portão.
  if (!aud) return { quality: qualityReport, status: 'erro', fase: 'Auditar', iteracao, tdd: relatorioTdd(), consultas: consultasLog, fallbacks: fallbacksModelo, modelos: relatorioModelos(), ponytail: ponytailAteAgora(), acao: 'a auditoria ponytail não retornou — sem ela não há como afirmar que P10 foi respeitado; reinvocar com resumeFromRunId' }
  const auditoria = aud
  qualityIteration.review = auditoria.qualityReview
  const qualityReview = auditoria.qualityReview
  if (!Array.isArray(qualityReview) || qualityReview.length !== qualityContract.checks.length || new Set(qualityReview.map(r => r?.id)).size !== qualityContract.checks.length || qualityReview.some(r => {
    const check = qualityContract.checks.find(c => c.id === r?.id)
    if (!check || !['satisfied', 'issue', 'not-applicable'].includes(r.status) || (check.applicability === 'not-applicable' ? r.status !== 'not-applicable' : r.status === 'not-applicable') || !objetoPlano(r.finding) || (r.status === 'issue' ? !textoCheio(r.finding.summary) || !textoCheio(r.finding.scenario) : Object.keys(r.finding).length !== 0) || !Array.isArray(r.evidence) || !r.evidence.length) return true
    return r.evidence.some(e => {
      if (!objetoPlano(e) || !textoCheio(e.observation) || !Number.isInteger(e.line) || e.line < 1) return true
      const file = inventory.files.find(f => f.path === e.path)
      if (file?.status !== 'text' || e.line > file.lines) return true
      if (check.paths.includes(e.path)) return false
      const specEvidence = e.path === pathNoWorkspace(ARGS.specPath)
      const specOnlyScope = check.paths.some(p => inventory.files.some(f => f.path === p && (f.status !== 'text' || (f.lines === 0 && f.bytes === 0))))
      return !(specEvidence && (check.applicability === 'not-applicable' || specOnlyScope))
    }) || (check.applicability === 'required' && check.paths.some(path => {
      const target = inventory.files.find(file => file.path === path)
      const requiresSpecEvidence = target && (target.status !== 'text' || (target.lines === 0 && target.bytes === 0))
      return !target || !r.evidence.some(e => e.path === (requiresSpecEvidence ? pathNoWorkspace(ARGS.specPath) : path))
    }))
  })) return { status: 'erro', fase: 'Auditar', iteracao, detalhe: 'qualityReview: cobertura incompleta ou evidência inválida; confira IDs, dispensas, finding e linhas de arquivos efetivamente inspecionados.', quality: qualityReport, tdd: relatorioTdd() }
  auditoriasLog.push({ iteracao, linhasAdicionadasAcumuladas: auditoria.linhasAdicionadasAcumuladas, deps: auditoria.dependenciasNovas.length, dup: auditoria.duplicacoes.length, abs: auditoria.abstracoesUsoUnico.length })

  // GUARDA DE AUDITORIA CEGA. Se a branch tem trabalho (arquivos tocados) mas a auditoria reporta 0
  // linhas acumuladas, ela não enxergou a working tree — típico de um `git diff <base>..HEAD` vazio
  // (o harness nunca commita). Objeto válido cheio de zeros NÃO é "nada encontrado": é o portão P10
  // falhando aberto, que o `!aud` não pega. Aborta como erro reinvocável, igual à auditoria que não
  // retorna — senão bastaria a auditoria ler o diff errado pra dependência injustificada passar.
  if (houveTrabalhoNaBranch && auditoria.linhasAdicionadasAcumuladas === 0) {
    return { quality: qualityReport, status: 'erro', fase: 'Auditar', iteracao, tdd: relatorioTdd(), consultas: consultasLog, fallbacks: fallbacksModelo, modelos: relatorioModelos(), ponytail: ponytailAteAgora(), acao: 'auditoria ponytail voltou cega: 0 linhas acumuladas com trabalho presente na branch — não enxergou a working tree não-commitada (provável `git diff <base>..HEAD` vazio). Reinvocar com resumeFromRunId; execute a inspeção somente leitura do prompt e confira os novos não incluídos.' }
  }
  // Auditoria vê a branch toda: o mesmo achado fora de escopo reaparece a cada iteração.
  for (const f of auditoria.forasDeEscopo) {
    if (!pendenciasForaDeEscopo.some(p => p.arquivo === f.arquivo && p.oQue === f.oQue)) pendenciasForaDeEscopo.push({ iteracao, ...f })
  }

  // ── REGRA DURA P10 — decidida em código, ponto ───────────────────────────────
  // Dependência nova sem justificativa ESCRITA NO DIFF não passa. Sem exceção, sem rota de
  // modelo, sem casar nome de pacote com texto livre da escada. Quem quer a dependência escreve
  // o porquê no código — que é onde a justificativa serve pra quem vier depois, não num campo
  // que morre com o run. Bloqueante automático: não passa pela confirmação.
  const bloqueantesAutomaticos = []

  // ── REGRA DURA: TESTES DA SPEC INTACTOS — decidida em código ─────────────────
  // Hash de cada teste após a implementação comparado à baseline do `tdd:vermelho`. Diferente
  // ou ausente = bloqueante automático, sem confirmação: o operário que edita o teste pra passar
  // não tem apelação, e "sem hash" é fail-closed (não há como provar que ficou intacto).
  // Os dois lados chegam aqui com a conferência de transporte recalculada (`hashesConferidos`):
  // divergência entre duas coletas conferidas é mudança de conteúdo, não erro de cópia.
  for (const p of testesDaSpec) {
    const agora = hashesAgora[p]
    if (agora && agora === hashesBase[p]) continue
    bloqueantesAutomaticos.push({
      arquivo: p,
      resumo: agora ? `Teste da SPEC alterado durante a implementação: ${p}` : `Teste da SPEC sem hash na validação: ${p} — não há como provar que ficou intacto`,
      cenario: agora
        ? `O hash de ${p} mudou entre o portão TDD (${hashesBase[p]}) e a validação (${agora}); as duas coletas conferiram, então não é erro de transcrição. O implementador não edita os testes que precisa fazer passar: se o teste parece errado, isso é consulta de arquitetura, não correção. Reverta o teste ao estado do TDD.`
        : `A validação não devolveu hash para ${p}. Sem ele a regra "implementador não edita teste" fica sem prova. Reporte o SHA-256 de todos os testes da SPEC.`,
      severidade: 'bloqueante', confianca: 'confirmado', origem: 'testes-intactos', natureza: 'integridade-dos-testes',
    })
  }

  // ── REGRA DURA: RESULTADO POR TESTE DEPOIS DA IMPLEMENTAÇÃO — decidida em código ─────────
  // Reprodução que continua (ou ficou) vermelha e controle de preservação que ficou vermelho são
  // bloqueantes automáticos, sem confirmação. Execução faltando, repetida, incoerente ou que saiu
  // 0 sem executar caso também: `verde` declarado sem uma execução válida por teste não prova nada.
  // A leitura é a mesma do portão (`lerExecucoes` + `semValor`). O operário corrige o código, nunca o teste.
  // Natureza (2.6.0), para o resumo da escalada: asserção é funcional; infra é indeterminada (junta
  // import e sintaxe da implementação com ambiente); execução faltando, incoerente ou sem caso é
  // evidência. Em infra o cenário separa os dois casos: import ou sintaxe se corrige no código, sem
  // editar o teste; ambiente não se contorna mudando código nem teste.
  {
    const lidas = lerExecucoes(val.execucoes)
    const SE_INFRA = ' Se a causa é import ou sintaxe do código, corrija o código sem editar o teste. Se a causa é ambiente (cache, temporário, permissão, ferramenta ausente, rede), não altere código nem teste para contorná-la: reporte como pendência.'
    for (const t of testesNumerados) {
      const r = lidas.mapa.get(t.id)
      const comum = { arquivo: t.path, severidade: 'bloqueante', confianca: 'confirmado', origem: 'portao-tdd' }
      const razao = r ? semValor(r) : null
      if (!r) {
        bloqueantesAutomaticos.push({ ...comum, natureza: 'evidencia', resumo: `Teste da SPEC sem execução por teste na validação: ${t.id} (critério ${t.criterio}) — não há como provar que passa`, cenario: 'A validação precisa reportar exatamente uma execução por teste da SPEC em execucoes (faltando ou repetida não vale).' })
      } else if (razao === 'saiu 0 sem executar nenhum caso') {
        bloqueantesAutomaticos.push({ ...comum, natureza: 'evidencia', resumo: `Teste da SPEC saiu 0 sem executar nenhum caso: ${t.id} (critério ${t.criterio})`, cenario: `\`${t.comando}\` não executou caso nenhum (filtro que não casa?). Sem caso executado não há verde.` })
      } else if (razao === 'resultado incoerente') {
        bloqueantesAutomaticos.push({ ...comum, natureza: 'evidencia', resumo: `Execução incoerente na validação: ${t.id} (critério ${t.criterio})`, cenario: `exitZero=${r.exitZero}, tipoFalha=${r.tipoFalha}, casos=${r.casos}: o resultado não fecha consigo mesmo e não serve de evidência.` })
      } else if (r.exitZero !== true) {
        const infra = r.tipoFalha === 'infra'
        const natureza = infra ? 'indeterminada' : 'funcional'
        bloqueantesAutomaticos.push(t.tipo === 'reproducao'
          ? { ...comum, natureza, resumo: `Teste de reprodução vermelho após a implementação: ${t.id} (critério ${t.criterio}) — a regressão não está resolvida`, cenario: `\`${t.comando}\` saiu diferente de 0 (${r.tipoFalha}): ${r.resumo || 'sem resumo'}.${infra ? SE_INFRA : ' Faça o teste passar sem editá-lo.'}` }
          : { ...comum, natureza, resumo: `Controle de preservação ficou vermelho: ${t.id} (critério ${t.criterio})`, cenario: `O controle passava no portão TDD e agora falha (${r.tipoFalha}): ${r.resumo || 'sem resumo'}.${infra ? SE_INFRA : ' A implementação quebrou comportamento que devia preservar; corrija sem editar o teste.'}` })
      }
    }
  }

  for (const d of auditoria.dependenciasNovas) {
    const barrada = d.justificativaEncontrada !== true || !textoCheio(d.onde) || !/(?:[^\s:]+:\d+|https?:\/\/\S+#[^\s]+)\s+\S[\s\S]{15,}/.test(d.onde)
    if (barrada) {
      bloqueantesAutomaticos.push({
        arquivo: d.onde || 'manifesto de dependências', resumo: `P10: dependência nova "${d.nome}" sem justificativa escrita de por que P1-P5 falharam`,
        cenario: `A auditoria não achou no diff nenhum texto explicando por que os degraus P1-P5 falham para "${d.nome}". Registre a justificativa em fonte acessível (SPEC, plano, ADR, PR ou código), com arquivo:linha ou URL com âncora e contexto do porquê, OU remova a dependência.`,
        severidade: 'bloqueante', confianca: 'confirmado', origem: 'auditoria-ponytail', natureza: 'dependencia',
      })
    }
    // UMA entrada por dependência, com a decisão VIGENTE. Deduplicar por nome+decisão fazia um run
    // verde carregar no relatório a barra da iteração 1 ao lado da justificativa da 2 — duas
    // entradas contraditórias sobre o mesmo pacote, sem nada dizendo qual vale.
    const registro = { iteracao, nome: d.nome, onde: d.onde, decisao: barrada ? 'barrada' : 'justificada', porque: barrada ? 'sem justificativa escrita no diff (P10)' : 'justificativa escrita encontrada no diff' }
    const jaVisto = dependenciasDecididas.findIndex(x => x.nome === d.nome)
    if (jaVisto === -1) dependenciasDecididas.push(registro)
    else dependenciasDecididas[jaVisto] = { ...registro, decisoesAnteriores: [...(dependenciasDecididas[jaVisto].decisoesAnteriores || []), { iteracao: dependenciasDecididas[jaVisto].iteracao, decisao: dependenciasDecididas[jaVisto].decisao }] }
  }

  // ENFORCEMENT do relato de escada (P1-P7). `escada` não é required no schema — rejeitar
  // `bloqueada` sem escada mataria a consulta ao arquiteto. Então a checagem é aqui, em código:
  // unidade que concluiu tocando arquivos e não relatou nada é divergência, não silêncio.
  // `semCriacao: true` (2.6.0) é a outra resposta válida: só modificou o existente. Ela dispensa
  // este bloqueante, não a auditoria, que confronta o diff com a escada (`criacoesSemRelato`).
  for (const r of resultados.filter(x => x.status === 'concluida')) {
    if ((r.arquivosTocados || []).length > 0 && (r.escada || []).length === 0 && r.semCriacao !== true) {
      bloqueantesAutomaticos.push({
        arquivo: (r.arquivosTocados || []).join(', '), resumo: `Relato de escada ausente na unidade ${r.unidade}: ${(r.arquivosTocados || []).length} arquivo(s) tocado(s), 0 item(ns) relatado(s) e sem declaração semCriacao`,
        cenario: 'Sem o relato não há como auditar em que degrau da escada cada coisa criada parou (P1-P7). Se a unidade criou função, arquivo ou dependência, reporte um item de `escada` para cada; se só modificou o que já existia, devolva `escada: []` com `semCriacao: true`.',
        severidade: 'bloqueante', confianca: 'confirmado', origem: 'auditoria-ponytail', natureza: 'procedimento',
      })
    }
  }

  // Duplicações e abstrações de uso único: findings NORMAIS — passam pela confirmação abaixo,
  // que julga o fato E a severidade (a `severidade` daqui é a alegação, não um veredito).
  // Reuse o veredito somente para o mesmo arquivo, alegação e cenário. Um sinal confirmado como
  // bloqueante que reaparece continua bloqueante; desaparecer da auditoria atual é o que o remove.
  // Refutação ou "real, não bloqueante" da mesma evidência não paga outro confirmador; cenário
  // diferente exige novo juízo.
  //
  // TESTE DA SPEC É CONGELADO: a regra dos testes intactos (acima) proíbe qualquer operário de
  // editá-lo, então um sinal de peso de diff nele não tem quem conserte dentro do loop — como
  // bloqueante, o run só podia terminar escalado no teto. Decidido em código pelo arquivo, sem
  // rota de modelo: vira pendência reportada, sem confirmador. Arquivo que não dá pra identificar
  // segue o fluxo normal. Achado de LENTE em teste da SPEC não passa por aqui e continua bloqueando.
  //
  // Criação sem relato (2.6.0) é sinal P1-P7 de natureza procedimento, julgado pelo confirmador
  // com a escada acumulada à vista. O que nasceu no portão (testes da SPEC, apoio) sai antes, em
  // código: não tem escada de operário a conferir. `buscaChamadores` do P11 viaja como campo
  // próprio, fora do `cenario`, que é chave do cache de veredito (o texto da busca varia).
  const criacoesSemRelato = (Array.isArray(auditoria.criacoesSemRelato) ? auditoria.criacoesSemRelato : []).filter(x => !nascidosNoPortao.includes(pathNoWorkspace(String(x.arquivo || ''))))
  const findingsDaAuditoria = [
    ...auditoria.duplicacoes.map(x => ({ arquivo: x.arquivo || '(diff da branch)', linha: x.linha, resumo: `P2: "${x.oQue}" duplica o que já existe em ${x.ondeJaExiste}`, cenario: `A base já resolve isso em ${x.ondeJaExiste}; o diff reintroduz a lógica.`, severidade: 'bloqueante', confianca: 'plausivel', origem: 'auditoria-ponytail', sinal: 'P2', natureza: 'peso-de-diff' })),
    ...auditoria.abstracoesUsoUnico.map(x => ({ arquivo: x.arquivo || '(diff da branch)', linha: x.linha, resumo: `P11: abstração de uso único "${x.oQue}"`, cenario: `Único chamador: ${x.unicoChamador}. Abstração sem segundo caso de uso.`, severidade: 'bloqueante', confianca: 'plausivel', origem: 'auditoria-ponytail', sinal: 'P11', natureza: 'peso-de-diff', ...(textoCheio(x.buscaChamadores) ? { buscaChamadores: x.buscaChamadores } : {}) })),
    ...criacoesSemRelato.map(x => ({ arquivo: x.arquivo || '(diff da branch)', linha: x.linha, resumo: `P1-P7: criação sem relato de escada "${x.oQue}"${x.unidade ? ` (${x.unidade})` : ''}`, cenario: `O diff cria "${x.oQue}" e nenhuma escada declarada o registra; sem o relato não se audita em que degrau ele parou.`, severidade: 'bloqueante', confianca: 'plausivel', origem: 'auditoria-ponytail', sinal: 'P1-P7', natureza: 'procedimento' })),
  ].flatMap(f => {
    if (testesDaSpec.includes(pathNoWorkspace(f.arquivo))) {
      if (!pendenciasEmTestesDaSpec.some(p => p.arquivo === f.arquivo && p.resumo === f.resumo)) pendenciasEmTestesDaSpec.push({ iteracao, arquivo: f.arquivo, linha: f.linha, resumo: f.resumo, cenario: f.cenario, ...(f.buscaChamadores ? { buscaChamadores: f.buscaChamadores } : {}) })
      return []
    }
    const julgado = duplicacoesEAbstracoesJulgadas.find(j => j.arquivo === f.arquivo && j.resumo === f.resumo && j.cenario === f.cenario)
    if (!julgado) return [f]
    return julgado.confirmado && julgado.severidade === 'bloqueante' ? [{ ...f, confianca: 'confirmado' }] : []
  })

  phase('Revisar')
  findingsAbertos = [...findingsDaAuditoria, ...qualityReview.filter(r => r.status === 'issue').map(r => ({ arquivo: r.evidence[0].path, linha: r.evidence[0].line, resumo: `${r.id}: ${r.finding.summary}`, cenario: r.finding.scenario, severidade: 'bloqueante', confianca: 'plausivel', origem: 'auditoria-quality', natureza: 'qualidade' }))]
  // Lente que não retorna ABORTA o run, igual à auditoria — antes era `if (rev)` e a revisão
  // falhava ABERTA: no perfil econômico (1 lente), um null aqui fechava verde sem NENHUMA
  // revisão adversarial (revisão 2026-07-23, Codex #1). Portão que falha aberto não é portão;
  // reinvocar com resumeFromRunId reaproveita tudo que já completou.
  for (const lente of perfil.lentes) {
    const rev = await chamarRevisor('lente',
      `${LENTE_PROMPT[lente]}\n${COMO_VER_O_DIFF([...arquivosParaRevisao])}\nRevise esse diff da branch ${ARGS.branch} contra a SPEC ${ARGS.specPath}.
      ${qualityPrompt}
      Inventário de qualidade: ${JSON.stringify(inventory)}.
      Tente REFUTAR o trabalho. Finding sem arquivo:linha e cenário concreto não entra.
      Afirmação mecânica sobre uso, chamadores ou impacto ("único uso", "ninguém chama", "afeta só X")
      só entra com a busca executada (comando + resultado) no cenário; sem ela, marque plausivel.`,
      { label: `rev:${lente}:i${iteracao}`, phase: 'Revisar', schema: REVIEW_SCHEMA }
    )
    if (!rev) return { quality: qualityReport, status: 'erro', fase: 'Revisar', iteracao, tdd: relatorioTdd(), consultas: consultasLog, fallbacks: fallbacksModelo, modelos: relatorioModelos(), ponytail: ponytailAteAgora(), acao: `a lente ${lente} não retornou — sem ela a revisão adversarial do perfil não aconteceu e o verde seria mentira; reinvocar com resumeFromRunId` }
    // A natureza do finding de lente é do controlador, não da lente: um campo trazido por ela não
    // pode rotular revisão como procedimento no resumo da escalada.
    // 2.6.0 (decisão 13, furo 1): vale para todo campo que o controlador lê para rotear. Com
    // `origem: 'auditoria-ponytail'` forjado, o finding de lente ganhava a pergunta de severidade
    // e "real, não bloqueante" virava pendência; `sinal` e `buscaChamadores` montavam o prompt do
    // confirmador. A lente controla só o que o REVIEW_SCHEMA declara (severidade inclusive).
    // Cópia por lista, não remoção: campo de controlador novo já nasce fora do alcance da lente.
    // O item do schema segue aberto: fechá-lo faria o bridge Codex recusar a resposta inteira.
    findingsAbertos.push(...rev.findings.map(f => ({
      ...Object.fromEntries(CAMPOS_DA_LENTE.filter(k => Object.hasOwn(f, k)).map(k => [k, f[k]])),
      origem: 'lente',
      natureza: 'revisao',
    })))
  }

  // Bloqueantes automáticos entram SEM passar por confirmação — a regra já foi decidida em código.
  const bloqueantes = [...bloqueantesAutomaticos]
  for (const f of findingsAbertos.filter(f => f.severidade === 'bloqueante')) {
    if (f.confianca === 'confirmado') { bloqueantes.push(f); continue }
    // Só o sinal da auditoria ganha a pergunta de severidade: ninguém a julgou antes (ver
    // VEREDITO_AUDITORIA_SCHEMA). Finding de lente mantém a severidade que a lente classificou.
    const daAuditoria = f.origem === 'auditoria-ponytail' || f.origem === 'auditoria-quality'
    const v = await chamarRevisor('confirmacao',
      `Confirme ou refute este finding plausível antes de virar retrabalho:
      ${f.arquivo}:${f.linha || '?'} — ${f.resumo}. Cenário alegado: ${f.cenario}.
      Reproduza o cenário (leia o código, rode se preciso). real=true só com evidência.${daAuditoria ? '' : `
      Se o finding afirma uso, ausência de chamador ou impacto restrito, refaça a busca no workspace
      (ex.: git grep -n -w '<nome>' a partir da raiz física) e cite comando e resultado no porque;
      resultado que não bate → real=false.`}${daAuditoria ? `
      Este é um sinal MECÂNICO da auditoria ponytail: a severidade ainda não foi julgada por ninguém.
      Responda as duas perguntas em campos separados. real = o fato alegado existe.
      bloqueante = pela regra 4 do seu papel: true se viola critério de aceite, quebra em cenário
      real ou toca segurança; false se é só peso de diff (melhoria, estilo, risco menor) — aí vira
      pendência reportada, não retrabalho. Fato que existe e não bloqueia é real=true com
      bloqueante=false; nunca use real=false para dizer "não bloqueia".` : ''}${f.sinal === 'P11' ? `
      Avalie fronteira de responsabilidade, isolamento de I/O e testabilidade antes de julgar custo arquitetural.
      Uso único é afirmação sobre CHAMADORES: antes de responder, busque os chamadores no repositório
      (ex.: \`git grep -n "<nome>"\` a partir da raiz física) e cite no porque o comando e quantos
      chamadores achou. Dois ou mais chamadores = o fato alegado não existe (real=false).${f.buscaChamadores ? `
      Busca declarada pela auditoria (alegação, não prova; refaça a sua): ${f.buscaChamadores}` : ''}` : ''}${f.sinal === 'P1-P7' ? `
      Criação sem relato é afirmação sobre a escada: o fato só existe se o que o diff cria não está em
      nenhuma escada declarada. Escada declarada em todas as iterações: ${JSON.stringify(escadaReportada)}.` : ''}`,
      { label: `confirmar:i${iteracao}`, phase: 'Revisar', schema: daAuditoria ? VEREDITO_AUDITORIA_SCHEMA : VEREDITO_SCHEMA }
    )
    // Confirmador que não retorna ABORTA: antes o null descartava o finding bloqueante plausível
    // em silêncio — mesma classe de falha-aberta da lente acima. O veredito precisa existir.
    if (!v) return { quality: qualityReport, status: 'erro', fase: 'Revisar', iteracao, tdd: relatorioTdd(), consultas: consultasLog, fallbacks: fallbacksModelo, modelos: relatorioModelos(), ponytail: ponytailAteAgora(), acao: `o confirmador do finding "${f.resumo}" não retornou — sem veredito não há como decidir retrabalho nem verde; reinvocar com resumeFromRunId` }
    // Fail-closed: só `bloqueante === false` explícito, e só em sinal da auditoria, tira do retrabalho.
    if (f.origem === 'auditoria-quality') {
      if (typeof v.real !== 'boolean' || typeof v.bloqueante !== 'boolean' || !textoCheio(v.porque)) return { status: 'erro', fase: 'Revisar', detalhe: 'quality: confirmação exige real, bloqueante e evidência independente em porque.', quality: qualityReport }
      qualityIteration.confirmations.push({ finding: f, ...v })
    }
    const naoBloqueia = daAuditoria && v.bloqueante === false
    if (v.real && !naoBloqueia) bloqueantes.push(f)
    // Findings da auditoria são julgados como qualquer outro; o relatório guarda o VEREDITO,
    // não a alegação — senão a seção ponytail lista como violação o que foi refutado, ou como
    // bloqueante o que o confirmador julgou pendência.
    if (f.origem === 'auditoria-ponytail') duplicacoesEAbstracoesJulgadas.push({ iteracao, ...f, severidade: v.real && naoBloqueia ? 'nao-bloqueante' : f.severidade, confirmado: !!v.real, porqueVeredito: v.porque })
  }

  if (validacaoVerde && bloqueantes.length === 0) { verde = true; break }
  historicoFalhas.push({ iteracao, validacaoVerde, ...(verdeDeclaradoComFalhas ? { verdeDeclaradoComFalhas: true } : {}), validacoes: falhasDaValidacao, findings: bloqueantes })
  log(`Iteração ${iteracao} não fechou: ${falhasDaValidacao.length} falha(s) de validação, ${bloqueantes.length} finding(s) bloqueante(s) confirmados`)
}

// ── relatório final ──────────────────────────────────────────────────────────
// O bloco ponytail vai nos DOIS desfechos: numa escalada por dependência barrada, é justamente
// ele que explica por que o loop não convergiu.
// A escalada diz O QUE ficou aberto (2.6.0): teto com a última validação verde, sem falha listada
// e só relato de escada pendente não é a mesma situação que regressão vermelha. A natureza vem do
// controlador (bloqueante automático, sinal da auditoria, `revisao` na lente). `somenteProcedimento`
// muda só a ação: o status continua escalado e o harness nunca o converte em verde.
const resumoDaEscalada = (() => {
  const ultima = historicoFalhas[historicoFalhas.length - 1]
  if (!ultima) return null
  const contar = (itens, chave) => itens.reduce((acc, x) => { const k = chave(x); acc[k] = (acc[k] || 0) + 1; return acc }, {})
  const bloqueantesPorNatureza = contar(ultima.findings, f => f.natureza || 'revisao')
  const somenteProcedimento = ultima.validacaoVerde === true && ultima.validacoes.length === 0 && ultima.findings.length > 0 && Object.keys(bloqueantesPorNatureza).every(k => k === 'procedimento')
  return { iteracao: ultima.iteracao, validacaoVerde: ultima.validacaoVerde, falhasDeValidacaoPorNatureza: contar(ultima.validacoes, f => f.natureza), bloqueantesPorNatureza, somenteProcedimento }
})()
if (!verde) {
  return {
    status: 'escalado', fase: 'Loop', quality: qualityReport, detalhe: `${MAX_ITERACOES} iterações sem fechar`,
    resumoDaEscalada,
    historico: historicoFalhas, consultas: consultasLog, fallbacks: fallbacksModelo, modelos: relatorioModelos(),
    ponytail: ponytailAteAgora(), tdd: relatorioTdd(), validacoesReaproveitadas,
    acao: resumoDaEscalada && resumoDaEscalada.somenteProcedimento
      ? 'a última validação fechou verde, sem falha listada, e os bloqueantes restantes são só de procedimento (ex.: relato de escada): nenhuma falha funcional aberta foi registrada nesta iteração. Decisão do dono: aceitar com verificação independente registrada, completar o relato e reinvocar, ou investigar. O harness não converte isto em verde.'
      : 'diagnóstico pro humano: o loop não insiste além do teto',
  }
}

if (criteriosManuais.length > 0) return {
  status: 'bloqueado', fase: 'VerificacaoManual', quality: qualityReport,
  detalhe: 'validações automatizadas fecharam, mas há evidência manual ainda não coletada',
  verificacoesManuaisPendentes: criteriosManuais.map(c => ({ criterio: c.id, verificacao: c.verificacaoComplementar.trim() })),
  data: ARGS.hoje, iteracoes: iteracao, tdd: relatorioTdd(), validacoesReaproveitadas,
  validacaoFinal: { impressao: ultimaValidacao.impressao, comandos: [...validacoes], verde: true, reaproveitada: ultimaValidacao.reaproveitada, excluidos: [...EXCLUIDOS_IMPRESSAO], excluidosNaoRastreados: [...EXCLUIDOS_NAO_RASTREADOS] },
  fallbacks: fallbacksModelo, modelos: relatorioModelos(), consultas: consultasLog, ponytail: ponytailAteAgora(),
  acao: 'executar e registrar cada verificacaoComplementar; só então declarar todos os critérios verificados',
}

return {
  status: 'verde',
  quality: qualityReport,
  data: ARGS.hoje,
  iteracoes: iteracao,
  tdd: relatorioTdd(),
  // Validação reutilizável por uma retomada futura (rebaselineTdd.validacaoAnterior). Sem
  // impressão conferida, `impressao` é null e nenhuma retomada consegue reaproveitá-la.
  // `excluidos` (a SPEC, fora do diff) e `excluidosNaoRastreados` (as pendências, fora só dos não
  // rastreados) são as listas que a impressão deixou de fora: quem recalcula a impressão, na
  // retomada ou no Step 8, usa as mesmas listas, nessa ordem, ou o valor não confere.
  validacaoFinal: { impressao: ultimaValidacao.impressao, comandos: [...validacoes], verde: true, reaproveitada: ultimaValidacao.reaproveitada, excluidos: [...EXCLUIDOS_IMPRESSAO], excluidosNaoRastreados: [...EXCLUIDOS_NAO_RASTREADOS] },
  validacoesReaproveitadas,
  fallbacks: fallbacksModelo, modelos: relatorioModelos(),
  consultas: consultasLog,
  ponytail: ponytailAteAgora(),
  findingsNaoBloqueantes: findingsAbertos.filter(f => f.severidade === 'nao-bloqueante'),
  proximo: 'skill entregar retoma no Step 8 (validações finais) e grava este relatório no Log de execução da entrega',
}

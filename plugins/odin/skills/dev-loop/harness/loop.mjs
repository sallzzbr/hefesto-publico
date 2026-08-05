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

// ── args esperados (montados pela skill dev-loop) ────────────────────────────
// {
//   specPath:  string  — path do arquivo que contém a ## SPEC (entrega ou avulsa)
//   branch:    string  — branch de trabalho JÁ criada (o harness não cria branch)
//   perfil:    'economico' | 'balanceado' | 'maximo'
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
// }

const PERFIS = {
  economico:  { paralelo: false, lentes: ['corretude'] },
  balanceado: { paralelo: true,  lentes: ['corretude', 'seguranca-bordas'] },
  maximo:     { paralelo: true,  lentes: ['corretude', 'seguranca-bordas', 'ponytail-arquitetura'] },
}

const MAX_ITERACOES = 3
const MAX_CONSULTAS_POR_UNIDADE_ITERACAO = 2

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

// O harness NUNCA commita: todo o trabalho do loop fica na working tree como mudança não
// commitada, e arquivos novos ficam untracked. Um `git diff <base>..HEAD` — a leitura NATURAL de
// "diff da branch" — vem VAZIO nesse modelo e cega quem depende dele: a auditoria reporta 0 deps /
// 0 linhas e o P10 é desarmado em SILÊNCIO (objeto válido cheio de zeros, que o guard `!aud` não
// pega). A única leitura que enxerga tudo é encenar o índice primeiro. TODO agente que precisa ver
// o diff da branch recebe esta instrução — não deixe o agente escolher o comando sozinho.
const COMO_VER_O_DIFF = 'Para ver o diff COMPLETO da branch: rode primeiro `git add -A` (encena arquivos novos/untracked SEM commitar — o harness nunca commita) e então inspecione `git diff --cached`. NÃO use `git diff <base>..HEAD` nem `git diff <base>`: como não há commits novos na branch, esses vêm VAZIOS e esconderiam todo o trabalho do loop.'

// ── schemas ──────────────────────────────────────────────────────────────────
const SPEC_SCHEMA = { type: 'object', additionalProperties: false, required: ['ok', 'criterios', 'unidades', 'pendenciasBloqueadoras'], properties: {
  ok: { type: 'boolean' }, motivo: { type: 'string' }, specLite: { type: 'boolean' },
  criterios: { type: 'array', items: { type: 'object', required: ['id', 'texto'], properties: { id: { type: 'string' }, texto: { type: 'string' }, verificacaoComplementar: { type: 'string' } } } },
  unidades: { type: 'array', items: { type: 'object', required: ['id', 'titulo', 'arquivos', 'criterios'], properties: { id: { type: 'string' }, titulo: { type: 'string' }, arquivos: { type: 'string' }, contrato: { type: 'string' }, criterios: { type: 'array', items: { type: 'string' } } } } },
  validacoesDaSpec: { type: 'array', items: { type: 'string' } },
  pendenciasBloqueadoras: { type: 'array', items: { type: 'string' } },
} }

const TDD_SCHEMA = { type: 'object', additionalProperties: false, required: ['vermelhoConfirmado', 'testes'], properties: {
  vermelhoConfirmado: { type: 'boolean' },
  testes: { type: 'array', items: { type: 'object', required: ['criterio', 'path', 'motivoFalha'], properties: { criterio: { type: 'string' }, path: { type: 'string' }, motivoFalha: { type: 'string' } } } },
  problemas: { type: 'array', items: { type: 'string' } },
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
  arquivosTocados: { type: 'array', items: { type: 'string' } },
  consulta: { type: 'object', properties: { contexto: { type: 'string' }, decisaoNecessaria: { type: 'string' }, opcoes: { type: 'array', items: { type: 'string' } } } },
  pendencias: { type: 'array', items: { type: 'string' } },
} }

const CONSULTA_SCHEMA = { type: 'object', additionalProperties: false, required: ['decisao', 'porque'], properties: {
  decisao: { type: 'string' }, porque: { type: 'string' }, restricoes: { type: 'array', items: { type: 'string' } },
  furoNaSpec: { type: 'boolean' },
} }

const VALID_SCHEMA = { type: 'object', additionalProperties: false, required: ['verde'], properties: {
  verde: { type: 'boolean' },
  falhas: { type: 'array', items: { type: 'object', required: ['comando', 'resumo'], properties: { comando: { type: 'string' }, resumo: { type: 'string' } } } },
} }

const REVIEW_SCHEMA = { type: 'object', additionalProperties: false, required: ['findings'], properties: {
  findings: { type: 'array', items: { type: 'object', required: ['arquivo', 'resumo', 'cenario', 'severidade', 'confianca'], properties: {
    arquivo: { type: 'string' }, linha: { type: 'number' }, resumo: { type: 'string' }, cenario: { type: 'string' },
    severidade: { enum: ['bloqueante', 'nao-bloqueante'] }, confianca: { enum: ['confirmado', 'plausivel'] },
  } } },
} }

const VEREDITO_SCHEMA = { type: 'object', additionalProperties: false, required: ['real'], properties: { real: { type: 'boolean' }, porque: { type: 'string' } } }

// Auditoria ponytail: sinais MECÂNICOS no diff (não é julgamento de arquitetura — isso é a lente R3).
// `onde`/`arquivo` são PEDIDOS no prompt mas NÃO required: um schema estrito aqui faz o retorno
// inteiro ser rejeitado por um campo faltante, e retorno rejeitado = auditoria vazia = regra P10
// desarmada em silêncio. Localização feia é melhor que portão desligado; o `!aud` é que é erro.
const AUDITORIA_SCHEMA = { type: 'object', additionalProperties: false, required: ['dependenciasNovas', 'duplicacoes', 'abstracoesUsoUnico', 'forasDeEscopo', 'linhasAdicionadasAcumuladas'], properties: {
  dependenciasNovas: { type: 'array', items: { type: 'object', required: ['nome', 'justificativaEncontrada'], properties: {
    nome: { type: 'string', minLength: 1 }, justificativaEncontrada: { type: 'boolean' }, onde: { type: 'string' },
  } } },
  duplicacoes: { type: 'array', items: { type: 'object', required: ['oQue', 'ondeJaExiste'], properties: { oQue: { type: 'string' }, ondeJaExiste: { type: 'string' }, arquivo: { type: 'string' }, linha: { type: 'number' } } } },
  abstracoesUsoUnico: { type: 'array', items: { type: 'object', required: ['oQue', 'unicoChamador'], properties: { oQue: { type: 'string' }, unicoChamador: { type: 'string' }, arquivo: { type: 'string' }, linha: { type: 'number' } } } },
  forasDeEscopo: { type: 'array', items: { type: 'object', required: ['oQue', 'arquivo'], properties: { oQue: { type: 'string' }, arquivo: { type: 'string' } } } },
  // Acumulado da branch, não da iteração: o script não tem SHA base pra recortar o diff.
  linhasAdicionadasAcumuladas: { type: 'number' },
} }

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
  if (t.modelo !== 'fable' || overrideArquitetoMorto) return await tentar(prompt, base)

  // O registro do fallback NÃO afirma que a culpa foi do Fable — as causas são indistinguíveis.
  const r = await tentar(prompt, { ...base, model: 'fable' })
  if (r) return r
  overrideArquitetoMorto = true
  fallbacksModelo.push({ step: 'consulta', chamada: base.label, de: 'fable', para: 'opus (frontmatter)', causa: 'a chamada com override não retornou (tier indisponível, schema inválido ou timeout — indistinguíveis aqui); override desligado para o resto do run' })
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
  if (t.modelo !== 'haiku' || haikuMorto) return await tentar(prompt, base)
  const r = await tentar(prompt, { ...base, ...MECANICO })
  if (r) return r
  haikuMorto = true
  fallbacksModelo.push({ step, chamada: base.label, de: 'haiku (mecanico)', para: 'sonnet (operario)', causa: 'a chamada rebaixada não retornou (agente indisponível, schema inválido ou timeout — indistinguíveis aqui); haiku desligado para o resto do run' })
  return await tentar(prompt, base)
}

// Revisor é opus SEMPRE (MODELOS_STEP não permite outro modelo) — só o effort é configurável.
const chamarRevisor = (step, prompt, extra) => tentar(prompt, { ...REVISOR, ...(TIERING[step].effort ? { effort: TIERING[step].effort } : {}), ...extra })

// ── Fase 0: args válidos (falha barata antes de gastar agente) ───────────────
// A tool Workflow pode entregar args como string JSON — normalizar antes de validar.
let ARGS = args
if (typeof ARGS === 'string') {
  try { ARGS = JSON.parse(ARGS) } catch {
    return { status: 'erro', fase: 'Args', detalhe: 'args chegou como string e não é JSON válido', acao: 'reinvocar o Workflow com args objeto: {specPath, branch, perfil, validacoes, hoje}' }
  }
}
if (!ARGS || typeof ARGS !== 'object' || Array.isArray(ARGS)) {
  return { status: 'erro', fase: 'Args', detalhe: `args deve ser um objeto JSON, recebi ${Array.isArray(ARGS) ? 'array' : typeof ARGS}`, acao: 'reinvocar o Workflow com args objeto: {specPath, branch, perfil, validacoes, hoje}' }
}
const argsFaltando = ['specPath', 'branch', 'perfil'].filter(k => !ARGS[k])
if (argsFaltando.length > 0) {
  return { status: 'erro', fase: 'Args', detalhe: `args obrigatórios ausentes: ${argsFaltando.join(', ')}`, acao: 'reinvocar o Workflow com args completos: {specPath, branch, perfil, validacoes, hoje}' }
}

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

// Modelos/efforts EFETIVOS por step, não os pedidos: se um fallback desligou fable ou haiku no
// meio do run, é a queda que aparece aqui — o detalhe de qual chamada caiu fica em `fallbacks`.
// Vai em TODO desfecho pós-resolução (verde, escalado, bloqueado, erro), não só no verde: num
// run escalado é justamente aqui que se lê com que modelo cada step rodou.
const relatorioModelos = () => ({
  porStep: Object.fromEntries(Object.keys(MODELOS_STEP).map(s => {
    const t = TIERING[s]
    let efetivo = t.modelo
    if (t.modelo === 'fable' && overrideArquitetoMorto) efetivo = 'opus (fallback — ver fallbacks)'
    if (t.modelo === 'haiku' && haikuMorto) efetivo = 'sonnet (fallback — ver fallbacks)'
    return [s, { modelo: efetivo, effort: t.effort || 'herdado da sessão' }]
  })),
  recusados: tieringRecusado,
})

// ── Fase 1: Spec ─────────────────────────────────────────────────────────────
phase('Spec')
log(`Validando SPEC em ${ARGS.specPath} (perfil ${ARGS.perfil}, branch ${ARGS.branch})`)

const spec = await chamarOperario('spec',
  `Leia o arquivo ${ARGS.specPath} e valide a seção ## SPEC contra o formato canônico do odin:
  critérios de aceite todos verificáveis, cada um mapeado pra teste executável (ou verificação
  complementar explícita), unidades de trabalho com contratos e arquivos DISJUNTOS entre si,
  non-goals presentes. Extraia também as "Pendências bloqueadoras" do Gate de prontidão
  (seção pode não existir em spec legada — aí retorne lista vazia, não é erro).
  Se a SPEC for a variante não-software "SPEC-lite" (título "# SPEC-lite", ou tabela de
  critérios com "forma de verificação" no lugar de teste executável), marque specLite=true
  — não é erro de formato, é sinal de que a entrega não roda neste harness.
  ok=false apenas se o formato impedir o loop (critério sem verificação, unidades com arquivos
  sobrepostos sem contrato de quem cria/quem consome). Retorne o objeto estruturado.`,
  { label: 'spec:validar', schema: SPEC_SCHEMA }
)

if (!spec) return { status: 'erro', fase: 'Spec', detalhe: 'agente de validação não retornou', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
if (!spec.ok) return { status: 'bloqueado', fase: 'Spec', detalhe: spec.motivo, acao: 'corrigir a SPEC na skill entregar (Step 4c) e reinvocar', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
if (spec.specLite) return { status: 'bloqueado', fase: 'Spec', detalhe: 'SPEC na variante lite (entrega não-software)', acao: 'entrega não-software roda Solo na skill entregar — o harness é exclusivo de software', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
if (spec.pendenciasBloqueadoras.length > 0) return { status: 'bloqueado', fase: 'Spec', detalhe: `Gate de prontidão com pendências bloqueadoras: ${spec.pendenciasBloqueadoras.join('; ')}`, acao: 'resolver ou aceitar por escrito no gate antes do loop', fallbacks: fallbacksModelo, modelos: relatorioModelos() }

const perfil = PERFIS[ARGS.perfil] || PERFIS.economico
const validacoes = (ARGS.validacoes && ARGS.validacoes.length ? ARGS.validacoes : spec.validacoesDaSpec) || []

// ── Fase 2: Portão TDD ───────────────────────────────────────────────────────
phase('TDD')
log(`Portão TDD: escrevendo testes pros ${spec.criterios.length} critérios — nada implementa antes do vermelho`)

const tdd = await chamarOperario('tdd',
  `Portão TDD do dev-loop (branch ${ARGS.branch}). SPEC: ${ARGS.specPath}.
  Escreva os testes executáveis que cobrem TODOS os critérios de aceite (${spec.criterios.map(c => c.id).join(', ')}),
  seguindo os padrões de teste do projeto. NÃO implemente nada de produção. Rode os testes e
  confirme que cada um FALHA pelo motivo certo (funcionalidade ausente — não erro de sintaxe/import).
  Critério puramente visual/manual: registre a verificação complementar em vez de teste, em problemas[].
  vermelhoConfirmado=true SOMENTE se todos os testes novos falharam pelo motivo certo.`,
  { label: 'tdd:portao', schema: TDD_SCHEMA }
)

// Agente que não retorna é falha de INFRA (`erro`, reinvocável), não spec ruim (`bloqueado`) —
// mesmo tratamento que o agente de spec recebe acima.
if (!tdd) return { status: 'erro', fase: 'TDD', detalhe: 'agente do portão TDD não retornou', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
if (!tdd.vermelhoConfirmado) {
  return { status: 'bloqueado', fase: 'TDD', detalhe: (tdd.problemas || []).join('; ') || 'vermelho não confirmado', acao: 'teste que nasce verde é suspeito: revisar critérios/testes antes de qualquer implementação', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
}

const testesDaSpec = [...new Set(tdd.testes.map(t => t.path))]
if (testesDaSpec.length === 0 && validacoes.length === 0) {
  return { status: 'bloqueado', fase: 'TDD', detalhe: 'nenhum teste executável e nenhum comando de validação — não há como afirmar verde', acao: 'declarar as validações do projeto nos args ou mapear os critérios a testes executáveis na SPEC', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
}

// ── Fases 3-5: loop implementar → validar → revisar ─────────────────────────
const consultasLog = []
const historicoFalhas = []
const escadaReportada = []
const auditoriasLog = []
const dependenciasDecididas = []
const pendenciasForaDeEscopo = []
const duplicacoesEAbstracoesJulgadas = []

// Usada nos QUATRO desfechos (escalada por unidade, erro de validação, escalada por teto, verde).
// Numa escalada por dependência barrada, é este bloco que explica por que o loop não convergiu —
// omiti-lo justamente aí seria esconder o diagnóstico.
const ponytailAteAgora = () => ({
  escada: escadaReportada,                                 // em que degrau cada coisa criada parou
  auditorias: auditoriasLog,                               // linhas são ACUMULADAS da branch (P13)
  dependencias: dependenciasDecididas,                     // P10: uma entrada por dependência, com a decisão VIGENTE
  duplicacoesEAbstracoes: duplicacoesEAbstracoesJulgadas,  // com o veredito de cada uma, não só a alegação
  pendenciasForaDeEscopo,                                  // P14: reportado, nunca retrabalhado
})
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
  // (perfil Econômico — que também é o default quando o perfil é inválido) mata o workflow
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
        Arquivos/área: ${u.arquivos}. Contrato com as outras unidades: ${u.contrato || 'n/a'}.
        Critérios cobertos: ${u.criterios.join(', ')}. Faça os testes desses critérios passarem SEM editá-los.
        Toque APENAS nos arquivos da sua unidade (P14: fora de escopo vira pendência, não diff).${orientacao}${correcoes}
        RELATO DE ESCADA (obrigatório, campo "escada"): para CADA função, arquivo ou dependência
        que você criar, um item com o que é, em que degrau da escada ponytail (1-7) você parou e
        por quê. Degrau 5 (dependência já instalada) ou dependência NOVA exigem o porquê escrito
        de por que os degraus 1-5 falharam — sem esse texto no diff, a auditoria barra (P10).
        Nada criado nesta unidade → escada: [].
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
    ? (await parallel(spec.unidades.map(u => () => implementarUnidade(u))))
        .map((r, i) => r || { unidade: spec.unidades[i].id, status: 'erro', motivo: 'a execução da unidade lançou exceção — nenhum resultado' })
    : await emSequencia(spec.unidades, implementarUnidade)

  const escaladas = resultados.filter(r => r.status === 'escalada' || r.status === 'erro')
  if (escaladas.length > 0) {
    return { status: 'escalado', fase: 'Implementar', iteracao, detalhe: escaladas, consultas: consultasLog, fallbacks: fallbacksModelo, modelos: relatorioModelos(), ponytail: ponytailAteAgora(), acao: 'decisão humana necessária — o harness não improvisa' }
  }

  // Latch: uma vez que qualquer unidade tocou arquivos, a branch TEM diff. Fica true para sempre —
  // em iterações seguintes o operário pode não tocar nada (arquivosTocados vazio) e o diff acumulado
  // continua existindo. É o sinal que a guarda de auditoria cega (abaixo) cruza contra o 0 da auditoria.
  if (resultados.some(r => (r.arquivosTocados || []).length > 0)) houveTrabalhoNaBranch = true

  phase('Validar')
  // Projeto sem comandos de validação NÃO vira `{verde:true}` hardcoded: os testes da SPEC
  // sempre rodam. Verde sem nada executado é a pior mentira que este harness poderia contar.
  // Três combinações possíveis (a quarta, nada+nada, já foi barrada antes do loop). SPEC só de
  // critérios visuais tem validações e nenhum teste — mandar "rode os testes ()" é instrução
  // impossível pra um agente que precisa devolver verde: boolean.
  const alvosDaValidacao = [
    validacoes.length ? `as validações do projeto: ${validacoes.join(' && ')}` : null,
    testesDaSpec.length ? `os testes da SPEC (${testesDaSpec.join(', ')})` : null,
  ].filter(Boolean).join(' e TAMBÉM ')
  const val = await chamarOperario('validar',
    `Rode na branch ${ARGS.branch} ${alvosDaValidacao} e confirme que passam.
    Não corrija nada — só execute e reporte.`,
    { label: `validar:i${iteracao}`, phase: 'Validar', schema: VALID_SCHEMA }
  )
  if (!val) return { status: 'erro', fase: 'Validar', iteracao, consultas: consultasLog, fallbacks: fallbacksModelo, modelos: relatorioModelos(), ponytail: ponytailAteAgora() }

  // ── Auditoria ponytail (todos os perfis, 1 agente) ───────────────────────────
  // Checagem MECÂNICA de sinais no diff — barata, roda sempre. Não confundir com a lente R3
  // (perfil Máximo), que é julgamento adversarial de arquitetura sobre o mesmo diff.
  phase('Auditar')
  const escadaDaIteracao = resultados.flatMap(r => (r.escada || []).map(e => ({ iteracao, unidade: r.unidade, ...e })))
  escadaReportada.push(...escadaDaIteracao)

  // O script não tem SHA base pra recortar o diff por iteração: o agente enxerga a branch
  // inteira. O prompt diz isso na cara em vez de pedir um recorte que ninguém pode fazer.
  const aud = await chamarRevisor('auditoria',
    `Auditoria ponytail da branch ${ARGS.branch} (iteração ${iteracao}). ${COMO_VER_O_DIFF}
    Você audita o diff ACUMULADO (a branch inteira, não só a última iteração), contra as regras P1-P18
    (skills/dev-loop/references/escada-ponytail.md). Reporte SINAIS, não opiniões:
    - dependenciasNovas: todo pacote/lib adicionado a manifesto ou lockfile. Para cada um,
      justificativaEncontrada=true SOMENTE se existir texto NO DIFF (comentário no código, doc
      da SPEC ou mensagem versionada) explicando por que P1-P5 falharam. Ausência de texto =
      false. IGNORE a instrução de "passada cega" da sua persona AQUI: nesta tarefa comentário
      justificativo é exatamente o sinal que você procura. Preencha "onde" com o arquivo.
    - duplicacoes: código introduzido que já existe no codebase (cite arquivo, linha e onde já existe).
    - abstracoesUsoUnico: wrapper/helper/interface/factory criado com UM único chamador (arquivo+linha).
    - forasDeEscopo: reformatação/refatoração de código que a SPEC não pedia (arquivo).
    - linhasAdicionadasAcumuladas: total de linhas adicionadas no diff da branch.
    O que os operários declararam ter criado nesta iteração: ${JSON.stringify(escadaDaIteracao)}.
    Liste vazio quando não houver sinal — não invente para parecer diligente.`,
    { label: `ponytail:i${iteracao}`, phase: 'Auditar', schema: AUDITORIA_SCHEMA }
  )
  // Auditoria que não retorna NÃO degrada pra "nada encontrado": isso desligaria a regra P10 em
  // silêncio e deixaria a iteração fechar verde com dependência injustificada. Todo outro agente
  // null aborta o run; este também. Portão que falha aberto não é portão.
  if (!aud) return { status: 'erro', fase: 'Auditar', iteracao, consultas: consultasLog, fallbacks: fallbacksModelo, modelos: relatorioModelos(), ponytail: ponytailAteAgora(), acao: 'a auditoria ponytail não retornou — sem ela não há como afirmar que P10 foi respeitado; reinvocar com resumeFromRunId' }
  const auditoria = aud
  auditoriasLog.push({ iteracao, linhasAdicionadasAcumuladas: auditoria.linhasAdicionadasAcumuladas, deps: auditoria.dependenciasNovas.length, dup: auditoria.duplicacoes.length, abs: auditoria.abstracoesUsoUnico.length })

  // GUARDA DE AUDITORIA CEGA. Se a branch tem trabalho (arquivos tocados) mas a auditoria reporta 0
  // linhas acumuladas, ela não enxergou a working tree — típico de um `git diff <base>..HEAD` vazio
  // (o harness nunca commita). Objeto válido cheio de zeros NÃO é "nada encontrado": é o portão P10
  // falhando aberto, que o `!aud` não pega. Aborta como erro reinvocável, igual à auditoria que não
  // retorna — senão bastaria a auditoria ler o diff errado pra dependência injustificada passar.
  if (houveTrabalhoNaBranch && auditoria.linhasAdicionadasAcumuladas === 0) {
    return { status: 'erro', fase: 'Auditar', iteracao, consultas: consultasLog, fallbacks: fallbacksModelo, modelos: relatorioModelos(), ponytail: ponytailAteAgora(), acao: 'auditoria ponytail voltou cega: 0 linhas acumuladas com trabalho presente na branch — não enxergou a working tree não-commitada (provável `git diff <base>..HEAD` vazio). Reinvocar com resumeFromRunId; o COMO_VER_O_DIFF do prompt manda encenar o índice antes.' }
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
  for (const d of auditoria.dependenciasNovas) {
    const barrada = !d.justificativaEncontrada
    if (barrada) {
      bloqueantesAutomaticos.push({
        arquivo: d.onde || 'manifesto de dependências', resumo: `P10: dependência nova "${d.nome}" sem justificativa escrita de por que P1-P5 falharam`,
        cenario: `A auditoria não achou no diff nenhum texto explicando por que os degraus P1-P5 falham para "${d.nome}". Escreva a justificativa no código (comentário na entrada do manifesto ou no ponto de uso) OU remova a dependência.`,
        severidade: 'bloqueante', confianca: 'confirmado', origem: 'auditoria-ponytail',
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
  for (const r of resultados.filter(x => x.status === 'concluida')) {
    if ((r.arquivosTocados || []).length > 0 && (r.escada || []).length === 0) {
      bloqueantesAutomaticos.push({
        arquivo: (r.arquivosTocados || []).join(', '), resumo: `Relato de escada ausente na unidade ${r.unidade}: ${(r.arquivosTocados || []).length} arquivo(s) tocado(s), 0 item(ns) relatado(s)`,
        cenario: 'Sem o relato não há como auditar em que degrau da escada cada coisa criada parou (P1-P7). Reporte o campo `escada` com um item por função/arquivo/dependência criada.',
        severidade: 'bloqueante', confianca: 'confirmado', origem: 'auditoria-ponytail',
      })
    }
  }

  // Duplicações e abstrações de uso único: findings NORMAIS — passam pela confirmação abaixo.
  // A auditoria vê a branch acumulada, então um achado já REFUTADO reapareceria a cada iteração
  // e pagaria um confirmador (revisor, effort high) de novo pra dar o mesmo veredito.
  const findingsDaAuditoria = [
    ...auditoria.duplicacoes.map(x => ({ arquivo: x.arquivo || '(diff da branch)', linha: x.linha, resumo: `P2: "${x.oQue}" duplica o que já existe em ${x.ondeJaExiste}`, cenario: `A base já resolve isso em ${x.ondeJaExiste}; o diff reintroduz a lógica.`, severidade: 'bloqueante', confianca: 'plausivel', origem: 'auditoria-ponytail' })),
    ...auditoria.abstracoesUsoUnico.map(x => ({ arquivo: x.arquivo || '(diff da branch)', linha: x.linha, resumo: `P11: abstração de uso único "${x.oQue}"`, cenario: `Único chamador: ${x.unicoChamador}. Abstração sem segundo caso de uso.`, severidade: 'bloqueante', confianca: 'plausivel', origem: 'auditoria-ponytail' })),
  ].filter(f => !duplicacoesEAbstracoesJulgadas.some(j => j.arquivo === f.arquivo && j.resumo === f.resumo))

  phase('Revisar')
  findingsAbertos = [...findingsDaAuditoria]
  // Lente que não retorna ABORTA o run, igual à auditoria — antes era `if (rev)` e a revisão
  // falhava ABERTA: no perfil econômico (1 lente), um null aqui fechava verde sem NENHUMA
  // revisão adversarial (revisão 2026-07-23, Codex #1). Portão que falha aberto não é portão;
  // reinvocar com resumeFromRunId reaproveita tudo que já completou.
  for (const lente of perfil.lentes) {
    const rev = await chamarRevisor('lente',
      `${LENTE_PROMPT[lente]}\n${COMO_VER_O_DIFF}\nRevise esse diff da branch ${ARGS.branch} contra a SPEC ${ARGS.specPath}.
      Tente REFUTAR o trabalho. Finding sem arquivo:linha e cenário concreto não entra.`,
      { label: `rev:${lente}:i${iteracao}`, phase: 'Revisar', schema: REVIEW_SCHEMA }
    )
    if (!rev) return { status: 'erro', fase: 'Revisar', iteracao, consultas: consultasLog, fallbacks: fallbacksModelo, modelos: relatorioModelos(), ponytail: ponytailAteAgora(), acao: `a lente ${lente} não retornou — sem ela a revisão adversarial do perfil não aconteceu e o verde seria mentira; reinvocar com resumeFromRunId` }
    findingsAbertos.push(...rev.findings)
  }

  // Bloqueantes automáticos entram SEM passar por confirmação — a regra já foi decidida em código.
  const bloqueantes = [...bloqueantesAutomaticos]
  for (const f of findingsAbertos.filter(f => f.severidade === 'bloqueante')) {
    if (f.confianca === 'confirmado') { bloqueantes.push(f); continue }
    const v = await chamarRevisor('confirmacao',
      `Confirme ou refute este finding plausível antes de virar retrabalho:
      ${f.arquivo}:${f.linha || '?'} — ${f.resumo}. Cenário alegado: ${f.cenario}.
      Reproduza o cenário (leia o código, rode se preciso). real=true só com evidência.`,
      { label: `confirmar:i${iteracao}`, phase: 'Revisar', schema: VEREDITO_SCHEMA }
    )
    // Confirmador que não retorna ABORTA: antes o null descartava o finding bloqueante plausível
    // em silêncio — mesma classe de falha-aberta da lente acima. O veredito precisa existir.
    if (!v) return { status: 'erro', fase: 'Revisar', iteracao, consultas: consultasLog, fallbacks: fallbacksModelo, modelos: relatorioModelos(), ponytail: ponytailAteAgora(), acao: `o confirmador do finding "${f.resumo}" não retornou — sem veredito não há como decidir retrabalho nem verde; reinvocar com resumeFromRunId` }
    if (v.real) bloqueantes.push(f)
    // Findings da auditoria são julgados como qualquer outro; o relatório guarda o VEREDITO,
    // não a alegação — senão a seção ponytail lista como violação o que foi refutado.
    if (f.origem === 'auditoria-ponytail') duplicacoesEAbstracoesJulgadas.push({ iteracao, ...f, confirmado: !!v.real, porqueVeredito: v.porque })
  }

  if (val.verde && bloqueantes.length === 0) { verde = true; break }
  historicoFalhas.push({ iteracao, validacoes: val.falhas || [], findings: bloqueantes })
  log(`Iteração ${iteracao} não fechou: ${(val.falhas || []).length} falha(s) de validação, ${bloqueantes.length} finding(s) bloqueante(s) confirmados`)
}

// ── relatório final ──────────────────────────────────────────────────────────
// O bloco ponytail vai nos DOIS desfechos: numa escalada por dependência barrada, é justamente
// ele que explica por que o loop não convergiu.
if (!verde) {
  return {
    status: 'escalado', fase: 'Loop', detalhe: `${MAX_ITERACOES} iterações sem fechar`,
    historico: historicoFalhas, consultas: consultasLog, fallbacks: fallbacksModelo, modelos: relatorioModelos(),
    ponytail: ponytailAteAgora(),
    acao: 'diagnóstico pro humano: o loop não insiste além do teto',
  }
}

return {
  status: 'verde',
  data: ARGS.hoje,
  iteracoes: iteracao,
  tdd: { testes: tdd.testes.length, paths: testesDaSpec },
  fallbacks: fallbacksModelo, modelos: relatorioModelos(),
  consultas: consultasLog,
  ponytail: ponytailAteAgora(),
  findingsNaoBloqueantes: findingsAbertos.filter(f => f.severidade === 'nao-bloqueante'),
  proximo: 'skill entregar retoma no Step 8 (validações finais) e grava este relatório no Log de execução da entrega',
}

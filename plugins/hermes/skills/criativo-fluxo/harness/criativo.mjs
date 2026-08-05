export const meta = {
  name: 'hermes-criativo-fluxo',
  description: 'Harness do fluxo criativo: rotas em rough com aprovação visual humana, produção de candidatos com seleção, crítica adversarial fail-closed e pacote com rationale — invariantes em código, não em prosa',
  whenToUse: 'Invocado pela skill criativo-fluxo do hermes em dois estágios: rotas (brief aprovável → roughs pro humano escolher) e produzir (rota aprovada → render validado). Não usar sem brief, sem venv validado e sem opt-in de custo.',
  phases: [
    { title: 'Rotas', detail: 'briefing interrogado, prancheta e 2-3 rotas visuais ancoradas em referência' },
    { title: 'Roughs', detail: 'um rascunho barato por rota — o humano escolhe VENDO, não lendo' },
    { title: 'Portão', detail: 'estágio produzir só roda com rota_aprovada no artefato' },
    { title: 'Produzir', detail: 'candidatos em paralelo, seleção contra baseline, composição e pre-flight' },
    { title: 'Crit', detail: 'crítica adversarial fail-closed; finding plausível confirmado antes de virar retrabalho' },
    { title: 'Pacote', detail: 'reports de validação gravados SEMPRE + pacote de aprovação com rationale' },
  ],
}

// ── args esperados (montados pela skill criativo-fluxo) ──────────────────────
// Estágio A (rotas):    { estagio: 'rotas', briefPath, python, hoje, perfil?, tiering?, dirs? }
// Estágio B (produzir): { estagio: 'produzir', rotasPath, python, hoje, perfil?, tiering?, dirs? }
//
// dirs: { marketing?, branding?, contexto?, scripts? } — a skill SEMPRE injeta os paths-base
// RESOLVIDOS pela regra única (CLAUDE.md do workspace → defaults local_* → convenção
// descoberta no cwd → default documentado). Ausente ou parcial existe só para
// retrocompatibilidade com callers anteriores e cai nos defaults documentados
// (marketing/, branding/, contexto/, scripts/). O harness nunca lê config.
//
// O cwd da sessão DEVE ser a raiz de um workspace no layout hermes (contrato na skill):
// <marketing>/criativos/{briefs,base,renders}, <marketing>/registry/criativos/,
// <marketing>/referencias/banco-visual/, <marketing>/producao/pacotes-aprovacao/, <branding>/.
// Este script não tem filesystem nem env — quem valida venv/layout e lê defaults é a skill;
// os agents fazem todo trabalho de arquivo. `hoje` vem de fora (o script não tem relógio).
//
// tiering: { modelos?: {step: modelo}, efforts?: {step: effort} } — OPCIONAL, montado pela
// skill a partir de ~/.claude/hermes/defaults.md (campos criativo_*). Enforcement em código:
// promoção só dentro do papel (rotas: opus→fable, dirigida por criativo_diretor; producao/
// correcao: sonnet→opus), rebaixamento só nos steps mecânicos whitelisted e só pra haiku.
// Pedido fora disso é IGNORADO e registrado em `modelos.recusados` — nunca aplicado em silêncio.

const PERFIS = {
  economico:  { rotas: 2, candidatos: 2 },
  balanceado: { rotas: 3, candidatos: 3 },
  maximo:     { rotas: 3, candidatos: 4 },
}

const MAX_ITERACOES = 3
// Política de custo em código (era prosa e furou): rodadas de GERAÇÃO de imagem por run =
// 1 inicial + até 2 re-gerações. NOTA HONESTA (revisão 1.0.1): com MAX_ITERACOES=3 e no
// máximo 1 rodada por iteração, este teto coincide com o de iterações — a guarda protege
// configurações futuras que subam o teto de iterações, não muda o run default. Falha de
// overlay/copy NUNCA gasta geração nova — recompõe sobre a base escolhida (custo zero de API).
const MAX_RODADAS_IA = 3

// ── tiering de modelo/effort por step ────────────────────────────────────────
// A unidade de configuração é o STEP: papel fixo, modelo default e lista FECHADA de
// permitidos. `rotas` promove opus→fable por default (decisão estética é o análogo do
// planner; criativo_diretor governa — espelho do arquiteto do odin). Julgamento do validador
// é Opus sempre, com piso de effort high (lição do odin 2.3.1: travar só o modelo deixa o
// effort como alavanca destravada). Haiku só nos steps mecânicos whitelisted.
const MODELOS_STEP = {
  rotas:       { papel: 'diretor',   padrao: 'fable',  permitidos: ['fable', 'opus'],  effort: 'high', effortPiso: 'high' },
  roughs:      { papel: 'mecanico',  padrao: 'haiku',  permitidos: ['haiku', 'sonnet'], effort: 'low' },
  portao:      { papel: 'produtor',  padrao: 'sonnet', permitidos: ['sonnet', 'haiku'], effort: null },
  producao:    { papel: 'produtor',  padrao: 'sonnet', permitidos: ['sonnet', 'opus'],  effort: null },
  selecao:     { papel: 'validador', padrao: 'opus',   permitidos: ['opus'],            effort: 'high', effortPiso: 'high' },
  composicao:  { papel: 'mecanico',  padrao: 'haiku',  permitidos: ['haiku', 'sonnet'], effort: 'low' },
  preflight:   { papel: 'mecanico',  padrao: 'haiku',  permitidos: ['haiku', 'sonnet'], effort: 'low' },
  crit:        { papel: 'validador', padrao: 'opus',   permitidos: ['opus'],            effort: 'high', effortPiso: 'high' },
  confirmacao: { papel: 'validador', padrao: 'opus',   permitidos: ['opus'],            effort: 'high', effortPiso: 'high' },
  correcao:    { papel: 'produtor',  padrao: 'sonnet', permitidos: ['sonnet', 'opus'],  effort: null },
  pacote:      { papel: 'mecanico',  padrao: 'haiku',  permitidos: ['haiku', 'sonnet'], effort: 'low' },
}
const EFFORTS_VALIDOS = ['low', 'medium', 'high', 'xhigh']
const EFFORT_RANK = { low: 0, medium: 1, high: 2, xhigh: 3 }

// ── schemas ──────────────────────────────────────────────────────────────────
// required mínimo (só `ok`): a RECUSA do briefing interrogado (ok=false + motivo) precisa ser
// resposta conforme — schema que exige slug/artefato até na recusa torna o `bloqueado`
// inalcançável e transforma brief vago em falso erro de infra (finding #1 da revisão 1.0.1).
// Quando ok=true, o código guarda os campos essenciais logo após a chamada.
const ROTAS_SCHEMA = { type: 'object', additionalProperties: false, required: ['ok'], properties: {
  ok: { type: 'boolean' }, motivo: { type: 'string' },
  slug: { type: 'string' },
  artefatoPath: { type: 'string' },       // <marketing>/registry/criativos/<slug>__rotas.md, escrito pelo diretor
  conflitoTrilho: { type: 'string' },     // brief pede arquétipo X mas a vencedora do trilho é Y — decisão humana
  prancheta: { type: 'object', properties: {
    baselinePath: { type: ['string', 'null'] }, paleta: { type: 'array', items: { type: 'string' } },
    clonar: { type: 'string' }, evitar: { type: 'string' },
    aprendizados: { type: 'array', items: { type: 'string' } },
  } },
  rotas: { type: 'array', items: { type: 'object', required: ['n', 'nome', 'arquetipo', 'raca', 'comandoRough'], properties: {
    n: { type: 'number' }, nome: { type: 'string' }, arquetipo: { type: 'string' },
    raca: { type: 'string' },              // chave histórica do schema; valor = segmento temático genérico do workspace
    composicao: { type: 'string' }, promptIa: { type: ['string', 'null'] },
    comandoRough: { type: 'string' }, comandoOverlay: { type: 'string' },
    referencia: { type: 'string' }, porque: { type: 'string' },
  } } },
} }

// Contrato genérico dos steps mecânicos: comandos executados + artefatos que EXISTEM no disco.
const EXEC_SCHEMA = { type: 'object', additionalProperties: false, required: ['ok', 'artefatos', 'falhas'], properties: {
  ok: { type: 'boolean' },
  artefatos: { type: 'array', items: { type: 'string' } },
  falhas: { type: 'array', items: { type: 'object', required: ['comando', 'resumo'], properties: {
    comando: { type: 'string' }, criterio: { type: 'string' }, resumo: { type: 'string' },
  } } },
} }

// Booleans de guarda são required: omissão schema-legal de renderJaExiste anularia a proteção
// contra sobrescrever render publicado, e roughExiste é o enforcement da aprovação VISUAL
// (findings #2/#6 da revisão 1.0.1). `rota` segue opcional no schema (a recusa não a tem);
// quando aprovada=true, o código exige os campos essenciais dela logo após a chamada.
const PORTAO_SCHEMA = { type: 'object', additionalProperties: false, required: ['ok', 'aprovada', 'renderJaExiste', 'reproduzir', 'roughExiste'], properties: {
  ok: { type: 'boolean' }, aprovada: { type: 'boolean' }, motivo: { type: 'string' },
  renderJaExiste: { type: 'boolean' }, reproduzir: { type: 'boolean' },
  roughExiste: { type: 'boolean' },     // o arquivo de rough da rota APROVADA existe no disco? (false quando não aprovada)
  rota: { type: 'object', required: ['n', 'arquetipo', 'slug'], properties: {
    n: { type: 'number' }, nome: { type: 'string' }, arquetipo: { type: 'string' },
    slug: { type: 'string' }, raca: { type: 'string' }, formato: { type: 'string' },
    promptIa: { type: ['string', 'null'] }, comandoOverlay: { type: 'string' },
    textoEsperado: { type: 'string' }, copy: { type: ['string', 'null'] },
    baselinePath: { type: ['string', 'null'] }, mockupPath: { type: ['string', 'null'] },
    briefPath: { type: 'string' }, briefResumo: { type: 'string' },
  } },
} }

const PRODUCAO_SCHEMA = { type: 'object', additionalProperties: false, required: ['ok', 'candidatos', 'falhas'], properties: {
  ok: { type: 'boolean' }, motivo: { type: 'string' },
  candidatos: { type: 'array', items: { type: 'string' } },   // paths que EXISTEM no disco
  falhas: { type: 'array', items: { type: 'object', required: ['comando', 'resumo'], properties: {
    comando: { type: 'string' }, resumo: { type: 'string' },
  } } },
} }

const SELECAO_SCHEMA = { type: 'object', additionalProperties: false, required: ['escolhido', 'ranking'], properties: {
  escolhido: { type: 'string' },
  ranking: { type: 'array', items: { type: 'object', required: ['candidato', 'nota', 'porque'], properties: {
    candidato: { type: 'string' }, nota: { type: 'number' }, porque: { type: 'string' },
  } } },
} }

const CRIT_SCHEMA = { type: 'object', additionalProperties: false, required: ['findings'], properties: {
  findings: { type: 'array', items: { type: 'object', required: ['criterio', 'resumo', 'evidencia', 'cenario', 'severidade', 'confianca', 'custoCorrecao'], properties: {
    // enum, não string livre: os critérios A-J são contrato executável — "criterio: vibe"
    // não entra em bloqueantes sem ninguém perceber (finding #11 da revisão 1.0.1).
    criterio: { enum: ['arquetipo_correto', 'rosto_nao_coberto', 'principios_duros', 'fidelidade_referencia', 'fidelidade_estampa', 'naturalidade_ia', 'texto_correto', 'legibilidade_thumbnail', 'mensagem_completa', 'voz_da_marca'] },
    resumo: { type: 'string' }, evidencia: { type: 'string' }, cenario: { type: 'string' },
    severidade: { enum: ['bloqueante', 'nao-bloqueante'] },
    confianca: { enum: ['confirmado', 'plausivel'] },
    custoCorrecao: { enum: ['overlay', 'ia', 'copy'] },
    acaoSugerida: { type: 'string' },
  } } },
} }

const VEREDITO_SCHEMA = { type: 'object', additionalProperties: false, required: ['real'], properties: { real: { type: 'boolean' }, porque: { type: 'string' } } }

const CORRECAO_SCHEMA = { type: 'object', additionalProperties: false, required: ['resumo'], properties: {
  resumo: { type: 'string' },
  comandoOverlay: { type: ['string', 'null'] },   // null = manter o atual
  promptIa: { type: ['string', 'null'] },         // null = sem re-geração
  copyCorrigida: { type: ['string', 'null'] },    // null = copy segue como está
} }

const PACOTE_SCHEMA = { type: 'object', additionalProperties: false, required: ['ok', 'pacotePath', 'gravados', 'falhas'], properties: {
  ok: { type: 'boolean' }, pacotePath: { type: 'string' },
  gravados: { type: 'array', items: { type: 'string' } },
  falhas: { type: 'array', items: { type: 'object', required: ['comando', 'resumo'], properties: {
    comando: { type: 'string' }, resumo: { type: 'string' },
  } } },
} }

// ── helpers ──────────────────────────────────────────────────────────────────
const DIRETOR = { agentType: 'hermes:diretor-de-arte' }        // opus no frontmatter (piso do papel)
const PRODUTOR = { agentType: 'hermes:produtor-de-criativo' }  // sonnet no frontmatter
const VALIDADOR = { agentType: 'hermes:validador-de-criativo' }// opus no frontmatter
const MECANICO = { agentType: 'hermes:mecanico-de-criativo' }  // haiku — só steps whitelisted chegam aqui

// agent() devolve null por indisponibilidade/schema inválido/timeout — e pode LANÇAR.
// Exceção vira null: todo call site trata null como desfecho estruturado. Morrer sem
// relatório não é opção (invariante herdado do odin 2.3.1 / mimyr 1.1.0).
const tentar = async (prompt, opts) => { try { return await agent(prompt, opts) } catch (e) { return null } }

// Fallbacks nas DUAS pontas do tiering, espelhando odin/mimyr: chamada promovida (fable no
// diretor, opus no produtor) que não retorna cai pro piso do frontmatter e desliga a promoção
// pelo resto do run; chamada rebaixada pra haiku que não retorna repete UMA vez no produtor
// (Sonnet, piso do papel executor) e desliga o haiku. O registro não afirma culpa —
// indisponibilidade, schema inválido e timeout são indistinguíveis aqui. Um null JÁ NO PISO
// segue o tratamento normal do step (fail-closed de quem chamou).
const fallbacksModelo = []
let haikuMorto = false
let promocaoDiretorMorta = false
let promocaoProdutorMorta = false

// Escape pra interpolar texto livre em comando de shell (texto de arte vem do brief):
// aspas simples com quote-out — o único ponto do harness que monta shell com string livre.
const shq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`

// Modelo EFETIVO por step, registrado no momento de cada execução — não inferido de flags
// globais no fim (um fallback tardio não pode re-rotular steps que já rodaram no tier certo;
// finding #5 do Codex na revisão 1.0.1). Última execução vence (steps repetem por iteração).
const execucoesPorStep = {}
const registrarExec = (step, modelo) => { execucoesPorStep[step] = modelo }

async function chamarDiretor(step, prompt, opts) {
  const t = TIERING[step]
  const base = { ...DIRETOR, ...(t.effort ? { effort: t.effort } : {}), ...opts }
  if (t.modelo === 'fable' && !promocaoDiretorMorta) {
    const r = await tentar(prompt, { ...base, model: 'fable' })
    if (r) { registrarExec(step, 'fable'); return r }
    promocaoDiretorMorta = true
    fallbacksModelo.push({ step, chamada: base.label, de: 'fable (promoção)', para: 'opus (frontmatter)', causa: 'a chamada promovida não retornou (tier indisponível, schema inválido ou timeout — indistinguíveis aqui); promoção desligada para o resto do run' })
  }
  registrarExec(step, t.modelo === 'fable' ? 'opus (fallback da promoção)' : t.modelo)
  return await tentar(prompt, base)
}

async function chamarProdutor(step, prompt, opts) {
  const t = TIERING[step]
  const base = { ...PRODUTOR, ...(t.effort ? { effort: t.effort } : {}), ...opts }
  if (t.modelo === 'haiku' && !haikuMorto) {
    const r = await tentar(prompt, { ...base, ...MECANICO })
    if (r) { registrarExec(step, 'haiku'); return r }
    haikuMorto = true
    fallbacksModelo.push({ step, chamada: base.label, de: 'haiku (mecanico)', para: 'sonnet (produtor)', causa: 'a chamada rebaixada não retornou; haiku desligado para o resto do run' })
    registrarExec(step, 'sonnet (fallback do haiku)')
    return await tentar(prompt, base)
  }
  if (t.modelo === 'opus' && !promocaoProdutorMorta) {
    const r = await tentar(prompt, { ...base, model: 'opus' })
    if (r) { registrarExec(step, 'opus'); return r }
    promocaoProdutorMorta = true
    fallbacksModelo.push({ step, chamada: base.label, de: 'opus (promoção)', para: 'sonnet (frontmatter)', causa: 'a chamada promovida não retornou; promoção desligada para o resto do run' })
    registrarExec(step, 'sonnet (fallback da promoção)')
    return await tentar(prompt, base)
  }
  registrarExec(step, t.modelo === 'haiku' ? 'sonnet (haiku desligado no run)' : t.modelo === 'opus' ? 'sonnet (promoção desligada no run)' : t.modelo)
  return await tentar(prompt, base)
}

async function chamarMecanico(step, prompt, opts) {
  const t = TIERING[step]
  const base = { ...PRODUTOR, ...(t.effort ? { effort: t.effort } : {}), ...opts }
  if (t.modelo === 'haiku' && !haikuMorto) {
    const r = await tentar(prompt, { ...base, ...MECANICO })
    if (r) { registrarExec(step, 'haiku'); return r }
    haikuMorto = true
    fallbacksModelo.push({ step, chamada: base.label, de: 'haiku (mecanico)', para: 'sonnet (produtor)', causa: 'a chamada rebaixada não retornou; haiku desligado para o resto do run' })
    registrarExec(step, 'sonnet (fallback do haiku)')
    return await tentar(prompt, base)
  }
  // haiku morto ou rebaixamento desligado: roda no produtor (sonnet), piso do papel executor
  registrarExec(step, t.modelo === 'haiku' ? 'sonnet (haiku desligado no run)' : t.modelo)
  return await tentar(prompt, base)
}

// Validador é opus SEMPRE (MODELOS_STEP não permite outro modelo) — só o effort é configurável.
const chamarValidador = (step, prompt, extra) => { registrarExec(step, 'opus'); return tentar(prompt, { ...VALIDADOR, ...(TIERING[step].effort ? { effort: TIERING[step].effort } : {}), ...extra }) }

// ── Fase 0: args válidos (falha barata antes de gastar agente) ───────────────
let ARGS = args
if (typeof ARGS === 'string') {
  try { ARGS = JSON.parse(ARGS) } catch {
    return { status: 'erro', fase: 'Args', detalhe: 'args chegou como string e não é JSON válido', acao: 'reinvocar o Workflow com args objeto: {estagio, briefPath|rotasPath, python, hoje}' }
  }
}
if (!ARGS || typeof ARGS !== 'object' || Array.isArray(ARGS)) {
  return { status: 'erro', fase: 'Args', detalhe: `args deve ser um objeto JSON, recebi ${Array.isArray(ARGS) ? 'array' : typeof ARGS}`, acao: 'reinvocar o Workflow com args objeto: {estagio, briefPath|rotasPath, python, hoje}' }
}
if (!['rotas', 'produzir'].includes(ARGS.estagio)) {
  return { status: 'erro', fase: 'Args', detalhe: `estagio deve ser 'rotas' ou 'produzir', recebi: ${ARGS.estagio}`, acao: "reinvocar com estagio: 'rotas' (brief → roughs) ou 'produzir' (rota aprovada → render)" }
}
const chaveEntrada = ARGS.estagio === 'rotas' ? 'briefPath' : 'rotasPath'
const argsFaltando = [chaveEntrada, 'python', 'hoje'].filter(k => !ARGS[k])
if (argsFaltando.length > 0) {
  return { status: 'erro', fase: 'Args', detalhe: `args obrigatórios ausentes: ${argsFaltando.join(', ')}`, acao: `reinvocar o Workflow com args completos: {estagio: '${ARGS.estagio}', ${chaveEntrada}, python, hoje} — python é o venv do workspace, validado pela skill ANTES de invocar` }
}
const perfil = PERFIS[ARGS.perfil] || PERFIS.balanceado

// Paths-base do workspace: resolvidos pela SKILL (regra única) e injetados via args.dirs.
// Ausência parcial é apenas retrocompatibilidade e cai no default documentado; o harness
// nunca lê config de path.
const dirsArg = ARGS.dirs && typeof ARGS.dirs === 'object' && !Array.isArray(ARGS.dirs) ? ARGS.dirs : {}
const DIR = {
  marketing: dirsArg.marketing || 'marketing',
  branding: dirsArg.branding || 'branding',
  contexto: dirsArg.contexto || 'contexto',
  scripts: dirsArg.scripts || 'scripts',
}

// Resolução do tiering: defaults da tabela + pedido dos args, com a whitelist decidindo.
// Pedido recusado NÃO degrada o run — o step roda no default e a recusa vai pro relatório.
const tieringRecusado = []
const TIERING = {}
{
  const mapaOuRecusa = (valor, nome) => {
    if (valor == null) return {}
    if (typeof valor !== 'object' || Array.isArray(valor)) {
      tieringRecusado.push({ step: `(${nome})`, pedido: valor, causa: `${nome} deve ser objeto {step: valor}, recebi ${Array.isArray(valor) ? 'array' : typeof valor}` })
      return {}
    }
    return valor
  }
  const pedidoModelos = mapaOuRecusa(ARGS.tiering && ARGS.tiering.modelos, 'tiering.modelos')
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
      else if (cfg.effortPiso && EFFORT_RANK[e] < EFFORT_RANK[cfg.effortPiso]) tieringRecusado.push({ step, pedido: e, mantido: effort, causa: `effort abaixo do piso do step (piso: ${cfg.effortPiso}) — julgamento adversarial não aceita o porão` })
      else effort = e
    }
    TIERING[step] = { modelo, effort }
  }
  for (const step of new Set([...Object.keys(pedidoModelos), ...Object.keys(pedidoEfforts)])) {
    if (!Object.prototype.hasOwnProperty.call(MODELOS_STEP, step)) tieringRecusado.push({ step, pedido: pedidoModelos[step] ?? pedidoEfforts[step], causa: `step desconhecido (existem: ${Object.keys(MODELOS_STEP).join(', ')})` })
  }
}
log(`Tiering por step: ${Object.entries(TIERING).map(([s, t]) => `${s}=${t.modelo}${t.effort ? `(${t.effort})` : ''}`).join(' · ')}`)
if (tieringRecusado.length > 0) log(`Tiering: ${tieringRecusado.length} pedido(s) recusado(s) pela whitelist — ver modelos.recusados no relatório`)

// Modelos/efforts EFETIVOS por step — do registro de execução real (execucoesPorStep), não de
// flags globais: um fallback tardio não re-rotula step que já rodou no tier certo. Step nunca
// despachado neste run aparece com o configurado + a marca "(não despachado)". Em TODO desfecho.
const relatorioModelos = () => ({
  porStep: Object.fromEntries(Object.keys(MODELOS_STEP).map(s => {
    const t = TIERING[s]
    const efetivo = execucoesPorStep[s] || `${t.modelo} (não despachado no run)`
    return [s, { modelo: efetivo, effort: t.effort || 'herdado da sessão' }]
  })),
  recusados: tieringRecusado,
})

// ═════════════════════════════════════════════════════════════════════════════
// ESTÁGIO A — ROTAS: briefing interrogado → prancheta → rotas → roughs → humano
// ═════════════════════════════════════════════════════════════════════════════
if (ARGS.estagio === 'rotas') {
  phase('Rotas')
  log(`Diretor de arte sobre ${ARGS.briefPath} — até ${perfil.rotas} rotas`)

  const dir = await chamarDiretor('rotas',
    `Você é o diretor de arte do run. Brief: ${ARGS.briefPath} (leia-o primeiro).
    1. BRIEFING INTERROGADO: o brief tem produto, público, objetivo, UMA mensagem central E a
       ideia do Portão 1 consolidada nele — observação humana (verdade específica observável;
       cumplicidade genérica do tipo "quem tem X entende" NÃO é observação), headline aprovada
       nos 4 testes de copy (troca do termo definidor, fala humana, "e daí?", verdade
       comercial) e hierarquia de leitura (1º / 2º / produto / ação)? Falta qualquer um →
       ok=false com motivo listando o que falta (na recusa devolva SÓ ok e motivo — sem slug,
       sem artefato, sem rotas). Você não completa com suposição, e brief sem ideia NÃO vira
       rota: rough custa API e peça sem ideia não se conserta em composição.
    2. PRANCHETA: leia ${DIR.branding}/principios-criativos.md, ${DIR.branding}/arquetipos-criativos.md,
       ${DIR.contexto}/identidade-visual.md, o índice ${DIR.marketing}/referencias/banco-visual/_indice.csv
       (e os .md/.png das referências que casam com o brief — vencedora do arquétipo+raça é a
       baseline), e a seção de aprendizados de produção do branding se existir. Compile:
       baselinePath (PNG da vencedora ou null), paleta, o que clonar, o que evitar, aprendizados.
    3. ROTAS: proponha ${perfil.rotas} rotas visuais GENUINAMENTE distintas (composição/ângulo/
       mood — não variações da mesma ideia), cada uma com: n (1..${perfil.rotas}), nome curto,
       arquetipo (slug canônico do branding), raca (chave histórica do schema cujo VALOR é o
       segmento temático genérico usado na subpasta de renders; "raça" é só o caso do workspace de origem),
       composicao executável, promptIa (fotografia
       realista, SEM texto na imagem; null se arquétipo texto), comandoRough (o comando MAIS
       BARATO que comunica a rota: 1 chamada de ${DIR.scripts}/gerar_imagem.py com ${ARGS.python}, saída
       ${DIR.marketing}/criativos/base/<slug>__rota<n>_rough.png — ou, no arquétipo texto, o comando
       compor_*.py de comp, custo zero), comandoOverlay previsto completo — com saída
       OBRIGATORIAMENTE em ${DIR.marketing}/criativos/renders/<raca>/<slug>.png, a convenção canônica
       do registry, e, nos arquétipos com imagem IA, com o path da imagem-base escrito como o
       placeholder literal {{BASE}} (o harness substitui em CÓDIGO pelo candidato selecionado;
       nunca escreva um path real de base no comando de overlay) —, referencia que ancora e
       porque. Se o brief pedir arquétipo diferente do trilho vencedor, preencha conflitoTrilho.
    4. Defina o slug na convenção do registry (${DIR.marketing}/registry/README.md) e ESCREVA o artefato
       ${DIR.marketing}/registry/criativos/<slug>__rotas.md com frontmatter YAML: slug, brief_path,
       criado_em: ${ARGS.hoje}, rota_aprovada: null, prancheta e as rotas completas (todos os
       campos acima) — mais uma seção legível '## Rotas' com o porquê de cada uma. O campo
       rota_aprovada fica null: quem aprova é o humano, fora deste run.
    Retorne o objeto estruturado espelhando o que gravou.`,
    { label: 'rotas:dirigir', phase: 'Rotas', schema: ROTAS_SCHEMA }
  )

  if (!dir) return { status: 'erro', fase: 'Rotas', detalhe: 'o diretor de arte não retornou', fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'reinvocar com resumeFromRunId' }
  if (!dir.ok) return { status: 'bloqueado', fase: 'Rotas', detalhe: dir.motivo || 'brief não passou no briefing interrogado', acao: 'completar o brief com o humano (produto, público, objetivo, mensagem única + a ideia do Portão 1: observação humana, headline aprovada nos 4 testes de copy, hierarquia de leitura) e reinvocar — o diretor não completa brief com suposição; nenhuma API de imagem foi gasta', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
  if (!dir.rotas || dir.rotas.length === 0) return { status: 'bloqueado', fase: 'Rotas', detalhe: 'diretor não propôs nenhuma rota', acao: 'revisar o brief com o humano e reinvocar', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
  // ok=true incompleto (sem slug/artefato) é não-conformidade do agente, não problema de brief.
  if (!dir.slug || !dir.artefatoPath) return { status: 'erro', fase: 'Rotas', detalhe: 'diretor aprovou o brief mas não devolveu slug/artefatoPath — resposta não-conforme', fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'reinvocar com resumeFromRunId' }

  phase('Roughs')
  log(`Gerando ${dir.rotas.length} rough(s) em paralelo — 1 por rota`)
  const roughs = await parallel(dir.rotas.map(r => () =>
    chamarMecanico('roughs',
      `Execute EXATAMENTE este comando no diretório de trabalho ATUAL da sessão (venv: ${ARGS.python})
      e confirme que o arquivo de saída existe no disco depois:
      ${r.comandoRough}
      REGRA DE CWD: rode a partir do cwd atual da sessão, SEM cd para nenhum outro diretório —
      os paths relativos do comando resolvem a partir dele; se não resolverem, reporte falha em
      vez de procurar o workspace em outro lugar.
      ok=true SOMENTE se o arquivo de saída existe. artefatos = [path do arquivo gerado].
      Se o comando falhar, rode-o UMA segunda vez antes de reportar falha (API de imagem oscila).
      Não ajuste flag nenhuma.`,
      { label: `rough:rota${r.n}`, phase: 'Roughs', schema: EXEC_SCHEMA }
    )
  ))
  const rotasComRough = dir.rotas.map((r, i) => {
    const res = roughs[i]
    const okRough = !!(res && res.ok && res.artefatos && res.artefatos.length > 0)
    return { n: r.n, nome: r.nome, arquetipo: r.arquetipo, referencia: r.referencia, porque: r.porque, rough: okRough ? res.artefatos[0] : null, falha: okRough ? null : (res && res.falhas && res.falhas.length ? res.falhas[0].resumo : 'o mecânico do rough não retornou') }
  })
  if (rotasComRough.every(r => !r.rough)) {
    return { status: 'escalado', fase: 'Roughs', detalhe: rotasComRough, fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'nenhum rough foi gerado (API de imagem/venv indisponível?) — sem rough não há escolha VISUAL de rota; corrigir o setup com o humano e reinvocar' }
  }

  return {
    status: 'aguardando-rota',
    slug: dir.slug,
    rotasPath: dir.artefatoPath,
    conflitoTrilho: dir.conflitoTrilho || null,
    prancheta: dir.prancheta || null,
    rotas: rotasComRough,
    fallbacks: fallbacksModelo, modelos: relatorioModelos(),
    proximo: `a skill mostra os roughs ao humano (Read nos PNGs), ele escolhe VENDO; a skill grava rota_aprovada: <n> (e aprovada_em: data) no frontmatter de ${dir.artefatoPath} e reinvoca o harness com {estagio: 'produzir', rotasPath}. Rough indisponível de uma rota não impede escolher outra.`,
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ESTÁGIO B — PRODUZIR: portão de rota → candidatos → seleção → composição →
// pre-flight → crit adversarial → correção → pacote (reports SEMPRE)
// ═════════════════════════════════════════════════════════════════════════════
phase('Portão')
log(`Validando portão de rota em ${ARGS.rotasPath}`)

const portao = await chamarProdutor('portao',
  `Valide o portão de rota do fluxo criativo. Leia ${ARGS.rotasPath} (artefato de rotas):
  - aprovada=true SOMENTE se o frontmatter tem rota_aprovada: <n> apontando pra uma rota que
    existe no artefato. null/ausente/inválido → aprovada=false com motivo. Você NÃO improvisa.
  - Extraia da rota aprovada: n, nome, arquetipo, slug (do artefato), raca (chave histórica
    cujo valor é o segmento temático genérico da subpasta de renders), formato,
    promptIa (null se arquétipo texto), comandoOverlay, textoEsperado (o texto da arte previsto
    no comando/brief), copy (headline/body/descricao do brief, como texto corrido; null se o
    brief não traz copy), baselinePath (da prancheta), mockupPath (se o brief/registry aponta
    mockup de produto; senão null), briefPath e briefResumo (3-5 linhas: mensagem, público,
    oferta/prazo prometidos — o crit julga completude por isso).
  - renderJaExiste: o arquivo ${DIR.marketing}/criativos/renders/<raca>/<slug>.png já existe no disco?
  - reproduzir: o frontmatter tem reproduzir: true?
  - roughExiste: o arquivo de rough da rota APROVADA (o path de saída do comando_rough dela)
    existe no disco? Confira de verdade (ls). Quando aprovada=false, devolva roughExiste=false.
  ok=false (com motivo) se o artefato não existe ou está incompleto. Os quatro booleans
  (aprovada, renderJaExiste, reproduzir, roughExiste) são SEMPRE respondidos, inclusive na
  recusa (com false). Retorne o objeto.`,
  { label: 'portao:validar', phase: 'Portão', schema: PORTAO_SCHEMA }
)

if (!portao) return { status: 'erro', fase: 'Portão', detalhe: 'o validador do portão não retornou', fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'reinvocar com resumeFromRunId' }
if (!portao.ok) return { status: 'bloqueado', fase: 'Portão', detalhe: portao.motivo || 'artefato de rotas ausente ou incompleto', acao: 'rodar o estágio rotas primeiro (ou corrigir o artefato) e reinvocar', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
if (!portao.aprovada) return { status: 'bloqueado', fase: 'Portão', detalhe: 'rota_aprovada ausente no artefato — o humano ainda não escolheu a rota', acao: 'apresentar os roughs ao humano, gravar rota_aprovada: <n> no frontmatter e reinvocar — o harness não produz com o portão aberto (nenhuma API de imagem foi gasta)', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
if (portao.renderJaExiste && !portao.reproduzir) {
  return { status: 'bloqueado', fase: 'Portão', detalhe: `o render final do slug já existe e o artefato não tem reproduzir: true`, acao: 'confirmar com o humano: marcar reproduzir: true no artefato de rotas (sobrescreve) ou versionar o slug (v<N+1>) — o harness não sobrescreve render publicado em silêncio', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
}
// Aprovado sem rota extraível é resposta não-conforme — desreferenciar sem guarda mataria o
// run com TypeError SEM relatório, o invariante que este arquivo declara (finding #2, 1.0.1).
if (!portao.rota || !portao.rota.arquetipo || !portao.rota.slug || !portao.rota.raca || !portao.rota.comandoOverlay) {
  return { status: 'erro', fase: 'Portão', detalhe: 'portão aprovou mas não devolveu a rota completa (arquetipo/slug/raca como segmento temático/comandoOverlay)', fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'reinvocar com resumeFromRunId' }
}
// Enforcement da aprovação VISUAL (a headline da fase, antes só em prosa — finding #6, 1.0.1):
// rota aprovada cujo rough não existe no disco = escolha às cegas; o harness recusa.
if (portao.roughExiste === false) {
  return { status: 'bloqueado', fase: 'Portão', detalhe: 'a rota aprovada não tem rough no disco — a escolha de rota é VISUAL, não textual', acao: 'gerar o rough da rota (re-rodar o estágio rotas, ou executar o comando_rough dela à mão) e aprovar VENDO; não existe atalho pra aprovar sem rough — se o rough é impossível no ambiente (ex.: gerador indisponível), troque de rota ou corrija o setup', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
}

const rota = portao.rota
const ehTexto = rota.arquetipo === 'texto'
// Placeholder {{BASE}} é contrato do comando de overlay em arquétipo com imagem IA: a troca
// da imagem-base pelo candidato selecionado é feita em CÓDIGO (o mecânico é proibido de
// editar comando — finding #5, 1.0.1). Artefato antigo sem placeholder = corrigir o artefato.
if (!ehTexto && !rota.comandoOverlay.includes('{{BASE}}')) {
  return { status: 'bloqueado', fase: 'Portão', detalhe: 'comando de overlay da rota aprovada não tem o placeholder {{BASE}} para a imagem-base', acao: 'editar o artefato de rotas trocando o path de base do comando_overlay pelo literal {{BASE}} e reinvocar — sem isso a composição ignoraria o candidato selecionado', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
}
log(`Portão fechado: rota ${rota.n} (${rota.nome || rota.arquetipo}) aprovada — slug ${rota.slug}${ehTexto ? ' · arquétipo texto (zero API de imagem)' : ''}`)

// ── loop produzir → validar (teto e política de custo em CÓDIGO) ─────────────
const historico = []            // por iteração: falhas de preflight + findings julgados
const findingsJulgados = []
let iteracao = 0
let verde = false
let rodadasIa = 0               // rodadas de GERAÇÃO de imagem (1 inicial + re-gerações)
let baseEscolhida = null        // imagem-base vigente (candidato selecionado)
let selecaoInfo = null
let candidatosTodos = []
let comandoOverlayAtual = rota.comandoOverlay
let promptIaAtual = rota.promptIa
let copyAtual = rota.copy || null
let copyFoiCorrigida = false
let precisaGerarIa = !ehTexto   // 1ª iteração de arquétipo IA gera; overlay-only NUNCA re-gera
let renderAtual = null
let preflightFinal = null

// Pacote/reports como função: o caminho principal (verde/teto) E os escalados de meio de
// loop que já têm iteração no histórico passam por aqui — "reports SEMPRE" vale pra todo
// desfecho com trabalho julgado (finding #9 da revisão 1.0.1). No caminho principal, pacote
// que falha é erro reinvocável; nos escalados é best-effort com aviso (a falha de gravação
// não pode mascarar o diagnóstico do escalado — os dados seguem em `historico` no relatório).
async function montarPacote(desfecho) {
  phase('Pacote')
  return await chamarMecanico('pacote',
    `Monte o pacote de aprovação e grave os reports do run (regra de ouro: validação sem report
    gravado = validação que não aconteceu). Trabalhe a partir do cwd ATUAL da sessão, sem cd —
    todos os paths abaixo são relativos a ele. Data: ${ARGS.hoje}. Slug: ${rota.slug}.
    1. Para CADA iteração do histórico abaixo, grave
       ${DIR.marketing}/registry/criativos/${rota.slug}__validacao_iter<N>.md com frontmatter
       (slug, iteracao, veredito: fail|pass — pass só na iteração final ${desfecho === 'verde' ? iteracao : 'NENHUMA (não fechou verde)'},
       criterios_falhos, criado_em: ${ARGS.hoje}) e corpo com o JSON da iteração, formatado.
    2. Append em ${DIR.marketing}/registry/criativos/_validacoes.csv (crie com header
       slug,iteracao,veredito,criterios_falhos,criado_em se não existir) — uma linha por iteração.
    3. Crie ${DIR.marketing}/producao/pacotes-aprovacao/${ARGS.hoje}-${rota.slug}/ com:
       _decisao.md (frontmatter: slug, rota aprovada ${rota.n}, iteracoes ${iteracao},
       veredito_final ${desfecho === 'verde' ? 'pass' : 'escalado'}, criado_em ${ARGS.hoje};
       corpo: recomendação ${desfecho === 'verde' ? 'APROVAR' : 'DECISÃO HUMANA — o run não fechou'},
       o rationale da seleção, o que mudou entre iterações, e a copy final ${copyFoiCorrigida ? '(CORRIGIDA no run — marque isso)' : ''});
       cópia do render final (se existir); grid.md listando os roughs das rotas e TODOS os
       candidatos gerados com o escolhido marcado (paths abaixo — não copie os PNGs, liste os paths).
    Histórico das iterações (JSON): ${JSON.stringify(historico)}
    Seleção: ${JSON.stringify(selecaoInfo)}
    Candidatos gerados: ${JSON.stringify(candidatosTodos)}
    Copy final: ${copyAtual || '(sem copy no run)'}
    Render final: ${renderAtual || '(nenhum render composto)'}
    Artefato de rotas: ${ARGS.rotasPath}
    ok=true SÓ se tudo gravado; liste em gravados os paths escritos. NÃO altere o registry
    canônico do criativo nem o artefato de rotas.`,
    { label: 'pacote:montar', phase: 'Pacote', schema: PACOTE_SCHEMA }
  )
}
async function escaladoComPacote(fase, detalhe, acao) {
  const pac = historico.length > 0 ? await montarPacote('escalado') : null
  return {
    status: 'escalado', fase, iteracao, detalhe, acao,
    historico, findingsJulgados,
    pacote: pac && pac.ok ? pac.pacotePath : null,
    ...(historico.length > 0 && !(pac && pac.ok) ? { avisoPacote: 'pacote não gravado — os reports das iterações seguem no campo historico deste relatório' } : {}),
    fallbacks: fallbacksModelo, modelos: relatorioModelos(),
  }
}

while (iteracao < MAX_ITERACOES && !verde) {
  iteracao++
  phase('Produzir')

  // ── produção de candidatos (só arquétipo com imagem IA, só quando a falha pede) ──
  if (precisaGerarIa) {
    // Belt do invariante "zero API em texto" (finding #4 da revisão 1.0.1): a coerção de
    // custo acontece na correção; este guarda pega qualquer estado inválido que escape.
    if (ehTexto || !promptIaAtual) {
      return await escaladoComPacote('Produzir', { motivo: `geração de imagem pedida ${ehTexto ? 'em arquétipo texto (não existe imagem-base gerada)' : 'sem prompt de IA na rota'}` }, 'estado inválido de geração — revisar o artefato de rotas e a decisão de correção com o humano')
    }
    if (rodadasIa >= MAX_RODADAS_IA) {
      historico.push({ iteracao, evento: 'teto de rodadas de geração de imagem atingido' })
      break // vira escalado com pacote — insistir em re-gerar é exatamente o anti-padrão da prosa
    }
    rodadasIa++
    const n = rodadasIa === 1 ? perfil.candidatos : Math.max(2, perfil.candidatos - 1)
    log(`Iteração ${iteracao}/${MAX_ITERACOES} — gerando ${n} candidato(s) de imagem-base (rodada de IA ${rodadasIa}/${MAX_RODADAS_IA})`)
    const prod = await chamarProdutor('producao',
      `Gere ${n} candidatos de imagem-base pra rota aprovada do slug ${rota.slug}.
      Prompt de geração (use EXATAMENTE, sem melhorar): ${promptIaAtual}
      Comando-base: ${ARGS.python} ${DIR.scripts}/gerar_imagem.py "<prompt>" <saida> (+ flags que a rota
      pedir, ex.: --edit de mockup/foto — veja o artefato ${ARGS.rotasPath} se precisar).
      Saídas: ${DIR.marketing}/criativos/base/${rota.slug}__cand<k>_iter${iteracao}.png (k = 1..${n}).
      REGRA DE CWD: execute tudo a partir do cwd ATUAL da sessão, sem cd — paths relativos
      resolvem a partir dele; se não resolverem, reporte falha em vez de procurar o workspace.
      Execute as ${n} gerações, confirme que cada arquivo existe, e liste em candidatos SÓ os
      que existem. Comando que falhar 2x → entra em falhas. Texto NUNCA na imagem gerada.`,
      { label: `producao:i${iteracao}`, phase: 'Produzir', schema: PRODUCAO_SCHEMA }
    )
    if (!prod) return { status: 'erro', fase: 'Produzir', iteracao, detalhe: 'o produtor não retornou', fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'reinvocar com resumeFromRunId' }
    if (!prod.ok || prod.candidatos.length === 0) {
      return await escaladoComPacote('Produzir', { motivo: prod.motivo, falhas: prod.falhas }, 'nenhum candidato gerado (API de imagem/chave/venv?) — corrigir o setup com o humano e reinvocar')
    }
    candidatosTodos.push(...prod.candidatos.map(c => ({ iteracao, path: c })))

    // ── seleção: o validador ranqueia contra a baseline — nada segue sem escolha ──
    if (prod.candidatos.length === 1) {
      baseEscolhida = prod.candidatos[0]
      selecaoInfo = { escolhido: baseEscolhida, ranking: [{ candidato: baseEscolhida, nota: 0, porque: 'candidato único — os demais falharam na geração' }] }
      log(`Seleção trivial: 1 candidato disponível`)
    } else {
      const sel = await chamarValidador('selecao',
        `Tarefa T1 (seleção). Ranqueie os candidatos de imagem-base contra a baseline e a rota.
        Candidatos (leia TODOS os PNGs): ${prod.candidatos.join(', ')}
        Baseline da vencedora: ${rota.baselinePath || 'não fornecida — julgue pela rota e princípios'}
        Rota aprovada (composição/mood/paleta): ${ARGS.rotasPath} (rota ${rota.n})
        Julgue: aderência à composição da rota, naturalidade da cena (artefatos IA), força em
        thumbnail, proximidade do padrão da vencedora. escolhido = o melhor path.`,
        { label: `selecao:i${iteracao}`, phase: 'Produzir', schema: SELECAO_SCHEMA }
      )
      if (!sel) return { status: 'erro', fase: 'Produzir', iteracao, detalhe: 'o validador da seleção não retornou', fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'sem seleção não há como compor sem viés do produtor; reinvocar com resumeFromRunId' }
      if (!prod.candidatos.includes(sel.escolhido)) {
        return { status: 'erro', fase: 'Produzir', iteracao, detalhe: `seleção apontou path fora dos candidatos: ${sel.escolhido}`, fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'reinvocar com resumeFromRunId' }
      }
      baseEscolhida = sel.escolhido
      selecaoInfo = sel
      log(`Selecionado: ${baseEscolhida}`)
    }
    precisaGerarIa = false
  } else {
    log(`Iteração ${iteracao}/${MAX_ITERACOES} — ${ehTexto ? 'arquétipo texto: composição direta' : 'correção de overlay sobre a base existente (custo zero de API)'}`)
  }

  // ── composição: overlay programático sobre a base vigente ──────────────────
  // A troca da imagem-base pelo candidato selecionado é feita AQUI, em código, via o
  // placeholder {{BASE}} validado no portão — nunca pedida em prosa ao mecânico, cujo
  // contrato proíbe editar comando (finding #5 da revisão 1.0.1).
  const comandoComposicao = ehTexto ? comandoOverlayAtual : comandoOverlayAtual.split('{{BASE}}').join(baseEscolhida)
  const comp = await chamarMecanico('composicao',
    `Execute a composição do render (venv: ${ARGS.python}), a partir do cwd ATUAL da sessão —
    NUNCA mude de diretório; paths relativos resolvem a partir dele (se não resolverem, reporte
    falha em vez de procurar o workspace em outro lugar):
    ${comandoComposicao}
    A saída do render é o path de saída do PRÓPRIO comando (o último argumento) — essa é a fonte
    única; não mude o destino nem o compare com outra convenção. Os scripts compor_*.py
    auto-logam o comando — NÃO use --sem-log.
    ok=true SOMENTE se o arquivo de saída do comando existe depois de rodar. artefatos = [esse path].`,
    { label: `composicao:i${iteracao}`, phase: 'Produzir', schema: EXEC_SCHEMA }
  )
  if (!comp) return { status: 'erro', fase: 'Produzir', iteracao, detalhe: 'o mecânico da composição não retornou', fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'reinvocar com resumeFromRunId' }
  if (!comp.ok || comp.artefatos.length === 0) {
    return await escaladoComPacote('Produzir', comp.falhas, 'a composição falhou (fonte/flag/path?) — o comando de overlay da rota precisa de correção humana')
  }
  renderAtual = comp.artefatos[0]

  // ── pre-flight determinístico (fail-closed, guarda de check cego) ──────────
  const pf = await chamarMecanico('preflight',
    `Rode o pre-flight determinístico do render (venv: ${ARGS.python}), a partir do cwd ATUAL da
    sessão — NUNCA mude de diretório:
    ${ARGS.python} ${DIR.scripts}/validar_criativo.py ${renderAtual} --formato ${rota.formato || 'feed'} --arquetipo ${rota.arquetipo}${rota.textoEsperado ? ` --texto-esperado ${shq(rota.textoEsperado)}` : ''}${rota.baselinePath ? ` --baseline ${rota.baselinePath}` : ''}
    Capture o JSON de stdout. ok = (exit code 0). Cada check com fail vira uma entrada em
    falhas com criterio = nome do check e resumo = o que o JSON reportou. Se o script QUEBRAR
    (crash/traceback/flag inválida, sem JSON), ok=false e uma entrada em falhas com
    criterio "script" e o erro literal no resumo. Warns NÃO derrubam (não entram em falhas;
    cite no resumo do primeiro artefato se houver).
    artefatos = [${renderAtual}] se o arquivo existe. NÃO corrija nada.`,
    { label: `preflight:i${iteracao}`, phase: 'Produzir', schema: EXEC_SCHEMA }
  )
  if (!pf) return { status: 'erro', fase: 'Produzir', iteracao, detalhe: 'o mecânico do pre-flight não retornou', fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'portão que falha aberto não é portão; reinvocar com resumeFromRunId' }
  if (pf.artefatos.length === 0) {
    return { status: 'erro', fase: 'Produzir', iteracao, detalhe: 'pre-flight cego: render composto mas 0 artefatos analisados', fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'provável path/venv errado — reinvocar com resumeFromRunId' }
  }
  // ok=false SEM falha nomeada = o script quebrou (crash ≠ reprovação) e o mecânico não soube
  // dizer o quê. Fingir pre-flight verde aqui era o fail-open nº 1 da revisão 1.0.1 (pf.ok
  // nunca era lido) — portão que falha aberto não é portão.
  if (!pf.ok && (!pf.falhas || pf.falhas.length === 0)) {
    return { status: 'erro', fase: 'Produzir', iteracao, detalhe: 'pre-flight reprovou (exit ≠ 0) sem reportar falha nomeada — provável crash do validar_criativo.py (venv/flags/formato)', fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'conferir o script/venv no workspace e reinvocar com resumeFromRunId' }
  }
  preflightFinal = pf
  const falhasPreflight = pf.falhas || []

  // ── crit adversarial (fail-closed) ─────────────────────────────────────────
  phase('Crit')
  const crit = await chamarValidador('crit',
    `Tarefa T2 (crítica). Julgue o render final contra TODOS os critérios do seu contrato
    (A-J), tentando REFUTAR a aprovação. Leia como imagem: o render, a baseline e o mockup
    (quando houver).
    render: ${renderAtual}
    brief: ${rota.briefPath} — resumo do prometido: ${rota.briefResumo}
    rota aprovada: ${ARGS.rotasPath} (rota ${rota.n}; arquétipo esperado: ${rota.arquetipo})
    baseline da vencedora: ${rota.baselinePath || 'não fornecida — D vira sinalização, diga isso'}
    mockup do produto: ${rota.mockupPath || 'não fornecido — E é skip com esse motivo'}
    copy do anúncio a julgar (G e J): ${copyAtual || 'não fornecida — J é skip com esse motivo'}
    documento de voz: ${DIR.branding}/tom-de-voz-aplicado.md (leia antes de julgar J)
    princípios duros: ${DIR.branding}/principios-criativos.md (leia antes de julgar C)
    criterio: use EXATAMENTE um dos slugs do contrato — arquetipo_correto, rosto_nao_coberto,
    principios_duros, fidelidade_referencia, fidelidade_estampa, naturalidade_ia,
    texto_correto, legibilidade_thumbnail, mensagem_completa, voz_da_marca.${ehTexto ? `
    Arquétipo texto: NÃO existe imagem-base gerada — custoCorrecao 'ia' é inválido aqui;
    problema visual se resolve por overlay (recompor) ou copy.` : ''}
    Findings SÓ com evidência concreta (região/trecho + cenário de dano). Na dúvida,
    confianca=plausivel — a confirmação é de outra chamada, não sua. Sem problema real em um
    critério = sem finding dele (não fabrique). custoCorrecao pela tabela: overlay (recompor
    resolve), ia (re-gerar imagem-base), copy (só texto do anúncio).`,
    { label: `crit:i${iteracao}`, phase: 'Crit', schema: CRIT_SCHEMA }
  )
  if (!crit) return { status: 'erro', fase: 'Crit', iteracao, detalhe: 'o crit não retornou', fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'sem crítica adversarial o verde seria mentira; reinvocar com resumeFromRunId' }

  // ── confirmação de findings plausíveis (fail-closed) ───────────────────────
  const bloqueantes = []
  for (const f of crit.findings.filter(f => f.severidade === 'bloqueante')) {
    if (f.confianca === 'confirmado') { bloqueantes.push(f); findingsJulgados.push({ iteracao, ...f, confirmado: true, porqueVeredito: 'confirmado pelo próprio crit com evidência' }); continue }
    const v = await chamarValidador('confirmacao',
      `Tarefa T3 (confirmação). Confirme ou refute este finding plausível antes de virar retrabalho:
      critério ${f.criterio} — ${f.resumo}. Evidência alegada: ${f.evidencia}. Cenário: ${f.cenario}.
      Releia ${renderAtual} (zoom na região citada)${copyAtual ? ' e a copy fornecida' : ''}. real=true só com evidência própria.`,
      { label: `confirmar:i${iteracao}`, phase: 'Crit', schema: VEREDITO_SCHEMA }
    )
    if (!v) return { status: 'erro', fase: 'Crit', iteracao, detalhe: `o confirmador do finding "${f.resumo}" não retornou`, fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'um null descartaria bloqueante plausível em silêncio; reinvocar com resumeFromRunId' }
    if (v.real) bloqueantes.push(f)
    findingsJulgados.push({ iteracao, ...f, confirmado: !!v.real, porqueVeredito: v.porque })
  }

  historico.push({ iteracao, render: renderAtual, preflight: falhasPreflight, bloqueantesConfirmados: bloqueantes, naoBloqueantes: crit.findings.filter(f => f.severidade === 'nao-bloqueante') })

  if (falhasPreflight.length === 0 && bloqueantes.length === 0) { verde = true; break }
  if (iteracao >= MAX_ITERACOES) break

  // ── correção pela tabela canônica (custo em código) ────────────────────────
  // Coerção em código do invariante "zero API em texto" (finding #4 da revisão 1.0.1):
  // arquétipo texto NÃO tem imagem-base gerada — finding com custo 'ia' nele jamais liga
  // geração; vira correção de overlay, com a coerção registrada no histórico.
  let custoIa = bloqueantes.some(f => f.custoCorrecao === 'ia')
  const custoIaCoergido = custoIa && ehTexto
  if (custoIaCoergido) custoIa = false
  const cor = await chamarProdutor('correcao',
    `Traduza as falhas confirmadas desta iteração em correção executável, pela tabela
    fail→ação canônica (overlay recompõe sobre a base; ia re-gera; copy só reescreve texto):
    Falhas de pre-flight (todas custo overlay): ${JSON.stringify(falhasPreflight)}
    Findings bloqueantes confirmados: ${JSON.stringify(bloqueantes.map(f => ({ criterio: f.criterio, resumo: f.resumo, custoCorrecao: f.custoCorrecao, acaoSugerida: f.acaoSugerida })))}
    ${custoIaCoergido ? "NOTA: findings marcados custo 'ia' foram COERGIDOS a overlay (arquétipo texto não tem imagem gerada) — trate-os como overlay e devolva promptIa null." : ''}
    Comando de overlay atual: ${comandoOverlayAtual}
    ${promptIaAtual ? `Prompt de IA atual: ${promptIaAtual}` : 'Arquétipo texto — sem prompt de IA.'}
    ${copyAtual ? `Copy atual: ${copyAtual}` : ''}
    Devolva: comandoOverlay corrigido (ou null pra manter${ehTexto ? '' : '; em arquétipo com imagem IA, mantenha o placeholder literal {{BASE}} no lugar do path da imagem-base'}), promptIa corrigido (SÓ se alguma
    falha tem custo ia — senão null), copyCorrigida (SÓ se alguma falha tem custo copy — senão
    null). Corrija TODAS as falhas de uma vez. Não invente correção fora da tabela.`,
    { label: `correcao:i${iteracao}`, phase: 'Crit', schema: CORRECAO_SCHEMA }
  )
  if (!cor) return { status: 'erro', fase: 'Crit', iteracao, detalhe: 'o produtor da correção não retornou', fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'reinvocar com resumeFromRunId' }
  const avisosCorrecao = []
  if (custoIaCoergido) avisosCorrecao.push("findings com custo 'ia' coergidos a overlay — arquétipo texto não tem imagem gerada")
  let comandoAceito = false
  if (cor.comandoOverlay) {
    // comando corrigido de arquétipo IA sem {{BASE}} quebraria a substituição em código —
    // recusado (conta como não-mudança; a guarda de não-progresso decide o desfecho).
    if (ehTexto || cor.comandoOverlay.includes('{{BASE}}')) { comandoOverlayAtual = cor.comandoOverlay; comandoAceito = true }
    else avisosCorrecao.push('comandoOverlay corrigido recusado: sem o placeholder {{BASE}} (arquétipo IA)')
  }
  if (cor.copyCorrigida) { copyAtual = cor.copyCorrigida; copyFoiCorrigida = true }
  if (custoIa && cor.promptIa) { promptIaAtual = cor.promptIa; precisaGerarIa = true }
  else if (custoIa && !cor.promptIa) { precisaGerarIa = true } // re-gera com o prompt atual — a falha é da imagem
  historico[historico.length - 1].correcao = { resumo: cor.resumo, avisos: avisosCorrecao }
  // Guarda de não-progresso (finding #8 da revisão 1.0.1): correção que não mudou comando,
  // copy nem pediu re-geração re-produziria o MESMO render — iterar só queimaria teto e
  // chamadas de julgamento; escala com o diagnóstico honesto.
  if (!comandoAceito && !cor.copyCorrigida && !precisaGerarIa) {
    return await escaladoComPacote('Crit', { motivo: 'correção não produziu mudança executável', resumoCorrecao: cor.resumo, avisos: avisosCorrecao }, 'ajustar comando/copy/rota manualmente com o humano — iterar sem mudança só queimaria o teto')
  }
  log(`Iteração ${iteracao} não fechou: ${falhasPreflight.length} falha(s) de pre-flight, ${bloqueantes.length} bloqueante(s) — correção ${custoIa ? 'com re-geração de imagem' : 'só de overlay/copy (custo zero de API)'}`)
}

// ── pacote de aprovação + reports (verde OU teto — os escalados de meio de loop já passam
// por montarPacote dentro de escaladoComPacote) ──────────────────────────────
const desfecho = verde ? 'verde' : 'escalado'
const pac = await montarPacote(desfecho)
if (!pac || !pac.ok) return { status: 'erro', fase: 'Pacote', detalhe: pac ? pac.falhas : 'o mecânico do pacote não retornou', parcial: { desfecho, iteracoes: iteracao, render: renderAtual, historico, findingsJulgados }, fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'report não gravado = validação que não aconteceu; reinvocar com resumeFromRunId (o loop já completo vem do cache)' }

// ── relatório final ──────────────────────────────────────────────────────────
if (!verde) {
  return {
    status: 'escalado', fase: 'Loop', detalhe: `${iteracao} iteração(ões) sem fechar (teto ${MAX_ITERACOES}; rodadas de IA ${rodadasIa}/${MAX_RODADAS_IA})`,
    slug: rota.slug, render: renderAtual, pacote: pac.pacotePath,
    historico, findingsJulgados, fallbacks: fallbacksModelo, modelos: relatorioModelos(),
    acao: 'decisão humana no pacote: trocar de rota (os roughs das outras seguem válidos), ajustar brief, ou descartar — loop que não converge é sinal de rota/brief errado, não de falta de força bruta',
  }
}

return {
  status: 'verde',
  data: ARGS.hoje,
  slug: rota.slug,
  rotaAprovada: { n: rota.n, nome: rota.nome || null, arquetipo: rota.arquetipo },
  iteracoes: iteracao,
  rodadasIa,
  render: renderAtual,
  selecao: selecaoInfo,
  candidatos: candidatosTodos,
  copy: copyAtual, copyFoiCorrigida,
  preflight: preflightFinal,
  pacote: pac.pacotePath,
  reportsGravados: pac.gravados,
  findingsJulgados,
  findingsNaoBloqueantes: historico.length ? historico[historico.length - 1].naoBloqueantes : [],
  fallbacks: fallbacksModelo, modelos: relatorioModelos(),
  proximo: `a skill retoma pós-verde: apresentar o pacote ao humano (render + grid + rationale), e após OK humano gravar o registry canônico do criativo (${DIR.marketing}/registry/criativos/<slug>.md + _indice.csv, status aprovado) e seguir pro /campanha-montar do workspace — o harness nunca commita e nunca marca aprovação humana`,
}

export const meta = {
  name: 'mimyr-gerar-curso',
  description: 'Harness do gerar-curso: portão de estrutura, um escritor por capítulo, checks mecânicos e revisão adversarial — invariantes em código, não em prosa',
  whenToUse: 'Invocado pela skill gerar-curso do mimyr com estrutura aprovada pelo humano, perfil de custo escolhido e opt-in multi-agente. Não usar sem esses três.',
  phases: [
    { title: 'Estrutura', detail: 'validar o portão: critérios por capítulo fechados antes de qualquer prosa' },
    { title: 'Escrever', detail: 'um escritor por capítulo; paralelo conforme o perfil' },
    { title: 'Checks', detail: 'scripts mecânicos do plugin (acentos, travessão, SVG, links)' },
    { title: 'Revisar', detail: 'lentes adversariais sequenciais; findings bloqueantes confirmados antes de reescrita' },
  ],
}

// Paths do workspace resolvem na skill pela regra única de
// references/defaults.md: CLAUDE.md do workspace → defaults local_* do usuário →
// convenção descoberta no cwd → default documentado. Literais abaixo são ilustrativos do
// default; o harness recebe paths resolvidos nos args e nunca lê configuração.

// ── args esperados (montados pela skill gerar-curso) ─────────────────────────
// {
//   cursoDir:      string — diretório do curso relativo ao cwd do workspace (./courses/<curso>)
//   estruturaPath: string — path da estrutura APROVADA (./courses/<curso>/estrutura.md).
//                  Autoria/aprovação são da skill com o humano — o harness só valida (espelho
//                  do odin: SPEC autorada na entregar, harness valida).
//   perfil:        'economico' | 'balanceado' | 'maximo'
//   scriptsDir:    string — ${CLAUDE_PLUGIN_ROOT}/scripts JÁ EXPANDIDO pela skill. Este script
//                  não tem filesystem nem env — quem resolve paths e lê defaults é a sessão.
//   python:        string — python do venv do workspace (ex.: .venv/bin/python). A skill valida
//                  o venv ANTES de invocar: sem venv os checks quebrariam por defeito de setup,
//                  não do conteúdo, e o run "falharia" mentindo (lição da Fase 5 do megaplano).
//   hoje:          string — data ISO passada de fora (Date.now não existe aqui)
//   tiering?:      { modelos?: {step: modelo}, efforts?: {step: effort} } — OPCIONAL. Montado
//                  pela SKILL a partir de ~/.claude/mimyr/defaults.md (campos gerar_curso_*).
//                  Steps e valores aceitos: ver MODELOS_STEP. Enforcement em código, não
//                  convenção: promoção só dentro do papel (escrever: sonnet→opus, dirigida por
//                  gerar_curso_escritor), rebaixamento só nos steps mecânicos whitelisted
//                  (checks; estrutura sob opt-in) e só pra haiku. Pedido fora disso é IGNORADO
//                  e registrado em `modelos.recusados` — nunca aplicado em silêncio.
// }

const PERFIS = {
  economico:  { paralelo: false, lentes: ['didatica'] },
  balanceado: { paralelo: true,  lentes: ['didatica', 'voz'] },
  maximo:     { paralelo: true,  lentes: ['didatica', 'voz', 'precisao-tecnica'] },
}

const MAX_ITERACOES = 3

// ── tiering de modelo/effort por step ────────────────────────────────────────
// A unidade de configuração é o STEP, não o agente: cada chamada pertence a um step nomeado,
// com papel fixo, modelo default e lista FECHADA de permitidos. Diferença deliberada pro odin:
// `escrever` permite promoção sonnet→opus (decisão de design aprovada em 2026-07-24 — conteúdo
// na voz do autor pode justificar o tier acima; quem liga é o default gerar_curso_escritor).
// Haiku só em `checks` (default) e `estrutura` (opt-in — o step tem julgamento: extração de
// contratos e critérios; erro nele envenena o run inteiro, então o default fica no piso do
// papel). Revisão é Opus sempre — julgamento adversarial não aceita o porão. O effort também
// tem piso nos steps de julgamento: travar só o modelo deixa o effort como alavanca destravada
// (lição da revisão adversarial do odin 2.3.1).
const MODELOS_STEP = {
  estrutura:   { papel: 'escritor', padrao: 'sonnet', permitidos: ['sonnet', 'haiku'], effort: null },
  escrever:    { papel: 'escritor', padrao: 'sonnet', permitidos: ['sonnet', 'opus'],  effort: null },
  checks:      { papel: 'mecanico', padrao: 'haiku',  permitidos: ['haiku', 'sonnet'], effort: 'low' },
  lente:       { papel: 'revisor',  padrao: 'opus',   permitidos: ['opus'],            effort: 'high', effortPiso: 'high' },
  confirmacao: { papel: 'revisor',  padrao: 'opus',   permitidos: ['opus'],            effort: 'high', effortPiso: 'high' },
}
const EFFORTS_VALIDOS = ['low', 'medium', 'high', 'xhigh']
const EFFORT_RANK = { low: 0, medium: 1, high: 2, xhigh: 3 }

const LENTE_PROMPT = {
  'didatica': `Lente L1 — didática, sobre o CURSO INTEIRO (progressão é julgamento entre capítulos, não dentro de um): refute a progressão (pré-requisito assumido por um capítulo que nenhum anterior ensinou — compare com os contratos da estrutura), carga cognitiva (capítulo que despeja conceitos além do seu único learning job), objetivo de aprendizagem NÃO atendido de verdade pela prosa (aparência de cobertura sem ensinar), exercício desconectado do conceito ou impraticável sem instalação.`,
  'voz': `Lente L2 — voz: julgue cada capítulo contra ./perfil-de-voz.md (leia o arquivo — ele é o contrato, não opinião sua): ritmo e padrão do autor (afirmação → expansão → exemplo), "você"/"pessoal" (nunca "aluno"/"estudante"), sem travessão na prosa visível, abertura com gancho e não tom acadêmico seco, jargão traduzido na primeira ocorrência.`,
  'precisao-tecnica': `Lente L3 — precisão técnica: afirmações tecnicamente corretas e verificáveis? Exemplos atuais e inspecionáveis (nada deprecado/estatística velha)? Analogias que não ensinam o conceito ERRADO? Cross-references que apontam pro lugar certo?`,
}

// ── schemas ──────────────────────────────────────────────────────────────────
const ESTRUTURA_SCHEMA = { type: 'object', additionalProperties: false, required: ['ok', 'aprovada', 'capitulos', 'capitulosComArquivoExistente'], properties: {
  ok: { type: 'boolean' }, motivo: { type: 'string' },
  aprovada: { type: 'boolean' },
  capitulos: { type: 'array', items: { type: 'object', required: ['id', 'titulo', 'arquivo', 'objetivo', 'criterios'], properties: {
    id: { type: 'string' }, titulo: { type: 'string' },
    arquivo: { type: 'string' },            // relativo ao cursoDir, ex.: modulo-1/o-que-e.html
    objetivo: { type: 'string' },           // o único learning job do capítulo
    criterios: { type: 'array', items: { type: 'string' } },
    preRequisitos: { type: 'string' },      // contrato: o que assume que capítulos anteriores ensinaram
    naoCobre: { type: 'string' },
    tom: { type: 'string' }, personas: { type: 'string' }, fontes: { type: 'string' },
    reescrever: { type: 'boolean' },
  } } },
  capitulosComArquivoExistente: { type: 'array', items: { type: 'string' } },  // ids SEM reescrever:true cujo arquivo já existe
} }

const ESCREVER_SCHEMA = { type: 'object', additionalProperties: false, required: ['status', 'resumo', 'arquivosTocados'], properties: {
  status: { enum: ['concluido', 'bloqueado'] },
  resumo: { type: 'string' }, motivo: { type: 'string' },
  arquivosTocados: { type: 'array', items: { type: 'string' } },
  criteriosAtendidos: { type: 'array', items: { type: 'string' } },
  tempoLeituraMin: { type: 'number' },
  pendencias: { type: 'array', items: { type: 'string' } },
} }

// arquivosAnalisados alimenta a guarda de check cego (abaixo) — sem ele, um mecânico que não
// achou os arquivos devolveria {verde:true, falhas:[]} indistinguível de "tudo passou".
const CHECKS_SCHEMA = { type: 'object', additionalProperties: false, required: ['verde', 'arquivosAnalisados', 'falhas'], properties: {
  verde: { type: 'boolean' },
  arquivosAnalisados: { type: 'number' },
  falhas: { type: 'array', items: { type: 'object', required: ['comando', 'resumo'], properties: {
    comando: { type: 'string' }, arquivo: { type: 'string' }, resumo: { type: 'string' },
  } } },
} }

const REVIEW_SCHEMA = { type: 'object', additionalProperties: false, required: ['findings'], properties: {
  findings: { type: 'array', items: { type: 'object', required: ['arquivo', 'resumo', 'cenario', 'severidade', 'confianca'], properties: {
    arquivo: { type: 'string' }, capitulo: { type: 'string' }, linha: { type: 'number' },
    resumo: { type: 'string' }, cenario: { type: 'string' },
    severidade: { enum: ['bloqueante', 'nao-bloqueante'] }, confianca: { enum: ['confirmado', 'plausivel'] },
  } } },
} }

const VEREDITO_SCHEMA = { type: 'object', additionalProperties: false, required: ['real'], properties: { real: { type: 'boolean' }, porque: { type: 'string' } } }

// ── helpers ──────────────────────────────────────────────────────────────────
const ESCRITOR = { agentType: 'mimyr:escritor-de-capitulo' }   // sonnet no frontmatter (piso do papel)
const REVISOR = { agentType: 'mimyr:revisor-de-curso' }        // opus no frontmatter
const MECANICO = { agentType: 'mimyr:mecanico-de-curso' }      // haiku — só steps whitelisted chegam aqui

async function emSequencia(itens, fn) {
  const out = []
  for (const item of itens) out.push(await fn(item))
  return out
}

// agent() devolve null tanto por indisponibilidade quanto por schema inválido/timeout — e pode
// LANÇAR. Exceção vira null: todo call site trata null como desfecho estruturado, e um throw
// sem rede mataria o workflow sem status, sem fallbacks e sem modelos. Morrer sem relatório
// não é opção (invariante herdado do odin 2.3.1).
const tentar = async (prompt, opts) => { try { return await agent(prompt, opts) } catch (e) { return null } }

// Fallbacks nas DUAS pontas do tiering, espelhando o odin: step rebaixado pra haiku roda no
// mecânico e, se a chamada não retornar, repete UMA vez no piso do papel (escritor/sonnet),
// desliga o haiku pelo resto do run e registra — o tier barato nunca aborta um run. Step
// `escrever` promovido a opus (gerar_curso_escritor) que não retornar cai pro piso sonnet do
// frontmatter, desliga a promoção pelo run e registra. O registro NÃO afirma de quem foi a
// culpa — indisponibilidade, schema inválido e timeout são indistinguíveis aqui. Um null JÁ NO
// PISO segue o tratamento normal do step (erro/bloqueio de quem chamou).
const fallbacksModelo = []
let haikuMorto = false
let promocaoEscritorMorta = false
async function chamarEscritor(step, prompt, opts) {
  const t = TIERING[step]
  const base = { ...ESCRITOR, ...(t.effort ? { effort: t.effort } : {}), ...opts }
  if (t.modelo === 'haiku' && !haikuMorto) {
    const r = await tentar(prompt, { ...base, ...MECANICO })
    if (r) return r
    haikuMorto = true
    fallbacksModelo.push({ step, chamada: base.label, de: 'haiku (mecanico)', para: 'sonnet (escritor)', causa: 'a chamada rebaixada não retornou (agente indisponível, schema inválido ou timeout — indistinguíveis aqui); haiku desligado para o resto do run' })
    return await tentar(prompt, base)
  }
  if (t.modelo === 'opus' && !promocaoEscritorMorta) {
    const r = await tentar(prompt, { ...base, model: 'opus' })
    if (r) return r
    promocaoEscritorMorta = true
    fallbacksModelo.push({ step, chamada: base.label, de: 'opus (promoção)', para: 'sonnet (frontmatter)', causa: 'a chamada promovida não retornou (tier indisponível, schema inválido ou timeout — indistinguíveis aqui); promoção desligada para o resto do run' })
    return await tentar(prompt, base)
  }
  return await tentar(prompt, base)
}

// Revisor é opus SEMPRE (MODELOS_STEP não permite outro modelo) — só o effort é configurável.
const chamarRevisor = (step, prompt, extra) => tentar(prompt, { ...REVISOR, ...(TIERING[step].effort ? { effort: TIERING[step].effort } : {}), ...extra })

// ── Fase 0: args válidos (falha barata antes de gastar agente) ───────────────
let ARGS = args
if (typeof ARGS === 'string') {
  try { ARGS = JSON.parse(ARGS) } catch {
    return { status: 'erro', fase: 'Args', detalhe: 'args chegou como string e não é JSON válido', acao: 'reinvocar o Workflow com args objeto: {cursoDir, estruturaPath, perfil, scriptsDir, python, hoje}' }
  }
}
if (!ARGS || typeof ARGS !== 'object' || Array.isArray(ARGS)) {
  return { status: 'erro', fase: 'Args', detalhe: `args deve ser um objeto JSON, recebi ${Array.isArray(ARGS) ? 'array' : typeof ARGS}`, acao: 'reinvocar o Workflow com args objeto: {cursoDir, estruturaPath, perfil, scriptsDir, python, hoje}' }
}
const argsFaltando = ['cursoDir', 'estruturaPath', 'perfil', 'scriptsDir', 'python'].filter(k => !ARGS[k])
if (argsFaltando.length > 0) {
  return { status: 'erro', fase: 'Args', detalhe: `args obrigatórios ausentes: ${argsFaltando.join(', ')}`, acao: 'reinvocar o Workflow com args completos: {cursoDir, estruturaPath, perfil, scriptsDir, python, hoje} — scriptsDir e python são a skill quem resolve (venv validado antes)' }
}

// Resolução do tiering: defaults da tabela + pedido dos args, com a whitelist decidindo. Pedido
// recusado NÃO degrada o run — o step roda no default e a recusa vai pro relatório E pro log.
const tieringRecusado = []
const TIERING = {}
{
  // Mapa que não é objeto plano vira {} com UMA recusa nomeada — sem a guarda, uma string
  // espalhada gerava chaves numéricas espúrias, uma por caractere.
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
  // hasOwnProperty, não truthy check: `__proto__`/`toString` acham propriedade herdada em
  // MODELOS_STEP e escapariam do registro. Set deduplica step presente nos dois mapas.
  for (const step of new Set([...Object.keys(pedidoModelos), ...Object.keys(pedidoEfforts)])) {
    if (!Object.prototype.hasOwnProperty.call(MODELOS_STEP, step)) tieringRecusado.push({ step, pedido: pedidoModelos[step] ?? pedidoEfforts[step], causa: `step desconhecido (existem: ${Object.keys(MODELOS_STEP).join(', ')})` })
  }
}
log(`Tiering por step: ${Object.entries(TIERING).map(([s, t]) => `${s}=${t.modelo}${t.effort ? `(${t.effort})` : ''}`).join(' · ')}`)
if (tieringRecusado.length > 0) log(`Tiering: ${tieringRecusado.length} pedido(s) recusado(s) pela whitelist — ver modelos.recusados no relatório`)

// Modelos/efforts EFETIVOS por step, não os pedidos: se um fallback desligou opus ou haiku no
// meio do run, é a queda que aparece aqui — o detalhe de qual chamada caiu fica em `fallbacks`.
// Vai em TODO desfecho (verde, escalado, bloqueado, erro), não só no verde.
const relatorioModelos = () => ({
  porStep: Object.fromEntries(Object.keys(MODELOS_STEP).map(s => {
    const t = TIERING[s]
    let efetivo = t.modelo
    if (t.modelo === 'opus' && s === 'escrever' && promocaoEscritorMorta) efetivo = 'sonnet (fallback — ver fallbacks)'
    if (t.modelo === 'haiku' && haikuMorto) efetivo = 'sonnet (fallback — ver fallbacks)'
    return [s, { modelo: efetivo, effort: t.effort || 'herdado da sessão' }]
  })),
  recusados: tieringRecusado,
})

// ── Fase 1: portão de ESTRUTURA (o análogo do portão TDD) ────────────────────
// Curso não tem teste executável; o "vermelho" é a definição fechada ANTES da prosa: capítulo
// sem objetivo/critérios/contrato = portão aberto = não escreve. O harness NUNCA commita e
// NUNCA toca templates/build do workspace — todo trabalho fica na working tree.
phase('Estrutura')
log(`Validando estrutura em ${ARGS.estruturaPath} (perfil ${ARGS.perfil}, curso ${ARGS.cursoDir})`)

const est = await chamarEscritor('estrutura',
  `Leia o arquivo ${ARGS.estruturaPath} e valide a estrutura do curso contra o portão do mimyr:
  - aprovada=true SOMENTE se o arquivo contém a marca explícita de aprovação humana
    (linha "Status: aprovada" ou equivalente inequívoco). Rascunho/pendente → aprovada=false.
  - Extraia TODOS os capítulos com: id, titulo, arquivo (path relativo a ${ARGS.cursoDir},
    ex.: modulo-1/slug.html), objetivo de aprendizagem (UM learning job), criterios
    verificáveis (checklist que uma revisão consegue julgar), preRequisitos (o que o capítulo
    assume que os anteriores ensinaram), naoCobre, tom, personas, fontes, reescrever.
  - ok=false se qualquer capítulo estiver sem objetivo, sem criterios, ou com arquivo
    ambíguo/colidindo com o de outro capítulo (a disjunção de arquivos é o que permite
    escritores em paralelo). Explique em motivo.
  - capitulosComArquivoExistente: ids dos capítulos SEM reescrever:true cujo arquivo JÁ existe
    em ${ARGS.cursoDir} (confira no disco) — é o análogo do teste que nasce verde: o run é de
    geração e não sobrescreve conteúdo publicado em silêncio.
  Retorne o objeto estruturado.`,
  { label: 'estrutura:validar', schema: ESTRUTURA_SCHEMA }
)

if (!est) return { status: 'erro', fase: 'Estrutura', detalhe: 'agente de validação da estrutura não retornou', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
if (!est.aprovada) return { status: 'bloqueado', fase: 'Estrutura', detalhe: 'estrutura sem marca de aprovação humana', acao: 'aprovar a estrutura com o humano na skill gerar-curso (marcar "Status: aprovada") e reinvocar — o harness não escreve com o portão aberto', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
if (!est.ok) return { status: 'bloqueado', fase: 'Estrutura', detalhe: est.motivo, acao: 'fechar objetivo/critérios/contrato de cada capítulo na skill gerar-curso e reinvocar', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
if (est.capitulos.length === 0) return { status: 'bloqueado', fase: 'Estrutura', detalhe: 'estrutura aprovada mas sem capítulos extraíveis', acao: 'revisar o formato da estrutura na skill gerar-curso', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
if (est.capitulosComArquivoExistente.length > 0) {
  return { status: 'bloqueado', fase: 'Estrutura', detalhe: `capítulo(s) com arquivo já existente sem reescrever:true — ${est.capitulosComArquivoExistente.join(', ')}`, acao: 'marcar reescrever: true na estrutura (com OK do humano) ou remover o capítulo do escopo do run', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
}

const perfil = PERFIS[ARGS.perfil] || PERFIS.economico
const capitulos = est.capitulos
log(`Portão de estrutura fechado: ${capitulos.length} capítulo(s) com critérios — nada foi escrito antes disso`)

// ── Fases 2-4: loop escrever → checks → revisar ──────────────────────────────
const historicoFalhas = []
const findingsJulgados = []          // com o veredito de cada um, não só a alegação
let iteracao = 0
let verde = false
let findingsAbertos = []
let checksFinais = null
let houveTrabalho = false            // latch: algum capítulo já foi escrito? (guarda de check cego)
const reescritasPorCapitulo = {}     // id → nº de vezes que o escritor rodou nele
let resultadosUltimaIteracao = []

// Iteração 1 escreve todos; iterações seguintes só os capítulos com falha mapeada a eles.
let alvos = capitulos.map(c => c.id)

while (iteracao < MAX_ITERACOES && !verde) {
  iteracao++
  phase('Escrever')
  log(`Iteração ${iteracao}/${MAX_ITERACOES} — ${alvos.length} capítulo(s), ${perfil.paralelo ? 'paralelo' : 'sequencial'}`)

  const correcoes = iteracao === 1 ? '' : `\nCORREÇÕES DESTA ITERAÇÃO (obrigatórias): ${JSON.stringify(historicoFalhas[historicoFalhas.length - 1])}`

  const escreverCapitulo = async (cap) => {
    try {
      const i = capitulos.findIndex(c => c.id === cap.id)
      const anterior = i > 0 ? capitulos[i - 1] : null
      const proximo = i < capitulos.length - 1 ? capitulos[i + 1] : null
      // O escritor recebe os OBJETIVOS dos capítulos anteriores, não a prosa: os vizinhos podem
      // estar sendo escritos em paralelo agora. A coerência de progressão é julgada pela lente
      // didática depois — não presumida durante.
      const contexto = capitulos.slice(0, i).map(c => `${c.id}: ${c.objetivo}`).join(' | ') || '(primeiro capítulo)'
      reescritasPorCapitulo[cap.id] = (reescritasPorCapitulo[cap.id] || 0) + 1
      const r = await chamarEscritor('escrever',
        `Escreva o capítulo ${cap.id} — "${cap.titulo}" do curso em ${ARGS.cursoDir} (estrutura: ${ARGS.estruturaPath}).
        Arquivo do capítulo (o ÚNICO que você toca): ${ARGS.cursoDir}/${cap.arquivo}
        Objetivo de aprendizagem (o único learning job): ${cap.objetivo}
        Critérios a atender (a revisão julga por eles): ${cap.criterios.join('; ')}
        Contrato — assume ensinado antes: ${cap.preRequisitos || 'nada'} | NÃO cobre: ${cap.naoCobre || 'n/a'}
        Tom: ${cap.tom || 'padrão do perfil de voz'} | Personas: ${cap.personas || 'as do manifesto do curso'} | Fontes: ${cap.fontes || 'n/a'}
        O que os capítulos anteriores ensinam (objetivos, não prosa — podem estar sendo escritos agora): ${contexto}
        Navegação: página ${i + 1} de ${capitulos.length}${anterior ? `, anterior "${anterior.titulo}" (${anterior.arquivo})` : ''}${proximo ? `, próxima "${proximo.titulo}" (${proximo.arquivo})` : ''}.
        Siga o padrão de conteúdo da skill mimyr:escrever-capitulo (template ./templates/subpage.html,
        hook → conceito → exemplo → mini-exercício → checagem rápida) e a prosa final na voz do
        autor via bragir:escrever-como-antonio. NUNCA toque em outro capítulo, shell, template,
        sidebar ou styles — sidebar/índice/SEO rodam fora do harness, depois do verde.${correcoes}`,
        { label: `escrever:${cap.id}`, phase: 'Escrever', schema: ESCREVER_SCHEMA }
      )
      if (!r) return { capitulo: cap.id, status: 'erro', motivo: 'o escritor não retornou' }
      return { capitulo: cap.id, ...r }
    } catch (e) {
      return { capitulo: cap.id, status: 'erro', motivo: `exceção durante a escrita: ${e && e.message ? e.message : String(e)}` }
    }
  }

  const capitulosAlvo = capitulos.filter(c => alvos.includes(c.id))
  // parallel() devolve null pro thunk que lançou — null vira erro nomeado, não silêncio: um
  // capítulo sumido fecharia verde sem nunca ter sido escrito.
  const resultados = perfil.paralelo
    ? (await parallel(capitulosAlvo.map(c => () => escreverCapitulo(c))))
        .map((r, i) => r || { capitulo: capitulosAlvo[i].id, status: 'erro', motivo: 'a escrita lançou exceção — nenhum resultado' })
    : await emSequencia(capitulosAlvo, escreverCapitulo)
  resultadosUltimaIteracao = resultados

  const problemas = resultados.filter(r => r.status === 'bloqueado' || r.status === 'erro')
  if (problemas.length > 0) {
    return { status: 'escalado', fase: 'Escrever', iteracao, detalhe: problemas, fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'decisão humana necessária (fonte ausente, contrato impossível) — o harness não improvisa' }
  }

  // ESCOPO ESTRITO decidido em código (análogo do P14 como bloqueante automático): escritor que
  // tocou arquivo fora do seu capítulo quebra a disjunção que torna o paralelo seguro. Sem
  // apelação — não passa por confirmação.
  const bloqueantesAutomaticos = []
  for (const r of resultados) {
    const cap = capitulos.find(c => c.id === r.capitulo)
    const foraDoEscopo = (r.arquivosTocados || []).filter(a => !a.endsWith(cap.arquivo))
    if (foraDoEscopo.length > 0) {
      bloqueantesAutomaticos.push({
        capitulo: cap.id, arquivo: foraDoEscopo.join(', '),
        resumo: `escopo estrito violado: o escritor de ${cap.id} tocou arquivo(s) fora do seu capítulo`,
        cenario: `Arquivos fora de ${cap.arquivo}: ${foraDoEscopo.join(', ')}. A disjunção por capítulo é o que permite escritores em paralelo sem conflito; a correção é reverter o que está fora e reescrever só o próprio arquivo.`,
        severidade: 'bloqueante', confianca: 'confirmado', origem: 'escopo-estrito',
      })
    }
  }
  if (resultados.some(r => (r.arquivosTocados || []).length > 0)) houveTrabalho = true

  // ── Checks mecânicos (todos os perfis) — finding barato antes do julgamento caro ──
  phase('Checks')
  const arquivosCapitulos = capitulos.map(c => `${ARGS.cursoDir}/${c.arquivo}`)
  const chk = await chamarEscritor('checks',
    `Rode os checks mecânicos do curso ${ARGS.cursoDir} e reporte — NÃO corrija nada:
    1. ${ARGS.python} ${ARGS.scriptsDir}/corrigir_acentos.py ${ARGS.cursoDir} --dry-run
    2. ${ARGS.python} ${ARGS.scriptsDir}/remover_travessao.py ${ARGS.cursoDir} --dry-run
    3. SOMENTE se algum arquivo de capítulo contém "<svg" (confira com grep):
       ${ARGS.python} ${ARGS.scriptsDir}/checar_svg_overflow.py ${ARGS.cursoDir}
       (o script exige fontes do curso em fonts/ — curso sem diagrama SVG não paga esse check).
    4. Nos arquivos de capítulo (${arquivosCapitulos.join(', ')}): todo href relativo resolve a
       partir do próprio arquivo? Sobrou placeholder de template não resolvido ({{...}},
       PAGE_NUMBER, TOTAL_PAGES etc.)?
    verde=true SOMENTE se nada falhou. Cada falha com o comando/checagem, o arquivo e um resumo.
    arquivosAnalisados = quantos arquivos os checks efetivamente examinaram.`,
    { label: `checks:i${iteracao}`, phase: 'Checks', schema: CHECKS_SCHEMA }
  )
  // Checks que não retornam ABORTAM (erro reinvocável), não viram "nada encontrado" — portão
  // que falha aberto não é portão (invariante herdado do odin 2.3.1).
  if (!chk) return { status: 'erro', fase: 'Checks', iteracao, fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'o agente de checks não retornou — sem ele não há como afirmar verde mecânico; reinvocar com resumeFromRunId' }
  // GUARDA DE CHECK CEGO: capítulos escritos + 0 arquivos analisados = o mecânico não achou a
  // working tree (path errado, venv quebrado no meio do run). Objeto válido cheio de zeros NÃO
  // é "tudo passou" — aborta como erro reinvocável, igual ao check que não retorna.
  if (houveTrabalho && chk.arquivosAnalisados === 0) {
    return { status: 'erro', fase: 'Checks', iteracao, fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'checks voltaram cegos: 0 arquivos analisados com capítulos escritos na working tree — provável path/venv errado; reinvocar com resumeFromRunId' }
  }
  checksFinais = chk

  // Falha de check que NÃO aponta pra arquivo de capítulo (shell, asset do workspace, ou falha
  // sem arquivo — venv/fonte/script) não é dos escritores — corrigir fora do escopo quebraria a
  // disjunção, e iterar sem alvo só queimaria o teto. Escala pro humano.
  // `includes`, não `endsWith`: o mecânico costuma reportar "arquivo:linha" — o sufixo de linha
  // não pode desmapear a falha do capítulo (run real de 2026-07-24 escalou por isso).
  const falhasForaDosCapitulos = (chk.falhas || []).filter(f => !f.arquivo || !capitulos.some(c => f.arquivo.includes(c.arquivo)))
  if (falhasForaDosCapitulos.length > 0) {
    return { status: 'escalado', fase: 'Checks', iteracao, detalhe: falhasForaDosCapitulos, fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'checks falharam fora dos capítulos do run (shell/asset do workspace, ou falha de setup sem arquivo) — os escritores não podem corrigir isso; correção é decisão humana na skill' }
  }

  // ── Revisão adversarial: lentes sequenciais, fail-closed ─────────────────────
  phase('Revisar')
  findingsAbertos = []
  for (const lente of perfil.lentes) {
    const rev = await chamarRevisor('lente',
      `${LENTE_PROMPT[lente]}
      Curso: ${ARGS.cursoDir} — capítulos do run (leia TODOS os arquivos): ${arquivosCapitulos.join(', ')}.
      Contratos e critérios por capítulo (a estrutura aprovada é o contrato): ${JSON.stringify(capitulos.map(c => ({ id: c.id, arquivo: c.arquivo, objetivo: c.objetivo, criterios: c.criterios, preRequisitos: c.preRequisitos, naoCobre: c.naoCobre })))}
      Tente REFUTAR o trabalho. Finding sem arquivo + trecho/critério citado + cenário concreto
      não entra. Preencha "capitulo" com o id do capítulo cujo ARQUIVO precisa mudar.`,
      { label: `rev:${lente}:i${iteracao}`, phase: 'Revisar', schema: REVIEW_SCHEMA }
    )
    // Lente que não retorna ABORTA o run: no perfil econômico (1 lente) um null aqui fecharia
    // verde sem NENHUMA revisão adversarial.
    if (!rev) return { status: 'erro', fase: 'Revisar', iteracao, fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: `a lente ${lente} não retornou — sem ela a revisão adversarial do perfil não aconteceu e o verde seria mentira; reinvocar com resumeFromRunId` }
    findingsAbertos.push(...rev.findings.map(f => ({ ...f, lente })))
  }

  // Bloqueantes automáticos entram SEM confirmação — a regra já foi decidida em código.
  const bloqueantes = [...bloqueantesAutomaticos]
  for (const f of findingsAbertos.filter(f => f.severidade === 'bloqueante')) {
    if (f.confianca === 'confirmado') { bloqueantes.push(f); findingsJulgados.push({ iteracao, ...f, confirmado: true, porqueVeredito: 'confirmado pela própria lente com evidência' }); continue }
    const v = await chamarRevisor('confirmacao',
      `Confirme ou refute este finding plausível antes de virar reescrita:
      ${f.arquivo}${f.linha ? `:${f.linha}` : ''} — ${f.resumo}. Cenário alegado: ${f.cenario}.
      Leia o capítulo e a estrutura (${ARGS.estruturaPath}); reproduza o cenário. real=true só com evidência.`,
      { label: `confirmar:i${iteracao}`, phase: 'Revisar', schema: VEREDITO_SCHEMA }
    )
    // Confirmador que não retorna ABORTA: um null descartaria o bloqueante plausível em silêncio.
    if (!v) return { status: 'erro', fase: 'Revisar', iteracao, fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: `o confirmador do finding "${f.resumo}" não retornou — sem veredito não há como decidir reescrita nem verde; reinvocar com resumeFromRunId` }
    if (v.real) bloqueantes.push(f)
    findingsJulgados.push({ iteracao, ...f, confirmado: !!v.real, porqueVeredito: v.porque })
  }

  const falhasDeCheck = (chk.falhas || [])
  if (chk.verde && bloqueantes.length === 0) { verde = true; break }

  // Mapeia cada falha a um capítulo: finding com `capitulo`, ou casando o arquivo com a
  // estrutura. Bloqueante confirmado SEM capítulo mapeável é furo de ESTRUTURA (progressão
  // quebrada no plano, não na prosa de um arquivo) — escala pro humano, análogo do furoNaSpec.
  const mapearCapitulo = (f) => f.capitulo && capitulos.some(c => c.id === f.capitulo)
    ? f.capitulo
    : (capitulos.find(c => f.arquivo && f.arquivo.includes(c.arquivo)) || {}).id
  const semMapa = bloqueantes.filter(f => !mapearCapitulo(f))
  if (semMapa.length > 0) {
    return { status: 'escalado', fase: 'Revisar', iteracao, detalhe: semMapa, historico: historicoFalhas, fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'finding bloqueante confirmado sem capítulo mapeável = furo na ESTRUTURA, não na prosa — revisar a estrutura com o humano e reinvocar' }
  }
  alvos = [...new Set([
    ...bloqueantes.map(mapearCapitulo),
    ...falhasDeCheck.map(f => mapearCapitulo({ arquivo: f.arquivo })).filter(Boolean),
  ])]
  historicoFalhas.push({ iteracao, checks: falhasDeCheck, findings: bloqueantes, capitulosParaReescrever: alvos })
  log(`Iteração ${iteracao} não fechou: ${falhasDeCheck.length} falha(s) de check, ${bloqueantes.length} finding(s) bloqueante(s) — reescrevendo ${alvos.length} capítulo(s)`)
}

// ── relatório final ──────────────────────────────────────────────────────────
if (!verde) {
  return {
    status: 'escalado', fase: 'Loop', detalhe: `${MAX_ITERACOES} iterações sem fechar`,
    historico: historicoFalhas, findingsJulgados, fallbacks: fallbacksModelo, modelos: relatorioModelos(),
    acao: 'diagnóstico pro humano: loop que não converge é sinal de estrutura ruim, não de falta de força bruta',
  }
}

return {
  status: 'verde',
  data: ARGS.hoje,
  iteracoes: iteracao,
  capitulos: capitulos.map(c => {
    const r = resultadosUltimaIteracao.find(x => x.capitulo === c.id) || {}
    return {
      id: c.id, titulo: c.titulo, arquivo: `${ARGS.cursoDir}/${c.arquivo}`,
      objetivo: c.objetivo, criterios: c.criterios,
      criteriosAtendidosDeclarados: r.criteriosAtendidos || null,
      tempoLeituraMin: r.tempoLeituraMin || null,
      vezesEscrito: reescritasPorCapitulo[c.id] || 0,
    }
  }),
  checks: checksFinais,
  findingsJulgados,                    // confirmados E refutados, com o porquê de cada veredito
  findingsNaoBloqueantes: findingsAbertos.filter(f => f.severidade === 'nao-bloqueante'),
  fallbacks: fallbacksModelo, modelos: relatorioModelos(),
  proximo: 'a skill gerar-curso retoma pós-verde: sidebar/índice (injetar_sidebar.py, atualizar_indice_curso.py), SEO (atualizar_seo.py), revisão humana dos findings não-bloqueantes, e persiste este relatório em <cursoDir>/relatorio-geracao.md — o harness nunca commita',
}

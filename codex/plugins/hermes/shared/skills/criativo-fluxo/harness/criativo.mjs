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
// Estágio A (rotas):    { estagio: 'rotas', briefPath, python, hoje, segmentos?, perfil?, tiering?, dirs? }
// Estágio B (produzir): { estagio: 'produzir', rotasPath, python, hoje, segmentos?, perfil?, tiering?, dirs? }
//
// segmentos: lista (array de slugs, sem repetição) dos segmentos permitidos pelo perfil do negócio, que a skill
// lê do perfil (campo `segmentos`) e injeta (o harness não lê config). O segmento é POR ROTA e nomeia
// renders/<segmento>/<slug>.png; quando a lista vem, a rota com segmento fora dela é recusada.
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
// Opcionais do estágio produzir (1.4.0): reproduzir (true libera render já existente),
// headline (string que substitui a copy do run), headlineTravada (true: headline não se reescreve).
// Campos de rota (artefato de rotas): segmento (subpasta de renders), acoes (obrigatório),
// semGeracao (true = sem imagem IA, mesmo fora do arquétipo texto), headlineTravada.
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
// Ações estruturadas (E1, hermes 1.5.9): o agente só preenche campos; o harness monta o argv.
// gerar {prompt, saida, referencias, tamanho, provedor?} · compor {compositor, base?, saida, textos,
// formato, opcoes, sobrescrever} · validar {render?, formato?, arquetipo?, textoEsperado?, logRender?, baseline?}.
// Manifesto de scripts: lido pelo operário (o harness não tem filesystem) e devolvido como dado.
const ACAO_SCHEMA = { type: 'object', required: ['op'], properties: {
  op: { enum: ['gerar', 'compor', 'validar'] },
  prompt: { type: 'string' }, saida: { type: 'string' }, referencias: { type: 'array', items: { type: 'string' } },
  tamanho: { type: 'string' }, provedor: { type: 'string' },
  compositor: { type: 'string' }, base: { type: 'string' }, formato: { type: 'string' },
  textos: { type: 'object' }, opcoes: { type: 'object' }, sobrescrever: { type: 'boolean' },
  render: { type: 'string' }, arquetipo: { type: 'string' }, textoEsperado: { type: 'string' },
  logRender: { type: 'string' }, baseline: { type: 'string' },
} }
const ACOES_SCHEMA = { type: 'array', items: ACAO_SCHEMA }
const MANIFESTO_SCHEMA = { type: 'object', properties: { scripts: { type: 'array', items: { type: 'object' } } } }

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
  rotas: { type: 'array', items: { type: 'object', required: ['n', 'nome', 'arquetipo', 'segmento', 'acoes'], properties: {
    n: { type: 'number' }, nome: { type: 'string' }, arquetipo: { type: 'string' },
    segmento: { type: 'string' },          // segmento do perfil do negócio; nomeia a subpasta de renders
    composicao: { type: 'string' }, promptIa: { type: ['string', 'null'] },
    acoes: ACOES_SCHEMA,                    // contrato estruturado: o rough sai da ação gerar, o render da ação compor
    referencia: { type: 'string' }, porque: { type: 'string' },
    semGeracao: { type: 'boolean' },        // true = sem geração de imagem IA (ex.: produtotexto sobre mockup)
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
// Pre-flight devolve também os checks do validador: pass com texto_fiel em skip não é verde (A7).
// `checks` fica opcional no schema (os controladores de replay respondem sem ele), mas a guarda de
// texto_fiel abaixo é fail-closed: com texto esperado, resposta sem `checks` também escala (A7).
const PREFLIGHT_SCHEMA = { ...EXEC_SCHEMA, properties: { ...EXEC_SCHEMA.properties,
  checks: { type: 'array', items: { type: 'object', required: ['nome', 'status'], properties: { nome: { type: 'string' }, status: { type: 'string' } } } },
} }

// Booleans de guarda são required: omissão schema-legal de renderJaExiste anularia a proteção
// contra sobrescrever render publicado, e roughExiste é o enforcement da aprovação VISUAL
// (findings #2/#6 da revisão 1.0.1). `rota` segue opcional no schema (a recusa não a tem);
// quando aprovada=true, o código exige os campos essenciais dela logo após a chamada.
const PORTAO_SCHEMA = { type: 'object', additionalProperties: false, required: ['ok', 'aprovada', 'renderJaExiste', 'reproduzir', 'roughExiste'], properties: {
  ok: { type: 'boolean' }, aprovada: { type: 'boolean' }, motivo: { type: 'string' },
  renderJaExiste: { type: 'boolean' }, reproduzir: { type: 'boolean' },
  roughExiste: { type: 'boolean' },     // o arquivo de rough da rota APROVADA existe no disco? (false quando não aprovada)
  manifesto: MANIFESTO_SCHEMA,          // conteúdo do manifesto de scripts, tal qual o operário o leu
  symlinksForaDoCwd: { type: 'array', items: { type: 'string' } },  // paths do workspace que são symlink resolvendo fora do cwd
  rota: { type: 'object', required: ['n', 'arquetipo', 'slug'], properties: {
    n: { type: 'number' }, nome: { type: 'string' }, arquetipo: { type: 'string' },
    slug: { type: 'string' }, segmento: { type: 'string' }, formato: { type: 'string' },
    promptIa: { type: ['string', 'null'] },
    textoEsperado: { type: 'string' }, copy: { type: ['string', 'null'] },
    baselinePath: { type: ['string', 'null'] }, mockupPath: { type: ['string', 'null'] },
    briefPath: { type: 'string' }, briefResumo: { type: 'string' },
    semGeracao: { type: 'boolean' }, headlineTravada: { type: 'boolean' },
    acoes: ACOES_SCHEMA,
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
  findings: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['criterio', 'resumo', 'evidencia', 'cenario', 'severidade', 'confianca', 'custoCorrecao'], properties: {
    // enum, não string livre: os critérios (A-Q mais a fidelidade ao mockup) são contrato executável, e "criterio: vibe"
    // não entra em bloqueantes sem ninguém perceber (finding #11 da revisão 1.0.1). K-Q têm
    // slug próprio desde a 1.5.2 (HERMES-1): remapeados para A-J, verdade_comercial virava
    // voz_da_marca e a trava de headline a rebaixava a sinalização.
    criterio: { enum: ['arquetipo_correto', 'rosto_nao_coberto', 'principios_duros', 'fidelidade_referencia', 'fidelidade_mockup', 'naturalidade_ia', 'texto_correto', 'legibilidade_thumbnail', 'mensagem_completa', 'voz_da_marca',
      'tres_segundos', 'miniatura', 'desfoque', 'exclusao', 'coerencia_imagem_copy', 'verdade_comercial', 'headline_tem_ideia'] },
    resumo: { type: 'string' }, evidencia: { type: 'string' }, cenario: { type: 'string' },
    severidade: { enum: ['bloqueante', 'nao-bloqueante'] },
    confianca: { enum: ['confirmado', 'plausivel'] },
    custoCorrecao: { enum: ['overlay', 'ia', 'copy'] },
    acaoSugerida: { type: 'string' },
    alvo: { type: 'string' },   // 'headline' quando o defeito é da headline; omitido nos demais
  } } },
} }

// Decisão 17A do dono (2026-11-03): justificativa em toda refutação. Com porque opcional,
// {real:false} sem justificativa descartava o finding. porque é obrigatório e não vazio em todo
// veredito; o controlador ainda recusa porque só com espaços ou caracteres invisíveis (segunda
// camada, falha fechada).
const VEREDITO_SCHEMA = { type: 'object', additionalProperties: false, required: ['real', 'porque'], properties: { real: { type: 'boolean' }, porque: { type: 'string', minLength: 20 } } }

// Decisão 18C do dono (2026-11-03): com a headline travada, headline_tem_ideia na headline passa
// por esta confirmação antes de virar sinalização. promessaFalsa=true é verdade comercial.
const PROMESSA_SCHEMA = { type: 'object', additionalProperties: false, required: ['promessaFalsa', 'porque'], properties: { promessaFalsa: { type: 'boolean' }, porque: { type: 'string', minLength: 20 } } }

const CORRECAO_SCHEMA = { type: 'object', additionalProperties: false, required: ['resumo'], properties: {
  resumo: { type: 'string' },
  promptIa: { type: ['string', 'null'] },         // null = sem re-geração
  copyCorrigida: { type: ['string', 'null'] },    // null = copy segue como está
  acoes: ACOES_SCHEMA,                            // substitui o array inteiro (validado de novo); null/omitido mantém
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
// segue o tratamento normal do step (fail-closed de quem chamou). Roughs e produção
// são exceções: podem ter gasto API antes de perder o retorno; nunca recebem fallback.
const fallbacksModelo = []
let haikuMorto = false
let promocaoDiretorMorta = false
let promocaoProdutorMorta = false

// Escape pra interpolar texto livre em comando de shell (texto de arte vem do brief):
// aspas simples com quote-out. `q` deixa passar só o que é seguro sem aspas (letras, dígitos e
// _@%+=:,./-); todo o resto vira UM argumento entre aspas simples. TODO valor interpolado em
// comando montado pelo harness passa por `q` (python, scripts, saída, base, baseline, formato,
// arquétipo, texto) — o teste executa o comando montado num /bin/sh real.
const shq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`
const SEGURO = /^[A-Za-z0-9_@%+=:,./-]+$/
const q = (s) => (SEGURO.test(String(s)) ? String(s) : shq(s))
// Valor que começa com '-' seria lido pelo script como OPÇÃO, mesmo entre aspas: a flag longa leva
// o valor no mesmo token (--flag=valor); posicional e flag curta são recusados na validação.
const iniciaOpcao = (v) => String(v).startsWith('-')
const flagValor = (flag, v) => (iniciaOpcao(v) && flag.startsWith('--') ? [`${flag}=${q(v)}`] : [flag, q(v)])

// ── validação de entrada (lexical: o sandbox não tem filesystem) ─────────────
// Existência e symlink são verificados pelo operário e informados (symlinksForaDoCwd).
const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,80}$/
const FLAG_RE = /^--?[A-Za-z0-9][\w-]*$/
// Campo do manifesto: posição (posicional) ou flag válida. Posição vence; a flag que a validação não
// aceitou nunca vai para o argv.
const campoPos = (c) => !!c && typeof c === 'object' && Number.isInteger(c.posicao) && c.posicao >= 0
const campoFlag = (c) => !!c && typeof c === 'object' && !campoPos(c) && typeof c.flag === 'string' && FLAG_RE.test(c.flag)
// Sem '-' inicial (o script leria o path como opção), sem espaço inicial/final (o path escrito com
// espaço de borda escapava da checagem de caminho absoluto) e sem quebra de linha (um comando por
// linha no bloco sh).
const pathSeguro = (p) => typeof p === 'string' && p.length > 0 && p === p.trim() && !/[\0\r\n]/.test(p) && !p.startsWith('-') && !/^([\\/~]|[A-Za-z]:)/.test(p) && !p.split(/[\\/]/).includes('..')
// Path que vai CRU para a prosa de um prompt (rotasPath, briefPath, dirs.*, artefatoPath, baseline): além
// de pathSeguro, sem '$', que um agente poderia expandir (`$HOME/...`) ao seguir a instrução.
const pathCru = (p) => pathSeguro(p) && !p.includes('$')
const dataReal = (s) => {
  const m = typeof s === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(s) : null
  if (!m) return false
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const bissexto = (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0
  return mes >= 1 && mes <= 12 && d >= 1 && d <= [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1]
}
const falha = (tipo, detalhe, acao) => ({ falha: { tipo, detalhe, acao } })
const blocoSh = (cmd) => '```sh\n' + cmd + '\n```'

// Valida o array de ações e o manifesto (quando há compor). Devolve {falha} ou {plano}.
// 'erro' = entrada inválida (path/forma); 'bloqueado' = fora do manifesto declarado pelo workspace.
function validarAcoes(acoes, manifesto) {
  if (!Array.isArray(acoes) || acoes.length === 0) return falha('erro', 'acoes deve ser um array não vazio de ações estruturadas')
  if (JSON.stringify(acoes).includes('```')) return falha('erro', 'acoes contém cerca de código (```), que não cabe em valor de argumento')
  const por = {}
  for (const a of acoes) {
    if (!a || typeof a !== 'object' || !['gerar', 'compor', 'validar'].includes(a.op)) return falha('erro', `ação inválida: op deve ser gerar, compor ou validar (recebi ${JSON.stringify(a && a.op)})`)
    if (por[a.op]) return falha('erro', `mais de uma ação ${a.op}: o contrato aceita no máximo uma por rota`)
    por[a.op] = a
  }
  const { gerar, compor, validar } = por
  const caminho = (v, campo) => pathSeguro(v) ? null : falha('erro', `${campo} inválido: ${JSON.stringify(v)} — o path deve ser relativo ao cwd, sem .. nem caminho absoluto`)
  const texto = (v, campo) => (typeof v === 'string' && v.length > 0) ? null : falha('erro', `${campo} deve ser texto não vazio`)
  const opcionalTexto = (v, campo) => (v === undefined || v === null || typeof v === 'string') ? null : falha('erro', `${campo} deve ser texto`)
  let f
  if (gerar) {
    f = texto(gerar.prompt, 'gerar.prompt') || caminho(gerar.saida, 'gerar.saida') || opcionalTexto(gerar.tamanho, 'gerar.tamanho') || opcionalTexto(gerar.provedor, 'gerar.provedor')
    if (f) return f
    if (gerar.referencias !== undefined && !Array.isArray(gerar.referencias)) return falha('erro', 'gerar.referencias deve ser um array de paths')
    for (const r of gerar.referencias || []) { f = caminho(r, 'gerar.referencias'); if (f) return f }
  }
  let spec = null
  if (compor) {
    if (!manifesto || typeof manifesto !== 'object' || !Array.isArray(manifesto.scripts)) return falha('bloqueado', 'ação compor exige o manifesto de scripts (manifesto-scripts.json) devolvido pelo portão; ausente ou sem a lista scripts', 'o workspace declara os compositores em manifesto-scripts.json (path em dirs.manifesto, default <dirs.scripts>/manifesto-scripts.json); o operário do portão lê e devolve em `manifesto`')
    spec = manifesto.scripts.find(x => x && x.nome === compor.compositor)
    if (!spec) return falha('bloqueado', `compositor fora do manifesto: ${JSON.stringify(compor.compositor)}`, `declarar o compositor em manifesto-scripts.json (compositores declarados: ${manifesto.scripts.map(x => x && x.nome).filter(Boolean).join(', ') || 'nenhum'})`)
    if (!pathSeguro(spec.executavel)) return falha('bloqueado', `manifesto: executável inválido no compositor ${compor.compositor}`)
    const campos = spec.campos && typeof spec.campos === 'object' ? spec.campos : {}
    const tem = (o, k) => !!o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k)
    const valorSemOpcao = (v, c, nome) => (iniciaOpcao(v) && !(campoFlag(c) && c.flag.startsWith('--'))) ? falha('erro', `${nome} começa com '-' e o script o leria como opção: só flag longa (--nome) aceita esse valor`) : null
    const campo = (c) => campoPos(c) || campoFlag(c)
    // Posições declaradas do compositor: únicas e sem buraco (0..n-1). Duplicada ou com buraco
    // reordenaria ou deslocaria os argumentos do script em silêncio.
    const declarados = [campos.saida, campos.base, campos.formato, ...Object.values(campos.textos && typeof campos.textos === 'object' ? campos.textos : {}), ...Object.values(campos.opcoes && typeof campos.opcoes === 'object' ? campos.opcoes : {})].filter(campoPos).map(c => c.posicao)
    const repetida = declarados.find((n, i) => declarados.indexOf(n) !== i)
    if (repetida !== undefined) return falha('bloqueado', `manifesto: posição ${repetida} repetida em campos do compositor ${compor.compositor}`, 'cada campo posicional do manifesto usa uma posição própria (0, 1, 2...)')
    const buraco = declarados.length ? [...Array(declarados.length).keys()].find(n => !declarados.includes(n)) : undefined
    if (buraco !== undefined) return falha('bloqueado', `manifesto: posição ${buraco} ausente nos campos posicionais do compositor ${compor.compositor} (as posições devem ser 0..${declarados.length - 1} sem buraco)`, 'renumerar os campos posicionais do manifesto sem lacuna')
    f = caminho(compor.saida, 'compor.saida')
    if (f) return f
    if (!campo(campos.saida)) return falha('bloqueado', `manifesto: o compositor ${compor.compositor} não declara onde fica a saída (campos.saida)`)
    if (compor.base !== undefined) {
      if (compor.base !== '{{BASE}}') { f = caminho(compor.base, 'compor.base'); if (f) return f }
      if (!campo(campos.base)) return falha('bloqueado', `campo base não declarado no manifesto do compositor ${compor.compositor}`)
    }
    if (compor.formato !== undefined) {
      f = texto(compor.formato, 'compor.formato'); if (f) return f
      if (!campo(campos.formato)) return falha('bloqueado', `campo formato não declarado no manifesto do compositor ${compor.compositor}`)
      f = valorSemOpcao(compor.formato, campos.formato, 'compor.formato'); if (f) return f
    }
    for (const [grupo, escalar] of [['textos', v => typeof v === 'string' || typeof v === 'number'], ['opcoes', v => ['string', 'number', 'boolean'].includes(typeof v)]]) {
      const valores = compor[grupo] === undefined ? {} : compor[grupo]
      if (!valores || typeof valores !== 'object' || Array.isArray(valores)) return falha('erro', `compor.${grupo} deve ser um objeto chave → valor`)
      for (const [k, v] of Object.entries(valores)) {
        if (!tem(campos[grupo], k) || !campo(campos[grupo][k])) return falha('bloqueado', `${grupo === 'textos' ? 'texto' : 'opção'} não declarado no manifesto do compositor ${compor.compositor}: ${k}`, `declarar ${k} em campos.${grupo} do manifesto ou remover da ação`)
        if (!escalar(v)) return falha('erro', `compor.${grupo}.${k} deve ser um valor escalar`)
        f = valorSemOpcao(v, campos[grupo][k], `compor.${grupo}.${k}`); if (f) return f
      }
    }
    const usadas = [campos.saida, ...(compor.base !== undefined ? [campos.base] : []), ...(compor.formato !== undefined ? [campos.formato] : []), ...Object.keys(compor.textos || {}).map(k => campos.textos[k]), ...Object.keys(compor.opcoes || {}).map(k => campos.opcoes[k])].filter(campoPos).map(c => c.posicao).sort((a, b) => a - b)
    const falta = usadas.findIndex((n, i) => n !== i)
    if (falta >= 0) return falha('erro', `a ação omite o campo posicional ${falta}, mas usa uma posição maior: o script receberia os argumentos deslocados`, `informar o campo posicional ${falta} do compositor ${compor.compositor} (só os últimos posicionais são opcionais)`)
    if (compor.sobrescrever !== undefined && typeof compor.sobrescrever !== 'boolean') return falha('erro', 'compor.sobrescrever deve ser boolean')
    if (spec.sobrescrever !== undefined && !(typeof spec.sobrescrever === 'string' && FLAG_RE.test(spec.sobrescrever))) return falha('bloqueado', `manifesto: flag sobrescrever inválida no compositor ${compor.compositor}`)
    if (compor.sobrescrever === true && spec.sobrescrever === undefined) return falha('bloqueado', `o compositor ${compor.compositor} não declara a flag sobrescrever no manifesto`)
    if (spec.logRender !== undefined && !pathSeguro(spec.logRender)) return falha('bloqueado', `manifesto: logRender inválido no compositor ${compor.compositor}`)
  }
  if (validar) {
    for (const k of ['render', 'logRender', 'baseline']) { if (validar[k] !== undefined && validar[k] !== null) { f = caminho(validar[k], `validar.${k}`); if (f) return f } }
    for (const k of ['formato', 'arquetipo', 'textoEsperado']) { f = opcionalTexto(validar[k], `validar.${k}`); if (f) return f }
    if (compor && validar.render !== undefined && validar.render !== null && validar.render !== compor.saida) return falha('erro', 'validar.render difere da saída da ação compor: o pre-flight valida o render composto')
  }
  return { plano: { gerar, compor, validar, spec } }
}

// Monta o argv como string de shell: executável do manifesto + campos → flag/posição, tudo por `q`.
// Posicionais primeiro (ordenados pela posição declarada), depois as flags.
function comandoGerar(g, saida) {
  // Prompt posicional: o '-' inicial ganha um espaço à frente (não vira opção). Quebra de linha fica
  // entre aspas (um argumento só, A3); o bloco de produção apresenta CADA comando num bloco sh próprio.
  const prompt = String(g.prompt)
  const a = [q(ARGS.python), q(`${DIR.scripts}/gerar_imagem.py`), q(iniciaOpcao(prompt) ? ` ${prompt}` : prompt), q(saida)]
  for (const r of g.referencias || []) a.push('--edit', q(r))
  if (g.tamanho) a.push(...flagValor('--tamanho', g.tamanho))
  if (g.provedor) a.push(...flagValor('--provedor', g.provedor))
  return a.join(' ')
}
function comandoCompor({ compor: c, spec }, base, sobrescrever) {
  const campos = spec.campos
  const itens = []
  if (c.base !== undefined) { const b = c.base === '{{BASE}}' ? base : c.base; if (b != null) itens.push([campos.base, b]) }
  itens.push([campos.saida, c.saida])
  if (c.formato !== undefined) itens.push([campos.formato, c.formato])
  for (const [k, v] of Object.entries(c.textos || {})) itens.push([campos.textos[k], v])
  for (const [k, v] of Object.entries(c.opcoes || {})) itens.push([campos.opcoes[k], v])
  const pos = itens.filter(([sp]) => campoPos(sp)).sort((a, b) => a[0].posicao - b[0].posicao).map(([, v]) => q(v))
  const flags = []
  for (const [sp, v] of itens) { if (!campoFlag(sp)) continue; if (v === true) flags.push(q(sp.flag)); else if (v !== false) flags.push(...flagValor(sp.flag, v)) }
  return [q(ARGS.python), q(`${DIR.scripts}/${spec.executavel}`), ...pos, ...flags, ...(sobrescrever && spec.sobrescrever ? [q(spec.sobrescrever)] : [])].join(' ')
}

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
  if (step === 'producao') {
    // Retorno perdido não distingue indisponibilidade de geração já efetuada.
    registrarExec(step, t.modelo)
    return await tentar(prompt, { ...base, ...(t.modelo === 'opus' ? { model: 'opus' } : {}) })
  }
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
  if (step === 'roughs') {
    registrarExec(step, t.modelo)
    return await tentar(prompt, { ...base, ...(t.modelo === 'haiku' ? MECANICO : {}) })
  }
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

// Uma tentativa por comando de geração. O controlador não conhece o estado da API;
// o executor preserva as evidências e o humano reconcilia antes de autorizar outra.
const POLITICA_GERACAO = `Execute cada comando no máximo UMA vez. Não repita em falha,
      timeout, resposta vazia ou perda de conexão, mesmo que nenhum arquivo tenha aparecido.
      Pare de iniciar gerações ao detectar falha; aguarde somente as já iniciadas. Preserve
      arquivos, logs e recibos disponíveis, sem credenciais. Reporte comandos, saídas parciais
      e falhas observadas; resultado incerto exige reconciliar antes de qualquer nova tentativa.`
function falhaGeracao(fase, detalhe, parcial) {
  return {
    status: 'erro', fase, detalhe, parcial, requerReconciliacao: true,
    fallbacks: fallbacksModelo, modelos: relatorioModelos(),
    acao: 'preservar arquivos, logs, recibos e respostas parciais; reconciliar os efeitos reais com o humano antes de retomar. Não reinvocar geração nem trocar de executor para repetir. Outra tentativa exige decisão humana e orçamento revisto; o harness não oferece transação sobre a API',
  }
}

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
// Entrada validada ANTES de qualquer agente: data real de calendário, paths relativos ao cwd
// (sem .. nem caminho absoluto). Symlink e existência são do operário (portão informa).
if (!dataReal(ARGS.hoje)) return { status: 'erro', fase: 'Args', detalhe: `hoje deve ser uma data real AAAA-MM-DD, recebi: ${JSON.stringify(ARGS.hoje)}`, acao: 'reinvocar com hoje no formato AAAA-MM-DD de calendário real' }
if (!pathCru(ARGS[chaveEntrada])) return { status: 'erro', fase: 'Args', detalhe: `${chaveEntrada} inválido: ${JSON.stringify(ARGS[chaveEntrada])} — deve ser relativo ao cwd, sem .. nem caminho absoluto`, acao: `reinvocar com ${chaveEntrada} dentro do cwd do workspace` }
for (const k of ['marketing', 'branding', 'contexto', 'scripts', 'manifesto']) {
  const v = ARGS.dirs && typeof ARGS.dirs === 'object' && !Array.isArray(ARGS.dirs) ? ARGS.dirs[k] : undefined
  if (v && !pathCru(v)) return { status: 'erro', fase: 'Args', detalhe: `dirs.${k} inválido: ${JSON.stringify(v)} — deve ser relativo ao cwd, sem .. nem caminho absoluto`, acao: 'a skill resolve os paths-base dentro do cwd do workspace; reinvocar com dirs corrigido' }
}
// Segmentos permitidos: cada um vira nome de pasta de render, então a mesma forma segura do slug; lista sem repetição.
if (ARGS.segmentos !== undefined && !(Array.isArray(ARGS.segmentos) && ARGS.segmentos.length > 0 && ARGS.segmentos.every(s => typeof s === 'string' && SLUG_RE.test(s)) && new Set(ARGS.segmentos).size === ARGS.segmentos.length)) return { status: 'erro', fase: 'Args', detalhe: `segmentos inválido: ${JSON.stringify(ARGS.segmentos)} — lista não vazia de slugs sem repetição (^[a-z0-9][a-z0-9_-]{0,80}$)`, acao: 'reinvocar com args.segmentos igual ao campo segmentos do perfil do negócio (minúsculas, sem espaço nem barra)' }
if (ARGS.segmento !== undefined) return { status: 'erro', fase: 'Args', detalhe: 'args.segmento deixou de existir: o segmento é por rota e o perfil declara a lista', acao: 'reinvocar com args.segmentos: a lista do campo segmentos do perfil' }
// python: UM executável (o venv do workspace). Comando composto ("uv run python", "python -m x") não é
// suportado: virar um token único só falharia depois, no mecânico, com "command not found". Caminho com
// espaço é aceito (o quoting o trata como um argumento): vale quando o primeiro trecho já tem barra
// ("/dir com espaço/venv/bin/python") ou quando a string tem barra e o primeiro trecho não é lançador
// conhecido, atribuição nem seguido de opção ("meu venv/bin/python"). Sem barra, o espaço indica comando
// com argumentos e é recusado; wrapper desconhecido que pareça diretório vira caminho e falha no
// mecânico com "command not found" (limite aceito: crie um wrapper executável).
const SEP = /[\\/]/
const LANCADOR = /^(uv|poetry|pipenv|conda|pipx|pyenv|env|sudo|nice|nohup|time|exec|bash|sh|zsh|py|python[\d.]*|npx|node|docker|arch|xcrun)$/i
const pythonComposto = (p) => {
  if (!/\s/.test(p)) return false
  const primeiro = p.split(/\s/)[0]
  if (SEP.test(primeiro)) return false
  return !SEP.test(p) || LANCADOR.test(primeiro) || primeiro.includes('=') || /\s-/.test(p)
}
if (typeof ARGS.python !== 'string' || ARGS.python !== ARGS.python.trim() || /[\0\r\n]/.test(ARGS.python) || ARGS.python.startsWith('-') || pythonComposto(ARGS.python)) {
  return { status: 'erro', fase: 'Args', detalhe: `python inválido: ${JSON.stringify(ARGS.python)} — deve ser UM executável (caminho do venv do workspace), sem espaço nas bordas, sem quebra de linha, sem '-' inicial e sem comando composto como "uv run python"`, acao: 'reinvocar com args.python apontando para o executável do venv (ex.: .venv/bin/python); comando composto não é suportado — crie um wrapper executável se precisar de "uv run"' }
}
// Perfil é escolha de custo/rigor do dono. Valor fora do enum ("Máximo", "maximum") caía em
// silêncio no default — menos lentes e verde sem registro da troca. Ausente usa o default
// documentado; acento e caixa são normalizados; qualquer outro valor é erro antes de gastar agente.
const PERFIL_ID = ARGS.perfil === undefined ? 'balanceado' : typeof ARGS.perfil === 'string' ? ARGS.perfil.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() : ''
if (!Object.prototype.hasOwnProperty.call(PERFIS, PERFIL_ID)) return { status: 'erro', fase: 'Args', detalhe: `perfil desconhecido: ${JSON.stringify(ARGS.perfil)} (use ${Object.keys(PERFIS).join(', ')})`, acao: 'reinvocar com o perfil escolhido pelo dono no plano de custo' }
const perfil = PERFIS[PERFIL_ID]

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
DIR.manifesto = dirsArg.manifesto || `${DIR.scripts}/manifesto-scripts.json`

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
       (e os .md/.png das referências que casam com o brief — vencedora do arquétipo+segmento é a
       baseline), e a seção de aprendizados de produção do branding se existir. Compile:
       baselinePath (PNG da vencedora ou null), paleta, o que clonar, o que evitar, aprendizados.
    3. ROTAS: proponha ${perfil.rotas} rotas visuais GENUINAMENTE distintas (composição/ângulo/
       mood — não variações da mesma ideia), cada uma com: n (1..${perfil.rotas}), nome curto,
       arquetipo (slug canônico do branding), segmento (${ARGS.segmentos ? `UM de ${JSON.stringify(ARGS.segmentos)}, o que melhor descreve a peça; os segmentos permitidos vêm do perfil do negócio` : 'um dos segmentos permitidos pelo perfil do negócio'}, que nomeia a
       subpasta de renders), composicao executável, promptIa (fotografia
       realista, SEM texto na imagem; null se arquétipo texto), acoes (contrato estruturado, abaixo) —
       o render sai OBRIGATORIAMENTE em ${DIR.marketing}/criativos/renders/<segmento>/<slug>.png, a convenção
       canônica do registry, e, nos arquétipos com imagem IA, a ação compor leva o path da imagem-base
       escrito como o placeholder literal {{BASE}} (o harness substitui em CÓDIGO pelo candidato
       selecionado; nunca escreva um path real de base) —, referencia que ancora e porque. Se o brief pedir arquétipo diferente do trilho vencedor, preencha conflitoTrilho.
       Rota de arquétipo sem imagem IA que NÃO seja 'texto' (ex.: produtotexto sobre mockup do
       produto) leva semGeracao: true e promptIa null; sem o campo, o harness exige {{BASE}}.
       Rota com semGeracao: true não tem ação gerar: o render sai determinístico do mockup (ação compor, custo zero).
       CONTRATO ESTRUTURADO: leia ${DIR.manifesto} (compositores, campos e logRender que o workspace
       declara) e devolva em cada rota \`acoes\` (obrigatório) — o harness monta o comando em código.
       acoes = no máximo uma de cada: gerar {prompt, saida (o rough), referencias?, tamanho?,
       provedor?} · compor {compositor (NOME do manifesto), base: "{{BASE}}" nos arquétipos com imagem IA,
       saida (render canônico), textos, formato, opcoes, sobrescrever} · validar {formato?, arquetipo?,
       textoEsperado?, logRender?, baseline?}. Só compositor, textos e opções declarados no manifesto;
       paths relativos ao cwd, sem '..' e sem '-' inicial; nenhum valor com quebra de linha (o prompt
       da ação gerar é a exceção). Rota com textoEsperado precisa de logRender (no compositor ou na
       ação validar). Rota sem acoes encerra o run em erro, antes de qualquer rough.
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
  if (!SLUG_RE.test(dir.slug)) return { status: 'erro', fase: 'Rotas', detalhe: `slug inválido: ${JSON.stringify(dir.slug)} — só ^[a-z0-9][a-z0-9_-]{0,80}$`, fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'reinvocar; o slug entra em paths e comandos e não aceita espaço, maiúscula nem metacaractere' }
  if (!pathCru(dir.artefatoPath)) return { status: 'erro', fase: 'Rotas', detalhe: `artefatoPath inválido: ${JSON.stringify(dir.artefatoPath)} — deve ser relativo ao cwd, sem .. nem caminho absoluto`, fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'reinvocar; o artefato de rotas fica dentro do workspace' }

  if (dir.rotas.length > perfil.rotas || new Set(dir.rotas.map(r => r.n)).size !== dir.rotas.length) {
    return { status: 'bloqueado', fase: 'Rotas', detalhe: `rotas excedem o teto ${perfil.rotas} do perfil ou repetem identificador`, acao: 'corrigir o plano antes de qualquer rough pago', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
  }
  // Comando do rough por rota, ANTES de qualquer gasto: montado em código a partir da ação gerar.
  // Rota sem acoes encerra em erro: o agente nunca entrega comando em texto livre.
  const comandosRough = []
  for (const r of dir.rotas) {
    const bloqueio = (detalhe, acao, tipo = 'bloqueado') => ({ status: tipo, fase: 'Rotas', detalhe: `rota ${r.n}: ${detalhe}`, acao, fallbacks: fallbacksModelo, modelos: relatorioModelos() })
    if (!Array.isArray(r.acoes) || r.acoes.length === 0) return bloqueio('a rota não traz acoes (contrato estruturado obrigatório)', 'o diretor devolve acoes (gerar/compor/validar) em toda rota; nenhum rough foi gerado e nenhuma API de imagem foi gasta', 'erro')
    if (ARGS.segmentos && !ARGS.segmentos.includes(r.segmento)) return bloqueio(`segmento ${JSON.stringify(r.segmento)} fora dos segmentos do perfil ${JSON.stringify(ARGS.segmentos)}`, 'o diretor usa, em cada rota, um dos segmentos do perfil; nenhum rough foi gerado', 'erro')
    const gerar = r.acoes.filter(a => a && a.op === 'gerar')
    if (gerar.length === 0) {
      // Rota sem geração de imagem (arquétipo texto ou semGeracao): não há rough a gerar nem gasto; o
      // render composto é o primeiro preview. Rota com imagem IA exige a ação gerar.
      if (r.arquetipo === 'texto' || r.semGeracao === true) { comandosRough.push(null); continue }
      return bloqueio('acoes sem ação gerar em rota com imagem IA: o rough estruturado sai da ação gerar', 'incluir uma ação gerar na rota (ou marcar semGeracao: true se a rota não gera imagem)')
    }
    const v = validarAcoes(gerar)
    if (v.falha) return bloqueio(v.falha.detalhe, v.falha.acao || 'corrigir a ação gerar da rota e reinvocar; nenhum rough foi gerado', v.falha.tipo)
    comandosRough.push(comandoGerar(v.plano.gerar, v.plano.gerar.saida))
  }
  phase('Roughs')
  log(`Gerando ${dir.rotas.length} rough(s) em paralelo — 1 por rota`)
  const roughs = await parallel(dir.rotas.map((r, i) => () => comandosRough[i] === null ? { ok: true, artefatos: [], falhas: [], semRough: true } :
    chamarMecanico('roughs',
      `Execute EXATAMENTE este comando no diretório de trabalho ATUAL da sessão (venv: ${ARGS.python})
      e confirme que o arquivo de saída existe no disco depois:
${blocoSh(comandosRough[i])}
      REGRA DE CWD: rode a partir do cwd atual da sessão, SEM cd para nenhum outro diretório —
      os paths relativos do comando resolvem a partir dele; se não resolverem, reporte falha em
      vez de procurar o workspace em outro lugar.
      ok=true SOMENTE se o arquivo de saída existe. artefatos = [path do arquivo gerado].
      ${POLITICA_GERACAO}
      Não ajuste flag nenhuma.`,
      { label: `rough:rota${r.n}`, phase: 'Roughs', schema: EXEC_SCHEMA }
    )
  ))
  const geracoes = dir.rotas.map((r, i) => ({
    chamada: `rough:rota${r.n}`, comando: comandosRough[i], resultado: roughs[i] || null,
  })).filter((g) => g.comando !== null)
  // O lote já iniciado pode terminar; nenhuma rota segue enquanto existir efeito incerto.
  if (geracoes.some(({ resultado: r }) => !r || !r.ok || !r.artefatos?.length || r.falhas?.length)) {
    return falhaGeracao('Roughs', 'rough sem confirmação de sucesso ou com falha declarada', {
      rotasPath: dir.artefatoPath, geracoes,
    })
  }
  const rotasComRough = dir.rotas.map((r, i) => {
    const res = roughs[i]
    const okRough = !!(res && res.ok && res.artefatos && res.artefatos.length > 0)
    const semRough = !!(res && res.semRough)
    return { n: r.n, nome: r.nome, arquetipo: r.arquetipo, referencia: r.referencia, porque: r.porque, rough: okRough ? res.artefatos[0] : null, ...(semRough ? { semRough: true } : {}), falha: okRough || semRough ? null : (res && res.falhas && res.falhas.length ? res.falhas[0].resumo : 'o mecânico do rough não retornou') }
  })

  return {
    status: 'aguardando-rota',
    slug: dir.slug,
    rotasPath: dir.artefatoPath,
    conflitoTrilho: dir.conflitoTrilho || null,
    prancheta: dir.prancheta || null,
    rotas: rotasComRough,
    fallbacks: fallbacksModelo, modelos: relatorioModelos(),
    proximo: `a skill mostra os roughs ao humano (Read nos PNGs), ele escolhe VENDO; a skill grava rota_aprovada: <n> (e aprovada_em: data) no frontmatter de ${dir.artefatoPath} e reinvoca o harness com {estagio: 'produzir', rotasPath}. Falhas de geração exigem reconciliação antes de prosseguir.`,
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
  - Extraia da rota aprovada: n, nome, arquetipo, slug (do artefato), segmento (o da rota aprovada, subpasta de renders), formato,
    promptIa (null se arquétipo texto), textoEsperado (o texto da arte previsto
    nas acoes/brief), copy (headline/body/descricao do brief, como texto corrido; null se o
    brief não traz copy), baselinePath (da prancheta), mockupPath (se o brief/registry aponta
    mockup de produto; senão null), briefPath e briefResumo (3-5 linhas: mensagem, público,
    oferta/prazo prometidos — o crit julga completude por isso).
    Extraia também: acoes (array de ações estruturadas gerar/compor/validar, cópia fiel dos
    campos do artefato) e, quando o artefato os traz na rota, semGeracao (boolean) e headlineTravada
    (boolean) — nunca invente; ausente = omita o campo.
  - renderJaExiste: o arquivo da SAÍDA da ação compor da rota aprovada (o render que o run vai sobrescrever, sob ${DIR.marketing}/criativos/renders/<segmento>/<slug>.png) já existe no disco?
  - reproduzir: o frontmatter tem reproduzir: true?
  - roughExiste: o arquivo de rough da rota APROVADA (a saída da ação gerar dela)
    existe no disco? Confira de verdade (ls). Quando aprovada=false, devolva roughExiste=false.
    Rota com acoes SEM ação gerar (arquétipo texto ou semGeracao) não tem rough: não há arquivo a
    conferir, devolva roughExiste=true.
  - manifesto: se o arquivo ${DIR.manifesto} existe, devolva o conteúdo dele, JSON tal qual está
    (você só lê e repassa; não interprete nem complete). Ausente = omita o campo.
  - symlinksForaDoCwd: liste os paths sob ${DIR.marketing}, ${DIR.branding}, ${DIR.contexto} e ${DIR.scripts}
    que são symlink e resolvem para fora do cwd (confira de verdade, ex.: find -type l + realpath).
    Nenhum = array vazio.
  ok=false (com motivo) se o artefato não existe ou está incompleto. Os quatro booleans
  (aprovada, renderJaExiste, reproduzir, roughExiste) são SEMPRE respondidos, inclusive na
  recusa (com false). Retorne o objeto.`,
  { label: 'portao:validar', phase: 'Portão', schema: PORTAO_SCHEMA }
)

if (!portao) return { status: 'erro', fase: 'Portão', detalhe: 'o validador do portão não retornou', fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'reinvocar com resumeFromRunId' }
if (!portao.ok) return { status: 'bloqueado', fase: 'Portão', detalhe: portao.motivo || 'artefato de rotas ausente ou incompleto', acao: 'rodar o estágio rotas primeiro (ou corrigir o artefato) e reinvocar', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
if (!portao.aprovada) return { status: 'bloqueado', fase: 'Portão', detalhe: 'rota_aprovada ausente no artefato — o humano ainda não escolheu a rota', acao: 'apresentar os roughs ao humano, gravar rota_aprovada: <n> no frontmatter e reinvocar — o harness não produz com o portão aberto (nenhuma API de imagem foi gasta)', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
if (portao.renderJaExiste && !portao.reproduzir && ARGS.reproduzir !== true) {
  return { status: 'bloqueado', fase: 'Portão', detalhe: `o render final do slug já existe e nem o artefato nem args.reproduzir liberam reproduzir`, acao: 'confirmar com o humano: marcar reproduzir: true no artefato de rotas ou reinvocar com args.reproduzir: true (sobrescreve) ou versionar o slug (v<N+1>) — o harness não sobrescreve render publicado em silêncio', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
}
// Aprovado sem rota extraível é resposta não-conforme — desreferenciar sem guarda mataria o
// run com TypeError SEM relatório, o invariante que este arquivo declara (finding #2, 1.0.1).
const rotaTemAcoes = !!portao.rota && Array.isArray(portao.rota.acoes) && portao.rota.acoes.length > 0
if (!portao.rota || !portao.rota.arquetipo || !portao.rota.slug || !portao.rota.segmento || !rotaTemAcoes) {
  return { status: 'erro', fase: 'Portão', detalhe: 'portão aprovou mas não devolveu a rota completa (arquetipo, slug, segmento e acoes são obrigatórios)', fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'reinvocar com resumeFromRunId' }
}
// Enforcement da aprovação VISUAL (a headline da fase, antes só em prosa — finding #6, 1.0.1):
// rota aprovada cujo rough não existe no disco = escolha às cegas; o harness recusa.
if (portao.roughExiste === false) {
  return { status: 'bloqueado', fase: 'Portão', detalhe: 'a rota aprovada não tem rough no disco — a escolha de rota é VISUAL, não textual', acao: 'conferir arquivos, logs e recibos; se já houve tentativa, reconciliar seu efeito antes de autorizar outra geração com o humano. Só aprovar VENDO o rough; sem ele, trocar de rota ou corrigir o setup. Arquivo ausente não prova ausência de efeito na API', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
}

const rota = portao.rota
const falhaPortao = (tipo, detalhe, acao) => ({ status: tipo, fase: 'Portão', detalhe, acao, fallbacks: fallbacksModelo, modelos: relatorioModelos() })
// O segmento da rota nomeia uma pasta: sempre slug, com ou sem args.segmentos (sem o arg, "../../fora" ou
// "Com Espaço" fechava verde porque só se comparava com o arg).
if (typeof rota.segmento !== 'string' || !SLUG_RE.test(rota.segmento)) return falhaPortao('erro', `segmento da rota inválido: ${JSON.stringify(rota.segmento)} — só ^[a-z0-9][a-z0-9_-]{0,80}$`, 'corrigir o segmento no artefato de rotas (ele nomeia a pasta de renders) e reinvocar; nenhuma geração foi feita')
if (ARGS.segmentos && !ARGS.segmentos.includes(rota.segmento)) return falhaPortao('erro', `segmento da rota ${JSON.stringify(rota.segmento)} fora dos segmentos do perfil ${JSON.stringify(ARGS.segmentos)}`, 'corrigir o segmento no artefato de rotas para um dos segmentos do perfil e reinvocar; nenhuma geração foi feita')
// Entrada da rota validada antes de qualquer geração paga ou composição.
if (typeof rota.slug !== 'string' || !SLUG_RE.test(rota.slug)) return falhaPortao('erro', `slug da rota inválido: ${JSON.stringify(rota.slug)} — só ^[a-z0-9][a-z0-9_-]{0,80}$`, 'corrigir o slug no artefato de rotas (minúsculas, dígitos, _ e -) e reinvocar; nenhuma geração foi feita')
if (Array.isArray(portao.symlinksForaDoCwd) && portao.symlinksForaDoCwd.length > 0) return falhaPortao('erro', `symlink que resolve fora do cwd: ${portao.symlinksForaDoCwd.join(', ')}`, 'remover ou refazer o symlink dentro do workspace e reinvocar; o harness não escreve nem lê fora do cwd')
// Texto esperado sem log de render declarado: o validador pularia o texto fiel (A7).
const semLogRender = (plano) => !!((plano.validar && plano.validar.textoEsperado) || rota.textoEsperado) && !((plano.validar && plano.validar.logRender) || plano.spec.logRender)
const v = validarAcoes(rota.acoes, portao.manifesto)
if (v.falha) return falhaPortao(v.falha.tipo, `acoes da rota: ${v.falha.detalhe}`, v.falha.acao || 'corrigir as acoes da rota (ou o manifesto) e reinvocar; nenhuma geração foi feita')
if (!v.plano.compor) return falhaPortao('bloqueado', 'acoes da rota sem ação compor: não há composição a executar', 'incluir a ação compor na rota e reinvocar')
if (rota.baselinePath && !pathCru(rota.baselinePath)) return falhaPortao('erro', `baselinePath inválido: ${JSON.stringify(rota.baselinePath)} — deve ser relativo ao cwd, sem .. nem caminho absoluto`, 'corrigir a baseline da prancheta no artefato de rotas e reinvocar')
// A saída da ação compor é o arquivo que será sobrescrito e validado: precisa ficar sob
// <marketing>/criativos/renders/<segmento>/<slug>.png (a convenção do registry), nunca em branding/ ou em outro diretório.
const semPonto = (x) => String(x).replace(/^(\.\/)+/, '').replace(/\/+$/, '')
const pastaRender = `${semPonto(DIR.marketing)}/criativos/renders/${rota.segmento}/`
// Forma exata: <pasta do segmento>/<slug da rota>.png, sem subpasta, sem outro slug e só com a extensão documentada.
if (semPonto(v.plano.compor.saida) !== `${pastaRender}${rota.slug}.png`) return falhaPortao('bloqueado', `a saída da ação compor (${JSON.stringify(v.plano.compor.saida)}) não é ${pastaRender}${rota.slug}.png: o render é gravado só na pasta do segmento, com o slug da rota e extensão png, sem subpasta`, `corrigir compor.saida no artefato de rotas para ${pastaRender}${rota.slug}.png e reinvocar; nenhuma geração foi feita`)
const planoAcoes = v.plano
if (semLogRender(planoAcoes)) return falhaPortao('bloqueado', 'a rota tem texto esperado mas nenhum logRender (na ação validar nem no compositor do manifesto): o validador deixaria o check texto_fiel em skip', 'declarar logRender no compositor do manifesto ou na ação validar e reinvocar; nenhuma geração foi feita')
// semGeracao explícito (não inferido de promptIa vazio): "sem prompt" ≠ "sem geração". Rota
// com semGeracao se comporta como arquétipo texto no que toca custo: zero API de imagem.
const ehTexto = rota.arquetipo === 'texto' || rota.semGeracao === true
const headlineTravada = rota.headlineTravada === true || ARGS.headlineTravada === true
// Placeholder {{BASE}} é contrato do comando de overlay em arquétipo com imagem IA: a troca
// da imagem-base pelo candidato selecionado é feita em CÓDIGO (o mecânico é proibido de
// editar comando — finding #5, 1.0.1). Artefato antigo sem placeholder = corrigir o artefato.
if (!ehTexto && planoAcoes.compor.base !== '{{BASE}}') {
  return { status: 'bloqueado', fase: 'Portão', detalhe: 'a ação compor da rota aprovada não tem o placeholder {{BASE}} para a imagem-base', acao: 'editar o artefato de rotas trocando o path de base da ação compor pelo literal {{BASE}} e reinvocar — sem isso a composição ignoraria o candidato selecionado', fallbacks: fallbacksModelo, modelos: relatorioModelos() }
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
let acoesAtuais = planoAcoes
let promptIaAtual = rota.promptIa || (planoAcoes.gerar ? planoAcoes.gerar.prompt : rota.promptIa)
// args.headline troca SÓ o valor do rótulo Headline: copy estruturada mantém Subheadline, body,
// descrição e CTA; copy sem nenhum rótulo reconhecido é só a headline e é substituída inteira.
// Rótulo ancorado (início, após | / quebra de linha ou ". ") — nunca dentro de "Subheadline".
const headlineNova = typeof ARGS.headline === 'string' ? ARGS.headline.trim() : ''
const ROTULO_COPY = /(^|[ \t]*[|/][ \t]*|\.[ \t]+|\n[ \t]*)(Subheadline|Headline|Body|Corpo|Descri[cç][aã]o|CTA)[ \t]*:[ \t]*/gi
function trocarHeadline(copy, nova) {
  const rotulos = [...copy.matchAll(ROTULO_COPY)]
  if (!rotulos.length) return nova
  const i = rotulos.findIndex(m => m[2].toLowerCase() === 'headline')
  if (i < 0) return `Headline: ${nova} | ${copy}`
  const ini = rotulos[i].index + rotulos[i][0].length
  let fim = rotulos[i + 1] ? rotulos[i + 1].index : copy.length
  const corte = copy.slice(ini, fim).search(/[|\n]/)
  if (corte >= 0) fim = ini + corte
  const resto = copy[fim] === '|' ? copy.slice(ini, fim).match(/\s*$/)[0] : ''
  return copy.slice(0, ini) + nova + resto + copy.slice(fim)
}
let copyAtual = (headlineNova ? (rota.copy ? trocarHeadline(rota.copy, headlineNova) : headlineNova) : rota.copy) || null
const sinalizacoes = []         // findings de headline com a trava ligada: sinalizados, nunca bloqueantes
// Rebaixados com a trava, qualquer custo. tres_segundos e coerencia_imagem_copy entram porque o
// validador os remapeava para mensagem_completa antes da 1.5.2, e a regra 2 da decisão 14 manda
// o que a trava já rebaixava continuar sinalização. miniatura, desfoque e exclusao iam para
// legibilidade_thumbnail: com a trava, só custo copy os rebaixa; overlay ou ia seguem o fluxo normal.
const REDACAO_HEADLINE = ['voz_da_marca', 'mensagem_completa', 'headline_tem_ideia', 'tres_segundos', 'coerencia_imagem_copy']
// alvo é string livre no schema: 'Headline' ou 'headline ' ainda é a headline, para a trava e
// para o bloqueio da verdade comercial (comparar por igualdade exata deixava a promessa escapar).
const ehAlvoHeadline = f => typeof f.alvo === 'string' && f.alvo.trim().toLowerCase() === 'headline'
// Justificativa de um veredito: texto que sobra depois de tirar espaços e caracteres invisíveis
// (decisão 17A). trim não tira formatação Unicode: U+200B ou U+2060 sozinhos passavam no
// minLength do schema e no trim e descartavam o finding com um porque em branco no report.
const INVISIVEL = /[\p{White_Space}\p{Cf}\p{Default_Ignorable_Code_Point}]/gu
// Decisão do dono, 2026-11-04: conte pontos de código, sem espaços/invisíveis.
const justificativa = v => {
  const texto = typeof v.porque === 'string' ? v.porque.replace(INVISIVEL, '') : ''
  return [...texto].length >= 20 && /[\p{L}\p{N}]/u.test(texto)
}
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
       veredito_final ${desfecho === 'verde' ? 'pass' : desfecho}, criado_em ${ARGS.hoje};
       corpo: recomendação ${desfecho === 'verde' ? 'APROVAR' : 'DECISÃO HUMANA — o run não fechou'},
       o rationale da seleção, o que mudou entre iterações, e a copy final ${copyFoiCorrigida ? '(CORRIGIDA no run — marque isso)' : ''});
       cópia do render final (se existir); grid.md listando os roughs das rotas e TODOS os
       candidatos gerados com o escolhido marcado (paths abaixo — não copie os PNGs, liste os paths).
    Histórico das iterações (JSON): ${JSON.stringify(historico)}
    Seleção: ${JSON.stringify(selecaoInfo)}
    Candidatos gerados: ${JSON.stringify(candidatosTodos)}
    Copy final: ${copyAtual || '(sem copy no run)'}
    Sinalizações (headline travada, não bloqueiam; copyCorrigida descartada fica aqui): ${JSON.stringify(sinalizacoes)}
    Render final: ${renderAtual || '(nenhum render composto)'}
    Artefato de rotas: ${ARGS.rotasPath}
    ok=true SÓ se tudo gravado; liste em gravados os paths escritos. NÃO altere o registry
    canônico do criativo nem o artefato de rotas.`,
    { label: 'pacote:montar', phase: 'Pacote', schema: PACOTE_SCHEMA }
  )
}
async function encerrarComPacote(status, fase, detalhe, acao, extra = {}) {
  const pac = historico.length > 0 ? await montarPacote(status) : null
  return {
    status, fase, iteracao, detalhe, acao, ...extra,
    historico, findingsJulgados, sinalizacoes,
    pacote: pac && pac.ok ? pac.pacotePath : null,
    ...(historico.length > 0 && !(pac && pac.ok) ? { avisoPacote: 'pacote não gravado — os reports das iterações seguem no campo historico deste relatório' } : {}),
    fallbacks: fallbacksModelo, modelos: relatorioModelos(),
  }
}
const escaladoComPacote = (fase, detalhe, acao) => encerrarComPacote('escalado', fase, detalhe, acao)

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
    // Os comandos saem de campos estruturados, montados em código (um por candidato); sem ação gerar,
    // o comando sai do promptIa (nunca texto livre ao produtor).
    const gerarAcao = acoesAtuais.gerar || {}
    const comandosCand = Array.from({ length: n }, (_, k) => comandoGerar({ ...gerarAcao, prompt: promptIaAtual }, `${DIR.marketing}/criativos/base/${rota.slug}__cand${k + 1}_iter${iteracao}.png`))
    if (comandosCand.some(c => c.includes('```'))) return await escaladoComPacote('Produzir', { motivo: 'prompt de geração contém cerca de código (```)' }, 'tirar a cerca do prompt de IA e reinvocar')
    const prod = await chamarProdutor('producao',
      `Gere ${n} candidatos de imagem-base pra rota aprovada do slug ${rota.slug}.
      Execute EXATAMENTE os ${n} comandos abaixo, um por bloco sh, sem alterar argumento nenhum. Cada
      bloco é UM comando e pode ocupar várias linhas (texto entre aspas com quebra de linha): rode o bloco
      inteiro de uma vez, nunca linha por linha, e nunca trate uma linha de dentro das aspas como comando:
${comandosCand.map(blocoSh).join('\n')}
      Saídas: ${DIR.marketing}/criativos/base/${rota.slug}__cand<k>_iter${iteracao}.png (k = 1..${n}).
      REGRA DE CWD: execute tudo a partir do cwd ATUAL da sessão, sem cd — paths relativos
      resolvem a partir dele; se não resolverem, reporte falha em vez de procurar o workspace.
      Execute as ${n} gerações, confirme que cada arquivo existe, e liste em candidatos SÓ os
      que existem. ${POLITICA_GERACAO}
      Texto NUNCA na imagem gerada.`,
      { label: `producao:i${iteracao}`, phase: 'Produzir', schema: PRODUCAO_SCHEMA }
    )
    if (!prod || !prod.ok || !prod.candidatos?.length || prod.falhas?.length) {
      return falhaGeracao('Produzir', 'produção sem confirmação de sucesso ou com falha declarada', {
        iteracao, rodadasIa, rotasPath: ARGS.rotasPath,
        geracao: { chamada: `producao:i${iteracao}`, resultado: prod || null },
        candidatosTodos, baseEscolhida, renderAtual, historico, findingsJulgados,
      })
    }
    if (prod.candidatos.length > n) {
      historico.push({ iteracao, evento: 'teto de candidatos excedido', autorizado: n, recebido: prod.candidatos.length, candidatos: prod.candidatos })
      return await escaladoComPacote('Produzir', `produção retornou ${prod.candidatos.length} candidatos para teto ${n}`, 'reconciliar custo e artefatos com o dono antes de continuar; não repetir geração')
    }
    const candidatoInseguro = prod.candidatos.find(c => !pathSeguro(c))
    if (candidatoInseguro !== undefined) {
      historico.push({ iteracao, evento: 'candidato com path inválido', candidatos: prod.candidatos })
      return await escaladoComPacote('Produzir', `candidato com path inválido (relativo ao cwd, sem ..): ${JSON.stringify(candidatoInseguro)}`, 'o produtor devolveu path fora do contrato; conferir os arquivos gerados e reinvocar sem repetir geração')
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
  // O argv sai do manifesto e dos campos da ação compor (a flag de sobrescrever também é do manifesto):
  // a iteração 1 roda como está, exceto no reuso (portao.renderJaExiste, reproduzir); da 2 em diante
  // o render já existe e o script só o regrava com a flag.
  const saidaDeclarada = acoesAtuais.compor.saida
  const comandoComposicao = comandoCompor(acoesAtuais, baseEscolhida, acoesAtuais.compor.sobrescrever === true || iteracao >= 2 || portao.renderJaExiste)
  if (comandoComposicao.includes('```')) return await escaladoComPacote('Produzir', { motivo: 'comando de composição contém cerca de código (```)' }, 'tirar a cerca do valor que a carrega e reinvocar')
  const comp = await chamarMecanico('composicao',
    `Execute a composição do render (venv: ${ARGS.python}), a partir do cwd ATUAL da sessão —
    NUNCA mude de diretório; paths relativos resolvem a partir dele (se não resolverem, reporte
    falha em vez de procurar o workspace em outro lugar):
${blocoSh(comandoComposicao)}
    A saída do render é ${q(saidaDeclarada)}, declarada na ação compor — essa é a fonte
    única; não mude o destino nem o compare com outra convenção. Os scripts compor_*.py
    auto-logam o comando — NÃO use --sem-log.
    ok=true SOMENTE se o arquivo de saída do comando existe depois de rodar. artefatos = [esse path].`,
    { label: `composicao:i${iteracao}`, phase: 'Produzir', schema: EXEC_SCHEMA }
  )
  if (!comp) return { status: 'erro', fase: 'Produzir', iteracao, detalhe: 'o mecânico da composição não retornou', fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'reinvocar com resumeFromRunId' }
  if (!comp.ok || comp.artefatos.length === 0) {
    return await escaladoComPacote('Produzir', comp.falhas, 'a composição falhou (fonte/flag/path?) — as acoes da rota precisam de correção humana')
  }
  const norm = (x) => String(x).replace(/^(\.\/)+/, '')
  if (!comp.artefatos.some(a => norm(a) === norm(saidaDeclarada))) return await escaladoComPacote('Produzir', { motivo: `a composição não confirmou a saída declarada na ação compor: ${saidaDeclarada}`, artefatos: comp.artefatos }, 'conferir o compositor e a saída do manifesto; o render validado é sempre o declarado na ação')
  renderAtual = saidaDeclarada

  // ── pre-flight determinístico (fail-closed, guarda de check cego) ──────────
  const val = acoesAtuais.validar || {}
  const textoPf = val.textoEsperado || rota.textoEsperado || null
  const baselinePf = val.baseline || rota.baselinePath || null
  // --log-render só com texto esperado: sem o log do render o check de texto fiel fica em skip (A7).
  // O logRender aceita {slug}, {segmento} e {hoje}, expandidos em código (valores já validados como slug e data):
  // o log do compositor que é datado ou nomeado por peça não cabe em um path fixo do manifesto.
  const expandirLog = (p) => p == null ? p : p.replace(/\{(slug|segmento|hoje)\}/g, (_, k) => k === 'slug' ? rota.slug : k === 'segmento' ? rota.segmento : ARGS.hoje)
  const logRenderPf = textoPf ? expandirLog(val.logRender || acoesAtuais.spec.logRender || null) : null
  const comandoPf = [q(ARGS.python), q(`${DIR.scripts}/validar_criativo.py`), q(renderAtual),
    ...flagValor('--formato', val.formato || rota.formato || acoesAtuais.compor.formato || 'feed'), ...flagValor('--arquetipo', val.arquetipo || rota.arquetipo),
    ...(textoPf ? (iniciaOpcao(textoPf) ? [`--texto-esperado=${q(textoPf)}`] : ['--texto-esperado', q(textoPf)]) : []), ...(baselinePf ? ['--baseline', q(baselinePf)] : []),
    ...(logRenderPf ? ['--log-render', q(logRenderPf)] : [])].join(' ')
  if (comandoPf.includes('```')) return await escaladoComPacote('Produzir', { motivo: 'comando do pre-flight contém cerca de código (```)' }, 'conferir o path do render e os textos da rota e reinvocar')
  const pf = await chamarMecanico('preflight',
    `Rode o pre-flight determinístico do render (venv: ${ARGS.python}), a partir do cwd ATUAL da
    sessão — NUNCA mude de diretório:
${blocoSh(comandoPf)}
    Capture o JSON de stdout. ok = (exit code 0). Devolva SEMPRE em checks (obrigatório, mesmo vazio) cada check do JSON como {nome, status} (status pass, fail, warn ou skip). Cada check com fail vira uma entrada em
    falhas com criterio = nome do check e resumo = o que o JSON reportou. Se o script QUEBRAR
    (crash/traceback/flag inválida, sem JSON), ok=false e uma entrada em falhas com
    criterio "script" e o erro literal no resumo. Warns NÃO derrubam (não entram em falhas;
    cite no resumo do primeiro artefato se houver).
    artefatos = [${renderAtual}] se o arquivo existe. NÃO corrija nada.`,
    { label: `preflight:i${iteracao}`, phase: 'Produzir', schema: PREFLIGHT_SCHEMA }
  )
  if (!pf) return { status: 'erro', fase: 'Produzir', iteracao, detalhe: 'o mecânico do pre-flight não retornou', fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'portão que falha aberto não é portão; reinvocar com resumeFromRunId' }
  // O mecânico nomeia crash/flag inválida como 'script': é erro operacional, não overlay.
  if ((pf.falhas || []).some(f => f.criterio === 'script')) {
    return { status: 'erro', fase: 'Produzir', iteracao, detalhe: 'pre-flight falhou operacionalmente — crítica e correção não executadas', preflight: pf, fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'conferir script/venv/flags no workspace; preservar render e falhas antes de retomar' }
  }
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
  // pass sem texto_fiel comprovado (skip, ausente ou outro status) não prova o texto da arte: veredito
  // unknown, o run escala em vez de fechar verde. Nome e status comparados normalizados (caixa, '-' e
  // espaço). Resposta sem `checks` conta como check ausente: fail-closed.
  const norm1 = (x) => String(x).toLowerCase().replace(/[\s-]+/g, '_')
  if (falhasPreflight.length === 0 && textoPf) {
    const checksPf = Array.isArray(pf.checks) ? pf.checks : []
    const tf = checksPf.find(c => c && norm1(c.nome) === 'texto_fiel')
    const naoComprovado = !tf || !['pass', 'warn'].includes(norm1(tf.status))
    if (naoComprovado) {
      historico.push({ iteracao, render: renderAtual, preflight: [], veredito: 'unknown', checks: checksPf })
      return await encerrarComPacote('escalado', 'Produzir', `pre-flight sem texto_fiel comprovado (${tf ? `status ${JSON.stringify(tf.status)}` : 'check ausente'}): o texto da arte não foi verificado, veredito unknown (não fecha verde)`,
        'garantir o log de render do compositor (logRender no manifesto ou na ação validar) para o validador comparar o texto, ou conferir o texto da arte com o humano; reinvocar com args.reproduzir: true', { veredito: 'unknown', checks: checksPf })
    }
  }

  // ── crit adversarial (fail-closed) ─────────────────────────────────────────
  phase('Crit')
  const crit = await chamarValidador('crit',
    `Tarefa T2 (crítica). Julgue o render final contra TODOS os critérios do seu contrato
    (A-Q), nas duas lentes, acabamento e ideia, tentando REFUTAR a aprovação. Leia como
    imagem: o render, a baseline e o mockup (quando houver).
    render: ${renderAtual}
    brief: ${rota.briefPath} — resumo do prometido: ${rota.briefResumo}
    rota aprovada: ${ARGS.rotasPath} (rota ${rota.n}; arquétipo esperado: ${rota.arquetipo})
    baseline da vencedora: ${rota.baselinePath || 'não fornecida — D vira sinalização, diga isso'}
    mockup do produto: ${rota.mockupPath || 'não fornecido'}
    copy do anúncio a julgar (G, J, O, P e Q): ${copyAtual || 'não fornecida: J é skip com esse motivo'}
    documento de voz: ${DIR.branding}/tom-de-voz-aplicado.md (leia antes de julgar J)
    princípios duros: ${DIR.branding}/principios-criativos.md (leia antes de julgar C)
    catálogo e contexto do negócio: ${DIR.contexto}/ (P se julga por lookup do catálogo/contexto
    nessa pasta, nunca de memória; cite em evidencia o arquivo consultado)
    Cada finding contém somente os campos do schema; não acrescente metadados ou campos de roteamento.
    alvo: 'headline' SOMENTE quando o defeito está na headline/copy principal; omita nos demais.
    criterio: use EXATAMENTE um dos slugs do contrato, o PRÓPRIO slug do teste que falhou.
    Acabamento: arquetipo_correto, rosto_nao_coberto, principios_duros, fidelidade_referencia,
    fidelidade_mockup (bloqueante mesmo sem baseline: o produto do render difere do mockup fornecido), naturalidade_ia, texto_correto, legibilidade_thumbnail,
    mensagem_completa, voz_da_marca. Ideia: tres_segundos, miniatura, desfoque, exclusao,
    coerencia_imagem_copy, verdade_comercial, headline_tem_ideia. Nunca troque o slug de um
    teste de ideia pelo de um critério de acabamento. Headline que promete o que o negócio não
    oferece, inclusive no 4º teste de copy de Q, é verdade_comercial, nunca headline_tem_ideia:
    Q cobre troca do termo definidor, fala humana e "e daí?".${ehTexto ? `
    Arquétipo texto: NÃO existe imagem-base gerada — custoCorrecao 'ia' é inválido aqui;
    problema visual se resolve por overlay (recompor) ou copy.` : ''}
    Findings SÓ com evidência concreta (região/trecho + cenário de dano). Na dúvida,
    confianca=plausivel — a confirmação é de outra chamada, não sua. Sem problema real em um
    critério = sem finding dele (não fabrique). custoCorrecao pela tabela: overlay (recompor
    resolve), ia (re-gerar imagem-base), copy (só texto do anúncio).`,
    { label: `crit:i${iteracao}`, phase: 'Crit', schema: CRIT_SCHEMA }
  )
  if (!crit) return { status: 'erro', fase: 'Crit', iteracao, detalhe: 'o crit não retornou', fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'sem crítica adversarial o verde seria mentira; reinvocar com resumeFromRunId' }

  // ── confirmação de promessa na headline travada (decisão 18C, fail-closed) ──
  // Decisão 18C do dono (2026-11-03): com a trava, todo headline_tem_ideia com alvo headline, em
  // qualquer severidade e confiança, passa por esta confirmação antes de virar sinalização. O crit
  // pode chamar de "headline sem ideia" uma headline que promete o que o negócio não oferece, e a
  // trava rebaixaria a promessa falsa a sinalização. promessaFalsa=true é verdade comercial
  // confirmada na headline travada (o fim antecipado como bloqueado logo abaixo); promessaFalsa=false
  // só rebaixa com justificativa válida; refutação inválida encerra como erro de resposta, sem
  // afirmar promessa falsa nem liberar entrega. false com porque válido
  // segue o tratamento de hoje: sinalização se bloqueante, não-bloqueante se declarado assim. Sem
  // trava, nada muda.
  const reclassificacao = new Map()   // finding do crit → { motivo, porque } da reclassificação
  const promessaDescartada = new Map()  // finding do crit → porque da promessa descartada
  if (headlineTravada) {
    for (const f of crit.findings.filter(f => f.criterio === 'headline_tem_ideia' && ehAlvoHeadline(f))) {
      const p = await chamarValidador('confirmacao',
        `Tarefa T3 (confirmação de promessa). A headline está travada e o crit apontou
        headline_tem_ideia nela: ${f.resumo}. Evidência apontada: ${f.evidencia}. Cenário: ${f.cenario}.
        Copy do anúncio: ${copyAtual || 'não fornecida'}. Render: ${renderAtual}.
        Pergunta única: a crítica aponta promessa de produto, variação, serviço ou condição que o
        negócio não oferece? Responda por lookup do catálogo/contexto do negócio em ${DIR.contexto}/,
        nunca de memória; cite em porque o arquivo consultado e o que ele diz.
        promessaFalsa=true quando a headline promete o que o catálogo/contexto não oferece;
        promessaFalsa=false quando a crítica é só de ideia (troca do termo definidor, fala humana,
        "e daí?"). porque é obrigatório nos dois casos: mínimo de 20 caracteres sem espaços ou caracteres invisíveis, com pelo menos uma letra ou número. Explique o problema apontado e por que a evidência sustenta a confirmação ou a refutação; tamanho sozinho não basta. Não procure problemas novos.`,
        { label: `promessa:i${iteracao}`, phase: 'Crit', schema: PROMESSA_SCHEMA }
      )
      if (!p) return { status: 'erro', fase: 'Crit', iteracao, detalhe: `o confirmador de promessa do finding "${f.resumo}" não retornou`, fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'um null rebaixaria a sinalização uma possível promessa falsa na headline travada; reinvocar com resumeFromRunId' }
      if (p.promessaFalsa === false) {
        if (!justificativa(p)) return {
          status: 'erro', natureza: 'resposta_invalida', fase: 'Crit', iteracao,
          solicitacao: `promessa:i${iteracao}`,
          detalhe: `o confirmador de promessa do finding "${f.resumo}" retornou refutação com justificativa inválida; não há confirmação de promessa falsa`,
          fallbacks: fallbacksModelo, modelos: relatorioModelos(),
          acao: 'corrigir a justificativa do confirmador (mínimo de 20 caracteres sem espaços/invisíveis e letra ou número, explicando a evidência) antes de retomar; não liberar entrega'
        }
        promessaDescartada.set(f, p.porque); continue
      }
      reclassificacao.set(f, { motivo: 'a confirmação de promessa apontou promessa que o negócio não oferece', porque: p.porque })
    }
  }

  // ── confirmação de findings plausíveis (fail-closed) ───────────────────────
  // Decisão 14 do dono (2026-11-03): com a trava, verdade_comercial na headline é o único
  // critério que continua bloqueando, então a severidade declarada pelo crit não a tira do
  // bloqueio. Declarada nao-bloqueante, ia para naoBloqueantes e o run fechava verde
  // recomendando aprovar a promessa falsa. A coerção fica registrada no histórico. O
  // headline_tem_ideia reclassificado pela 18C vira verdade_comercial bloqueante, com registro.
  const severidadeCoagida = []
  const reclassificados = []
  // O schema recusa campos extras; a defesa de roteamento também independe dessa validação.
  // Quem marca o reclassificado é a identidade do objeto criado aqui, nunca um campo do finding:
  // campo forjado pulava a T3, furava a sinalização da trava e encerrava bloqueado sem confirmação.
  const reclassificadosNaIteracao = new Set()
  const findingsCrit = crit.findings.map(f => {
    if (reclassificacao.has(f)) {
      const r = reclassificacao.get(f)
      reclassificados.push({ resumo: f.resumo, de: 'headline_tem_ideia', para: 'verdade_comercial', severidadeDeclarada: f.severidade, confiancaDeclarada: f.confianca, motivo: r.motivo })
      const novo = { ...f, criterio: 'verdade_comercial', criterioOriginal: 'headline_tem_ideia', severidade: 'bloqueante', severidadeDeclarada: f.severidade, reclassificacao: r.motivo, porquePromessa: r.porque }
      reclassificadosNaIteracao.add(novo)
      return novo
    }
    if (promessaDescartada.has(f)) return { ...f, porquePromessa: promessaDescartada.get(f) }
    // Fidelidade ao mockup bloqueia MESMO sem baseline de vencedora (diferente da fidelidade à referência): com
    // mockup fornecido, a severidade declarada pelo crit não tira o finding do bloqueio. Registrado no histórico.
    if (rota.mockupPath && f.criterio === 'fidelidade_mockup' && f.severidade !== 'bloqueante') {
      severidadeCoagida.push({ criterio: f.criterio, resumo: f.resumo, severidadeDeclarada: f.severidade })
      return { ...f, severidade: 'bloqueante', severidadeDeclarada: f.severidade }
    }
    if (!(headlineTravada && ehAlvoHeadline(f) && f.criterio === 'verdade_comercial' && f.severidade !== 'bloqueante')) return f
    severidadeCoagida.push({ criterio: f.criterio, resumo: f.resumo, severidadeDeclarada: f.severidade })
    return { ...f, severidade: 'bloqueante', severidadeDeclarada: f.severidade }
  })
  const bloqueantes = []
  for (const f of findingsCrit.filter(f => f.severidade === 'bloqueante')) {
    // A confirmação de promessa já julgou o reclassificado: não gasta a T3 de novo.
    if (reclassificadosNaIteracao.has(f)) { bloqueantes.push(f); findingsJulgados.push({ iteracao, ...f, confirmado: true, porqueVeredito: f.porquePromessa }); continue }
    // Headline travada: o defeito é sinalizado ao humano, não vira retrabalho nem gasta confirmação.
    // A trava protege a REDAÇÃO (copy / voz / mensagem / ideia da headline); defeito de render com
    // alvo headline (custo overlay/ia) segue o fluxo normal. Decisão 14 do dono (2026-11-03):
    // verdade_comercial na headline NUNCA é sinalizada, qualquer que seja o custo; segue a
    // confirmação normal e, confirmada, encerra o run como bloqueado logo abaixo.
    if (headlineTravada && ehAlvoHeadline(f) && f.criterio !== 'verdade_comercial' && (f.custoCorrecao === 'copy' || REDACAO_HEADLINE.includes(f.criterio))) { sinalizacoes.push({ iteracao, ...f, motivo: `headline travada: ${f.criterio} sinalizado, não bloqueia (com a trava, só verdade_comercial bloqueia)` }); continue }
    if (f.confianca === 'confirmado') { bloqueantes.push(f); findingsJulgados.push({ iteracao, ...f, confirmado: true, porqueVeredito: 'confirmado pelo próprio crit com evidência' }); continue }
    const v = await chamarValidador('confirmacao',
      `Tarefa T3 (confirmação). Confirme ou refute este finding plausível antes de virar retrabalho:
      critério ${f.criterio} — ${f.resumo}. Evidência apontada: ${f.evidencia}. Cenário: ${f.cenario}.
      Releia ${renderAtual} (zoom na região citada)${copyAtual ? ' e a copy fornecida' : ''}. real=true só com evidência própria.
      porque é obrigatório nos dois vereditos: mínimo de 20 caracteres sem espaços ou caracteres invisíveis, com pelo menos uma letra ou número. Explique o problema apontado e por que a evidência sustenta a confirmação ou a refutação; tamanho sozinho não basta. Refutação sem porque válido não descarta o finding.${f.criterio === 'verdade_comercial' ? `
      Verdade comercial se confirma ou refuta por lookup do catálogo/contexto do negócio em
      ${DIR.contexto}/, nunca de memória; cite em porque o arquivo consultado e o que ele diz.` : ''}`,
      { label: `confirmar:i${iteracao}`, phase: 'Crit', schema: VEREDITO_SCHEMA }
    )
    if (!v) return { status: 'erro', fase: 'Crit', iteracao, detalhe: `o confirmador do finding "${f.resumo}" não retornou`, fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'um null descartaria bloqueante plausível em silêncio; reinvocar com resumeFromRunId' }
    // Decisão 17A do dono (2026-11-03): só refutação com porque descarta. Porque ausente, vazio ou
    // só com espaços (o schema exige texto, a segunda camada fica aqui) mantém o finding bloqueante.
    if (v.real === false && justificativa(v)) { findingsJulgados.push({ iteracao, ...f, confirmado: false, porqueVeredito: v.porque }); continue }
    bloqueantes.push(f)
    findingsJulgados.push({ iteracao, ...f, confirmado: true, porqueVeredito: v.porque ?? null,
      ...(v.real === true ? {} : { refutacaoRecusada: true, motivo: 'refutação sem porque recusada (só real=false com porque válido (20 caracteres sem espaços/invisíveis e letra ou número) descarta): o finding segue bloqueante, falha fechada, decisão 17A' }) })
  }

  historico.push({ iteracao, render: renderAtual, preflight: falhasPreflight, bloqueantesConfirmados: bloqueantes, naoBloqueantes: findingsCrit.filter(f => f.severidade === 'nao-bloqueante'), ...(severidadeCoagida.length ? { severidadeCoagida } : {}), ...(reclassificados.length ? { reclassificados } : {}) })

  // Verdade comercial confirmada na headline travada não tem correção no run: a copy não se
  // reescreve (copyCorrigida seria descartada) e recompor não tira a promessa da peça. Iterar
  // queimaria o teto e fechar verde recomendaria aprovar promessa falsa (HERMES-1). O run para
  // aqui, com reports gravados, e a decisão volta ao dono. Vale também para o headline_tem_ideia
  // reclassificado pela confirmação de promessa (18C), com a origem dita no detalhe.
  const promessaTravada = headlineTravada ? bloqueantes.filter(f => ehAlvoHeadline(f) && f.criterio === 'verdade_comercial') : []
  if (promessaTravada.length > 0) {
    return await encerrarComPacote('bloqueado', 'Crit',
      `headline travada com verdade_comercial confirmada: ${promessaTravada.map(f => reclassificadosNaIteracao.has(f) ? `${f.resumo} (headline_tem_ideia reclassificado como verdade_comercial: ${f.reclassificacao})` : f.resumo).join('; ')}. A copy não se reescreve no run, então não há correção possível aqui`,
      'decisão do dono: destravar a headline (tirar headlineTravada da rota e dos args) para o run poder corrigir a copy, ou trocá-la por uma headline verdadeira com args.headline; reinvocar com args.reproduzir: true, porque o render do slug já foi composto. O harness não itera sem correção possível nem fecha verde sobre promessa falsa',
      { findingsBloqueio: promessaTravada })
  }

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
    Ações estruturadas atuais (JSON): ${JSON.stringify([acoesAtuais.gerar, acoesAtuais.compor, acoesAtuais.validar].filter(Boolean))}
    ${promptIaAtual ? `Prompt de IA atual: ${promptIaAtual}` : 'Arquétipo texto — sem prompt de IA.'}
    ${copyAtual ? `Copy atual: ${copyAtual}` : ''}
    ${headlineTravada ? 'HEADLINE TRAVADA: não reescreva a copy — copyCorrigida deve ser null.' : ''}
    Devolva: acoes corrigidas (o array inteiro, só campos do contrato e só compositor/opções/textos declarados no manifesto; null/omitido pra manter${ehTexto ? '' : '; em arquétipo com imagem IA, mantenha base: "{{BASE}}" na ação compor'}), promptIa corrigido (SÓ se alguma
    falha tem custo ia — senão null), copyCorrigida (SÓ se alguma falha tem custo copy — senão
    null). Corrija TODAS as falhas de uma vez. Não invente correção fora da tabela.`,
    { label: `correcao:i${iteracao}`, phase: 'Crit', schema: CORRECAO_SCHEMA }
  )
  if (!cor) return { status: 'erro', fase: 'Crit', iteracao, detalhe: 'o produtor da correção não retornou', fallbacks: fallbacksModelo, modelos: relatorioModelos(), acao: 'reinvocar com resumeFromRunId' }
  const avisosCorrecao = []
  if (custoIaCoergido) avisosCorrecao.push("findings com custo 'ia' coergidos a overlay — arquétipo texto não tem imagem gerada")
  let comandoAceito = false
  if (Array.isArray(cor.acoes) && cor.acoes.length > 0) {
    const v = validarAcoes(cor.acoes, portao.manifesto)
    if (v.falha) avisosCorrecao.push(`acoes corrigidas recusadas: ${v.falha.detalhe}`)
    else if (!v.plano.compor) avisosCorrecao.push('acoes corrigidas recusadas: sem ação compor')
    else if (!ehTexto && v.plano.compor.base !== '{{BASE}}') avisosCorrecao.push('acoes corrigidas recusadas: sem base {{BASE}} na ação compor (arquétipo IA)')
    else if (semLogRender(v.plano)) avisosCorrecao.push('acoes corrigidas recusadas: texto esperado sem logRender declarado')
    else if (v.plano.compor.saida !== acoesAtuais.compor.saida) avisosCorrecao.push('acoes corrigidas recusadas: a saída da ação compor não muda no run')
    else if (JSON.stringify(v.plano.compor) !== JSON.stringify(acoesAtuais.compor) || JSON.stringify(v.plano.validar) !== JSON.stringify(acoesAtuais.validar)) { acoesAtuais = { ...v.plano, gerar: acoesAtuais.gerar }; comandoAceito = true }
  }
  let copyAceita = false
  if (cor.copyCorrigida) {
    if (headlineTravada) {
      avisosCorrecao.push('copyCorrigida descartada: headline travada')
      sinalizacoes.push({ iteracao, tipo: 'copyCorrigida', motivo: 'copyCorrigida descartada: headline travada', descartada: cor.copyCorrigida })
    } else { copyAtual = cor.copyCorrigida; copyFoiCorrigida = true; copyAceita = true }
  }
  if (custoIa && cor.promptIa) { promptIaAtual = cor.promptIa; precisaGerarIa = true }
  else if (custoIa && !cor.promptIa) { precisaGerarIa = true } // re-gera com o prompt atual — a falha é da imagem
  historico[historico.length - 1].correcao = { resumo: cor.resumo, avisos: avisosCorrecao }
  // Guarda de não-progresso (finding #8 da revisão 1.0.1): correção que não mudou comando,
  // copy nem pediu re-geração re-produziria o MESMO render — iterar só queimaria teto e
  // chamadas de julgamento; escala com o diagnóstico honesto.
  if (!comandoAceito && !copyAceita && !precisaGerarIa) {
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
    historico, findingsJulgados, sinalizacoes, fallbacks: fallbacksModelo, modelos: relatorioModelos(),
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
  sinalizacoes,
  preflight: preflightFinal,
  pacote: pac.pacotePath,
  reportsGravados: pac.gravados,
  findingsJulgados,
  findingsNaoBloqueantes: historico.length ? historico[historico.length - 1].naoBloqueantes : [],
  fallbacks: fallbacksModelo, modelos: relatorioModelos(),
  proximo: `a skill retoma pós-verde: apresentar o pacote ao humano (render + grid + rationale), e após OK humano gravar o registry canônico do criativo (${DIR.marketing}/registry/criativos/<slug>.md + _indice.csv, status aprovado) e seguir pro /campanha-montar do workspace — o harness nunca commita e nunca marca aprovação humana`,
}

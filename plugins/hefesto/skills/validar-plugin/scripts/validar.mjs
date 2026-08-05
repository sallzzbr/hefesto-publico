#!/usr/bin/env node
// Validador determinístico de marketplace + plugins Claude Code.
// Uso: node validar.mjs [raiz-do-marketplace] [--plugin <nome>]
// Exit 0 = sem erros (avisos permitidos); exit 1 = erros.
// Sem dependências: Node >= 16, ESM puro.

import { readFileSync, readdirSync, existsSync, statSync, lstatSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';

const SEMVER = /^\d+\.\d+\.\d+$/;
const WIN_PATH = /[A-Za-z]:\\/;
const UNIX_HOME = /(^|[\s"'(=`])\/(Users|home)\//;

// Paths de domínio: tokens relativos que assumem estrutura do workspace consumidor.
// A extração cobre prosa, backticks e strings de harness; prefixos internos são delimitados
// por segmento para não liberar, por exemplo, docs/roteamento-clientes por coincidência parcial.
const PREFIXOS_INTERNOS_PLUGIN = /^(?:\$?\{CLAUDE_PLUGIN_ROOT\}(?:\/|$)|references(?:\/|$)|scripts(?:\/|$)|harness(?:\/|$)|skills(?:\/|$)|commands(?:\/|$)|agents(?:\/|$)|tests(?:\/|$)|evals(?:\/|$)|docs\/(?:roteamento-matrix\.md|inventario-skills\.md|roteamento\/)|plugins(?:\/|$)|\.claude-plugin(?:\/|$)|\.claude(?:\/|$)|\.venv(?:\/|$)|\.git(?:\/|$)|node_modules(?:\/|$))/;
const RAIZES_DOMINIO = new Set([
  'financas', 'marketing', 'branding', 'contexto', 'financeiro',
  'courses', 'templates', 'personas', 'diagnostics', 'transcriptions',
  'agenda', 'rascunhos', 'ideias', 'metricas', 'voz', 'posts',
]);
const SEGMENTOS_DOCS_DOMINIO = /^(?:desafios|plans|pendencias(?:\.md)?|roteamento-clientes)$/i;
const CONTEXTO_OPERACIONAL = /\b(?:leia|ler|liste|listar|busque|buscar|salve|salvar|grave|gravar|escreva|escrever|crie|criar|carregue|carregar|localize|localizar|procure|procurar|atualize|atualizar|dados vivem)\b/i;
const CLAUSULA_RESOLUCAO = {
  workspace: /CLAUDE\.md|workspace/i,
  defaults: /defaults[\s\S]{0,180}local_|local_[a-z0-9_*]+[\s\S]{0,180}defaults/i,
  cwd: /convenç[aã]o[\s\S]{0,120}cwd|descobert[ao][\s\S]{0,120}cwd/i,
  fallback: /default\s+documentado|fallback[\s\S]{0,120}default/i,
  illustrative: /ilustrativ/i,
};
const DELEGACAO_RESOLUCAO_CANONICA = /regra\s+única[\s\S]{0,600}(?:references\/[^\s`)"']*defaults\.md|capa-template\.md)/i;

function temClausulaResolucaoCompleta(texto) {
  // O marcador `> ` da citação quebra os regexes no meio de uma cláusula correta; a
  // formatação não pode decidir se o contrato foi declarado.
  const semCitacao = texto.replace(/^[ \t]*>[ \t]?/gm, '');
  const cadeiaCompleta = Object.values(CLAUSULA_RESOLUCAO).every((re) => re.test(semCitacao));
  const delegacaoCanonica = DELEGACAO_RESOLUCAO_CANONICA.test(semCitacao)
    && CLAUSULA_RESOLUCAO.illustrative.test(semCitacao);
  return cadeiaCompleta || delegacaoCanonica;
}

function pathsDeDominio(texto) {
  const achados = new Set();
  const semUrls = texto.replace(/https?:\/\/[^\s"'`)]+/g, '');
  const re = /(?:\$\{CLAUDE_PLUGIN_ROOT\}\/|\.\.?\/)?[A-Za-z0-9_.à-úÀ-Ú<>*{}-]+(?:\/[A-Za-z0-9_.à-úÀ-Ú<>*{}-]+)+\/?/g;
  let m;
  while ((m = re.exec(semUrls)) !== null) {
    const token = m[0].replace(/[.,;:]+$/, '');
    if (token.startsWith('../')) continue;
    const puro = token.replace(/^\.\//, '');
    if (/^\{DIR\.[^}]+\}\//i.test(puro)) continue;
    if (/^[a-z0-9-]+\/SKILL\.md$/i.test(puro)) continue;
    if (PREFIXOS_INTERNOS_PLUGIN.test(puro)) continue;
    const niveis = puro.split('/').filter(Boolean);
    if (niveis.length < 2) continue;
    const raiz = niveis[0].toLocaleLowerCase('pt-BR');
    const ultimo = niveis[niveis.length - 1] || '';
    const raizConhecida = RAIZES_DOMINIO.has(raiz)
      || (raiz === 'docs' && SEGMENTOS_DOCS_DOMINIO.test(niveis[1] || ''));
    const inicioLinha = semUrls.lastIndexOf('\n', m.index) + 1;
    const fimLinhaEncontrado = semUrls.indexOf('\n', m.index);
    const fimLinha = fimLinhaEncontrado === -1 ? semUrls.length : fimLinhaEncontrado;
    const linha = semUrls.slice(inicioLinha, fimLinha);
    const terminaEmBarra = puro.endsWith('/');
    const terminaEmArquivo = /\.[A-Za-z0-9]{1,8}$/.test(ultimo);
    const operacional = CONTEXTO_OPERACIONAL.test(linha);
    if (raizConhecida && !(terminaEmBarra || terminaEmArquivo || operacional)) continue;
    if (!raizConhecida && !((terminaEmBarra || terminaEmArquivo) && operacional)) continue;

    achados.add(token);
  }
  return [...achados];
}
const TEXT_EXTS = new Set(['.md', '.mjs', '.js', '.json', '.py', '.sh', '.txt', '.yml', '.yaml']);

const erros = [];
const avisos = [];
const erro = (arquivo, msg) => erros.push(`ERRO  ${arquivo}: ${msg}`);
const aviso = (arquivo, msg) => avisos.push(`AVISO ${arquivo}: ${msg}`);

// --- args ---------------------------------------------------------------
let raizArg = null;
let soPlugin = null;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--plugin') {
    soPlugin = argv[++i];
    if (!soPlugin || soPlugin.startsWith('--')) {
      console.error('ERRO: --plugin requer um nome (uso: validar.mjs [raiz] [--plugin <nome>])');
      process.exit(1);
    }
  } else if (!raizArg) raizArg = argv[i];
}

// --- localizar raiz do marketplace ---------------------------------------
function acharRaiz(inicio) {
  let dir = resolve(inicio);
  for (;;) {
    if (existsSync(join(dir, '.claude-plugin', 'marketplace.json'))) return dir;
    const pai = dirname(dir);
    if (pai === dir) return null;
    dir = pai;
  }
}

const raiz = acharRaiz(raizArg ?? process.cwd());
if (!raiz) {
  console.error('ERRO: nenhum .claude-plugin/marketplace.json encontrado a partir de ' + (raizArg ?? process.cwd()));
  process.exit(1);
}
const rel = (p) => relative(raiz, p) || '.';
const SELF = resolve(process.argv[1] ?? '');

// --- helpers -------------------------------------------------------------
function lerJson(caminho) {
  if (!existsSync(caminho)) { erro(rel(caminho), 'arquivo não existe'); return null; }
  try {
    return JSON.parse(readFileSync(caminho, 'utf8'));
  } catch (e) {
    erro(rel(caminho), 'JSON inválido — ' + e.message);
    return null;
  }
}

function frontmatter(caminho) {
  const texto = readFileSync(caminho, 'utf8');
  if (!/^---[ \t]*\r?\n/.test(texto)) return { ok: false, motivo: 'sem frontmatter (arquivo não começa com ---)' };
  // o fecho precisa ser uma linha contendo só "---" (evita aceitar "---qualquer-coisa")
  const fecho = texto.slice(3).match(/\r?\n---[ \t]*(\r?\n|$)/);
  if (!fecho) return { ok: false, motivo: 'frontmatter não fechado (falta linha com apenas ---)' };
  const bloco = texto.slice(3, 3 + fecho.index);
  const m = bloco.match(/^description:[ \t]*(.*)$/m);
  if (!m) return { ok: false, motivo: 'frontmatter sem campo description' };
  let desc = m[1].trim();
  // valor iniciando em "#" é comentário YAML, não conteúdo (description: # TODO)
  if (desc.startsWith('#')) desc = '';
  // scalars multilinha (>, |, variantes): coleta só as linhas indentadas CONTÍGUAS;
  // para na primeira linha não-indentada pra não capturar o valor da chave seguinte
  if (['', '>', '|', '>-', '|-', '>+', '|+'].includes(desc)) {
    const continuacao = [];
    for (const linha of bloco.slice(m.index + m[0].length).split('\n').slice(1)) {
      if (/^[ \t]+\S/.test(linha)) continuacao.push(linha.trim());
      else break;
    }
    desc = continuacao.join(' ');
  }
  if (/^["']/.test(desc)) desc = desc.replace(/^["']|["']$/g, '');
  if (!desc) return { ok: false, motivo: 'description vazia (valor ausente, só comentário ou scalar multilinha sem conteúdo)' };
  return { ok: true, description: desc };
}

function arquivosTextoRecursivos(dir) {
  const achados = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    const st = lstatSync(caminho);
    if (st.isSymbolicLink()) { aviso(rel(caminho), 'symlink ignorado na validação'); continue; }
    if (st.isDirectory()) {
      if (nome === 'tests') continue;
      achados.push(...arquivosTextoRecursivos(caminho));
    }
    else {
      if (resolve(caminho) === SELF) continue;
      const idx = nome.lastIndexOf('.');
      const ext = idx >= 0 ? nome.slice(idx).toLowerCase() : '';
      if (TEXT_EXTS.has(ext)) achados.push(caminho);
    }
  }
  return achados;
}

function extrairInventarioDeLinha(arquivo, texto, regex, rotulo) {
  const linhas = texto.split(/\r?\n/);
  const idx = linhas.findIndex((linha) => /publica\b.*plugins?\b/i.test(linha));
  if (idx === -1) {
    erro(rel(arquivo), `sem linha de inventário de plugins em ${rotulo}`);
    return null;
  }
  const nomes = [...linhas[idx].matchAll(regex)].map((m) => m[1]);
  if (!nomes.length) {
    erro(rel(arquivo), `linha de inventário de plugins em ${rotulo} sem nomes reconhecíveis`);
    return null;
  }
  const unicos = [...new Set(nomes)];
  if (unicos.length !== nomes.length) {
    erro(rel(arquivo), `linha de inventário de plugins em ${rotulo} repete nomes`);
    return null;
  }
  return { nomes: unicos, linha: idx + 1 };
}

function compararInventarioDoDoc(arquivo, texto, regex, rotulo, esperados) {
  const inventario = extrairInventarioDeLinha(arquivo, texto, regex, rotulo);
  if (!inventario) return;

  const faltando = esperados.filter((nome) => !inventario.nomes.includes(nome));
  const extras = inventario.nomes.filter((nome) => !esperados.includes(nome));
  if (faltando.length || extras.length) {
    const partes = [];
    if (faltando.length) partes.push(`faltando: ${faltando.join(', ')}`);
    if (extras.length) partes.push(`extras: ${extras.join(', ')}`);
    erro(
      rel(arquivo),
      `inventário de plugins difere do marketplace.json (linha ${inventario.linha}; ${partes.join('; ')})`,
    );
  }
}

function normalizarTituloInventario(titulo) {
  return titulo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function tipoDeInventarioDoTitulo(titulo) {
  const normalizado = normalizarTituloInventario(titulo);
  if (/\bskills?\b/.test(normalizado)) return 'skills';
  if (/\bcommands?\b|\bcomandos?\b/.test(normalizado)) return 'commands';
  if (/\bagents?\b|\bagentes?\b/.test(normalizado)) return 'agents';
  return null;
}

function primeiraCelulaDaTabela(linha) {
  const colunas = linha.split('|');
  if (colunas.length < 3) return null;
  return colunas[1].trim();
}

function extrairNomeDaCelula(celula, tipo) {
  if (!celula) return null;
  const texto = celula.trim();
  if (tipo === 'commands') {
    const comando = texto.match(/^`?\/(?:[a-z0-9-]+:)?([a-z0-9-]+)(?:`)?(?=\s|$|[—-])/i);
    if (comando) return comando[1];
  }
  if (texto.startsWith('`')) {
    const slug = texto.match(/^`([a-z0-9-]+)`(?=\s|$|[—-])/i);
    if (slug) return slug[1];
  }
  return null;
}

function extrairInventarioDaSecao(linhas, tipo) {
  const nomes = [];
  let emBlocoDeCodigo = false;
  for (const linha of linhas) {
    const aparada = linha.trim();
    if (/^```/.test(aparada)) {
      emBlocoDeCodigo = !emBlocoDeCodigo;
      continue;
    }
    if (emBlocoDeCodigo) continue;

    if (/^\s*\|/.test(linha)) {
      const nome = extrairNomeDaCelula(primeiraCelulaDaTabela(linha), tipo);
      if (nome) nomes.push(nome);
      continue;
    }

    if (/^\s*(?:[-*+]|\d+\.)\s+/.test(linha)) {
      const conteudo = linha.replace(/^\s*(?:[-*+]|\d+\.)\s+/, '');
      const nome = extrairNomeDaCelula(conteudo, tipo);
      if (nome) nomes.push(nome);
    }
  }
  return nomes;
}

function compararInventarioDoReadmePlugin(arquivo, texto, inventarioEsperado) {
  const linhas = texto.split(/\r?\n/);
  const headings = [];
  for (let i = 0; i < linhas.length; i++) {
    const match = linhas[i].match(/^(#{1,6})\s+(.*\S)\s*$/);
    if (!match) continue;
    headings.push({
      indice: i,
      linha: i + 1,
      nivel: match[1].length,
      titulo: match[2].trim(),
    });
  }

  const secoes = headings
    .map((heading) => {
      const tipo = tipoDeInventarioDoTitulo(heading.titulo);
      return tipo ? { ...heading, tipo } : null;
    })
    .filter(Boolean);

  const vistos = {
    skills: { presente: false, nomes: [], linhas: [] },
    commands: { presente: false, nomes: [], linhas: [] },
    agents: { presente: false, nomes: [], linhas: [] },
  };

  for (let i = 0; i < secoes.length; i++) {
    const secao = secoes[i];
    const bucket = vistos[secao.tipo];
    bucket.presente = true;

    let fim = linhas.length;
    for (const heading of headings) {
      if (heading.indice > secao.indice && heading.nivel <= secao.nivel) {
        fim = heading.indice;
        break;
      }
    }

    const nomes = extrairInventarioDaSecao(linhas.slice(secao.indice + 1, fim), secao.tipo);
    if (!nomes.length) {
      erro(rel(arquivo), `seção "${secao.titulo}" em README.md sem inventário reconhecível`);
      continue;
    }

    bucket.nomes.push(...nomes);
    bucket.linhas.push(secao.linha);
  }

  for (const tipo of ['skills', 'commands', 'agents']) {
    const esperado = inventarioEsperado[tipo];
    const bucket = vistos[tipo];
    const rotulo = tipo === 'skills' ? 'skills' : tipo === 'commands' ? 'commands' : 'agents';

    if (esperado.length && !bucket.presente) {
      erro(rel(arquivo), `sem seção de inventário de ${rotulo} em README.md`);
      continue;
    }
    if (!bucket.nomes.length) continue;

    const repetidos = bucket.nomes.filter((nome, idx) => bucket.nomes.indexOf(nome) !== idx);
    if (repetidos.length) {
      erro(rel(arquivo), `inventário de ${rotulo} em README.md repete nomes: ${[...new Set(repetidos)].join(', ')}`);
      continue;
    }

    const unicos = [...new Set(bucket.nomes)];
    const faltando = esperado.filter((nome) => !unicos.includes(nome));
    const extras = unicos.filter((nome) => !esperado.includes(nome));
    if (faltando.length || extras.length) {
      const partes = [];
      if (faltando.length) partes.push(`faltando: ${faltando.join(', ')}`);
      if (extras.length) partes.push(`extras: ${extras.join(', ')}`);
      erro(
        rel(arquivo),
        `inventário de ${rotulo} em README.md difere do conteúdo em disco (linha ${bucket.linhas[0]}; ${partes.join('; ')})`,
      );
    }
  }
}

function normalizarCaminhoDoc(caminho) {
  return caminho.replace(/\\/g, '/').replace(/\/+$/, '');
}

function limparComentarioEstrutura(texto) {
  return texto.replace(/\s+#.*$/, '').trim();
}

function compararEstruturaDoReadmePlugin(arquivo, texto, dirPlugin) {
  const linhas = texto.split(/\r?\n/);
  const idxSecao = linhas.findIndex((linha) => /^##\s+Estrutura\s*$/i.test(linha.trim()));
  if (idxSecao === -1) return;

  let idxBloco = -1;
  for (let i = idxSecao + 1; i < linhas.length; i++) {
    if (/^```/.test(linhas[i].trim())) {
      idxBloco = i;
      break;
    }
    if (/^#{1,6}\s+/.test(linhas[i].trim())) break;
  }
  if (idxBloco === -1) {
    erro(rel(arquivo), 'seção "Estrutura" sem bloco de código');
    return;
  }

  let raizDoc = null;
  const stack = [];
  let viuRaiz = false;
  for (let i = idxBloco + 1; i < linhas.length; i++) {
    const linhaOriginal = linhas[i];
    const linha = linhaOriginal.trimEnd();
    if (/^```/.test(linha.trim())) break;
    if (!linha.trim()) continue;

    if (!viuRaiz) {
      const raizMatch = linha.trim().match(/^([A-Za-z0-9_.\-\/]+\/?)\s*(?:#.*)?$/);
      if (!raizMatch) {
        erro(rel(arquivo), 'bloco "Estrutura" sem raiz de plugin reconhecível');
        return;
      }
      raizDoc = normalizarCaminhoDoc(raizMatch[1]);
      viuRaiz = true;
      const esperado = normalizarCaminhoDoc(rel(dirPlugin));
      if (raizDoc !== esperado) {
        erro(rel(arquivo), `raiz da estrutura "${raizDoc}" difere do diretório real "${esperado}"`);
      }
      continue;
    }

    const branch = linha.match(/^(?<prefix>(?:│   |    )*)(?<marker>[├└]── )(?<rest>.*\S)\s*$/);
    if (!branch?.groups) {
      erro(rel(arquivo), `linha de estrutura não reconhecida: ${linha.trim()}`);
      return;
    }

    const depth = (branch.groups.prefix.match(/(?:│   |    )/g) || []).length;
    const conteudo = limparComentarioEstrutura(branch.groups.rest);
    const itemDir = conteudo.endsWith('/');
    const itemNome = normalizarCaminhoDoc(conteudo.replace(/\/+$/, ''));
    if (!itemNome) {
      erro(rel(arquivo), 'item vazio no bloco "Estrutura"');
      return;
    }

    const pais = stack.slice(0, depth);
    const caminhoRel = join(raizDoc, ...pais, itemNome);
    const caminhoAbs = resolve(raiz, caminhoRel);
    if (!existsSync(caminhoAbs)) {
      erro(rel(arquivo), `estrutura em README.md aponta para caminho inexistente: ${normalizarCaminhoDoc(caminhoRel)}`);
    } else {
      const ehDiretorio = statSync(caminhoAbs).isDirectory();
      if (itemDir && !ehDiretorio) erro(rel(arquivo), `estrutura em README.md esperava diretório, mas encontrou arquivo: ${normalizarCaminhoDoc(caminhoRel)}`);
      if (!itemDir && ehDiretorio) erro(rel(arquivo), `estrutura em README.md esperava arquivo, mas encontrou diretório: ${normalizarCaminhoDoc(caminhoRel)}`);
    }

    if (itemDir) {
      stack.length = depth;
      stack.push(itemNome);
    }
  }

  if (!viuRaiz) {
    erro(rel(arquivo), 'bloco "Estrutura" sem raiz de plugin reconhecível');
  }
}

// --- marketplace ----------------------------------------------------------
const mpCaminho = join(raiz, '.claude-plugin', 'marketplace.json');
const mp = lerJson(mpCaminho);
if (!mp) { imprimir(); process.exit(1); }

const nomesPlugins = (mp.plugins ?? []).map((p) => p.name).filter(Boolean);
for (const [arquivo, regex, rotulo] of [
  [join(raiz, 'README.md'), /\*\*([a-z0-9-]+)\*\*\s*\(/gi, 'README.md'],
  [join(raiz, 'AGENTS.md'), /`([a-z0-9-]+)`\s*\(/gi, 'AGENTS.md'],
]) {
  if (existsSync(arquivo)) {
    const texto = readFileSync(arquivo, 'utf8');
    compararInventarioDoDoc(arquivo, texto, regex, rotulo, nomesPlugins);
  }
}

if (!mp.name) erro(rel(mpCaminho), 'marketplace sem name');
if (!mp.metadata?.version) erro(rel(mpCaminho), 'sem metadata.version');
else if (!SEMVER.test(mp.metadata.version)) erro(rel(mpCaminho), `metadata.version "${mp.metadata.version}" não é semver X.Y.Z`);
if (!Array.isArray(mp.plugins) || mp.plugins.length === 0) erro(rel(mpCaminho), 'lista plugins[] vazia ou ausente');

const entradas = (mp.plugins ?? []).filter((p) => !soPlugin || p.name === soPlugin);
if (soPlugin && entradas.length === 0) erro(rel(mpCaminho), `plugin "${soPlugin}" não está no marketplace.json`);

// --- cada plugin -----------------------------------------------------------
for (const entrada of entradas) {
  const ctx = `${rel(mpCaminho)} [${entrada.name ?? '?'}]`;
  if (!entrada.name) { erro(ctx, 'entrada sem name'); continue; }
  if (typeof entrada.source !== 'string' || !entrada.source.startsWith('./')) {
    erro(ctx, `source deve ser string relativa "./..." (atual: ${JSON.stringify(entrada.source)})`);
    continue;
  }
  if (entrada.source.split('/').includes('..')) {
    erro(ctx, `source não pode escapar da raiz do marketplace com ".." (atual: ${entrada.source})`);
    continue;
  }
  if (!entrada.description) aviso(ctx, 'entrada sem description');
  if (!entrada.category) aviso(ctx, 'entrada sem category');
  if (!Array.isArray(entrada.tags) || entrada.tags.length === 0) aviso(ctx, 'entrada sem tags');
  if (!entrada.version) erro(ctx, 'entrada sem version');
  else if (!SEMVER.test(entrada.version)) erro(ctx, `version "${entrada.version}" não é semver`);

  const dirPlugin = resolve(raiz, entrada.source);
  if (!existsSync(dirPlugin)) { erro(ctx, `source aponta para diretório inexistente: ${entrada.source}`); continue; }

  const nomeDir = dirPlugin.split(/[\\/]/).pop();
  if (nomeDir !== entrada.name) aviso(ctx, `nome da entrada "${entrada.name}" difere do diretório "${nomeDir}"`);

  const pjCaminho = join(dirPlugin, '.claude-plugin', 'plugin.json');
  const pj = lerJson(pjCaminho);
  if (pj) {
    if (pj.name !== entrada.name) erro(rel(pjCaminho), `name "${pj.name}" difere da entrada do marketplace "${entrada.name}"`);
    if (!pj.version) erro(rel(pjCaminho), 'sem version');
    else if (!SEMVER.test(pj.version)) erro(rel(pjCaminho), `version "${pj.version}" não é semver`);
    else if (entrada.version && pj.version !== entrada.version) {
      erro(rel(pjCaminho), `version ${pj.version} dessincronizada do marketplace.json (${entrada.version})`);
    }
    if (!pj.description) erro(rel(pjCaminho), 'sem description');
    for (const campo of ['author', 'license']) {
      if (!pj[campo]) aviso(rel(pjCaminho), `sem ${campo}`);
    }
    if (!Array.isArray(pj.keywords) || pj.keywords.length === 0) aviso(rel(pjCaminho), 'sem keywords');
    if (!pj.homepage && !pj.repository) aviso(rel(pjCaminho), 'sem homepage nem repository');
  }

  const inventarioEsperado = {
    skills: existsSync(join(dirPlugin, 'skills'))
      ? readdirSync(join(dirPlugin, 'skills')).filter((nome) => statSync(join(dirPlugin, 'skills', nome)).isDirectory())
      : [],
    commands: existsSync(join(dirPlugin, 'commands'))
      ? readdirSync(join(dirPlugin, 'commands'))
          .filter((nome) => nome.endsWith('.md') && nome !== 'README.md')
          .map((nome) => nome.replace(/\.md$/i, ''))
      : [],
    agents: existsSync(join(dirPlugin, 'agents'))
      ? readdirSync(join(dirPlugin, 'agents'))
          .filter((nome) => nome.endsWith('.md') && nome !== 'README.md')
          .map((nome) => nome.replace(/\.md$/i, ''))
      : [],
  };

  const readmeCaminho = join(dirPlugin, 'README.md');
  if (existsSync(readmeCaminho)) {
    const textoReadme = readFileSync(readmeCaminho, 'utf8');
    compararInventarioDoReadmePlugin(readmeCaminho, textoReadme, inventarioEsperado);
    compararEstruturaDoReadmePlugin(readmeCaminho, textoReadme, dirPlugin);
  }

  // skills/
  const dirSkills = join(dirPlugin, 'skills');
  if (existsSync(dirSkills)) {
    for (const nome of readdirSync(dirSkills)) {
      const dirSkill = join(dirSkills, nome);
      if (!statSync(dirSkill).isDirectory()) { aviso(rel(dirSkill), 'arquivo solto em skills/ — skills são diretórios com SKILL.md'); continue; }
      const skillMd = join(dirSkill, 'SKILL.md');
      if (!existsSync(skillMd)) { erro(rel(dirSkill), 'diretório de skill sem SKILL.md'); continue; }
      const fm = frontmatter(skillMd);
      if (!fm.ok) erro(rel(skillMd), fm.motivo);
      else if (fm.description.length > 1024) erro(rel(skillMd), `description com ${fm.description.length} chars (máx 1024)`);
      else if (fm.description.length < 60) aviso(rel(skillMd), `description curta (${fm.description.length} chars) — provavelmente sem gatilhos suficientes`);
    }
  }

  // commands/ e agents/
  for (const sub of ['commands', 'agents']) {
    const dirSub = join(dirPlugin, sub);
    if (!existsSync(dirSub)) continue;
    for (const nome of readdirSync(dirSub).filter((n) => n.endsWith('.md'))) {
      const fm = frontmatter(join(dirSub, nome));
      if (!fm.ok) erro(rel(join(dirSub, nome)), fm.motivo);
    }
  }

  // portabilidade de paths em todos os arquivos de texto relevantes do plugin
  for (const arquivo of arquivosTextoRecursivos(dirPlugin)) {
    const texto = readFileSync(arquivo, 'utf8');
    if (WIN_PATH.test(texto)) erro(rel(arquivo), 'contém path absoluto de Windows (C:\\ ...)');
    if (UNIX_HOME.test(texto)) aviso(rel(arquivo), 'contém path absoluto de home Unix (/Users/ ou /home/) — confirme se é exemplo intencional');
  }

  // Paths de domínio (estrutura de workspace assumida) sem cláusula completa de resolução.
  // A conformidade é por arquivo: uma referência irmã não mascara o arquivo operacional.
  if (existsSync(dirSkills)) {
    for (const nomeSkill of readdirSync(dirSkills)) {
      const dirSkill = join(dirSkills, nomeSkill);
      if (!statSync(dirSkill).isDirectory()) continue;
      // Todo arquivo de texto da skill entra: prompt hardcoded num .py/.sh do harness
      // quebra igual ao de um .md, e o scan de portabilidade acima já usa o mesmo escopo.
      for (const arquivo of arquivosTextoRecursivos(dirSkill)) {
        const texto = readFileSync(arquivo, 'utf8');
        const achados = pathsDeDominio(texto);
        if (achados.length > 0 && !temClausulaResolucaoCompleta(texto)) {
          erro(rel(arquivo), `assume estrutura de workspace (ex.: \`${achados[0]}\`) sem cláusula de resolução completa — declare CLAUDE.md do workspace → defaults local_* → convenção descoberta no cwd → default documentado e marque paths literais como ilustrativos`);
        }
      }
    }
  }
  // README do plugin: é a vitrine lida antes de qualquer skill rodar, então path de domínio
  // aqui ensina a estrutura errada a quem acabou de instalar.
  if (existsSync(readmeCaminho)) {
    const texto = readFileSync(readmeCaminho, 'utf8');
    const achados = pathsDeDominio(texto);
    if (achados.length > 0 && !temClausulaResolucaoCompleta(texto)) {
      erro(rel(readmeCaminho), `assume estrutura de workspace (ex.: \`${achados[0]}\`) sem cláusula de resolução completa — declare CLAUDE.md do workspace → defaults local_* → convenção descoberta no cwd → default documentado e marque paths literais como ilustrativos`);
    }
  }
  for (const sub of ['commands', 'agents']) {
    const dirSub = join(dirPlugin, sub);
    if (!existsSync(dirSub)) continue;
    for (const nome of readdirSync(dirSub).filter((n) => n.endsWith('.md'))) {
      const texto = readFileSync(join(dirSub, nome), 'utf8');
      const achados = pathsDeDominio(texto);
      if (achados.length > 0 && !temClausulaResolucaoCompleta(texto)) {
        erro(rel(join(dirSub, nome)), `assume estrutura de workspace (ex.: \`${achados[0]}\`) sem cláusula de resolução completa — declare CLAUDE.md do workspace → defaults local_* → convenção descoberta no cwd → default documentado e marque paths literais como ilustrativos`);
      }
    }
  }
}

// --- plugins em disco fora do marketplace -----------------------------------
if (!soPlugin) {
  const dirPlugins = join(raiz, 'plugins');
  if (existsSync(dirPlugins)) {
    const listados = new Set((mp.plugins ?? []).map((p) => p.name));
    for (const nome of readdirSync(dirPlugins)) {
      if (statSync(join(dirPlugins, nome)).isDirectory() && !listados.has(nome)) {
        aviso(`plugins/${nome}`, 'existe em disco mas não está no marketplace.json');
      }
    }
  }
}

// --- saída -------------------------------------------------------------------
function imprimir() {
  for (const e of erros) console.log(e);
  for (const a of avisos) console.log(a);
  console.log(`\n${erros.length} erro(s), ${avisos.length} aviso(s) — marketplace: ${raiz}`);
}
imprimir();
process.exit(erros.length ? 1 : 0);

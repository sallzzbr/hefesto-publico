#!/usr/bin/env node
// Preparação local do espelho: inventário do commit e varredura que reprova em erro.
// Não publica, não acessa serviços e não executa arquivos do snapshot.
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

function caminhoSeguro(p) {
  return typeof p === 'string' && p.length > 0 && !p.startsWith('/') &&
    !p.includes('\\') && !p.includes('\0') && !p.split('/').some(c => c === '..' || c === '.' || c === '');
}
function politica(texto, origem = null) {
  const p = JSON.parse(texto);
  if (!Array.isArray(p.arquivos) || !p.arquivos.length || !p.arquivos.every(caminhoSeguro) || new Set(p.arquivos).size !== p.arquivos.length) {
    throw new Error('inventário vazio, duplicado ou com caminho inválido');
  }
  p.gerados ??= [];
  if (!Array.isArray(p.gerados) || !p.gerados.every(caminhoSeguro) || new Set(p.gerados).size !== p.gerados.length || p.gerados.some(c => p.arquivos.includes(c))) throw new Error('inventário de arquivos gerados inválido');
  p.esperados = [...p.arquivos, ...p.gerados];
  if (!Array.isArray(p.internos) || !p.internos.every(i => caminhoSeguro(i.endsWith('/') ? i.slice(0, -1) : i))) throw new Error('caminho interno inválido');
  if (!Array.isArray(p.proibidos) || !p.proibidos.length || p.proibidos.some(r => typeof r !== 'string' || !r.length)) throw new Error('guard sem padrões');
  if (!p.excecoes || typeof p.excecoes !== 'object' || Array.isArray(p.excecoes)) throw new Error('exceções inválidas');
  // Prefixo `(?c)`: regra sensível à caixa (sigla em maiúsculas); as demais ignoram a caixa.
  // Prefixo `(?o)`: regra Unicode, sem distinção de caixa, aplicada só ao texto ORIGINAL (nunca às formas normalizadas):
  // distingue a palavra com til da forma com cedilha, que a retirada de acentos colapsa.
  const regex = r => { const re = r.startsWith('(?c)') ? new RegExp(r.slice(4)) : r.startsWith('(?o)') ? new RegExp(r.slice(4), 'iu') : new RegExp(r, 'i'); return f => re.test(f); };
  const original = r => r.startsWith('(?o)');
  p.regras = p.proibidos.map(r => ({ testar: regex(r), retencoes: [], soOriginal: original(r) }));
  for (const [r, retencoes] of Object.entries(p.excecoes)) {
    if (!r || !Array.isArray(retencoes) || retencoes.some(e => !e || !p.esperados.includes(e.caminho) ||
      typeof e.linha !== 'string' || !e.linha || e.linha.includes('\n') || typeof e.justificativa !== 'string' || !e.justificativa.trim())) {
      throw new Error('retenção exige caminho autorizado, linha exata e justificativa');
    }
    // Chave "@nome" retém linhas de um validador (ex.: "@cpf"); as demais chaves são regex.
    if (!r.startsWith('@')) p.regras.push({ testar: regex(r), retencoes, soOriginal: original(r) });
  }
  // Detectores com validação (dígito verificador, contexto, isenções ancoradas): vêm depois das regex.
  p.validadores ??= [];
  if (!Array.isArray(p.validadores) || p.validadores.some(n => !Object.hasOwn(DETECTORES, n))) throw new Error('validador desconhecido');
  for (const n of p.validadores) p.regras.push({ testar: DETECTORES[n], retencoes: p.excecoes[`@${n}`] ?? [] });
  // Nomes de plugin excluído e das suas skills e scripts: derivados de `internos` (e da árvore do commit),
  // nunca de uma lista manual. Vêm por último para não deslocar o número das regras acima.
  for (const re of regexDosNomesInternos(nomesInternos(p, origem))) p.regras.push({ testar: regex(re), retencoes: [] });
  return p;
}
const escaparRe = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Plugin excluído = diretório `plugins/<nome>/` (ou `codex/plugins/<nome>/`) listado em `internos`. O nome do
// plugin entra sempre; nomes de skill e de script (do commit, quando a origem é informada) entram com duas
// ou mais palavras, porque um nome de uma palavra só ("requirements") casaria com texto comum.
function nomesInternos(p, origem) {
  const plugins = new Set();
  for (const i of p.internos) { const m = /^(?:codex\/)?plugins\/([^/]+)\/$/.exec(i); if (m) plugins.add(m[1]); }
  const nomes = new Set(plugins);
  if (origem) {
    for (const nome of plugins) for (const base of [`plugins/${nome}`, `codex/plugins/${nome}`]) {
      let lista = '';
      try { lista = git(origem.repo, 'ls-tree', '-r', '--name-only', origem.ref, `${base}/`).toString('utf8'); } catch { /* base ausente neste commit */ }
      for (const arq of lista.split('\n').filter(Boolean)) {
        const rel = arq.slice(base.length + 1).split('/');
        const candidato = rel[0] === 'skills' && rel.length > 2 ? rel[1] : rel[0] === 'scripts' && rel.length === 2 ? rel[1].replace(/\.[^.]+$/, '') : null;
        if (candidato && palavrasDoNome(candidato).length >= 2) nomes.add(candidato);
      }
    }
  }
  return [...nomes];
}
const palavrasDoNome = n => n.split(/[-_\s.]+/).filter(Boolean);
// Separador tolerante (hífen, sublinhado, espaço, ponto, hífen Unicode e quebra de linha, até 3): cobre
// kebab, snake, camelCase (sem separador, a regra é sem caixa) e o nome partido em duas linhas.
function regexDosNomesInternos(nomes) {
  return nomes.map(n => {
    const palavras = palavrasDoNome(n).map(escaparRe);
    return palavras.length === 1 ? `\\b${palavras[0]}\\b` : palavras.join('[\\W_]{0,3}');
  });
}
function git(repo, ...args) {
  return execFileSync('git', ['-C', repo, ...args], { maxBuffer: 32 * 1024 * 1024 });
}
function exportar(repo, ref, stage) {
  if (!/^[a-f0-9]{40}$/.test(ref)) throw new Error('snapshot exige SHA completo');
  if (existsSync(stage)) throw new Error('destino do stage já existe');
  const p = politica(git(repo, 'show', `${ref}:scripts/espelho-publico.json`).toString('utf8'), { repo, ref });
  const entradas = git(repo, 'ls-tree', '-rz', ref).toString('utf8').split('\0').filter(Boolean).map(l => {
    const [meta, caminho] = l.split('\t');
    const [modo, tipo, sha] = meta.split(' ');
    return { modo, tipo, sha, caminho };
  });
  const porPath = new Map(entradas.map(e => [e.caminho, e]));
  for (const caminho of p.arquivos) {
    const e = porPath.get(caminho);
    if (!e) throw new Error(`inventário aponta para arquivo ausente: ${caminho}`);
    if (e.tipo !== 'blob' || !['100644', '100755'].includes(e.modo)) throw new Error(`arquivo não regular: ${caminho}`);
    if (p.internos.some(i => i.endsWith('/') ? caminho.startsWith(i) : caminho === i)) throw new Error(`caminho simultaneamente público e interno: ${caminho}`);
  }
  for (const { caminho } of entradas) {
    if (!p.arquivos.includes(caminho) && !p.internos.some(i => i.endsWith('/') ? caminho.startsWith(i) : caminho === i)) {
      throw new Error(`arquivo não classificado para publicação: ${caminho}`);
    }
  }
  // Ler todos os blobs antes de criar o destino: objeto ausente não deixa exportação parcial.
  const arquivos = p.arquivos.map(c => ({ ...porPath.get(c), conteudo: git(repo, 'cat-file', 'blob', porPath.get(c).sha) }));
  mkdirSync(stage, { recursive: true });
  for (const a of arquivos) {
    const destino = join(stage, a.caminho);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, a.conteudo, { flag: 'wx', mode: a.modo === '100755' ? 0o755 : 0o644 });
  }
  console.log(`${arquivos.length} arquivos exportados do commit ${ref.slice(0, 7)}.`);
}
// Exceções valem para uma linha exata em um arquivo, nunca para nomes ou notas.
// Os diagnósticos informam só regra e contagem: nunca nome, caminho nem trecho. Única exceção:
// execução local explícita (ESPELHO_DIAGNOSTICO_LOCAL=1, ignorada quando CI está definido),
// que acrescenta arquivo, linha e trecho no stderr do terminal de quem rodou.
const LIMIAR_BASE64 = 8;       // caracteres (6 bytes): cobre um prenome ou nome próprio curto
const PROFUNDIDADE_BASE64 = 3; // base64 dentro de base64 dentro de base64
const CHAVES = '[A-Za-z0-9+/_-]';

// ---------------- normalização e decodificações (formas examinadas de um texto) ----------------
const norm = t => t.normalize('NFKC').replace(/\p{Cf}/gu, '').normalize('NFD').replace(/\p{M}/gu, '');
// Cirílico e grego que se confundem com letras latinas; o texto é rebaixado a minúsculas antes.
const HOMOGLIFOS = Object.fromEntries([
  ...'а:a е:e о:o р:p с:c у:y х:x і:i ј:j ѕ:s һ:h к:k м:m н:h т:t в:b ԁ:d ԛ:q ԝ:w ѵ:v ӏ:l ɡ:g ı:i'.split(' ').map(x => x.split(':')),
  ...'α:a β:b γ:y ε:e η:n ι:i κ:k μ:u ν:v ο:o ρ:p τ:t υ:u χ:x ω:w'.split(' ').map(x => x.split(':')),
]);
const homoglifos = t => [...t.toLowerCase()].map(c => HOMOGLIFOS[c] ?? c).join('');
// Dígito no lugar de letra (leetspeak); "1" é ambíguo (i ou l), então saem duas formas.
// Token hexadecimal com dígito (cor `#c4e5`, hash de commit) não é leetspeak: vira preenchimento neutro antes da troca.
const HEX_COM_DIGITO = /#(?=[0-9a-f]*\d)[0-9a-f]{3,8}(?![0-9a-z])|(?<![0-9a-z])(?=[0-9a-f]*\d)[0-9a-f]{7,64}(?![0-9a-z])/gi;
const leet = t => { const base = t.replace(HEX_COM_DIGITO, m => 'z'.repeat(m.length)); return ['i', 'l'].map(um => base.replace(/[013457]/g, d => ({ 0: 'o', 1: um, 3: 'e', 4: 'a', 5: 's', 7: 't' })[d])); };
const desofuscar = t => t
  .replace(/\s*[[({]\s*(?:at|arroba)\s*[\])}]\s*/gi, '@')
  .replace(/\s*[[({]\s*(?:dot|ponto)\s*[\])}]\s*/gi, '.');
// E-mail partido por quebra de linha logo depois do @ ou do ponto do domínio. Quebra ANTES do @ não
// é juntada: decorador (`@pytest.mark.x` no começo da linha) viraria e-mail falso. Limite conhecido.
const juntarQuebras = t => t
  .replace(/@[ \t]*\r?\n[ \t]*/g, '@')
  .replace(/(@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.)[ \t]*\r?\n[ \t]*(?=[a-z])/gi, '$1');
const percentual = t => t.replace(/(?:%[0-9a-f]{2})+/gi, m => { try { return decodeURIComponent(m); } catch { return m; } });
const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hyphen: '-', dash: '-', minus: '-', period: '.', commat: '@', lowbar: '_', sol: '/', colon: ':' };
const entidades = t => t.replace(/&(?:#(\d{1,7})|#x([0-9a-f]{1,6})|([a-z]{2,8}));/gi, (m, d, h, n) => {
  if (n) return ENTIDADES[n.toLowerCase()] ?? m;
  try { return String.fromCodePoint(d ? Number(d) : parseInt(h, 16)); } catch { return m; }
});
const escapes = t => t.replace(/\\u\{([0-9a-f]{1,6})\}|\\u([0-9a-f]{4})|\\x([0-9a-f]{2})/gi, (m, a, b, c) => {
  try { return String.fromCodePoint(parseInt(a ?? b ?? c, 16)); } catch { return m; }
});
// Tokens base64 (e base64url): contíguos, quebrados em linhas de qualquer largura (quebra real ou \n
// escapado em JSON) e colados a prefixo (4 alinhamentos). Decodifica recursivamente.
function decodificados(t, prof = PROFUNDIDADE_BASE64) {
  if (prof <= 0) return [];
  const tokens = new Set();
  for (const [tok] of t.matchAll(new RegExp(`${CHAVES}{${LIMIAR_BASE64},}={0,2}`, 'g'))) tokens.add(tok);
  // Âncora de início de token evita retrocesso quadrático em blob longo.
  const quebrado = new RegExp(`(?<!${CHAVES})(?:${CHAVES}{4,}={0,2}(?:\\\\[nrt]|[ \\t]*\\r?\\n[ \\t]*))+${CHAVES}+={0,2}`, 'g');
  for (const [m] of t.matchAll(quebrado)) tokens.add(m.replace(/\\[nrt]|\s+/g, ''));
  const saida = [];
  for (const tok of tokens) for (let desloc = 0; desloc < 4; desloc++) {
    const sub = tok.slice(desloc);
    if (sub.replace(/=+$/, '').length < LIMIAR_BASE64) continue;
    const dec = Buffer.from(sub.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    saida.push(dec, ...decodificados(dec, prof - 1));
  }
  for (const [hex] of t.matchAll(/(?<![0-9a-f])(?:[0-9a-f]{2}){6,}(?![0-9a-f])/gi)) saida.push(Buffer.from(hex, 'hex').toString('utf8'));
  return saida;
}
// camelCase vira palavras separadas (`itemNome` => `item Nome`): a regra de uma palavra inteira enxerga o termo
// dentro de identificador. Aplicado antes de rebaixar a caixa, que apaga a fronteira.
const separarCamel = t => t.replace(/(\p{Ll}|\d)(\p{Lu}\p{Ll})/gu, '$1 $2');
const canonicas = t => {
  const h = homoglifos(norm(t)), d = desofuscar(h);
  const c = homoglifos(norm(separarCamel(t)));
  return [t, norm(t), h, d, juntarQuebras(d), c];
};
function formas(texto) {
  const conj = new Set(canonicas(texto));
  for (const f of [percentual, entidades, escapes]) { const r = f(texto); if (r !== texto) for (const c of canonicas(r)) conj.add(c); }
  const dec = decodificados(texto).join('\0\0\0\0\0');
  if (dec) for (const c of canonicas(dec)) conj.add(c);
  for (const origem of dec ? [texto, dec] : [texto]) for (const l of leet(homoglifos(norm(origem)))) conj.add(l);
  return [...conj];
}

// ---------------- detectores com validação (precisam de código, não só de regex) ----------------
const SEP = '[\\s.\\-\\u2010-\\u2015\\u2212]';
const SEPT = '[ \\t.\\-\\u2010-\\u2015\\u2212]';
const digitos = s => s.replace(/\D/g, '');
const antes = (f, i, janela = 40) => f.slice(Math.max(0, i - janela), i);
function dvCpf(d) {
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  return [9, 10].every(n => (d.slice(0, n).split('').reduce((s, c, i) => s + Number(c) * (n + 1 - i), 0) * 10) % 11 % 10 === Number(d[n]));
}
function dvCnpj(d) {
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const dv = pesos => { const r = d.slice(0, pesos.length).split('').reduce((s, c, i) => s + Number(c) * pesos[i], 0) % 11; return r < 2 ? 0 : 11 - r; };
  return dv([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[12]) && dv([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[13]);
}
// Sequência de dígitos sem contexto (ID, timestamp) não reprova: exige dígito verificador válido
// ou a palavra CPF/CNPJ logo antes. Os separadores aceitam ponto, hífen, en/em-dash, espaço e quebra de linha.
const CPF = new RegExp(`(?<!\\d)\\d{3}${SEP}{0,2}\\d{3}${SEP}{0,2}\\d{3}${SEP}{0,2}\\d{2}(?!\\d)`, 'g');
const CNPJ = new RegExp(`(?<!\\d)\\d{2}${SEP}{0,2}\\d{3}${SEP}{0,2}\\d{3}${SEP}{0,2}/?${SEP}{0,2}\\d{4}${SEP}{0,2}\\d{2}(?!\\d)`, 'g');
const casar = (f, re, ok) => { for (const m of f.matchAll(re)) if (ok(m[0], m.index)) return true; return false; };
const CTX_DOC = /(?:cpf|cnpj|documento)\W{0,12}$/i;
const CTX_FONE = /(?:tel(?:efone)?|fone|fixo|cel(?:ular)?|whats\s?app|zap|contato|ligar|ligue|chamar|phone|mobile)\W{0,25}$/i;
const FONE_FORTE = [
  new RegExp(`(?<!\\d)\\(\\s*\\d{2}\\s*\\)${SEPT}*9?\\d{4}${SEPT}?\\d{4}(?!\\d)`, 'g'),
  new RegExp(`(?<!\\d)\\+\\s*55${SEPT}*\\(?\\s*\\d{2}\\s*\\)?${SEPT}*9?\\d{4}${SEPT}*\\d{4}(?!\\d)`, 'g'),
  /(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=|tel:)\+?[\d ()-]{10,}/gi,
  new RegExp(`(?<![\\d-])[1-9][1-9]${SEPT}9\\d{4}${SEPT}\\d{4}(?!\\d)`, 'g'),
  /(?<!\d)55[1-9][1-9]9\d{8}(?!\d)/g,
];
// Fixo DDD + 4 + hífen + 4 sem contexto: o hífen no meio do bloco final já é formato de telefone, salvo
// quando os dois blocos formam intervalo (anos "2024-2025", faixas redondas "3000-4000"), que exige contexto.
const FONE_FIXO_HIFEN = new RegExp(`(?<![\\d-])[1-9][1-9]${SEPT}[2-5]\\d{3}-\\d{4}(?!\\d)`, 'g');
const intervalo = s => { const [a, b] = s.match(/\d{4}-\d{4}$/)[0].split('-'); return (/^(?:19|20)/.test(a) && /^(?:19|20)/.test(b)) || (/00$/.test(a) && /00$/.test(b)); };
const FONE_CONTEXTO = [
  /(?<!\d)[1-9][1-9]9\d{8}(?!\d)/g,
  new RegExp(`(?<!\\d)(?:\\+?55${SEPT}*)?\\(?[1-9][1-9]\\)?${SEPT}*[2-5]\\d{3}${SEPT}*\\d{4}(?!\\d)`, 'g'),
  new RegExp(`(?<!\\d)\\(?[1-9][1-9]\\)?${SEPT}*9\\d{4}${SEPT}*\\d{4}(?!\\d)`, 'g'),
];
const HOSTS_GIT = new Set(['github.com', 'gitlab.com', 'bitbucket.org', 'ssh.dev.azure.com']);
// Usuários de serviço (não pessoa): só com eles a forma de destino remoto isenta o e-mail.
const USUARIOS_SERVICO = new Set(['deploy', 'user', 'usuario', 'root', 'admin', 'ubuntu', 'ec2-user', 'ftp', 'backup', 'www-data', 'ci', 'runner']);
const EMAIL = /(?<![\w.+-])([\w.+-]+)@([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})(?![\w-])/gi;
function emailIsento(f, m) {
  const [, local, dominio] = m, d = dominio.toLowerCase(), depois = f.slice(m.index + m[0].length), linha = f.slice(f.lastIndexOf('\n', m.index) + 1, m.index);
  // Isenções ancoradas no fim do domínio: example.com.br é isento, example.empresareal.com.br não.
  if (/(?:^|\.)example\.(?:com|org|net|edu)(?:\.[a-z]{2})?$/.test(d) || /\.(?:invalid|test|example|localhost)$/.test(d)) return true;
  if (d === 'users.noreply.github.com' || d === 'anthropic.com') return true;
  // Destino remoto de ssh/scp/rsync/git exige a FORMA, não a palavra na linha: git@ só com host de git
  // conhecido; os demais usuários genéricos de serviço, colados a ":caminho" ou logo após o comando.
  const l = local.toLowerCase();
  if (l === 'git') return HOSTS_GIT.has(d);
  if (!USUARIOS_SERVICO.has(l)) return false;
  return /^:[\w~/.-]/.test(depois) || /\b(?:ssh|scp|sftp|rsync|mosh)\s+(?:-\S+\s+(?:[^-\s]\S*\s+)?)*$/i.test(linha);
}
const DETECTORES = {
  // Só dígitos (11 seguidos) é indistinguível de ID sequencial mesmo com dígito verificador válido: exige a palavra CPF.
  cpf: f => casar(f, CPF, (s, i) => CTX_DOC.test(antes(f, i, 25)) || (!/^\d+$/.test(s) && dvCpf(digitos(s)))),
  cnpj: f => casar(f, CNPJ, (s, i) => dvCnpj(digitos(s)) || CTX_DOC.test(antes(f, i, 25))),
  telefone: f => FONE_FORTE.some(re => casar(f, re, () => true)) || casar(f, FONE_FIXO_HIFEN, s => !intervalo(s)) ||
    FONE_CONTEXTO.some(re => casar(f, re, (s, i) => CTX_FONE.test(antes(f, i, 40)))),
  email: f => { for (const m of f.matchAll(EMAIL)) if (!emailIsento(f, m)) return true; return false; },
};

// ---------------- avaliação das regras ----------------
function regrasVioladas(texto, p, caminho) {
  const achadas = [];
  let comuns; // formas do texto inteiro, calculadas uma vez e só se alguma regra precisar delas
  for (const [i, regra] of p.regras.entries()) {
    const retem = caminho && regra.retencoes.some(e => e.caminho === caminho);
    const fs = retem
      ? formas(texto.split(/\r?\n/).map(linha => regra.retencoes.some(e => e.caminho === caminho && e.linha === linha) ? '' : linha).join('\n'))
      : (comuns ??= formas(texto));
    if (regra.soOriginal ? regra.testar(fs[0]) : fs.some(f => regra.testar(f))) achadas.push(i + 1);
  }
  return achadas;
}
function decodificar(bytes) {
  const utf16 = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : null;
  let texto;
  try { texto = new TextDecoder(utf16 ?? 'utf-8', { fatal: true }).decode(bytes); } catch { throw new Error('arquivo com bytes inválidos na codificação'); }
  if (texto.includes('\0')) throw new Error('arquivo com byte NUL');
  return texto;
}
const resumo = mapa => [...mapa].sort((a, b) => a[0] - b[0]).map(([r, n]) => `regra ${r}: ${n} arquivo${n > 1 ? 's' : ''}`).join('; ');
function examinar(texto, p, caminho, tipo) {
  const regras = regrasVioladas(texto, p, caminho);
  if (regras.length) throw new Error(`${tipo} proibido (${regras.length > 1 ? 'regras' : 'regra'} ${regras.join(', ')})`);
}
// Só com ESPELHO_DIAGNOSTICO_LOCAL=1 e sem CI: localiza a linha de cada regra violada. Nunca no log de CI.
const diagnosticoLocal = () => process.env.ESPELHO_DIAGNOSTICO_LOCAL === '1' && !process.env.CI;
function localizar(texto, p, rel, regras) {
  const linhas = texto.split(/\r?\n/);
  for (const r of regras) {
    const regra = p.regras[r - 1];
    const achou = linhas.map((l, i) => [i + 1, l]).filter(([, l]) => regra.soOriginal ? regra.testar(l) : formas(l).some(f => regra.testar(f)));
    for (const [n, l] of achou.slice(0, 5)) console.error(`LOCAL regra ${r}: ${rel}:${n}: ${l.trim().slice(0, 120)}`);
    if (!achou.length) console.error(`LOCAL regra ${r}: ${rel}: sem linha única (padrão atravessa linhas ou vem de forma decodificada)`);
  }
}
function verificarNotas(arquivo, config, origem = null) {
  const p = politica(readFileSync(config, 'utf8'), origem);
  examinar(decodificar(readFileSync(arquivo)), p, null, 'notas da release: conteúdo');
  console.log('Guard: notas finais da release examinadas.');
}
function verificar(stage, config, origem = null) {
  const p = politica(readFileSync(config, 'utf8'), origem);
  const st = lstatSync(stage);
  if (st.isSymbolicLink() || !st.isDirectory()) throw new Error('stage deve ser diretório regular');
  const encontrados = [];
  const achados = { nome: new Map(), conteudo: new Map() };
  const local = diagnosticoLocal();
  function varrer(dir, prefixo = '') {
    for (const nome of readdirSync(dir)) {
      const rel = prefixo + nome;
      const path = join(dir, nome);
      const s = lstatSync(path);
      if (s.isSymbolicLink()) throw new Error('arquivo não regular no stage');
      if (s.isDirectory()) { varrer(path, `${rel}/`); continue; }
      if (!s.isFile()) throw new Error('arquivo não regular no stage');
      if (!p.esperados.includes(rel)) throw new Error('arquivo fora do inventário no stage');
      encontrados.push(rel);
      const rn = regrasVioladas(rel, p, null);
      for (const r of rn) achados.nome.set(r, (achados.nome.get(r) ?? 0) + 1);
      if (local && rn.length) console.error(`LOCAL nome proibido (${rn.join(', ')}): ${rel}`);
      const texto = decodificar(readFileSync(path));
      const rc = regrasVioladas(texto, p, rel);
      for (const r of rc) achados.conteudo.set(r, (achados.conteudo.get(r) ?? 0) + 1);
      if (local && rc.length) localizar(texto, p, rel, rc);
    }
  }
  varrer(stage);
  const msgs = Object.entries(achados).filter(([, m]) => m.size).map(([tipo, m]) => `${tipo === 'nome' ? 'nome' : 'conteúdo'} proibido (${resumo(m)})`);
  if (msgs.length) throw new Error(msgs.join(' | '));
  const faltantes = p.esperados.filter(c => !encontrados.includes(c));
  if (faltantes.length) throw new Error(`inventário incompleto: ${faltantes.length} arquivo(s) ausente(s)`);
  console.log(`Guard: ${encontrados.length} arquivos examinados, nenhum conteúdo proibido detectado.`);
}
// Origem opcional (repo e SHA completo): dela saem os nomes de skill e de script dos plugins excluídos.
function origemDe(args) {
  if (args.length !== 4) return null;
  if (!/^[a-f0-9]{40}$/.test(args[3])) throw new Error('origem exige SHA completo');
  return { repo: args[2], ref: args[3] };
}
try {
  const [modo, ...args] = process.argv.slice(2);
  if (modo === 'exportar' && args.length === 3) exportar(...args);
  else if (modo === 'verificar-notas' && (args.length === 2 || args.length === 4)) verificarNotas(args[0], args[1], origemDe(args));
  else if (modo === 'verificar' && (args.length === 2 || args.length === 4)) verificar(args[0], args[1], origemDe(args));
  else throw new Error('uso: espelho.mjs exportar <repo> <SHA> <stage> | verificar <stage> <política.json> [<repo> <SHA>] | verificar-notas <notas> <política.json> [<repo> <SHA>]');
} catch (e) {
  console.error(`ERRO: ${e.message}`);
  process.exitCode = 1;
}

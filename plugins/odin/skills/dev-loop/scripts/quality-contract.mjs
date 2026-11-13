import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, posix, relative, resolve } from 'node:path';

export const qualityRules = JSON.parse(readFileSync(new URL('./quality-rules.json', import.meta.url), 'utf8'));

function requireFields(value, fields, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      fields.some(field => !Object.hasOwn(value, field)) || Object.keys(value).some(field => !fields.includes(field))) {
    throw new Error(`${label}: campos obrigatórios ausentes ou campos desconhecidos`);
  }
}

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim() || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) {
    throw new Error(`${label}: exige texto não vazio`);
  }
}

function requireArray(value, label, allowEmpty = false) {
  if (!Array.isArray(value) || (!allowEmpty && !value.length)) throw new Error(`${label}: exige array${allowEmpty ? '' : ' não vazio'}`);
}

// Valida cada ancestral existente: realpath apenas do alvo não protege paths futuros
// cujo diretório pai já é um symlink externo. Ausência é permitida; erro de acesso não é.
export function validateQualityPath(path, { root = process.cwd(), requireFile = false } = {}) {
  if (typeof path !== 'string' || !path.trim() || path !== path.trim() || isAbsolute(path) ||
      /[:\\\x00-\x1f\x7f*?{}]/.test(path) || posix.normalize(path) !== path ||
      path.split('/').some(part => !part || part === '.' || part === '..' || part.toLowerCase() === '.git')) {
    throw new Error(`path de qualidade inválido: ${JSON.stringify(path)}`);
  }
  const physicalRoot = realpathSync(root);
  let current = physicalRoot;
  const parts = path.split('/');
  for (const [index, part] of parts.entries()) {
    current = resolve(current, part);
    let stat;
    try { stat = lstatSync(current); }
    catch (error) { if (error.code === 'ENOENT') return path; throw error; }
    const physical = realpathSync(current);
    const location = relative(physicalRoot, physical);
    if (location === '..' || location.startsWith('../') || location.startsWith('..\\') || isAbsolute(location) ||
        location.split(/[\\/]/).some(component => component.toLowerCase() === '.git')) {
      throw new Error(`path fora do workspace ou metadados Git: ${path}`);
    }
    if (index < parts.length - 1 && !stat.isDirectory() && !stat.isSymbolicLink()) {
      throw new Error(`ancestral não é diretório: ${path}`);
    }
    if (requireFile && index === parts.length - 1 && !lstatSync(physical).isFile()) {
      throw new Error(`path exige arquivo, não diretório ou outro tipo: ${path}`);
    }
  }
  return path;
}

export function validateQualityContract(quality, options = {}) {
  requireFields(quality, ['version', 'profiles', 'conventions', 'checks', 'decomposition'], 'quality');
  if (quality.version !== qualityRules.version) throw new Error('quality.version: versão desconhecida');
  requireArray(quality.profiles, 'quality.profiles');
  if (new Set(quality.profiles).size !== quality.profiles.length || !quality.profiles.includes('base') ||
      quality.profiles.some(profile => typeof profile !== 'string' || !Object.hasOwn(qualityRules.profiles, profile))) {
    throw new Error('quality.profiles: perfis conhecidos, únicos e base são obrigatórios');
  }
  requireArray(quality.conventions, 'quality.conventions');
  for (const convention of quality.conventions) {
    requireFields(convention, ['source', 'decision'], 'convention');
    requireText(convention.source, 'convention.source');
    requireText(convention.decision, 'convention.decision');
  }
  requireArray(quality.checks, 'quality.checks');
  const expected = new Set(quality.profiles.flatMap(profile => qualityRules.profiles[profile]));
  const found = new Set();
  for (const check of quality.checks) {
    requireFields(check, ['id', 'applicability', 'reason', 'paths', 'verification', 'command'], 'check');
    if (!expected.has(check.id) || found.has(check.id)) throw new Error(`check.id desconhecido ou repetido: ${check.id}`);
    found.add(check.id);
    if (!['required', 'not-applicable'].includes(check.applicability) ||
        (check.applicability === 'not-applicable' && qualityRules.nonWaivable.includes(check.id))) {
      throw new Error(`${check.id}: applicability inválida ou dispensa proibida`);
    }
    requireText(check.reason, `${check.id}.reason`);
    requireArray(check.paths, `${check.id}.paths`);
    if (new Set(check.paths).size !== check.paths.length) throw new Error(`${check.id}.paths: paths repetidos`);
    for (const path of check.paths) validateQualityPath(path, { ...options, requireFile: true });
    if (!['review', 'command'].includes(check.verification)) throw new Error(`${check.id}.verification inválida`);
    if (typeof check.command !== 'string' || /[\x00-\x1f\x7f\u2028\u2029]/.test(check.command) ||
        (check.verification === 'command' ? !check.command.trim() : check.command !== '')) {
      throw new Error(`${check.id}.command: use comando de uma linha para command ou string vazia para review`);
    }
  }
  if (found.size !== expected.size) throw new Error(`quality.checks: regras ausentes: ${[...expected].filter(id => !found.has(id)).join(', ')}`);
  requireArray(quality.decomposition, 'quality.decomposition', true);
  const decomposed = new Set();
  for (const decision of quality.decomposition) {
    requireFields(decision, ['path', 'trigger', 'decision', 'verification'], 'decomposition');
    validateQualityPath(decision.path, { ...options, requireFile: true });
    if (decomposed.has(decision.path)) throw new Error(`decomposition.path repetido: ${decision.path}`);
    decomposed.add(decision.path);
    for (const field of ['trigger', 'decision', 'verification']) requireText(decision[field], `decomposition.${field}`);
  }
  return quality;
}

export function parseQualityContract(text, options = {}) {
  if (typeof text !== 'string') throw new Error('SPEC exige texto');
  let active = false, sections = 0, fence = null;
  const blocks = [];
  for (const line of text.split(/\r?\n/)) {
    if (fence) {
      const closing = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line);
      if (closing && closing[1][0] === fence.marker[0] && closing[1].length >= fence.marker.length) {
        if (fence.quality) blocks.push(fence);
        fence = null;
      } else if (fence.quality) fence.lines.push(line);
      continue;
    }
    const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (opening) {
      fence = { marker: opening[1], language: opening[2].trim(), quality: active, lines: [] };
      continue;
    }
    const heading = /^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!heading) continue;
    const title = heading[2].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (heading[1] === '##' && title === 'contrato de qualidade') { active = true; sections++; }
    else if (heading[1].length <= 2) active = false;
  }
  if (sections !== 1 || blocks.length !== 1 || blocks[0].language !== 'json' || fence?.quality) {
    throw new Error('SPEC exige seção única Contrato de qualidade com um bloco JSON inequívoco e fechado');
  }
  let quality;
  try { quality = JSON.parse(blocks[0].lines.join('\n')); }
  catch (error) { throw new Error(`Contrato de qualidade: JSON inválido: ${error.message}`); }
  return validateQualityContract(quality, options);
}

import { spawnSync } from 'node:child_process';

// contexto lê o acervo. A busca indexada de algumas versões pode regravar SQLite.
export function memoria(cwd, termo, branch, run = spawnSync) {
  const args = ['contexto', '--json', '--cwd', cwd, '--orcamento', '6000'];
  if (branch) args.push('--branch', branch);
  const p = run('munin', args, { cwd, encoding: 'utf8', timeout: 4000, maxBuffer: 131072,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1', GIT_OPTIONAL_LOCKS: '0' }, stdio: ['ignore', 'pipe', 'ignore'] });
  let result;
  try { result = JSON.parse(p.stdout); } catch { /* CLI ausente, interrompida ou saída incompatível */ }
  if (p.status !== 0 || !result?.ok || !result.secoes) return { situacao: 'sem contexto disponível', registros: [] };
  const normalizar = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const palavras = normalizar(termo).trim().split(/\s+/);
  const registros = [];
  for (const secao of ['Nesta branch', 'No projeto', 'Neste escopo avulso']) {
    for (const item of Array.isArray(result.secoes[secao]) ? result.secoes[secao] : []) {
      if (typeof item.texto !== 'string' || !item.id || !palavras.every(s => normalizar(item.texto).includes(s))) continue;
      registros.push({ id: item.id, data: item.data, texto: item.texto, secao });
    }
  }
  return { situacao: registros.length ? 'contexto encontrado' : 'sem correspondência no contexto recuperado', registros: registros.slice(0, 3) };
}

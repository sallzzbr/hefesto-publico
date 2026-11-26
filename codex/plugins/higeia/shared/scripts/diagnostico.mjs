import { realpathSync, statSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { candidatosAmbiente, candidatosResiduos, medirEspaco } from './espaco.mjs';
import { investigarUv } from './ambientes-uv.mjs';
import { consultarHooksCodex } from './hooks-codex.mjs';
import { memoria } from './memoria.mjs';
import { desenvolvimento } from './desenvolvimento.mjs';
import { computador } from './computador.mjs';
import { ambiente } from './ambiente.mjs';
import { residuos } from './residuos.mjs';

try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { execucao: { type: 'string' }, 'pacote-codex': { type: 'string' }, 'hooks-codex': { type: 'boolean' }, executavel: { type: 'string' }, desenvolvimento: { type: 'boolean' }, root: { type: 'string', multiple: true }, base: { type: 'string' }, memoria: { type: 'string' }, branch: { type: 'string' } } });
  const [modo] = positionals;
  const geral = modo === 'computador';
  const aceitaRaizes = modo === 'espaco' || modo === 'uv';
  if (positionals.length !== 1 || !['ambiente', 'residuos', 'espaco', 'desenvolvimento', 'uv', 'computador'].includes(modo)
    || (values['hooks-codex'] && modo !== 'ambiente')
    || (values.execucao !== undefined && (modo !== 'residuos' || !values.execucao.trim()))
    || (values['pacote-codex'] !== undefined && (!values.execucao || !values['pacote-codex'].trim()))
    || (modo !== 'residuos' && values.base) || (!aceitaRaizes && values.root?.length > 1)
    || (['espaco', 'desenvolvimento', 'uv', 'computador'].includes(modo) && values.memoria)
    || (modo !== 'espaco' && values.desenvolvimento) || ((modo === 'desenvolvimento' || geral) && values.root)
    || (values.branch && !values.memoria) || (values.memoria !== undefined && !values.memoria.trim())
    || (values.executavel !== undefined && (modo !== 'uv' || !values.executavel))) {
    throw Error('Uso: node diagnostico.mjs ambiente|residuos|espaco|desenvolvimento|uv|computador [--root DIR] [--hooks-codex (ambiente)] [--executavel NOME (uv)] [--desenvolvimento (espaco)] [--base REF (residuos)] [--execucao CAMINHO [--pacote-codex DIR] (residuos)] [--memoria TERMO [--branch NOME]]');
  }
  if (geral && process.platform !== 'darwin') throw Error('O diagnóstico geral do computador requer macOS.');
  const inventario = geral ? computador() : null;
  const raizes = inventario ? [inventario.raiz] : [...new Set((values.root || [process.cwd()]).map(dir => realpathSync(dir)))];
  for (const raiz of raizes) if (!statSync(raiz).isDirectory()) throw Error('A raiz deve ser um diretório.');
  const root = raizes[0];
  const candidatos = inventario?.candidatos ?? [];
  const limitesInventario = inventario?.limites ?? [];
  let resultado = { raizes };
  if (inventario) {
    const { idadeRelatorioDias, arquivoGrandeBytes } = inventario;
    resultado.computador = { idadeRelatorioDias, arquivoGrandeBytes };
  }
  for (const raiz of raizes) {
    if (modo === 'ambiente' || modo === 'espaco') {
      const dados = ambiente(raiz);
      candidatos.push(...candidatosAmbiente(dados));
      limitesInventario.push(...dados.limites);
      if (modo === 'ambiente') resultado = dados;
    }
    if (modo === 'residuos' || modo === 'espaco') {
      const dados = residuos(raiz, values.base, { execucao: values.execucao, pacoteCodex: values['pacote-codex'] });
      candidatos.push(...candidatosResiduos(dados));
      limitesInventario.push(...dados.limites, ...dados.repositorios.filter(r => r.erro));
      if (modo === 'residuos') resultado = dados;
    }
  }
  if (modo === 'desenvolvimento' || values.desenvolvimento) {
    const { candidatos: dev, limites, ...inventario } = desenvolvimento();
    candidatos.push(...dev);
    limitesInventario.push(...limites);
    resultado.desenvolvimento = inventario;
  }
  if (modo === 'uv') {
    if (process.platform !== 'darwin') throw Error('A investigação dos ambientes uv requer macOS.');
    const { candidatos: ambientes, limites, ...inventario } = investigarUv({ raizes, executavel: values.executavel });
    candidatos.push(...ambientes);
    limitesInventario.push(...limites);
    resultado.uv = inventario;
  }
  resultado.espaco = medirEspaco(raizes, candidatos);
  if (limitesInventario.length) {
    resultado.espaco.parcial = true;
    resultado.espaco.limitesInventario = limitesInventario;
  }
  if (values['hooks-codex']) resultado.hooksCodex = await consultarHooksCodex(root);
  if (values.memoria) resultado.memoria = memoria(root, values.memoria, values.branch);
  console.log(JSON.stringify(resultado, null, 2));
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}

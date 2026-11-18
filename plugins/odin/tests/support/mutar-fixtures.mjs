// Apoio dos testes da fase Mutar (odin 3.1.0): o contrato do JSON de `mutantes.mjs medir` e um
// agente falso que o devolve ao harness, sem rodar mutante nenhum.
//
// Contrato fixado AQUI (a SPEC diz "CRC-32 da serialização canônica do resto" sem escolher a forma):
//   - serialização canônica = JSON com as chaves de todo objeto em ordem alfabética, sem espaços;
//   - `conferencia` = CRC-32 (o de `scripts/crc32.mjs`, igual à cópia do harness: unidade UTF-16 abaixo
//     de 256 vale um byte, as demais dois) dessa serialização do objeto SEM o campo `conferencia`, em 8 dígitos hexadecimais minúsculos;
//   - `mutantes[].resultado`: 'morto' ou 'sobrevivente';
//   - o mecânico devolve ao harness o JSON do script nos campos de topo da resposta.
// O teste do script real (`mutantes.test.mjs`) confere a mesma definição contra a saída do script, então
// o harness e o script não podem divergir sem um dos dois reprovar.
import { hashDeApoio, legacyDefaults, pathsDoComandoDeHashes, completarHashesDeApoio } from './quality-fixtures.mjs';
import { readFileSync } from 'node:fs';
import { crc32 } from '../../skills/dev-loop/scripts/crc32.mjs';

const ordenado = v => Array.isArray(v) ? v.map(ordenado)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, ordenado(v[k])])) : v;
export const canonico = obj => JSON.stringify(ordenado(obj));
export const conferenciaDe = ({ conferencia: _ignorada, ...resto }) => crc32(canonico(resto));

export const TESTE = 'tests/a.test.js';
export const HASH_TESTE = `${'a'.repeat(64)}-e411bb3e`;
export const SHA_BASE = `abc1234${'f'.repeat(33)}`;
export const ARGS = { workspaceRoot: '/workspace', scriptsDir: '/plugin/scripts', specPath: 'docs/plans/spec.md', branch: 'feat/x', perfil: 'balanceado', validacoes: ['npm test'], hoje: '2026-11-15' };

// Mutante no formato do script. `resultado` default: morto.
export const mutante = (n, resultado = 'morto', extras = {}) => ({
  id: `src/a.js:${n + 2}:comparacao:0`, path: 'src/a.js', linha: n + 2, trecho: `if (a${n} >= b) {`, operador: 'comparacao', de: '>=', para: '<', resultado, ...extras,
});

// Evidência completa e coerente; `comandos` são os que o pedido mandou rodar (todos com exit 0 no controle).
export function evidenciaDeMutacao({ base = 'HEAD', comandos = [], mutantes = [mutante(1), mutante(2)], candidatos, amostrados, linhasAcrescentadas = { 'src/a.js': 6 }, controleOk = true, execucoes, removida = true, worktreeIntacta = true } = {}) {
  const evidencia = {
    base,
    candidatos: candidatos ?? mutantes.length,
    amostrados: amostrados ?? mutantes.length,
    linhasAcrescentadas,
    controle: { ok: controleOk, execucoes: execucoes ?? comandos.map(comando => ({ comando, exitCode: controleOk ? 0 : 1 })) },
    // `mortoPor` do script: o primeiro comando que derrubou o mutante (null se sobreviveu).
    mutantes: mutantes.map(m => (Object.hasOwn(m, 'mortoPor') ? m : { ...m, mortoPor: m.resultado === 'morto' ? (comandos[0] ?? null) : null })),
    removida,
    worktreeIntacta,
  };
  return { ...evidencia, conferencia: conferenciaDe(evidencia) };
}

// O comando do pedido da fase Mutar: `node '<scripts>/mutantes.mjs' medir <base> '<excluidos>' '<comandos>'`.
export function argumentosDoComandoMutar(prompt) {
  const texto = String(prompt ?? '');
  const i = texto.indexOf('mutantes.mjs');
  if (i < 0) return null;
  const trecho = texto.slice(i, i + 6000);
  const base = /medir\s+'?([0-9a-fA-F]{40,64}|HEAD)'?/.exec(trecho)?.[1] ?? null;
  const arrays = [...trecho.matchAll(/'(\[[^'\n]*\])'/g)].map(m => JSON.parse(m[1]));
  const prioridade = /--prioridade\s+'(\[[^'\n]*\])'/.exec(trecho)?.[1];
  return { base, excluidos: arrays[0] ?? [], comandos: arrays[1] ?? [], prioridade: prioridade ? JSON.parse(prioridade) : [] };
}

// Chamadas que medem mutação, na primeira tentativa ou na recoleta (o nome da recoleta é do harness).
export const ehMedicaoDeMutacao = label => /^mutar:medir:i\d+$/.test(label) || /^recoleta:[^:]*mutac[^:]*:i\d+$/i.test(label);
export const medicoes = (chamadas, iteracao) => chamadas.filter(c => ehMedicaoDeMutacao(c.label) && (iteracao == null || c.label.endsWith(`:i${iteracao}`)));

const inventarioDoPedido = prompt => {
  const achado = /inspecionar-git\.mjs' quality '(\[[^'\n]*\])'/.exec(String(prompt ?? ''));
  return achado ? { files: JSON.parse(achado[1]).map(path => ({ path, lines: 12, bytes: 240, status: 'text' })), uninspected: [], errors: [] } : null;
};

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

// Roda o harness de verdade com agentes falsos por label.
//   mutar(ctx)           -> evidência (ou null) de cada tentativa de `mutar:medir`/recoleta;
//                           ctx = { iteracao, tentativa, base, excluidos, comandos, evidencia(parcial) }
//   confirmarMutante(ctx)-> { real, porque } do sobrevivente (ctx.prompt, ctx.iteracao)
//   hashDoReforco(iter)  -> letra do hash que a validação da iteração devolve para paths de reforço
export async function rodarMutar({ args = ARGS, overrides = {}, mutar, confirmarMutante, confirmarFinding, letraDoReforco = () => 'e' } = {}) {
  const defaults = legacyDefaults();
  const chamadas = [];
  const apoio = new Set();
  const tentativas = new Map();
  const tabela = {
    ...defaults,
    'validar:': (o, c, prompt) => {
      const r = defaults['validar:'](o, c, prompt);
      const inv = inventarioDoPedido(prompt);
      if (inv) r.qualityInventory = inv;
      const pedidos = pathsDoComandoDeHashes(prompt);
      const iteracao = Number(/:i(\d+)$/.exec(o.label)[1]);
      if (pedidos) r.hashesDosTestes = Object.fromEntries(pedidos.map(p => [p, p === TESTE ? HASH_TESTE : hashDeApoio(p, /reforco/.test(p) ? letraDoReforco(iteracao) : 'e')]));
      return r;
    },
    'confirmar:': (o, c, prompt) => {
      if (o.label.startsWith('confirmar:mutante:')) return (confirmarMutante ?? (() => ({ real: false, porque: 'não reproduz' })))({ prompt, iteracao: Number(/:i(\d+)$/.exec(o.label)[1]), label: o.label });
      return (confirmarFinding ?? defaults['confirmar:'])(o, c, prompt);
    },
    ...overrides,
  };
  const agent = async (prompt, opts) => {
    chamadas.push({ label: opts.label, opts, prompt });
    if (ehMedicaoDeMutacao(opts.label) && !Object.hasOwn(overrides, opts.label)) {
      const iteracao = Number(/:i(\d+)$/.exec(opts.label)[1]);
      const tentativa = (tentativas.get(iteracao) ?? 0) + 1;
      tentativas.set(iteracao, tentativa);
      const a = argumentosDoComandoMutar(prompt) ?? { base: null, excluidos: [], comandos: [] };
      const ctx = { iteracao, tentativa, ...a, prompt, evidencia: parcial => evidenciaDeMutacao({ base: a.base ?? 'HEAD', comandos: a.comandos, ...parcial }) };
      return (mutar ?? (c => c.evidencia({})))(ctx);
    }
    const chave = Object.keys(tabela).find(k => opts.label === k || (k.endsWith(':') && opts.label.startsWith(k)));
    let resposta;
    if (chave) resposta = tabela[chave](opts, chamadas, prompt);
    else {
      const pedidos = pathsDoComandoDeHashes(prompt);
      if (!pedidos) throw new Error(`label sem resposta no teste: ${opts.label}`);
      resposta = { hashesDosTestes: Object.fromEntries(pedidos.map(p => [p, p === TESTE ? HASH_TESTE : hashDeApoio(p, 'e')])) };
    }
    if (opts.label === 'tdd:portao') for (const p of resposta?.apoio || []) apoio.add(p);
    if (resposta && typeof resposta === 'object' && resposta.hashesDosTestes) completarHashesDeApoio(prompt, resposta, apoio);
    return resposta;
  };
  const corpo = (() => {
    const linhas = readFileSync(new URL('../../skills/dev-loop/harness/loop.mjs', import.meta.url), 'utf8').split('\n');
    return linhas.slice(linhas.findIndex(l => l === '}') + 1).join('\n');
  })();
  const parallel = async thunks => Promise.all(thunks.map(t => Promise.resolve().then(t).catch(() => null)));
  const resultado = await new AsyncFunction('args', 'agent', 'parallel', 'phase', 'log', corpo)(args, agent, parallel, () => {}, () => {});
  return { resultado, chamadas };
}

// Valores numéricos de um objeto aninhado (para conferir `numeros` sem depender do nome das chaves).
export const numerosDe = v => v && typeof v === 'object' ? Object.values(v).flatMap(numerosDe) : typeof v === 'number' ? [v] : [];
// Contagem de um campo que pode ser número ou lista.
export const qtd = v => Array.isArray(v) ? v.length : v;

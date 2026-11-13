// Consistência entre o que o harness e os scripts do dev-loop ACEITAM e o que as docs CITAM, nas
// duas distribuições (2.6.0).
//
// O porte da 2.6.0 juntou código e docs escritos em paralelo. Doc que cita arg, motivo ou modo de
// script que o código não tem manda a sessão montar uma invocação que o harness ignora ou recusa;
// arg aceito pelo código e ausente da doc é capacidade que ninguém passa. As duas listas aqui são
// LIDAS do código (cabeçalho de args e `ARGS.*` do loop.mjs, constantes de campos, literais de
// motivo e natureza, a string de uso dos scripts, a guarda do bridge), não copiadas para o teste:
// lista copiada apodrece junto com a doc e não pega nada.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ODIN = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ = resolve(ODIN, '..', '..');
const CODEX = resolve(RAIZ, 'codex', 'plugins', 'odin');
const ler = (rel) => readFileSync(resolve(ODIN, rel), 'utf8');
const lerCodex = (rel) => readFileSync(resolve(CODEX, rel), 'utf8');
const LOOP = ler('skills/dev-loop/harness/loop.mjs');
const BRIDGE = readFileSync(resolve(RAIZ, 'codex', 'runtime', 'bridge.mjs'), 'utf8');
const SKILL = ler('skills/dev-loop/SKILL.md');
const EXECUCAO = lerCodex('skills/dev-loop/references/execucao.md');

// Trecho entre dois marcadores; marcador ausente falha alto em vez de devolver o arquivo inteiro.
function recorte(texto, inicio, fim) {
  const i = texto.indexOf(inicio);
  assert.ok(i >= 0, `marcador ausente: ${inicio}`);
  const j = fim ? texto.indexOf(fim, i + inicio.length) : texto.length;
  assert.ok(j >= 0, `marcador ausente: ${fim}`);
  return texto.slice(i, j);
}
const unicos = (xs) => [...new Set(xs)].sort();
const diferenca = (a, b) => unicos(a).filter((x) => !b.includes(x));

// ── o que o código aceita ────────────────────────────────────────────────────
// Cabeçalho de args: linhas `//   <nome>?:` entre o marcador e o fecho `// }`.
function argsDoCabecalho() {
  const bloco = recorte(LOOP, '// ── args esperados', '\n// }\n');
  return unicos([...bloco.matchAll(/^\/\/ {3}([A-Za-z]+)\??:/gm)].map((m) => m[1]));
}
const argsLidosPeloCodigo = () => unicos([...LOOP.matchAll(/\bARGS\.([A-Za-z]+)/g)].map((m) => m[1]));
const constante = (nome) => {
  const m = LOOP.match(new RegExp(`const ${nome} = \\[([^\\]]*)\\]`));
  assert.ok(m, `constante ausente no loop.mjs: ${nome}`);
  return unicos([...m[1].matchAll(/'([A-Za-z]+)'/g)].map((x) => x[1]));
};
// Args do harness que o bridge Codex recusa (tiering Claude), lidos da própria guarda.
function argsRecusadosPeloBridge() {
  const linha = BRIDGE.split('\n').find((l) => l.includes('tiering Claude não é configuração Codex'));
  assert.ok(linha, 'guarda de tiering ausente no bridge');
  return unicos([...linha.matchAll(/args\.([A-Za-z]+)/g)].map((m) => m[1]));
}
const motivosComHifen = () => unicos([...LOOP.matchAll(/motivo: '([a-z]+(?:-[a-z]+)+)'/g)].map((m) => m[1]));
const motivosSemHifen = () => unicos([...LOOP.matchAll(/motivo: '([a-z]+)'/g)].map((m) => m[1]));
// Natureza de bloqueante: todo literal atribuído a `natureza` (inclusive em ternário).
function naturezasDoCodigo() {
  const out = [];
  for (const l of LOOP.split('\n')) {
    const m = l.match(/\bnatureza(?:\s*:|\s*=(?!=))(?!\s*\{)(.*)$/);
    if (m) for (const q of m[1].matchAll(/'([a-z]+(?:-[a-z]+)*)'/g)) out.push(q[1]);
  }
  return unicos(out);
}
// Modos de cada script lidos da string de uso (e do `--impressao` do hashes-testes).
function modosDosScripts() {
  const dir = resolve(ODIN, 'skills', 'dev-loop', 'scripts');
  const uso = (arq) => {
    const src = readFileSync(join(dir, arq), 'utf8');
    const m = src.match(new RegExp(`uso: ${arq.replace('.', '\\.')} ([^'\\n]+)'`));
    assert.ok(m, `string de uso ausente em ${arq}`);
    return m[1];
  };
  const alternativas = (u) => u.split(' | ').map((a) => a.split(' ')[0]);
  const flags = (u) => unicos([...u.matchAll(/(--[a-z]+)/g)].map((m) => m[1]));
  const hashes = readFileSync(join(dir, 'hashes-testes.mjs'), 'utf8');
  return {
    'inspecionar-git': { modos: alternativas(uso('inspecionar-git.mjs')), flags: flags(uso('inspecionar-git.mjs')) },
    'copia-base': { modos: alternativas(uso('copia-base.mjs')), flags: flags(uso('copia-base.mjs')) },
    'hashes-testes': { modos: unicos([...hashes.matchAll(/process\.argv\[2\] === '(--[a-z]+)'/g)].map((m) => m[1])), flags: [] },
  };
}

// ── o que as docs citam ──────────────────────────────────────────────────────
// Chaves do bloco `Workflow({ args: {...} })` da SKILL Claude (indentação de 4 espaços).
function argsDaSkillClaude() {
  const args = recorte(recorte(SKILL, 'Workflow({', '\n})'), '  args: {', null);
  return unicos([...args.matchAll(/^ {4}([A-Za-z]+):/gm)].map((m) => m[1]));
}
// Codex: chaves do JSON de args e os itens de "Campos opcionais".
function argsDoCodex() {
  const secao = recorte(EXECUCAO, '## Args e pré-condições', '\nCampo desconhecido');
  const json = JSON.parse(recorte(secao, '```json\n', '\n```').slice('```json\n'.length));
  const opcionais = recorte(secao, 'Campos opcionais', null);
  return { obrigatorios: unicos(Object.keys(json)), opcionais: unicos([...opcionais.matchAll(/^- `([A-Za-z]+)[:`]/gm)].map((m) => m[1])) };
}
// Chaves de um literal `{ a: [..], b, c?: '..' }` em prosa ou comentário: tira `//`, conteúdo
// entre colchetes e strings, e fica com o identificador antes de `:`, `,` ou `}`. O texto começa
// na chave de abertura: o nome do arg antes dela não é campo.
function chavesDoLiteral(texto) {
  const i = texto.indexOf('{');
  assert.ok(i >= 0, `literal sem chave de abertura: ${texto.slice(0, 60)}`);
  const limpo = texto.slice(i + 1).replace(/^\s*\/\/\s?/gm, ' ').replace(/\[[^\]]*\]/g, '').replace(/'[^']*'/g, '').replace(/<[^>]*>/g, '');
  return unicos([...`${limpo}}`.matchAll(/([A-Za-z]+)\??\s*(?=[:,}])/g)].map((m) => m[1]));
}
const chavesJson = (texto) => unicos([...texto.matchAll(/"([A-Za-z]+)":/g)].map((m) => m[1]));
const kebabEntreCrases = (texto) => unicos([...texto.matchAll(/`([a-z]+(?:-[a-z]+)+)`/g)].map((m) => m[1]));

function docsDoOdin() {
  const out = [];
  const andar = (base, dir) => {
    for (const nome of readdirSync(dir)) {
      const p = join(dir, nome);
      if (statSync(p).isDirectory()) { if (nome !== 'shared' && nome !== 'tests' && nome !== 'node_modules') andar(base, p); }
      else if (nome.endsWith('.md') && nome !== 'CHANGELOG.md') out.push([relative(RAIZ, p), readFileSync(p, 'utf8')]);
    }
  };
  andar(ODIN, ODIN);
  andar(CODEX, CODEX);
  return out;
}

// ── args ─────────────────────────────────────────────────────────────────────
test('consistência: todo arg lido pelo loop.mjs está no cabeçalho de args, e todo arg do cabeçalho é lido', () => {
  const cabecalho = argsDoCabecalho();
  const lidos = argsLidosPeloCodigo();
  assert.ok(cabecalho.length >= 7, `cabeçalho de args não encontrado (${cabecalho.length} args)`);
  assert.deepEqual(diferenca(lidos, cabecalho), [], 'arg lido pelo código e ausente do cabeçalho de args');
  assert.deepEqual(diferenca(cabecalho, lidos), [], 'arg no cabeçalho que o código não lê');
});

test('consistência: a invocação da SKILL Claude cita só args que existem e documenta todo arg aceito', () => {
  const aceitos = argsDoCabecalho();
  const citados = argsDaSkillClaude();
  assert.deepEqual(diferenca(citados, aceitos), [], 'dev-loop/SKILL.md cita arg que o harness não tem');
  // Arg LEGADO no cabeçalho pode ficar fora do bloco, mas a prosa precisa dizer que existe.
  const legados = aceitos.filter((a) => new RegExp(`//   ${a}\\??:[^\\n]*LEGADO`).test(LOOP));
  for (const a of diferenca(aceitos, citados)) {
    assert.ok(legados.includes(a), `arg aceito e não documentado na invocação: ${a}`);
    assert.match(SKILL, new RegExp(`\`${a}[:\` ]`), `arg legado sem menção na SKILL: ${a}`);
  }
});

test('consistência: os args.json do Codex citam só args que existem e documentam todo arg que o bridge deixa passar', () => {
  const aceitos = argsDoCabecalho();
  const recusados = argsRecusadosPeloBridge();
  const { obrigatorios, opcionais } = argsDoCodex();
  const citados = unicos([...obrigatorios, ...opcionais]);
  assert.deepEqual(diferenca(citados, aceitos), [], 'execucao.md cita arg que o harness não tem');
  assert.deepEqual(diferenca(diferenca(aceitos, recusados), citados), [], 'arg aceito pelo harness e pelo bridge sem documentação no execucao.md');
  assert.deepEqual(citados.filter((a) => recusados.includes(a)), [], 'execucao.md manda passar arg que o bridge recusa');
  // O bridge recusa tiering Claude: o passo 1 precisa dizer que esses campos não entram.
  const passo1 = recorte(EXECUCAO, '1. Valide os gates', '\n2. ');
  for (const a of recusados) assert.ok(passo1.includes(`\`${a}\``), `execucao.md não diz que ${a} fica fora do args.json`);
  // Obrigatórios do código (args faltando = erro Args) estão no bloco JSON.
  const obrigatoriosDoCodigo = LOOP.match(/const argsFaltando = \[([^\]]*)\]/)[1].match(/'([A-Za-z]+)'/g).map((x) => x.slice(1, -1));
  assert.deepEqual(diferenca(obrigatoriosDoCodigo, obrigatorios), [], 'arg obrigatório fora do bloco JSON do execucao.md');
});

test('consistência: os campos de autorizacoesTdd e rebaselineTdd citados nas docs são exatamente os aceitos', () => {
  const AUT = constante('CAMPOS_AUTORIZACAO');
  const REB = constante('CAMPOS_REBASELINE');
  const VA = constante('CAMPOS_VALIDACAO_ANTERIOR');
  // Cabeçalho do próprio loop.mjs.
  assert.deepEqual(chavesDoLiteral(recorte(LOOP, '//   autorizacoesTdd?: [{', '}]')), AUT, 'cabeçalho: autorizacoesTdd');
  const reb = recorte(LOOP, '//   rebaselineTdd?:', '\n//                     Retomada tardia');
  const va = recorte(reb, 'validacaoAnterior?: {', '}');
  assert.deepEqual(chavesDoLiteral(va), VA, 'cabeçalho: validacaoAnterior');
  assert.deepEqual(chavesDoLiteral(reb.replace(va + '}', ', validacaoAnterior }')), REB, 'cabeçalho: rebaselineTdd');
  // SKILL Claude.
  const excecao = recorte(SKILL, '**Exceção humana (`autorizacoesTdd`).**', '**Retomada tardia');
  assert.deepEqual(chavesDoLiteral(recorte(excecao, '`{ criterios', '}`')), AUT, 'dev-loop/SKILL.md: autorizacoesTdd');
  assert.deepEqual(chavesDoLiteral(recorte(SKILL, '`rebaselineTdd: { criteriosAprovados', '}`').replace('`rebaselineTdd: {', '{')), REB, 'dev-loop/SKILL.md: rebaselineTdd');
  // execucao.md Codex.
  assert.deepEqual(chavesJson(recorte(EXECUCAO, '- `autorizacoesTdd`', '\n')), AUT, 'execucao.md: autorizacoesTdd');
  assert.deepEqual(chavesJson(recorte(EXECUCAO, '- `rebaselineTdd`', '\n')), REB, 'execucao.md: rebaselineTdd');
});

// ── motivos e naturezas ──────────────────────────────────────────────────────
test('consistência: o desfecho bloqueado cita exatamente os motivos que o portão emite, nas duas distribuições', () => {
  const doCodigo = motivosComHifen();
  assert.ok(doCodigo.length >= 6, `motivos do portão não encontrados (${doCodigo.join(', ')})`);
  const claude = kebabEntreCrases(recorte(SKILL, '- **`status: "bloqueado"`**', '- **`status: "escalado"`**'));
  const codex = kebabEntreCrases(recorte(EXECUCAO, '- `bloqueado`', '- `escalado`'));
  for (const [nome, citados] of [['dev-loop/SKILL.md', claude], ['execucao.md', codex]]) {
    assert.deepEqual(diferenca(citados, doCodigo), [], `${nome} cita motivo que o harness não emite`);
    assert.deepEqual(diferenca(doCodigo, citados), [], `${nome} omite motivo que o harness emite`);
  }
  for (const m of motivosSemHifen()) {
    assert.match(SKILL, new RegExp(`motivo: "${m}"`), `dev-loop/SKILL.md sem motivo "${m}"`);
    assert.match(EXECUCAO, new RegExp(`motivo: "${m}"`), `execucao.md sem motivo "${m}"`);
  }
});

test('consistência: o escalado documenta toda natureza de bloqueante que o controlador atribui', () => {
  const doCodigo = naturezasDoCodigo();
  assert.ok(doCodigo.length >= 8, `naturezas não encontradas (${doCodigo.join(', ')})`);
  const escalado = recorte(SKILL, '- **`status: "escalado"`**', '- **`status: "erro"`**');
  for (const n of doCodigo) assert.ok(escalado.includes(`\`${n}\``), `escalado sem a natureza "${n}"`);
});

// ── comandos de script ───────────────────────────────────────────────────────
test('consistência: todo modo e flag de script citado nas docs do odin existe no script', () => {
  const modos = modosDosScripts();
  let vistos = 0;
  for (const [rel, texto] of docsDoOdin()) {
    for (const [, trecho] of texto.matchAll(/`([^`\n]+)`/g)) {
      for (const m of trecho.matchAll(/(inspecionar-git|hashes-testes|copia-base)\.mjs"?\s+(--?[a-z]+|[a-z]+)/g)) {
        vistos++;
        const [, script, modo] = m;
        assert.ok(modos[script].modos.includes(modo), `${rel}: "${script}.mjs ${modo}" não é modo do script (aceitos: ${modos[script].modos.join(', ')})`);
        const resto = trecho.slice(m.index + m[0].length);
        for (const [, flag] of resto.matchAll(/(?:^|\s)(--[a-z]+)/g)) {
          assert.ok(modos[script].flags.includes(flag), `${rel}: "${script}.mjs ${modo} ... ${flag}" não é flag do script`);
        }
      }
    }
  }
  assert.ok(vistos >= 10, `poucas citações de script encontradas (${vistos}): o extrator parou de casar`);
  // E toda capacidade nova da 2.6.0 está citada em alguma doc das duas distribuições.
  const todas = docsDoOdin();
  for (const dist of ['plugins/odin', 'codex/plugins/odin']) {
    const texto = todas.filter(([rel]) => rel.startsWith(dist)).map(([, t]) => t).join('\n');
    for (const cmd of ['inspecionar-git.mjs alteracoes', 'hashes-testes.mjs --impressao', 'copia-base.mjs', 'remover']) {
      assert.ok(texto.includes(cmd), `${dist}: nenhuma doc cita "${cmd}"`);
    }
  }
});

test('definir direto preserva autorização, tier, nome e descoberta não concluída nas duas distribuições', () => {
  for (const texto of [ler('skills/definir/SKILL.md'), readFileSync(join(CODEX, 'skills/definir/SKILL.md'), 'utf8')]) {
    assert.match(texto, /pulo explícito/);
    assert.match(texto, /expresso.*completo/);
    assert.match(texto, /uma pergunta por vez/);
    assert.match(texto, /slug\/título.*antes de criar/);
    assert.match(texto, /GATE 1.*não concluído/);
    assert.match(texto, /não inventar.*descobertas\.md/);
    assert.match(texto, /expresso.*protocolo.*descobrir/i);
    assert.match(texto, /reaproveitar.*respostas/);
  }
});

test('capa permite exceção em definir sem dispensar tier, slug ou aprovação de gates', () => {
  const texto = ler('skills/descobrir/references/capa-template.md');
  assert.doesNotMatch(texto, /só a skill `descobrir` cria capa nova/);
  assert.match(texto, /exceção.*`definir`/);
  assert.match(texto, /pulado por decisão do dono.*não concluído/);
  assert.match(texto, /expresso.*protocolo.*`descobrir`/);
});

test('/spec prepara branch local e preserva limites do planejamento nas duas distribuições', () => {
  for (const texto of [ler('commands/spec.md'), readFileSync(join(CODEX, 'skills/entregar/SKILL.md'), 'utf8')]) {
    assert.match(texto, /branchBase/);
    assert.match(texto, /branchTrabalho/);
    assert.match(texto, /antes de gravar/i);
    assert.match(texto, /OK/);
    assert.match(texto, /sem commit automático/);
    assert.doesNotMatch(texto, /NÃO criar branch|sem branch/);
  }
});

test('retomada de SPEC verifica associação e não presume branchBase já registrada', () => {
  const texto = ler('skills/entregar/references/steps-detalhados.md');
  assert.match(texto, /\[branch-spec\]/);
  assert.match(texto, /branchBase.*branchTrabalho/);
  assert.match(texto, /SPEC legada.*sem branchBase/);
  assert.match(texto, /não trocar de branch com alterações pendentes/);
  assert.match(texto, /mesma entrega.*sem recriar/);
  assert.match(texto, /sem stash, reset ou pull automáticos/);
  assert.match(texto, /registrar a associação somente após conferir a branch correta/);
  const nativa = readFileSync(join(CODEX, 'skills/entregar/SKILL.md'), 'utf8');
  assert.match(nativa, /3\. Leia[^\n]*execute primeiro[^\n]*antes de qualquer escrita/);
});

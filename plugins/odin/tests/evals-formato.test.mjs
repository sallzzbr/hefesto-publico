// Formato dos evals de roteamento do odin — o runner que existe enquanto `claude plugin eval`
// não sai do early access.
//
// Por que: 43 diretórios em evals/roteamento/ que nenhum comando lia (auditoria de 2026-09-01).
// Este teste não julga roteamento (isso é LLM); trava a ESTRUTURA: cada frase da matriz tem um
// caso, cada caso aponta para a frase certa, os graders têm as seções que o runner da
// plataforma exige, e os banners citados existem de fato nos SKILL.md. Sem isso a pasta
// apodrece em silêncio até o dia em que o comando liberar.

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const PLUGIN = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MATRIZ = readFileSync(resolve(PLUGIN, 'docs', 'roteamento-matrix.md'), 'utf8');
const EVALS = resolve(PLUGIN, 'evals', 'roteamento');

// Linha numerada da tabela: `| N | frase | skill esperada | ... |`. A frase costuma vir entre
// aspas retas, mas duas linhas não — o parser lê a célula, não as aspas.
const frases = MATRIZ.split('\n')
  .map((l) => /^\| *(\d+) *\|([^|]*)\|/.exec(l))
  .filter(Boolean)
  .map((m) => ({ n: Number(m[1]), frase: m[2].trim().replace(/^"|"$/g, '') }));
const casos = readdirSync(EVALS, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
const numeroDoCaso = (nome) => Number(/^(\d+)-/.exec(nome)?.[1]);

test('a matriz tem frases numeradas de 1..N sem buraco nem repetição', () => {
  assert.ok(frases.length >= 40, `matriz com ${frases.length} frases`);
  assert.deepEqual(frases.map((f) => f.n), frases.map((_, i) => i + 1));
});

test('cada frase da matriz tem exatamente um caso, e nenhum caso é órfão', () => {
  const numeros = casos.map(numeroDoCaso);
  assert.ok(numeros.every(Number.isInteger), `caso sem número: ${casos.filter((c) => !Number.isInteger(numeroDoCaso(c))).join(', ')}`);
  assert.deepEqual([...numeros].sort((a, b) => a - b), frases.map((f) => f.n));
});

test('todo caso tem prompt.md não vazio e graders/criteria.md com Esperado, Score e a frase certa', () => {
  for (const caso of casos) {
    const n = numeroDoCaso(caso);
    const prompt = readFileSync(resolve(EVALS, caso, 'prompt.md'), 'utf8').trim();
    assert.ok(prompt.length > 10, `${caso}/prompt.md vazio`);
    const criteria = readFileSync(resolve(EVALS, caso, 'graders', 'criteria.md'), 'utf8');
    assert.match(criteria, /^## Esperado/m, `${caso}: sem ## Esperado`);
    assert.match(criteria, /^## Score/m, `${caso}: sem ## Score`);
    assert.match(criteria, new RegExp(`frase ${n}\\b`), `${caso}: criteria não cita "frase ${n}"`);
  }
});

test('os banners que os graders esperam existem literalmente nos SKILL.md', () => {
  const skills = readdirSync(resolve(PLUGIN, 'skills'));
  const corpoSkills = skills.map((s) => readFileSync(resolve(PLUGIN, 'skills', s, 'SKILL.md'), 'utf8')).join('\n');
  const bannersEsperados = new Set();
  for (const caso of casos) {
    const criteria = readFileSync(resolve(EVALS, caso, 'graders', 'criteria.md'), 'utf8');
    for (const m of criteria.matchAll(/Skill `([a-z-]+)` ATIVADA/g)) bannersEsperados.add(m[1]);
  }
  assert.ok(bannersEsperados.size >= 5, `poucos banners citados: ${[...bannersEsperados].join(', ')}`);
  for (const skill of bannersEsperados) {
    assert.ok(existsSync(resolve(PLUGIN, 'skills', skill)), `banner cita skill inexistente: ${skill}`);
    assert.ok(corpoSkills.includes(`Skill \`${skill}\` ATIVADA`), `SKILL.md de ${skill} não imprime o banner que o grader espera`);
  }
});

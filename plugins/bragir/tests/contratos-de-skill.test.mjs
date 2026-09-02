// Contratos das skills do bragir — o plugin não tinha diretório tests/ (auditoria de 2026-09-01).
//
// O que trava: o contrato de personas (CRÍTICO no AGENTS.md — personas são do projeto, nunca
// do plugin), a dependência do perfil de voz via ${CLAUDE_PLUGIN_ROOT}, frontmatter com
// gatilhos, versões em sincronia e ausência de dado pessoal. O validar.mjs já cobre frontmatter
// e paths; aqui entra o que é específico do bragir e que ninguém mais olha.

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const PLUGIN = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ = resolve(PLUGIN, '..', '..');
const SKILLS = readdirSync(resolve(PLUGIN, 'skills')).filter((s) => statSync(resolve(PLUGIN, 'skills', s)).isDirectory());
const skill = (nome) => readFileSync(resolve(PLUGIN, 'skills', nome, 'SKILL.md'), 'utf8');
const descricao = (texto) => /^---\r?\n[\s\S]*?description:\s*"?([^\n]*?)"?\r?\n[\s\S]*?^---/m.exec(texto)?.[1] ?? '';

function arquivosDoPlugin(dir = PLUGIN) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'tests') out.push(...arquivosDoPlugin(p)); }
    else out.push(p);
  }
  return out;
}

test('as cinco skills existem e cada description tem gatilho de uso e tamanho de roteamento', () => {
  assert.deepEqual(SKILLS.sort(), ['analisar-metricas', 'analisar-voz', 'escrever-como-antonio', 'gerenciar-personas', 'planejar-agenda']);
  for (const s of SKILLS) {
    const d = descricao(skill(s));
    assert.ok(d.length >= 80, `${s}: description curta demais para rotear (${d.length})`);
    assert.match(d, /Use (when|quando|sempre)/i, `${s}: description sem gatilho "Use when/quando"`);
  }
});

test('plugin.json e marketplace.json concordam na versão', () => {
  const pj = JSON.parse(readFileSync(resolve(PLUGIN, '.claude-plugin', 'plugin.json'), 'utf8'));
  const mp = JSON.parse(readFileSync(resolve(RAIZ, '.claude-plugin', 'marketplace.json'), 'utf8'));
  assert.equal(pj.name, 'bragir');
  assert.equal(mp.plugins.find((p) => p.name === 'bragir').version, pj.version);
});

test('o perfil de voz default vive no plugin e a skill de escrita o resolve via CLAUDE_PLUGIN_ROOT como último nível', () => {
  assert.ok(existsSync(resolve(PLUGIN, 'perfil-de-voz.md')), 'perfil-de-voz.md sumiu do plugin — escrever-como-antonio depende dele (AGENTS.md, regra 5)');
  const texto = skill('escrever-como-antonio');
  assert.ok(texto.includes('${CLAUDE_PLUGIN_ROOT}/perfil-de-voz.md'), 'escrever-como-antonio precisa apontar o fallback ${CLAUDE_PLUGIN_ROOT}/perfil-de-voz.md');
  assert.match(texto, /\.\/perfil-de-voz\.md/, 'o perfil do projeto (./perfil-de-voz.md) vem antes do default do plugin');
});

test('personas são do projeto: gerenciar-personas escreve em ./personas/ e proíbe o plugin como destino', () => {
  const texto = skill('gerenciar-personas');
  assert.match(texto, /\.\/personas\//, 'destino ./personas/ ausente');
  assert.match(texto, /Nunca escreva personas dentro do plugin/i, 'a proibição explícita de escrever em ${CLAUDE_PLUGIN_ROOT} sumiu');
  assert.ok(!existsSync(resolve(PLUGIN, 'personas')) && !existsSync(resolve(PLUGIN, 'personas.md')), 'há personas dentro do plugin — contrato CRÍTICO violado');
});

test('escrever-como-antonio descobre personas do projeto e oferece gerenciar-personas quando não há', () => {
  const texto = skill('escrever-como-antonio');
  assert.match(texto, /\.\/personas\//);
  assert.match(texto, /gerenciar-personas/);
});

test('nenhum arquivo do plugin carrega path pessoal, e-mail ou dado de projeto', () => {
  const proibidos = [/\/Users\//, /@gmail\.com/, /evio\.salgado/i];
  for (const arquivo of arquivosDoPlugin()) {
    const texto = readFileSync(arquivo, 'utf8');
    for (const re of proibidos) assert.doesNotMatch(texto, re, `${arquivo} casa ${re}`);
  }
});

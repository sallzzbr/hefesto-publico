import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const skill = (name) => read(`../plugins/odin/skills/${name}/SKILL.md`);
const description = (name) => JSON.parse(skill(name).match(/^description: (.*)$/m)[1]);

// Guardas documentais: não simulam o matcher do host nem provam execução por um modelo.
test('Odin expõe oito entrypoints nativos com descrições delimitadas e recursos locais', () => {
  for (const name of ['acompanhar', 'definir', 'descobrir', 'desenvolver', 'dev-loop', 'entregar', 'desafio', 'defaults']) {
    assert.match(skill(name), new RegExp(`^name: ${name}$`, 'm'));
    assert.ok(description(name).length <= 1024, name);
    assert.match(skill(name), /\[RUNTIME.md\]\(\.\.\/\.\.\/RUNTIME.md\)/);
    assert.doesNotMatch(skill(name), /\$\{CLAUDE_PLUGIN_ROOT\}/);
  }
});

test('descriptions preservam colisões críticas da matriz na superfície de ativação', () => {
  for (const [name, terms] of Object.entries({
    descobrir: ['missão', 'why did churn get worse', 'sem entrega definida', 'SOBRE'],
    definir: ['BFF', 'arquitetura', 'design system', 'hipóteses'],
    desenvolver: ['fake door', 'concierge', 'reversibilidade', 'plano da rodada'],
    entregar: ['me pediram uma tela', 'portão 0.5', 'SPEC sem implementar', 'hotfix urgente', 'resumo/status', 'SOBRE', 'configurar experimento'],
    'dev-loop': ['somente para software', 'sem SPEC', 'Dashboard', 'skill', 'perfil padrão é defaults'],
    acompanhar: ['em que fase estamos', 'post-mortem', 'resultados do experimento', 'construir dashboard', 'SOBRE'],
    defaults: ['perfil de custo padrão', 'explicitamente pedidas'],
    desafio: ['explicit', 'intenção clara', 'status/placar é acompanhar'],
  })) for (const term of terms) assert.ok(description(name).includes(term), `${name}: ${term}`);
});

test('roteador resolve ambiguidade, fases, expresso e status sem depender de slash runtime', () => {
  const text = skill('desafio');
  for (const term of ['shared/commands/desafio.md', 'Dois ou mais ativos', 'sem criar capa', 'mesmo com artefato desatualizado', 'DISCOVER', 'DEFINE', 'DEVELOP', 'DELIVER', 'ENCERRADO', 'GATE E aberto', 'GATE E', 'não crie artefatos aqui']) {
    assert.ok(text.includes(term), term);
  }
  for (const name of ['acompanhar', 'definir', 'descobrir', 'desenvolver', 'entregar']) {
    assert.ok(text.includes(`../${name}/SKILL.md`), name);
  }
});

test('defaults nativos preservam ausência sem escrita, pedido explícito e herança de modelos', () => {
  const text = skill('defaults');
  for (const term of ['~/.codex/hefesto/odin/defaults.md', 'CODEX_HOME', 'não procure outra raiz', 'Consulta nunca grava', 'pedido explícito', 'já confirma campo e valor', 'Preserve campos/comentários preexistentes', 'rejeite campos desconhecidos', 'Herde modelo e esforço da sessão', 'inoperantes no Codex', 'sem iniciar entrega ou dev-loop']) {
    assert.ok(text.includes(term), term);
  }
  assert.doesNotMatch(text, /~\/\.claude\//);
});

test('matriz registra auditoria manual Codex para todas as 43 frases sem alegar matcher real', () => {
  const matrix = read('../../plugins/odin/docs/roteamento-matrix.md');
  const rows = matrix.split('\n').filter((line) => /^\| \d+ \|/.test(line));
  assert.equal(rows.length, 43);
  for (const row of rows) assert.equal(row.split('|').length, 8, row);
  assert.match(matrix, /auditoria manual das descriptions nativas/);
  assert.match(matrix, /não prova seleção automática pelo host/);
  assert.match(rows[31], /`defaults`/);
  assert.match(rows[20], /`entregar`.*SPEC/);
});

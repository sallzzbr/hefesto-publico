import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const VALIDATOR = resolve(TEST_DIR, '..', 'skills', 'validar-plugin', 'scripts', 'validar.mjs');

function writeFixture(rootDir, files) {
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = resolve(rootDir, relativePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content, 'utf8');
  }
}

function baseFixture(skillBody) {
  return {
    '.claude-plugin/marketplace.json': JSON.stringify({
      name: 'demo-marketplace',
      metadata: { version: '0.1.0' },
      plugins: [
        {
          name: 'demo',
          source: './plugins/demo',
          description: 'Demo plugin.',
          version: '0.1.0',
          category: 'test',
          tags: ['test'],
        },
      ],
    }, null, 2),
    'plugins/demo/.claude-plugin/plugin.json': JSON.stringify({
      name: 'demo',
      version: '0.1.0',
      description: 'Demo plugin.',
      author: { name: 'Demo', url: 'https://example.com' },
      license: 'MIT',
      keywords: ['demo'],
      homepage: 'https://example.com',
      repository: 'https://example.com/repo',
    }, null, 2),
    'plugins/demo/skills/observe/SKILL.md': [
      '---',
      'description: "Write demo behavior. Use when you need a test fixture that routes correctly."',
      '---',
      '',
      '# Observe',
      '',
      ...skillBody,
    ].join('\n'),
  };
}

test('validar-plugin flags workspace domain paths without a resolution clause', () => {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'hefesto-validar-'));

  try {
    writeFixture(rootDir, baseFixture([
      'Os dados vivem em `Financas/demo/orcamento/` no Drive do usuário.',
    ]));

    const result = spawnSync('node', [VALIDATOR, rootDir], { encoding: 'utf8' });

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /plugins\/demo\/skills\/observe/);
    assert.match(result.stdout, /sem cláusula de resolução/);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('validar-plugin accepts domain paths when the skill declares the resolution rule', () => {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'hefesto-validar-'));

  try {
    writeFixture(rootDir, baseFixture([
      'A pasta se resolve pela regra única: `CLAUDE.md` do workspace → defaults do usuário com `local_dados` → convenção descoberta no cwd → default documentado.',
      'Os paths literais são ilustrativos do default, não hardcode.',
      'Exemplo: `Financas/demo/orcamento/`.',
    ]));

    const result = spawnSync('node', [VALIDATOR, rootDir], { encoding: 'utf8' });

    assert.equal(result.status, 0, result.stdout + result.stderr);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('validar-plugin flags an operational domain path outside backticks', () => {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'hefesto-validar-'));

  try {
    writeFixture(rootDir, baseFixture([
      'Leia marketing/registry/criativos/_indice.csv antes de responder.',
    ]));

    const result = spawnSync('node', [VALIDATOR, rootDir], { encoding: 'utf8' });

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /plugins\/demo\/skills\/observe\/SKILL\.md/);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('validar-plugin flags a two-segment domain directory in operational prose', () => {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'hefesto-validar-'));

  try {
    writeFixture(rootDir, baseFixture([
      'Liste os arquivos de marketing/registry antes de responder.',
    ]));

    const result = spawnSync('node', [VALIDATOR, rootDir], { encoding: 'utf8' });

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /marketing\/registry/);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('validar-plugin flags a domain path inside a harness string', () => {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'hefesto-validar-'));

  try {
    const fixture = baseFixture(['Skill neutra sem paths.']);
    fixture['plugins/demo/skills/observe/harness/run.mjs'] =
      "const prompt = 'Leia marketing/registry/criativos/_indice.csv';\n";
    writeFixture(rootDir, fixture);

    const result = spawnSync('node', [VALIDATOR, rootDir], { encoding: 'utf8' });

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /plugins\/demo\/skills\/observe\/harness\/run\.mjs/);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('validar-plugin does not accept an irrelevant resolution word', () => {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'hefesto-validar-'));

  try {
    writeFixture(rootDir, baseFixture([
      'Resolução de conflitos é responsabilidade humana.',
      'Leia `Financas/demo/orcamento/` no Drive.',
    ]));

    const result = spawnSync('node', [VALIDATOR, rootDir], { encoding: 'utf8' });

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /sem cláusula de resolução completa/);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('validar-plugin does not accept a local field without the four resolution levels', () => {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'hefesto-validar-'));

  try {
    writeFixture(rootDir, baseFixture([
      'Use `local_dados` para escolher a pasta.',
      'Leia `Financas/demo/orcamento/` no Drive.',
    ]));

    const result = spawnSync('node', [VALIDATOR, rootDir], { encoding: 'utf8' });

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /sem cláusula de resolução completa/);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('validar-plugin does not let a sibling reference mask the file with the path', () => {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'hefesto-validar-'));

  try {
    const fixture = baseFixture(['Skill neutra.']);
    fixture['plugins/demo/skills/observe/references/defaults.md'] = [
      'O path resolve pelo `CLAUDE.md` do workspace → defaults do usuário com `local_dados` →',
      'convenção descoberta no cwd → default documentado. Os paths literais são ilustrativos.',
    ].join('\n');
    fixture['plugins/demo/skills/observe/references/operation.md'] =
      'Leia `Financas/demo/orcamento/` no Drive.\n';
    writeFixture(rootDir, fixture);

    const result = spawnSync('node', [VALIDATOR, rootDir], { encoding: 'utf8' });

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /plugins\/demo\/skills\/observe\/references\/operation\.md/);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('validar-plugin matches internal path prefixes by segment, not partial text', () => {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'hefesto-validar-'));

  try {
    writeFixture(rootDir, baseFixture([
      'Leia `docs/roteamento-matrix.md` para entender o plugin.',
      'Depois leia `docs/roteamento-clientes/segredo.csv` para operar o workspace.',
    ]));

    const result = spawnSync('node', [VALIDATOR, rootDir], { encoding: 'utf8' });

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /docs\/roteamento-clientes\/segredo\.csv/);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('validar-plugin ignores conceptual slash-separated alternatives', () => {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'hefesto-validar-'));

  try {
    writeFixture(rootDir, baseFixture([
      'Use o nível `minor/patch/major` conforme o impacto.',
      'Compare `tema/formato/gancho` no relatório.',
      'Acompanhe 3 posts/semana durante o ciclo.',
    ]));

    const result = spawnSync('node', [VALIDATOR, rootDir], { encoding: 'utf8' });

    assert.equal(result.status, 0, result.stdout + result.stderr);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('validar-plugin ignores relative links and user defaults files that are plugin contracts', () => {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'hefesto-validar-'));

  try {
    writeFixture(rootDir, baseFixture([
      'Leia `../shared/references/defaults.md` para o contrato interno.',
      'Os defaults do usuário ficam em `~/.claude/demo/defaults.md`.',
    ]));

    const result = spawnSync('node', [VALIDATOR, rootDir], { encoding: 'utf8' });

    assert.equal(result.status, 0, result.stdout + result.stderr);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('validar-plugin accepts explicit delegation to a canonical resolution reference', () => {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'hefesto-validar-'));

  try {
    writeFixture(rootDir, baseFixture([
      'Os paths resolvem pela regra',
      'única em `references/defaults.md`.',
      'Os paths literais são ilustrativos do default, não hardcode.',
      'Leia `Financas/demo/orcamento/` no Drive.',
    ]));

    const result = spawnSync('node', [VALIDATOR, rootDir], { encoding: 'utf8' });

    assert.equal(result.status, 0, result.stdout + result.stderr);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('validar-plugin accepts a complete resolution clause split across lines', () => {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'hefesto-validar-'));

  try {
    writeFixture(rootDir, baseFixture([
      'Resolva no CLAUDE.md do workspace.',
      'Depois consulte os defaults do usuário e o campo',
      'local_dados.',
      'Na ausência deles, use a convenção descoberta no',
      'cwd.',
      'Por fim use o default',
      'documentado.',
      'Os paths literais são ilustrativos do default, não hardcode.',
      'Leia `Financas/demo/orcamento/` no Drive.',
    ]));

    const result = spawnSync('node', [VALIDATOR, rootDir], { encoding: 'utf8' });

    assert.equal(result.status, 0, result.stdout + result.stderr);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('validar-plugin ignores paths already injected through a DIR argument', () => {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'hefesto-validar-'));

  try {
    const fixture = baseFixture(['Skill neutra sem paths.']);
    fixture['plugins/demo/skills/observe/harness/run.mjs'] =
      "const prompt = 'Leia {DIR.marketing}/registry/criativos/_indice.csv';\n";
    writeFixture(rootDir, fixture);

    const result = spawnSync('node', [VALIDATOR, rootDir], { encoding: 'utf8' });

    assert.equal(result.status, 0, result.stdout + result.stderr);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('validar-plugin reads a resolution clause wrapped in a markdown blockquote', () => {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'hefesto-validar-'));

  try {
    // A cláusula é a mesma; só a quebra de linha cai dentro do `> ` da citação. O validador
    // não pode exigir que o autor reescreva texto correto por causa da formatação.
    writeFixture(rootDir, baseFixture([
      '> Resolve pelo `CLAUDE.md` do workspace → defaults do usuário com `local_dados` →',
      '> convenção descoberta no cwd → default',
      '> documentado; os literais são ilustrativos do default.',
      '',
      'Leia `Financas/demo/orcamento/` no Drive.',
    ]));

    const result = spawnSync('node', [VALIDATOR, rootDir], { encoding: 'utf8' });

    assert.equal(result.status, 0, result.stdout + result.stderr);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('validar-plugin flags a domain path in the plugin README', () => {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'hefesto-validar-'));

  try {
    const fixture = baseFixture(['Skill neutra sem paths.']);
    fixture['plugins/demo/README.md'] = [
      '# Demo',
      '',
      '## Skills',
      '',
      '| Skill | O que faz |',
      '|---|---|',
      '| `observe` | Skill real do plugin. |',
      '',
      'Leia `Financas/demo/orcamento/` no Drive para operar.',
    ].join('\n');
    writeFixture(rootDir, fixture);

    const result = spawnSync('node', [VALIDATOR, rootDir], { encoding: 'utf8' });

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /plugins\/demo\/README\.md/);
    assert.match(result.stdout, /sem cláusula de resolução/);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('validar-plugin does not treat a CLAUDE_PLUGIN_ROOT path as workspace structure', () => {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'hefesto-validar-'));

  try {
    // O extrator casa a partir da chave, então o token sai como `{CLAUDE_PLUGIN_ROOT}/...`
    // e precisa ser reconhecido como interno mesmo sem o cifrão.
    writeFixture(rootDir, baseFixture([
      'Leia o perfil default em `${CLAUDE_PLUGIN_ROOT}/perfil-de-voz.md` antes de escrever.',
    ]));

    const result = spawnSync('node', [VALIDATOR, rootDir], { encoding: 'utf8' });

    assert.equal(result.status, 0, result.stdout + result.stderr);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('validar-plugin flags a domain path in a skill script that is not markdown or javascript', () => {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'hefesto-validar-'));

  try {
    const fixture = baseFixture(['Skill neutra sem paths.']);
    fixture['plugins/demo/skills/observe/scripts/preparar.py'] =
      'PROMPT = "Leia marketing/registry/criativos/_indice.csv antes de responder"\n';
    fixture['plugins/demo/skills/observe/harness/rodar.sh'] =
      '#!/bin/sh\ncat marketing/registry/criativos/_indice.csv\n';
    writeFixture(rootDir, fixture);

    const result = spawnSync('node', [VALIDATOR, rootDir], { encoding: 'utf8' });

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /plugins\/demo\/skills\/observe\/scripts\/preparar\.py/);
    assert.match(result.stdout, /plugins\/demo\/skills\/observe\/harness\/rodar\.sh/);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('validar-plugin flags commands that hardcode workspace structure without delegation', () => {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'hefesto-validar-'));

  try {
    const fixture = baseFixture(['Skill neutra.']);
    fixture['plugins/demo/commands/status.md'] = [
      '---',
      'description: Mostra o status.',
      '---',
      '',
      'Leia `Financas/demo/orcamento/AAAA-MM.csv` e apresente o saldo.',
    ].join('\n');
    writeFixture(rootDir, fixture);

    const result = spawnSync('node', [VALIDATOR, rootDir], { encoding: 'utf8' });

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /plugins\/demo\/commands\/status\.md/);
    assert.match(result.stdout, /sem cláusula de resolução/);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

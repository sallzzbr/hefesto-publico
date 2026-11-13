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

test('validar-plugin flags absolute OS paths in non-markdown text files', () => {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'hefesto-validar-'));

  try {
    writeFixture(rootDir, {
      '.claude-plugin/marketplace.json': JSON.stringify(
        {
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
        },
        null,
        2,
      ),
      'plugins/demo/.claude-plugin/plugin.json': JSON.stringify(
        {
          name: 'demo',
          version: '0.1.0',
          description: 'Demo plugin.',
          author: { name: 'Demo', url: 'https://example.com' },
          license: 'MIT',
          keywords: ['demo'],
          homepage: 'https://example.com',
          repository: 'https://example.com/repo',
        },
        null,
        2,
      ),
      'plugins/demo/skills/observe/SKILL.md': [
        '---',
        'name: observe',
        'description: "Write demo behavior. Use when you need a test fixture that routes correctly."',
        '---',
        '',
        '# Observe',
      ].join('\n'),
      'plugins/demo/scripts/run.mjs': 'export const path = "C:' + '\\\\demo\\\\file.txt";\n',
    });

    const result = spawnSync('node', [VALIDATOR, rootDir], {
      encoding: 'utf8',
    });

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /plugins\/demo\/scripts\/run\.mjs/);
    assert.match(result.stdout, /path absoluto de Windows/);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('validar-plugin flags drift between root docs inventory and marketplace.json', () => {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'hefesto-validar-'));

  try {
    writeFixture(rootDir, {
      '.claude-plugin/marketplace.json': JSON.stringify(
        {
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
        },
        null,
        2,
      ),
      'plugins/demo/.claude-plugin/plugin.json': JSON.stringify(
        {
          name: 'demo',
          version: '0.1.0',
          description: 'Demo plugin.',
          author: { name: 'Demo', url: 'https://example.com' },
          license: 'MIT',
          keywords: ['demo'],
          homepage: 'https://example.com',
          repository: 'https://example.com/repo',
        },
        null,
        2,
      ),
      'plugins/demo/skills/observe/SKILL.md': [
        '---',
        'name: observe',
        'description: "Write demo behavior. Use when you need a test fixture that routes correctly."',
        '---',
        '',
        '# Observe',
      ].join('\n'),
      'README.md': [
        '# Demo',
        '',
        '> Demo marketplace.',
        '',
        'O repo é um marketplace que publica dois plugins: **demo** (plugin de teste) e **orphan** (não existe no manifest).',
      ].join('\n'),
      'AGENTS.md': [
        '# AGENTS.md',
        '',
        '`demo-marketplace` publica um **plugins**: `demo` (plugin de teste), `orphan` (fantasma).',
      ].join('\n'),
    });

    const result = spawnSync('node', [VALIDATOR, rootDir], {
      encoding: 'utf8',
    });

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /README\.md/);
    assert.match(result.stdout, /AGENTS\.md/);
    assert.match(result.stdout, /inventário de plugins/i);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('validar-plugin flags drift between plugin README inventory and on-disk plugin contents', () => {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'hefesto-validar-'));

  try {
    writeFixture(rootDir, {
      '.claude-plugin/marketplace.json': JSON.stringify(
        {
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
        },
        null,
        2,
      ),
      'plugins/demo/.claude-plugin/plugin.json': JSON.stringify(
        {
          name: 'demo',
          version: '0.1.0',
          description: 'Demo plugin.',
          author: { name: 'Demo', url: 'https://example.com' },
          license: 'MIT',
          keywords: ['demo'],
          homepage: 'https://example.com',
          repository: 'https://example.com/repo',
        },
        null,
        2,
      ),
      'plugins/demo/skills/observe/SKILL.md': [
        '---',
        'name: observe',
        'description: "Write demo behavior. Use when you need a test fixture that routes correctly."',
        '---',
        '',
        '# Observe',
      ].join('\n'),
      'plugins/demo/README.md': [
        '# Demo',
        '',
        '## Skills',
        '',
        '| Skill | O que faz |',
        '|---|---|',
        '| `observe` | Skill real do plugin. |',
        '| `orphan` | Skill fantasma que não existe em disco. |',
      ].join('\n'),
    });

    const result = spawnSync('node', [VALIDATOR, rootDir], {
      encoding: 'utf8',
    });

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /plugins\/demo\/README\.md/);
    assert.match(result.stdout, /inventário/i);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('validar-plugin flags drift between plugin README structure and on-disk plugin tree', () => {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'hefesto-validar-'));

  try {
    writeFixture(rootDir, {
      '.claude-plugin/marketplace.json': JSON.stringify(
        {
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
        },
        null,
        2,
      ),
      'plugins/demo/.claude-plugin/plugin.json': JSON.stringify(
        {
          name: 'demo',
          version: '0.1.0',
          description: 'Demo plugin.',
          author: { name: 'Demo', url: 'https://example.com' },
          license: 'MIT',
          keywords: ['demo'],
          homepage: 'https://example.com',
          repository: 'https://example.com/repo',
        },
        null,
        2,
      ),
      'plugins/demo/skills/observe/SKILL.md': [
        '---',
        'name: observe',
        'description: "Write demo behavior. Use when you need a test fixture that routes correctly."',
        '---',
        '',
        '# Observe',
      ].join('\n'),
      'plugins/demo/README.md': [
        '# Demo',
        '',
        '## Skills',
        '',
        '| Skill | O que faz |',
        '|---|---|',
        '| `observe` | Skill real do plugin. |',
        '',
        '## Estrutura',
        '',
        '```',
        'plugins/demo/',
        '├── .claude-plugin/',
        '│   └── plugin.json',
        '├── skills/',
        '│   └── observe/',
        '│       └── SKILL.md',
        '└── commands/',
        '    └── executar.md',
        '```',
      ].join('\n'),
    });

    const result = spawnSync('node', [VALIDATOR, rootDir], {
      encoding: 'utf8',
    });

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /plugins\/demo\/README\.md/);
    assert.match(result.stdout, /Estrutura/i);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

function marketplaceComPluginInterno(rootDir, { internos }) {
  const entrada = (nome) => ({ name: nome, source: `./plugins/${nome}`, description: 'Plugin de teste.', version: '0.1.0', category: 'test', tags: ['test'] });
  const manifesto = (nome) => JSON.stringify({ name: nome, version: '0.1.0', description: 'Plugin de teste.', author: { name: 'Demo', url: 'https://example.com' }, license: 'MIT', keywords: ['demo'], homepage: 'https://example.com', repository: 'https://example.com/repo' }, null, 2);
  const skill = (nome) => ['---', 'name: observe', 'description: "Write demo behavior. Use when you need a test fixture that routes correctly."', '---', '', `# ${nome}`].join('\n');
  writeFixture(rootDir, {
    '.claude-plugin/marketplace.json': JSON.stringify({ name: 'demo-marketplace', metadata: { version: '0.1.0' }, plugins: [entrada('demo'), entrada('secreto')] }, null, 2),
    'plugins/demo/.claude-plugin/plugin.json': manifesto('demo'),
    'plugins/demo/skills/observe/SKILL.md': skill('demo'),
    'plugins/secreto/.claude-plugin/plugin.json': manifesto('secreto'),
    'plugins/secreto/skills/observe/SKILL.md': skill('secreto'),
    'scripts/espelho-publico.json': JSON.stringify({ internos }),
    'README.md': '# Demo\n\nO repo é um marketplace que publica um plugin: **demo** (plugin de teste).\n',
    'AGENTS.md': '# AGENTS.md\n\n`demo-marketplace` publica um **plugins**: `demo` (plugin de teste).\n',
  });
  return spawnSync('node', [VALIDATOR, rootDir], { encoding: 'utf8' });
}

test('validar-plugin deixa o plugin excluído da distribuição fora do inventário dos docs', () => {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'hefesto-validar-'));
  try {
    const result = marketplaceComPluginInterno(rootDir, { internos: ['plugins/secreto/'] });
    assert.doesNotMatch(result.stdout, /inventário de plugins/i, result.stdout + result.stderr);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('validar-plugin continua cobrando no inventário o plugin que não é interno do espelho', () => {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'hefesto-validar-'));
  try {
    const result = marketplaceComPluginInterno(rootDir, { internos: ['plugins/outro/'] });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /faltando: secreto/);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

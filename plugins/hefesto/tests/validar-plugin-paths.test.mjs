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

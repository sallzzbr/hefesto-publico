import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { cp, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, win32, posix } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import test from 'node:test';

import { caminhoInventario } from '../scripts/sync-resources.mjs';

import { checkDistribution } from '../scripts/check.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
// Mesma contagem de check.mjs: o publicador reescreve estas duas linhas no stage.
const PLUGINS_ESPERADOS = 8;
const SKILLS_ESPERADAS = 66;

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'hefesto-codex-distribution-'));
  await Promise.all([
    cp(join(REPO, 'codex'), join(root, 'codex'), { recursive: true }),
    cp(join(REPO, 'plugins'), join(root, 'plugins'), { recursive: true }),
    cp(join(REPO, 'LICENSE'), join(root, 'LICENSE')),
  ]);
  const moduleUrl = `${pathToFileURL(join(root, 'codex/scripts/sync-resources.mjs')).href}?fixture=${Date.now()}-${Math.random()}`;
  const { sincronizar } = await import(moduleUrl);
  return {
    root,
    codexRoot: join(root, 'codex'),
    synchronize: () => sincronizar({ escrever: false }),
  };
}

async function expectFailure(setup, pattern) {
  const fx = await fixture();
  try {
    await setup(fx);
    await assert.rejects(
      checkDistribution({ repoRoot: fx.root, codexRoot: fx.codexRoot, synchronize: fx.synchronize }),
      pattern,
    );
  } finally {
    await rm(fx.root, { recursive: true, force: true });
  }
}

test('accepts the complete isolated distribution', async () => {
  const fx = await fixture();
  try {
    const result = await checkDistribution({
      repoRoot: fx.root,
      codexRoot: fx.codexRoot,
      synchronize: fx.synchronize,
    });
    assert.equal(result.plugins, PLUGINS_ESPERADOS);
    assert.equal(result.skills, SKILLS_ESPERADAS);
  } finally {
    await rm(fx.root, { recursive: true, force: true });
  }
});

test('rejects an altered synchronized resource', async () => {
  await expectFailure(async ({ codexRoot }) => {
    const target = join(codexRoot, 'plugins/bragir/shared/skills/analisar-voz/CONTRATO.md');
    await writeFile(target, `${await readFile(target, 'utf8')}\nadulterado\n`);
  }, /recurso divergente: plugins\/bragir\/shared\/skills\/analisar-voz\/CONTRATO\.md/);
});

test('rejects a missing synchronized resource', async () => {
  await expectFailure(async ({ codexRoot }) => {
    await unlink(join(codexRoot, 'plugins/hestia/shared/scripts/brl.py'));
  }, /recurso ausente: plugins\/hestia\/shared\/scripts\/brl\.py/);
});

test('rejects a plugin-root reference whose file is not packaged in shared/', async () => {
  await expectFailure(async ({ codexRoot }) => {
    await unlink(join(codexRoot, 'plugins/hermes/shared/references/regras-origem.md'));
  }, /CLAUDE_PLUGIN_ROOT\}\/references\/regras-origem\.md não existe em shared/);
});

test('rejects a removed native skill', async () => {
  await expectFailure(async ({ codexRoot }) => {
    await rm(join(codexRoot, 'plugins/mimyr/skills/analise-de-aula'), { recursive: true });
  }, /mimyr.*skills.*analise-de-aula|skill.*analise-de-aula/is);
});

test('rejects a native Markdown link that escapes its package', async () => {
  await expectFailure(async ({ codexRoot }) => {
    const skill = join(codexRoot, 'plugins/bragir/skills/analisar-voz/SKILL.md');
    await writeFile(skill, `${await readFile(skill, 'utf8')}\n[escape](../../../../LICENSE)\n`);
  }, /link.*escapa.*pacote|fora do pacote/is);
});

test('rejects malformed YAML in a native skill through the Forja validator', async () => {
  await expectFailure(async ({ codexRoot }) => {
    const skill = join(codexRoot, 'plugins/bragir/skills/analisar-voz/SKILL.md');
    const text = await readFile(skill, 'utf8');
    await writeFile(skill, text.replace(/^description:.*$/m, 'description: [invalid yaml'));
  }, /validador.*bragir|YAML inv[aá]lido/is);
});

test('rejects a marketplace whose native name is not hefesto', async () => {
  await expectFailure(async ({ codexRoot }) => {
    const path = join(codexRoot, '.agents/plugins/marketplace.json');
    const marketplace = JSON.parse(await readFile(path, 'utf8'));
    marketplace.name = 'outro';
    await writeFile(path, `${JSON.stringify(marketplace, null, 2)}\n`);
  }, /marketplace\.name deve ser hefesto/i);
});

test('rejects an absolute marketplace source path even when it points inside codex', async () => {
  await expectFailure(async ({ codexRoot }) => {
    const path = join(codexRoot, '.agents/plugins/marketplace.json');
    const marketplace = JSON.parse(await readFile(path, 'utf8'));
    marketplace.plugins[0].source.path = join(codexRoot, 'plugins', marketplace.plugins[0].name);
    await writeFile(path, `${JSON.stringify(marketplace, null, 2)}\n`);
  }, /path deve ser relativo/i);
});

test('resource inventory keys agree on Windows and POSIX paths', () => {
  const expected = 'plugins/odin/shared/CONTRATO.md';
  const inventory = new Set([expected]);
  assert.equal(caminhoInventario('C:/repo/codex', 'C:/repo/codex/' + expected, win32), expected);
  assert.ok(inventory.has(caminhoInventario('C:/repo/codex', 'C:/repo/codex/' + expected, win32)));
  assert.equal(caminhoInventario('/repo/codex', '/repo/codex/' + expected, posix), expected);
});

test('rejects a native skill without an explicit domain contract reference', async () => {
  await expectFailure(async ({ codexRoot }) => {
    const path = join(codexRoot, 'plugins/hefesto/skills/validar-plugin/SKILL.md');
    await writeFile(path, (await readFile(path, 'utf8')).replace('../../shared/skills/validar-plugin/CONTRATO.md', '#contrato'));
  }, /contrato de domínio em shared/);
});

test('accepts nested string metadata through both native validators', async () => {
  const fx = await fixture();
  try {
    const skill = join(fx.codexRoot, 'plugins/bragir/skills/analisar-voz/SKILL.md');
    await writeFile(skill, (await readFile(skill, 'utf8')).replace('\n---\n', '\nmetadata:\n  short-description: "Voz: estilo pessoal"\n  author: \'D\'\'Ávila\'\n  version: "1.0"\n---\n'));
    const result = await checkDistribution({ repoRoot: fx.root, codexRoot: fx.codexRoot, synchronize: fx.synchronize });
    assert.equal(result.skills, SKILLS_ESPERADAS);
  } finally { await rm(fx.root, { recursive: true, force: true }); }
});

test('rejects malformed nested metadata without ignoring unknown lines', async () => {
  for (const metadata of [
    'metadata:',
    'metadata:\n  author: "a"\n  author: "b"',
    'metadata:\n  author: [invalid',
    'metadata:\n author: "a"\n  version: "b"',
    'metadata:\n\tauthor: "a"',
    'metadata:\n  author:\n    name: "a"',
    'metadata: "scalar"',
    'metadata:\n  author: true',
    'metadata:\n  author: foo:',
    'metadata:\n  author: 0x10',
    'metadata:\n  author: 0o17',
    'metadata:\n  author: bad\u0001value',
    "metadata:\n  author: 'bad\u0001value'",
    'metadata:\n  author: "unclosed',
    'metadata:\n  author: "a"\nmetadata:\n  version: "1"',
    'description: "duplicate"',
  ]) {
    await expectFailure(async ({ codexRoot }) => {
      const skill = join(codexRoot, 'plugins/bragir/skills/analisar-voz/SKILL.md');
      await writeFile(skill, (await readFile(skill, 'utf8')).replace('\n---\n', `\n${metadata}\n---\n`));
    }, /frontmatter|YAML/i);
  }
});

// ── E3 (hermes 2.0.0) ───────────────────────────────────────────────────────
// Vale na árvore de desenvolvimento e no stage: mede o conjunto de skills do hermes, nunca a existência de outro pacote.
const HERMES_PUBLICO = [
  'analisar-criativos', 'analisar-produto', 'analise-diaria', 'auditoria-cro', 'auditoria-de-estrutura', 'criativo-fluxo',
  'diagnostico-site-funil', 'direcao-de-arte', 'evoluir-vencedor', 'fadiga-criativa', 'otimizar-verba', 'pnl-mensal',
  'regua-decisao', 'saude-do-funil', 'sintese-semanal', 'sugerir-criativos', 'unit-economics', 'validar-criativo',
];

test('C6: o pacote Codex público do hermes carrega exatamente as 18 skills públicas, nativas e de contrato', () => {
  const hermes = join(REPO, 'codex/plugins/hermes');
  assert.deepEqual(readdirSync(join(hermes, 'skills')).sort(), [...HERMES_PUBLICO].sort(), 'skills nativas');
  assert.deepEqual(readdirSync(join(hermes, 'shared/skills')).sort(), [...HERMES_PUBLICO].sort(), 'contratos em shared');
});

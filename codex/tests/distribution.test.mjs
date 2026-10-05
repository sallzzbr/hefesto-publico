import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import test from 'node:test';

import { checkDistribution } from '../scripts/check.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');

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
    assert.equal(result.plugins, 6);
    assert.equal(result.skills, 50);
  } finally {
    await rm(fx.root, { recursive: true, force: true });
  }
});

test('rejects an altered synchronized resource', async () => {
  await expectFailure(async ({ codexRoot }) => {
    const target = join(codexRoot, 'plugins/bragir/shared/perfil-de-voz.md');
    await writeFile(target, `${await readFile(target, 'utf8')}\nadulterado\n`);
  }, /recurso divergente: plugins\/bragir\/shared\/perfil-de-voz\.md/);
});

test('rejects a missing synchronized resource', async () => {
  await expectFailure(async ({ codexRoot }) => {
    await unlink(join(codexRoot, 'plugins/hestia/shared/scripts/brl.py'));
  }, /recurso ausente: plugins\/hestia\/shared\/scripts\/brl\.py/);
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

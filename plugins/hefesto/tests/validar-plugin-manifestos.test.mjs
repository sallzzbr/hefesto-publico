// Manifestos e frontmatter — a metade do validar.mjs que o mutation testing mostrou sem teste.
//
// Baseline 2026-07-28: 818 de 1154 mutantes sobreviviam. Os 23 testes existentes cobriam só
// paths de domínio, cláusula de resolução e inventários; `frontmatter()`, semver, `source`,
// `--plugin`, marketplace ausente e plugin fora do manifesto nunca tinham visto um teste. Cada
// caso aqui é uma mutação que antes passava verde.

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const VALIDATOR = resolve(TEST_DIR, '..', 'skills', 'validar-plugin', 'scripts', 'validar.mjs');

const DESCRICAO_OK = 'description: "Write demo behavior for tests. Use when you need a fixture that routes correctly and validates."';
const SKILL_OK = ['---', 'name: observe', DESCRICAO_OK, '---', '', '# Demo', '', 'Corpo sem paths de domínio.', ''].join('\n');

function marketplace(extra = {}) {
  return JSON.stringify({
    name: 'demo-marketplace',
    metadata: { version: '0.1.0' },
    plugins: [{ name: 'demo', source: './plugins/demo', description: 'Demo plugin.', version: '0.1.0', category: 'test', tags: ['test'], ...extra }],
  }, null, 2);
}

function pluginJson(version = '0.1.0') {
  return JSON.stringify({
    name: 'demo', version, description: 'Demo plugin.',
    author: { name: 'Demo', url: 'https://example.com' }, license: 'MIT', keywords: ['demo'],
    homepage: 'https://example.com', repository: 'https://example.com/repo',
  }, null, 2);
}

function fixture(files, args = []) {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'hefesto-manifestos-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      const abs = resolve(rootDir, rel);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content, 'utf8');
    }
    const r = spawnSync(process.execPath, [VALIDATOR, rootDir, ...args], { encoding: 'utf8' });
    return { status: r.status, out: `${r.stdout}\n${r.stderr}` };
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
}

const BASE = {
  '.claude-plugin/marketplace.json': marketplace(),
  'plugins/demo/.claude-plugin/plugin.json': pluginJson(),
  'plugins/demo/skills/observe/SKILL.md': SKILL_OK,
};

test('fixture base passa limpa: 0 erros, 0 avisos', () => {
  const r = fixture(BASE);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /0 erro\(s\), 0 aviso\(s\)/);
});

test('sem marketplace.json em nenhum ancestral: erro fatal, exit 1', () => {
  const r = fixture({ 'README.md': '# nada' });
  assert.equal(r.status, 1);
  assert.match(r.out, /nenhum \.claude-plugin\/marketplace\.json encontrado/);
});

test('--plugin sem nome é erro de uso, não plugin chamado "--algo"', () => {
  const r = fixture(BASE, ['--plugin']);
  assert.equal(r.status, 1);
  assert.match(r.out, /--plugin requer um nome/);
});

test('--plugin com nome que não está no marketplace reprova', () => {
  const r = fixture(BASE, ['--plugin', 'fantasma']);
  assert.equal(r.status, 1);
  assert.match(r.out, /plugin "fantasma" não está no marketplace\.json/);
});

test('metadata.version fora de X.Y.Z é erro', () => {
  const r = fixture({ ...BASE, '.claude-plugin/marketplace.json': marketplace().replace('"version": "0.1.0"\n  },', '"version": "1.0"\n  },') });
  assert.equal(r.status, 1);
  assert.match(r.out, /metadata\.version "1\.0" não é semver/);
});

test('source "." não é spec-válido: exige string relativa "./..."', () => {
  const r = fixture({ ...BASE, '.claude-plugin/marketplace.json': marketplace({ source: '.' }) });
  assert.equal(r.status, 1);
  assert.match(r.out, /source deve ser string relativa/);
});

test('source com ".." não pode escapar da raiz do marketplace', () => {
  const r = fixture({ ...BASE, '.claude-plugin/marketplace.json': marketplace({ source: './plugins/../plugins/demo' }) });
  assert.equal(r.status, 1);
  assert.match(r.out, /não pode escapar da raiz/);
});

test('version do plugin.json dessincronizada da entrada do marketplace é erro', () => {
  const r = fixture({ ...BASE, 'plugins/demo/.claude-plugin/plugin.json': pluginJson('0.2.0') });
  assert.equal(r.status, 1);
  assert.match(r.out, /version 0\.2\.0 dessincronizada do marketplace\.json \(0\.1\.0\)/);
});

test('entrada do marketplace sem version, e version não semver no plugin.json, são erros distintos', () => {
  const semVersao = JSON.parse(marketplace());
  delete semVersao.plugins[0].version;
  const r1 = fixture({ ...BASE, '.claude-plugin/marketplace.json': JSON.stringify(semVersao) });
  assert.equal(r1.status, 1);
  assert.match(r1.out, /entrada sem version/);
  const r2 = fixture({ ...BASE, 'plugins/demo/.claude-plugin/plugin.json': pluginJson('v1') });
  assert.equal(r2.status, 1);
  assert.match(r2.out, /version "v1" não é semver/);
});

test('plugin.json com name diferente da entrada, e plugin.json inválido, são erros', () => {
  const r1 = fixture({ ...BASE, 'plugins/demo/.claude-plugin/plugin.json': pluginJson().replace('"name": "demo"', '"name": "outro"') });
  assert.equal(r1.status, 1);
  assert.match(r1.out, /name "outro" difere da entrada do marketplace "demo"/);
  const r2 = fixture({ ...BASE, 'plugins/demo/.claude-plugin/plugin.json': '{ nope' });
  assert.equal(r2.status, 1);
  assert.match(r2.out, /JSON inválido/);
});

test('SKILL.md sem frontmatter, sem fecho, e sem description são três erros nomeados', () => {
  const casos = [
    ['# Sem frontmatter\n', /sem frontmatter/],
    ['---\ndescription: "x"\n\n# nunca fecha\n', /frontmatter não fechado/],
    ['---\nname: observe\n---\n', /frontmatter sem campo description/],
  ];
  for (const [conteudo, esperado] of casos) {
    const r = fixture({ ...BASE, 'plugins/demo/skills/observe/SKILL.md': conteudo });
    assert.equal(r.status, 1, conteudo);
    assert.match(r.out, esperado);
  }
});

test('fecho do frontmatter precisa ser uma linha só com ---, não "---qualquer-coisa"', () => {
  const r = fixture({ ...BASE, 'plugins/demo/skills/observe/SKILL.md': '---\ndescription: "x"\n---texto\n' });
  assert.equal(r.status, 1);
  assert.match(r.out, /frontmatter não fechado/);
});

test('description que é só comentário YAML conta como vazia', () => {
  const r = fixture({ ...BASE, 'plugins/demo/skills/observe/SKILL.md': '---\ndescription: # TODO\n---\n' });
  assert.equal(r.status, 1);
  assert.match(r.out, /description vazia/);
});

test('description sem espaço depois dos dois-pontos não é o campo description (YAML exige o espaço)', () => {
  const r = fixture({ ...BASE, 'plugins/demo/skills/observe/SKILL.md': '---\nname: observe\ndescription:Write demo behavior for tests. Use when you need a fixture.\n---\n' });
  assert.notEqual(r.status, 0);
  assert.match(r.out, /frontmatter sem campo description/);
});

test('name sem espaço depois dos dois-pontos não conta como name', () => {
  const r = fixture({ ...BASE, 'plugins/demo/skills/observe/SKILL.md': `---\nname:observe\n${DESCRICAO_OK}\n---\n` });
  assert.notEqual(r.status, 0);
  assert.match(r.out, /name/);
});

test('description com um espaço, com tab e em bloco (description: seguido de >) seguem aceitas', () => {
  for (const linha of [DESCRICAO_OK, DESCRICAO_OK.replace('description: ', 'description:\t')]) {
    const r = fixture({ ...BASE, 'plugins/demo/skills/observe/SKILL.md': `---\nname: observe\n${linha}\n---\n` });
    assert.equal(r.status, 0, r.out);
  }
  const bloco = '---\nname: observe\ndescription: >-\n  Write demo behavior for tests. Use when you need a fixture that routes correctly and validates.\n---\n';
  assert.equal(fixture({ ...BASE, 'plugins/demo/skills/observe/SKILL.md': bloco }).status, 0);
});

test('description em scalar multilinha (>) junta só as linhas indentadas contíguas', () => {
  const skill = [
    '---',
    'name: observe',
    'description: >-',
    '  Use quando o usuário pedir a fixture de teste, rodar a validação de manifesto,',
    '  ou conferir o frontmatter multilinha — três gatilhos concretos.',
    'allowed-tools: Read',
    '---',
    '',
  ].join('\n');
  const r = fixture({ ...BASE, 'plugins/demo/skills/observe/SKILL.md': skill });
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /0 erro\(s\), 0 aviso\(s\)/);
});

test('scalar multilinha sem conteúdo indentado é description vazia', () => {
  const r = fixture({ ...BASE, 'plugins/demo/skills/observe/SKILL.md': '---\ndescription: >\nallowed-tools: Read\n---\n' });
  assert.equal(r.status, 1);
  assert.match(r.out, /description vazia/);
});

test('description acima de 1024 chars é erro; abaixo de 60 é aviso (não erro)', () => {
  const longa = `---\ndescription: "${'Use when '.repeat(120)}"\n---\n`;
  const r1 = fixture({ ...BASE, 'plugins/demo/skills/observe/SKILL.md': longa });
  assert.equal(r1.status, 1);
  assert.match(r1.out, /description com \d+ chars \(máx 1024\)/);
  const curta = '---\nname: observe\ndescription: "Write demo."\n---\n';
  const r2 = fixture({ ...BASE, 'plugins/demo/skills/observe/SKILL.md': curta });
  assert.equal(r2.status, 0, r2.out);
  assert.match(r2.out, /AVISO .*description curta \(11 chars\)/);
});

test('diretório de skill sem SKILL.md é erro; arquivo solto em skills/ é aviso', () => {
  const r1 = fixture({ ...BASE, 'plugins/demo/skills/vazia/notas.md': '# sem SKILL.md' });
  assert.equal(r1.status, 1);
  assert.match(r1.out, /diretório de skill sem SKILL\.md/);
  const r2 = fixture({ ...BASE, 'plugins/demo/skills/solto.md': '# solto' });
  assert.equal(r2.status, 0, r2.out);
  assert.match(r2.out, /arquivo solto em skills\//);
});

test('command e agent sem frontmatter válido são erros', () => {
  const r = fixture({ ...BASE, 'plugins/demo/commands/demo.md': '# /demo sem frontmatter\n', 'plugins/demo/agents/revisor.md': '---\nname: revisor\n---\n' });
  assert.equal(r.status, 1);
  assert.match(r.out, /commands\/demo\.md: sem frontmatter/);
  assert.match(r.out, /agents\/revisor\.md: frontmatter sem campo description/);
});

test('plugin em disco fora do marketplace.json é aviso — e some com --plugin', () => {
  const files = { ...BASE, 'plugins/orfao/.claude-plugin/plugin.json': pluginJson().replace('"name": "demo"', '"name": "orfao"') };
  const r1 = fixture(files);
  assert.equal(r1.status, 0, r1.out);
  assert.match(r1.out, /plugins\/orfao: existe em disco mas não está no marketplace\.json/);
  const r2 = fixture(files, ['--plugin', 'demo']);
  assert.doesNotMatch(r2.out, /orfao/);
});

test('path absoluto de Windows é erro; home Unix é aviso', () => {
  const r1 = fixture({ ...BASE, 'plugins/demo/skills/observe/notas.md': 'veja C:\\Users\\x\\y.md' });
  assert.equal(r1.status, 1);
  assert.match(r1.out, /path absoluto de Windows/);
  const r2 = fixture({ ...BASE, 'plugins/demo/skills/observe/notas.md': 'veja /Users/alguem/y.md' });
  assert.equal(r2.status, 0, r2.out);
  assert.match(r2.out, /AVISO .*home Unix/);
});

test('entrada sem description/category/tags e plugin.json sem author/license/keywords são avisos, não erros', () => {
  const mp = JSON.parse(marketplace());
  delete mp.plugins[0].description; delete mp.plugins[0].category; delete mp.plugins[0].tags;
  const pj = JSON.parse(pluginJson());
  delete pj.author; delete pj.license; delete pj.keywords; delete pj.homepage; delete pj.repository;
  const r = fixture({ ...BASE, '.claude-plugin/marketplace.json': JSON.stringify(mp), 'plugins/demo/.claude-plugin/plugin.json': JSON.stringify(pj) });
  assert.equal(r.status, 0, r.out);
  for (const aviso of ['entrada sem description', 'entrada sem category', 'entrada sem tags', 'sem author', 'sem license', 'sem keywords', 'sem homepage nem repository']) {
    assert.match(r.out, new RegExp(aviso), aviso);
  }
});

test('name explícito da skill precisa ser kebab-case e igual ao diretório', () => {
  for (const nome of ['Outro Nome', 'outro', '""', 'observe # comentário']) {
    const skill = SKILL_OK.replace('name: observe', `name: ${nome}`);
    const r = fixture({ ...BASE, 'plugins/demo/skills/observe/SKILL.md': skill });
    // Comentário YAML depois do nome é válido e não faz parte do identificador.
    assert.equal(r.status, nome.includes('#') ? 0 : 1, `${nome}: ${r.out}`);
  }
});

test('name explícito admite aspas', () => {
  for (const nome of ['observe', '"observe"', "'observe'"]) {
    const r = fixture({ ...BASE, 'plugins/demo/skills/observe/SKILL.md': SKILL_OK.replace('name: observe', `name: ${nome}`) });
    assert.equal(r.status, 0, r.out);
  }
  assert.equal(fixture(BASE).status, 0);
});

test('skill sem name é erro obrigatório mesmo com description válida', () => {
 const r=fixture({...BASE,'plugins/demo/skills/observe/SKILL.md':SKILL_OK.replace('name: observe\n','')});
 assert.equal(r.status,1,r.out);
 assert.match(r.out,/sem campo name/);
});

// dependencies no plugin.json (doc oficial: "name", "name@marketplace" ou objeto; nome sem
// marketplace resolve no próprio marketplace). O Claude Code instala a dependência junto e
// desativa o plugin quando ela falta, então nome que não existe no marketplace é plugin que
// não carrega para quem instala.
function comDependencias(deps, extraMp = {}) {
  const mp = JSON.parse(marketplace());
  mp.plugins.push({ name: 'base', source: './plugins/base', description: 'Base.', version: '0.1.0', category: 'test', tags: ['test'] });
  Object.assign(mp, extraMp);
  const pj = JSON.parse(pluginJson());
  pj.dependencies = deps;
  return {
    ...BASE,
    '.claude-plugin/marketplace.json': JSON.stringify(mp),
    'plugins/demo/.claude-plugin/plugin.json': JSON.stringify(pj),
    'plugins/base/.claude-plugin/plugin.json': pluginJson().replace('"name": "demo"', '"name": "base"'),
  };
}

test('dependencies com plugin existente no marketplace é aceita nas três formas', () => {
  const formas = [
    ['base'],
    ['base@demo-marketplace'],
    [{ name: 'base' }],
    [{ name: 'base', marketplace: 'demo-marketplace', version: '^0.1.0' }],
  ];
  for (const deps of formas) {
    const r = fixture(comDependencias(deps));
    assert.equal(r.status, 0, `${JSON.stringify(deps)}: ${r.out}`);
    assert.match(r.out, /0 erro\(s\), 0 aviso\(s\)/, JSON.stringify(deps));
  }
});

test('dependencies com plugin inexistente no marketplace é erro, em qualquer forma e com --plugin', () => {
  const formas = [['fantasma'], ['fantasma@demo-marketplace'], [{ name: 'fantasma' }], ['base', 'fantasma']];
  for (const deps of formas) {
    const r = fixture(comDependencias(deps));
    assert.equal(r.status, 1, `${JSON.stringify(deps)}: ${r.out}`);
    assert.match(r.out, /plugin\.json: dependência "fantasma" não existe no marketplace "demo-marketplace"/, JSON.stringify(deps));
  }
  // O filtro --plugin restringe o que é validado, não o universo de nomes do marketplace.
  const r = fixture(comDependencias(['base']), ['--plugin', 'demo']);
  assert.equal(r.status, 0, r.out);
});

test('dependencies fora do formato da doc é erro', () => {
  const casos = [
    ['base', /dependencies deve ser lista/],
    [[42], /entrada 1 de dependencies inválida/],
    [[{ marketplace: 'demo-marketplace' }], /entrada 1 de dependencies inválida/],
    [['base', { name: 'base', version: 2 }], /entrada 2 de dependencies inválida/],
    [['@demo-marketplace'], /entrada 1 de dependencies inválida/],
  ];
  for (const [deps, esperado] of casos) {
    const r = fixture(comDependencias(deps));
    assert.equal(r.status, 1, `${JSON.stringify(deps)}: ${r.out}`);
    assert.match(r.out, esperado, JSON.stringify(deps));
  }
});

test('dependência de outro marketplace: erro sem allowCrossMarketplaceDependenciesOn, aviso com ele', () => {
  for (const deps of [['alheio@outro'], [{ name: 'alheio', marketplace: 'outro' }]]) {
    const r1 = fixture(comDependencias(deps));
    assert.equal(r1.status, 1, r1.out);
    assert.match(r1.out, /dependência "alheio@outro" vem de outro marketplace sem "outro" em allowCrossMarketplaceDependenciesOn/);
    const r2 = fixture(comDependencias(deps, { allowCrossMarketplaceDependenciesOn: ['outro'] }));
    assert.equal(r2.status, 0, r2.out);
    assert.match(r2.out, /AVISO .*dependência "alheio@outro" é de outro marketplace: existência não verificada/);
  }
});

test('argumentos GNU filtram o plugin e argumentos ignorados são recusados', () => {
  assert.equal(fixture(BASE, ['--plugin=ausente']).status, 1);
  assert.equal(fixture(BASE, ['--plugin=demo']).status, 0);
  for (const args of [['--plugin='], ['--desconhecido'], ['outra-raiz']]) {
    assert.equal(fixture(BASE, args).status, 1, JSON.stringify(args));
  }
});

test('portabilidade cobre barras Windows e root Unix sem confundir URLs', () => {
  const windows = fixture({ ...BASE, 'plugins/demo/references/path.md': 'Leia C:/Users/demo/arquivo.md' });
  assert.equal(windows.status, 1, windows.out);
  const unix = fixture({ ...BASE, 'plugins/demo/references/path.md': 'arquivo:/root/.claude/demo' });
  assert.match(unix.out, /path absoluto de home Unix/);
  const url = fixture({ ...BASE, 'plugins/demo/references/path.md': 'https://example.com/recurso' });
  assert.equal(url.status, 0, url.out);
});

test('validador instalado não acusa a cópia do seu fonte dentro do plugin alvo', () => {
  const r = fixture({ ...BASE, 'plugins/demo/scripts/validar.mjs': readFileSync(VALIDATOR, 'utf8') });
  assert.equal(r.status, 0, r.out);
  assert.doesNotMatch(r.out, /path absoluto/);
});

test('dependências objeto exigem faixa válida e satisfeita pela versão local', () => {
  const validas=['0.1.0','^0.1.0','~0.1.0','>=0.1.0 <0.2.0','0.1.x','0.1','*','0.0.1 - 0.1.0','^1.0.0 || 0.1.0'];
  for(const version of validas) {
    const r=fixture(comDependencias([{name:'base',version}]));
    assert.equal(r.status,0,version+': '+r.out);
  }
  for(const version of ['', 'banana', '0.1.0 || banana', '^1.0.0', '~0.2.0', '>0.1.0', '<0.1.0', '0.0.x', '^0.0.1']) {
    const r=fixture(comDependencias([{name:'base',version}]));
    assert.equal(r.status,1,version+': '+r.out);
    assert.match(r.out,/faixa/);
  }
});

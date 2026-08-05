#!/usr/bin/env node
// Cobra que mudança dentro de um plugin venha com bump de versão dele.
//
// Por que existe: a regra de versionamento do AGENTS.md ("minor ao adicionar skill, patch pra
// ajustes") não tinha gate NENHUM. O `validar.mjs` só confere que `plugin.json` e
// `marketplace.json` estão em sincronia — ninguém verificava se o diff veio acompanhado de
// bump. Era prosa afirmando processo, a mesma família que o resto do cerco combate. E pegou o
// próprio autor: o commit afbd9b8 mexeu em `plugins/odin/tests/` sem subir o odin.
//
// O que conta como mudança que exige bump: qualquer arquivo sob `plugins/<p>/`, EXCETO
// `tests/`. Testes não são contrato publicado — quem instala o plugin não os executa —, e
// exigir bump por teste transformaria o gate em pedágio que se aprende a contornar. A
// fronteira é uma decisão, e está escrita aqui para poder ser discutida em vez de adivinhada.
//
// Segunda cobrança (2026-07-31): bump sem entrada de CHANGELOG. O furo real que a motivou:
// uma versão publicada só num squash de PR — o plugin saltou duas versões e o CHANGELOG parou
// na anterior, com a explicação da intermediária vivendo apenas na mensagem de merge. Regra:
// se o plugin bumpou E mantém um `CHANGELOG.md`, a nova versão precisa aparecer como entrada
// `## <versão>`. Plugin sem CHANGELOG.md não é cobrado — changelog é opt-in por plugin, e
// inventar a obrigação aqui transformaria o gate em pedágio; quem adota o arquivo assume o
// contrato de mantê-lo.
//
// Uso: node scripts/verificar-bump.mjs <ref-base>
// No CI: ref-base é a base do PR (`origin/master`) ou o commit anterior, em push.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2];

if (!base) {
  console.error('ERRO: uso — node scripts/verificar-bump.mjs <ref-base>');
  process.exit(1);
}

const git = (...args) => execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8' }).trim();

let alterados;
try {
  alterados = git('diff', '--name-only', `${base}...HEAD`).split('\n').filter(Boolean);
} catch (e) {
  console.error(`ERRO: não consegui diffar contra ${base}: ${e.message}`);
  process.exit(1);
}

// `plugins/<p>/...` sem `tests/` logo abaixo do plugin.
const tocados = new Set();
for (const arquivo of alterados) {
  const m = /^plugins\/([^/]+)\/(.+)$/.exec(arquivo);
  if (!m) continue;
  if (m[2].startsWith('tests/')) continue;
  tocados.add(m[1]);
}

if (tocados.size === 0) {
  console.log('nenhum plugin tocado fora de tests/ — nada a cobrar.');
  process.exit(0);
}

function versaoEm(ref, plugin) {
  try {
    const bruto = git('show', `${ref}:plugins/${plugin}/.claude-plugin/plugin.json`);
    return JSON.parse(bruto).version ?? null;
  } catch {
    return null; // plugin novo neste diff, ou removido
  }
}

const faltando = [];
const semChangelog = [];
for (const plugin of [...tocados].sort()) {
  const antes = versaoEm(base, plugin);
  if (antes === null) continue; // plugin novo: não há de onde bumpar
  const agora = JSON.parse(
    readFileSync(resolve(RAIZ, `plugins/${plugin}/.claude-plugin/plugin.json`), 'utf8'),
  ).version;
  if (antes === agora) {
    faltando.push({ plugin, versao: agora });
    continue;
  }
  // Bumpou. Se o plugin mantém CHANGELOG.md, a nova versão precisa ter entrada nele —
  // versão cuja explicação vive só na mensagem de merge é histórico que se perde no squash.
  const changelog = resolve(RAIZ, `plugins/${plugin}/CHANGELOG.md`);
  if (!existsSync(changelog)) continue; // changelog é opt-in por plugin (ver cabeçalho)
  const linhas = readFileSync(changelog, 'utf8');
  const entrada = new RegExp(`^## ${agora.replaceAll('.', '\\.')}(\\s|$)`, 'm');
  if (!entrada.test(linhas)) semChangelog.push({ plugin, versao: agora });
}

if (faltando.length > 0 || semChangelog.length > 0) {
  console.error('ERRO: gate de bump reprovou:\n');
  for (const f of faltando) {
    console.error(`  ${f.plugin} — alterado sem bump de versão (continua em ${f.versao})`);
  }
  for (const f of semChangelog) {
    console.error(
      `  ${f.plugin} — bumpou para ${f.versao} sem entrada \`## ${f.versao}\` no CHANGELOG.md`,
    );
  }
  console.error(
    '\nRegra em AGENTS.md: minor ao adicionar skill, patch pra ajuste, major pra quebra de\n' +
    'contrato. Bump no `plugin.json` E na entrada correspondente do `marketplace.json`\n' +
    '(o validar.mjs cobra a sincronia). Mudança só em `tests/` não exige bump — se o seu diff\n' +
    'é só teste e este gate reprovou, algum arquivo fora de tests/ entrou junto.\n' +
    'Plugin que mantém CHANGELOG.md registra toda versão nova nele — a explicação da versão\n' +
    'não pode viver só na mensagem de merge.',
  );
  process.exit(1);
}

console.log(`plugins tocados: ${[...tocados].sort().join(', ')} — todos com bump. ok.`);

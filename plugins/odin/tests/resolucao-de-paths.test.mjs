// Contrato: nenhum passo executável do odin pode voltar ao default literal depois de a skill
// ter resolvido o diretório. A regressão que este teste tranca: o Step 2 gravava a spec avulsa
// em `docs/plans/` enquanto a busca de retomada já varria `<dirSpecs>` — com `local_specs`
// declarado, a retomada não achava a spec e criava uma segunda entrega.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const PLUGIN_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Verbos que caracterizam passo imperativo — é aqui que o literal causa dano.
const IMPERATIVO = /\b(?:grave|gravar|salve|salvar|crie|criar|criar\/abrir|varrer|varra|liste|listar|escreva|escrever|localize|localizar|procure|procurar)\b/i;
// Onde o literal continua legítimo: linha que o apresenta COMO default, ou comentário de exemplo.
const APRESENTA_COMO_DEFAULT = /\bdefaults?\b|ilustrativ|\/\/|legad[ao]/i;

const DEFAULTS_LITERAIS = /`?docs\/(?:desafios|plans|pendencias)/;

function arquivosMd(dir, achados = []) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      if (nome !== 'tests') arquivosMd(caminho, achados);
    } else if (nome.endsWith('.md')) {
      achados.push(caminho);
    }
  }
  return achados;
}

test('odin never writes to or scans the literal default after resolving the directory', () => {
  const ofensores = [];

  for (const arquivo of arquivosMd(PLUGIN_DIR)) {
    const linhas = readFileSync(arquivo, 'utf8').split(/\r?\n/);
    linhas.forEach((linha, i) => {
      if (!DEFAULTS_LITERAIS.test(linha)) return;
      if (!IMPERATIVO.test(linha)) return;
      if (APRESENTA_COMO_DEFAULT.test(linha)) return;
      ofensores.push(`${relative(PLUGIN_DIR, arquivo)}:${i + 1} — ${linha.trim().slice(0, 120)}`);
    });
  }

  assert.deepEqual(
    ofensores,
    [],
    `passo imperativo usando o default literal em vez do diretório resolvido:\n${ofensores.join('\n')}`,
  );
});

// ODIN-05/CX-06: a `entregar` mandava perguntar e gravar defaults quando o arquivo faltava,
// contra o protocolo de `references/defaults.md`. Num HOME efêmero (nuvem) isso virava um
// questionário a cada sessão. Vale para as duas distribuições: a cópia Codex sai do sync, mas
// as skills nativas são escritas à mão.
test('nenhuma doc do odin manda perguntar só porque o arquivo de defaults falta', () => {
  const CODEX_DIR = resolve(PLUGIN_DIR, '..', '..', 'codex', 'plugins', 'odin');
  const ofensores = [];
  for (const raiz of [PLUGIN_DIR, CODEX_DIR]) {
    for (const arquivo of arquivosMd(raiz)) {
      if (arquivo.endsWith('CHANGELOG.md')) continue;
      readFileSync(arquivo, 'utf8').split(/\r?\n/).forEach((linha, i) => {
        if (/arquivo (ou campo )?ausente\s*→\s*perguntar/i.test(linha)) ofensores.push(`${relative(raiz, arquivo)}:${i + 1}`);
      });
    }
  }
  assert.deepEqual(ofensores, [], `defaults ausentes não são motivo de pergunta:\n${ofensores.join('\n')}`);
});

// ODIN-07: command de plugin não ganha "Base directory"; path relativo resolve contra o cwd
// do projeto consumidor, onde a reference não existe. Só `${CLAUDE_PLUGIN_ROOT}` é resolvido.
test('commands citam references do plugin por ${CLAUDE_PLUGIN_ROOT}, e o alvo existe', () => {
  const ofensores = [];
  const COMMANDS = join(PLUGIN_DIR, 'commands');
  for (const nome of readdirSync(COMMANDS).filter((n) => n.endsWith('.md'))) {
    const texto = readFileSync(join(COMMANDS, nome), 'utf8');
    for (const m of texto.matchAll(/(\$\{CLAUDE_PLUGIN_ROOT\}\/)?(skills\/[\w-]+\/references\/[\w.-]+\.md)/g)) {
      if (!m[1]) ofensores.push(`commands/${nome}: ${m[2]} sem \${CLAUDE_PLUGIN_ROOT}/`);
      else if (!statSync(join(PLUGIN_DIR, m[2]), { throwIfNoEntry: false })) ofensores.push(`commands/${nome}: ${m[2]} não existe`);
    }
  }
  assert.deepEqual(ofensores, [], ofensores.join('\n'));
});

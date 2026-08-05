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

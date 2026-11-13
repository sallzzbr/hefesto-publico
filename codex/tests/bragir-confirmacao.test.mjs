// CX-01 no bragir: a planejar-agenda Claude mostra a tabela e pede confirmação antes de gravar o
// calendário; a skill nativa Codex tratava o pedido como autorização ("escreva se a atualização já
// estiver autorizada") e gravava direto. Decisão do dono (2026-11-02): o Codex mostra o que vai
// gravar e pede ok, salvo o usuário dizer explicitamente na sessão que pode gravar sem mostrar.
// O RUNTIME.md encerra o turno ao perguntar; a skill exige a prévia por escrita.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const CODEX = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(CODEX, '..');
const nativa = readFileSync(join(CODEX, 'plugins', 'bragir', 'skills', 'planejar-agenda', 'SKILL.md'), 'utf8');
const claude = readFileSync(join(REPO, 'plugins', 'bragir', 'skills', 'planejar-agenda', 'SKILL.md'), 'utf8');

// Parágrafos desembrulhados e partidos em frases: o markdown quebra a frase no meio da linha.
const frases = (texto) => texto.split(/\r?\n\s*\r?\n/)
  .map((p) => p.replace(/\s*\r?\n\s*/g, ' ').trim())
  .flatMap((p) => p.split(/(?<=[.!?])\s+/))
  .filter(Boolean);

test('planejar-agenda nativa mostra o que vai gravar e pede ok antes de escrever no calendário', () => {
  const previa = frases(nativa).find((f) => /mostre/i.test(f) && /pe[çc]a ok|pe[çc]a confirma/i.test(f) && /antes de (escrever|gravar)/i.test(f));
  assert.ok(previa, 'falta a frase que manda mostrar a tabela e pedir ok antes de gravar');
  assert.match(claude, /pe[çc]a confirma[çc][ãa]o\*{0,2} antes de escrever/i, 'a skill Claude perdeu a confirmação que a nativa espelha');
});

test('o pedido de planejar não autoriza gravar; só a dispensa explícita na sessão pula a prévia', () => {
  const ditas = frases(nativa);
  assert.ok(ditas.some((f) => /pedido[^.]*n[ãa]o autoriza gravar/i.test(f)), 'falta dizer que o pedido de planejar não é autorização para gravar');
  const dispensa = ditas.find((f) => /sem mostrar/i.test(f) && /explicitamente/i.test(f));
  assert.ok(dispensa, 'falta a única exceção: dispensa explícita para gravar sem mostrar');
  assert.match(dispensa, /nesta sess[ãa]o/i, 'a dispensa vale só na sessão em que foi dada');
  // O cabeçalho já diz que "entrypoint e runtime prevalecem"; a frase cobrada é a que põe esta
  // regra acima do reaproveitamento de autorização do RUNTIME.md.
  assert.ok(ditas.some((f) => /prevalece\s+sobre/i.test(f) && /reaproveitamento de autoriza/i.test(f)), 'falta declarar que a regra da skill prevalece sobre o reaproveitamento de autorização do runtime');
});

test('nenhuma escrita condicionada a autorização genérica', () => {
  assert.doesNotMatch(nativa, /(escreva|grave)\s+se\s+[^.]*j[áa]\s+(estiver|for)\s+autorizad/i, 'voltou o atalho "escreva se já estiver autorizado"');
  for (const f of frases(nativa).filter((x) => /autoriza/i.test(x))) {
    assert.match(f, /n[ãa]o autoriza|sem mostrar|prevalece/i, `frase de autorização sem a ressalva da prévia: ${f}`);
  }
});

test('mudar status de rascunhos é mutação separada com a mesma confirmação', () => {
  const rascunho = frases(nativa).find((f) => /rascunho/i.test(f) && /frontmatter|status/i.test(f));
  assert.ok(rascunho, 'falta a regra para o frontmatter dos rascunhos');
  assert.match(rascunho, /pe[çc]a ok|confirma/i, `mutação de rascunho sem confirmação: ${rascunho}`);
});

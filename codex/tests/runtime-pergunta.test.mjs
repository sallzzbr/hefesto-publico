// Decisão 19A do dono (2026-11-03): a regra de pergunta que só existia nas skills nativas do Odin
// e no contrato de conversa dele vai para o RUNTIME.md de todos os pacotes Codex. Pergunta
// necessária é curta e completa; o trabalho que não depende dela vem antes; ela fecha a mensagem
// e encerra o turno; depois dela nada continua executando; o que dá para verificar por leitura ou
// comando não vira pergunta.
// Este teste trava a instrução escrita, não o comportamento do agente: prova que todo RUNTIME.md
// lido pelas skills nativas traz a regra, não que o modelo a cumpre numa sessão real.
// Os pacotes vêm do marketplace Codex, não de lista fixa: pacote novo entra na cobrança sozinho.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const CODEX = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const marketplace = JSON.parse(readFileSync(join(CODEX, '.agents', 'plugins', 'marketplace.json'), 'utf8'));
const pacotes = (marketplace.plugins ?? []).map((p) => ({ nome: p.name, raiz: resolve(CODEX, p.source.path) }));

const TITULO = '## Perguntas ao usuário';
// Seção dedicada, desembrulhada: o markdown pode quebrar a frase no meio da linha.
function secao(texto) {
  const inicio = texto.indexOf(`\n${TITULO}\n`);
  if (inicio < 0) return null;
  const corpo = texto.slice(inicio + TITULO.length + 2);
  const fim = corpo.search(/^## /m);
  return (fim < 0 ? corpo : corpo.slice(0, fim)).replace(/\s+/g, ' ').trim();
}

test('o marketplace Codex lista todos os pacotes com manifesto, e é dele que a cobrança parte', () => {
  assert.ok(pacotes.length > 0, 'marketplace sem pacotes: o laço abaixo passaria sem ler nenhum RUNTIME.md');
  const comManifesto = readdirSync(join(CODEX, 'plugins'), { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(CODEX, 'plugins', e.name, '.codex-plugin', 'plugin.json')))
    .map((e) => e.name).sort();
  assert.deepEqual(pacotes.map((p) => p.nome).sort(), comManifesto, 'pacote fora do marketplace ficaria sem a regra cobrada');
});

for (const { nome, raiz } of pacotes) {
  test(`${nome}: RUNTIME.md manda perguntar só o necessário, depois do trabalho independente, e encerrar o turno`, () => {
    const caminho = join(raiz, 'RUNTIME.md');
    assert.ok(existsSync(caminho), `codex/plugins/${nome}/RUNTIME.md ausente`);
    const regra = secao(readFileSync(caminho, 'utf8'));
    assert.ok(regra, `codex/plugins/${nome}/RUNTIME.md sem a seção "${TITULO}"`);
    assert.match(regra, /n[ãa]o pergunte o que d[áa] para verificar por leitura ou comando/i, `${nome}: falta não perguntar o verificável`);
    assert.match(regra, /antes da pergunta[^.]*trabalho que n[ãa]o depende da resposta/i, `${nome}: falta fazer antes o trabalho independente`);
    assert.match(regra, /pergunta necess[áa]ria [ée] curta e completa/i, `${nome}: falta a pergunta curta e completa`);
    assert.match(regra, /fecha a mensagem e encerra o turno/i, `${nome}: falta fechar a mensagem e encerrar o turno`);
    assert.match(regra, /depois da pergunta, n[ãa]o continue executando/i, `${nome}: falta não continuar executando depois de perguntar`);
    // Linguagem neutra de domínio: a regra vale para todo pacote, sem vocabulário só do Odin.
    assert.doesNotMatch(regra, /\bLog\b|\bargs\b|\bOdin\b|\bSPEC\b|baseRef|\[pendente\]/, `${nome}: a regra comum cita termo só do Odin`);
  });

  // O RUNTIME genérico manda perguntar "com a ferramenta de interação disponível ou uma pergunta
  // direta", e a sessão de qualquer pacote pode ter essa ferramenta. Pela ferramenta, a resposta
  // volta no mesmo turno: "encerra o turno" sem ressalva proibiria seguir depois que ela chega.
  // Cada frase que encerra o turno fica restrita à pergunta direta, a ferramenta de interação é
  // nomeada, e o "não continue executando" vale até a resposta chegar. Trava a instrução escrita.
  test(`${nome}: RUNTIME.md diz como a pergunta termina na pergunta direta e na ferramenta de interação`, () => {
    const regra = secao(readFileSync(join(raiz, 'RUNTIME.md'), 'utf8'));
    assert.ok(regra, `codex/plugins/${nome}/RUNTIME.md sem a seção "${TITULO}"`);
    const frases = regra.split(/(?<=[.!?])\s+/);
    const encerram = frases.filter((f) => /encerra o turno/i.test(f));
    assert.ok(encerram.length > 0, `${nome}: nenhuma frase encerra o turno`);
    for (const f of encerram) assert.match(f, /pergunta direta/i, `${nome}: encerra o turno sem restringir à pergunta direta: ${f}`);
    assert.ok(frases.some((f) => /ferramenta de intera[çc][ãa]o/i.test(f) && /mesmo turno/i.test(f)), `${nome}: falta dizer que pela ferramenta de interação a resposta volta no mesmo turno`);
    const parar = frases.filter((f) => /n[ãa]o continue executando/i.test(f));
    assert.ok(parar.length > 0, `${nome}: falta não continuar executando depois de perguntar`);
    for (const f of parar) assert.match(f, /antes de a resposta chegar|at[ée] a resposta chegar/i, `${nome}: "não continue executando" sem limite na chegada da resposta: ${f}`);
  });
}

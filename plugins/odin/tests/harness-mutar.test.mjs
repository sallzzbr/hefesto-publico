// Fase Mutar do harness do dev-loop (odin 3.1.0), vista rodando: o corpo do `loop.mjs` é embrulhado
// num AsyncFunction com agentes falsos por label (ver `support/mutar-fixtures.mjs`). O script real
// de mutantes é medido em `mutantes.test.mjs`; aqui o agente falso do mecânico devolve o JSON dele,
// com a conferência (CRC-32) calculada fora do harness.
//
// Contrato assumido pelos casos (fixado no apoio): resultado do mutante 'morto' ou 'sobrevivente',
// JSON do script nos campos de topo da resposta do mecânico, campos do relatório `mutacao`
// (status, candidatos, amostrados, mortos, sobreviventes, equivalentes), `paraConferir` e `numeros`.

import assert from 'node:assert/strict';
import test from 'node:test';
import { pathsDoComandoDeHashes } from './support/quality-fixtures.mjs';
import {
  ARGS, SHA_BASE, TESTE, argumentosDoComandoMutar, medicoes, mutante, numerosDe, qtd, rodarMutar,
} from './support/mutar-fixtures.mjs';

const COMANDO_SPEC = `node --test --test-name-pattern=C1 ${TESTE}`;
const repro = (path = TESTE) => ({ criterio: 'C1', path, tipo: 'reproducao', comando: COMANDO_SPEC, motivoFalha: 'falta implementação' });
const IMPL_OK = { status: 'concluida', resumo: 'ok', escada: [{ item: 'fn', degrau: 7, porque: 'nada reusável' }], arquivosTocados: ['src/a.js'] };
const REFORCO = 'tests/reforco-a.test.js';
const COMANDO_REFORCO = `node --test ${REFORCO}`;
const SOBREVIVENTE = mutante(2, 'sobrevivente', { de: 'a >= b', para: 'a < b' });
const MORTO_2 = { ...SOBREVIVENTE, resultado: 'morto' };
// O mesmo mutante derrubado pelo comando do reforço (só assim o reforço vale).
const MORTO_2_PELO_REFORCO = { ...MORTO_2, mortoPor: COMANDO_REFORCO };
const soNumero = (c, n) => c.label.endsWith(`:i${n}`);
const mutacaoDe = r => r.resultado.mutacao ?? {};
const textoDe = v => JSON.stringify(v ?? null);
const implDaChamada = (chamadas, n) => chamadas.filter(c => c.label.startsWith('impl:'))[n];

test('A1: perfil balanceado mede mutação depois da revisão, com um comando único do script e a base da entrega', async () => {
  const { resultado, chamadas } = await rodarMutar({
    args: { ...ARGS, baseRef: SHA_BASE, pendenciasPath: 'docs/pendencias.md' },
    overrides: { 'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [repro()], apoio: ['tests/helper.mjs'] }) },
    mutar: c => c.evidencia({ candidatos: 7, amostrados: 4, mutantes: [mutante(1), mutante(2), mutante(3), mutante(4)] }),
  });
  assert.equal(resultado.status, 'verde', textoDe(resultado));
  const medidas = medicoes(chamadas);
  assert.deepEqual(medidas.map(c => c.label), ['mutar:medir:i1']);
  const rotulos = chamadas.map(c => c.label);
  const posMutar = rotulos.indexOf('mutar:medir:i1');
  for (const l of rotulos.filter(l => l.startsWith('rev:') || l.startsWith('ponytail:'))) assert.ok(rotulos.indexOf(l) < posMutar, `${l} vem antes da fase Mutar`);
  const prompt = medidas[0].prompt;
  assert.equal(prompt.match(/medir\s+'?[0-9a-f]{40}/g)?.length, 1, 'um único comando de mutantes.mjs medir');
  const a = argumentosDoComandoMutar(prompt);
  assert.equal(a.base, SHA_BASE);
  for (const excluido of [TESTE, 'tests/helper.mjs', 'docs/plans/spec.md', 'docs/pendencias.md']) assert.ok(a.excluidos.includes(excluido), `excluídos sem ${excluido}: ${a.excluidos}`);
  assert.deepEqual(a.comandos, [COMANDO_SPEC], 'só os comandos dos testes da SPEC (e reforços aceitos), não as validações do projeto');
  assert.equal(medidas[0].opts.agentType, chamadas.find(c => c.label === 'validar:i1').opts.agentType, 'o mecânico mede, como nas validações');
  const m = mutacaoDe({ resultado });
  assert.equal(m.candidatos, 7);
  assert.equal(m.amostrados, 4);
  assert.equal(qtd(m.mortos), 4);
  assert.equal(qtd(m.sobreviventes), 0);
});

test('A1: sem baseRef o comando usa HEAD', async () => {
  const { chamadas } = await rodarMutar({});
  assert.equal(medicoes(chamadas).length, 1, 'a fase Mutar roda no perfil balanceado');
  assert.equal(argumentosDoComandoMutar(medicoes(chamadas)[0].prompt).base, 'HEAD');
});

test('A1-controle: iteração que não fecharia verde não mede mutação', async () => {
  const { resultado, chamadas } = await rodarMutar({ overrides: {
    'validar:': (o) => ({ qualityExecutions: [], verde: false, falhas: [{ comando: 'npm test', resumo: 'falhou' }], execucoes: [], hashesDosTestes: {} }),
  } });
  assert.notEqual(resultado.status, 'verde');
  assert.equal(medicoes(chamadas).length, 0, 'sem validação verde não há o que mutar');
});

test('A2: perfil econômico não chama a fase Mutar e registra nao-medida por perfil', async () => {
  const { resultado, chamadas } = await rodarMutar({ args: { ...ARGS, perfil: 'economico' } });
  assert.equal(resultado.status, 'verde');
  assert.equal(medicoes(chamadas).length, 0);
  assert.ok(!chamadas.some(c => /^(mutar|confirmar:mutante)/.test(c.label)), 'nenhuma chamada da fase');
  assert.equal(mutacaoDe({ resultado }).status, 'nao-medida');
  assert.match(textoDe(resultado.mutacao), /perfil economico/);
});

test('A4: sobrevivente real volta ao operário com path:linha, a troca e o pedido de reforço; o reforço só vale com o mutante morto', async () => {
  let impls = 0;
  const { resultado, chamadas } = await rodarMutar({
    overrides: { 'impl:': () => (++impls === 1 ? IMPL_OK : { ...IMPL_OK, arquivosTocados: ['src/a.js', REFORCO], reforcos: [{ path: REFORCO, comando: COMANDO_REFORCO, mutante: SOBREVIVENTE.id }] }) },
    mutar: c => c.evidencia({ candidatos: 5, amostrados: 2, mutantes: [mutante(1), c.iteracao === 1 ? SOBREVIVENTE : MORTO_2] }),
    confirmarMutante: () => ({ real: true, porque: 'com a igual a b a saída muda' }),
  });
  assert.equal(resultado.status, 'verde', textoDe(resultado));
  assert.equal(resultado.iteracoes, 2);
  const correcao = implDaChamada(chamadas, 1).prompt;
  assert.ok(correcao.includes('src/a.js:4'), 'path:linha do sobrevivente');
  assert.ok(correcao.includes('a >= b') && correcao.includes('a < b'), 'a troca feita');
  assert.match(correcao, /refor[cç]o/i, 'pede caso novo em arquivo de reforço');
  const [primeira, segunda] = [medicoes(chamadas, 1)[0], medicoes(chamadas, 2)[0]].map(c => argumentosDoComandoMutar(c.prompt));
  assert.deepEqual(primeira.comandos, [COMANDO_SPEC]);
  assert.deepEqual(segunda.comandos, [COMANDO_SPEC, COMANDO_REFORCO], 'o comando do reforço entra depois dos da SPEC');
  assert.ok(segunda.excluidos.includes(REFORCO), 'o reforço não é mutado');
  assert.ok(!primeira.excluidos.includes(REFORCO));
});

test('A4: reforço aceito é protegido por hash nas validações seguintes (reforco-intacto)', async () => {
  let impls = 0;
  const { resultado, chamadas } = await rodarMutar({
    letraDoReforco: iteracao => (iteracao >= 3 ? 'f' : 'e'),
    overrides: { 'impl:': () => (++impls === 2 ? { ...IMPL_OK, arquivosTocados: ['src/a.js', REFORCO], reforcos: [{ path: REFORCO, comando: COMANDO_REFORCO, mutante: SOBREVIVENTE.id }] } : IMPL_OK) },
    // i1: um sobrevivente; i2: o do reforço morre e surge outro, então a iteração 3 acontece.
    mutar: c => c.evidencia({ candidatos: 5, amostrados: 3, mutantes: c.iteracao === 1 ? [mutante(1), SOBREVIVENTE] : [mutante(1), MORTO_2_PELO_REFORCO, mutante(3, 'sobrevivente')] }),
    confirmarMutante: () => ({ real: true, porque: 'muda a saída' }),
  });
  assert.equal(resultado.status, 'escalado', textoDe(resultado));
  const v3 = chamadas.find(c => c.label === 'validar:i3');
  assert.ok(pathsDoComandoDeHashes(v3.prompt).includes(REFORCO), 'a validação seguinte pede o hash do reforço aceito');
  const achados = resultado.historico.flatMap(h => h.findings);
  assert.ok(achados.some(f => f.origem === 'reforco-intacto' && f.arquivo === REFORCO), textoDe(achados));
});

test('A4: reforço em path proibido (teste da SPEC) é recusado e volta como correção, sem entrar nos comandos', async () => {
  const forjado = { path: TESTE, comando: `node --test --test-name-pattern=forjado ${TESTE}`, mutante: SOBREVIVENTE.id };
  const { resultado, chamadas } = await rodarMutar({
    overrides: { 'impl:': () => ({ ...IMPL_OK, reforcos: [forjado] }) },
    mutar: c => c.evidencia({ candidatos: 3, amostrados: 2, mutantes: [mutante(1), SOBREVIVENTE] }),
    confirmarMutante: () => ({ real: true, porque: 'muda a saída' }),
  });
  assert.equal(resultado.status, 'escalado');
  for (const c of medicoes(chamadas)) assert.ok(!c.prompt.includes('forjado'), 'comando do reforço recusado não é medido');
  assert.ok(resultado.historico.flatMap(h => h.findings).some(f => /refor[cç]o/i.test(textoDe(f)) && textoDe(f).includes(TESTE)), textoDe(resultado.historico));
});

test('A5: sobrevivente equivalente não bloqueia e aparece em equivalentes com o porquê do revisor', async () => {
  const { resultado, chamadas } = await rodarMutar({
    mutar: c => c.evidencia({ candidatos: 4, amostrados: 3, mutantes: [mutante(1), mutante(3), SOBREVIVENTE] }),
    confirmarMutante: () => ({ real: false, porque: 'a troca só altera a mensagem de log' }),
  });
  assert.equal(resultado.status, 'verde', textoDe(resultado));
  assert.equal(resultado.iteracoes, 1);
  const confirmacao = chamadas.find(c => c.label === 'confirmar:mutante:i1');
  assert.ok(confirmacao, 'cada sobrevivente vai ao confirmador');
  assert.ok(confirmacao.prompt.includes('src/a.js:4') && confirmacao.prompt.includes('a >= b') && confirmacao.prompt.includes('a < b'));
  assert.equal(confirmacao.opts.agentType, chamadas.find(c => c.label === 'rev:corretude:i1').opts.agentType, 'quem confirma é o revisor');
  const m = mutacaoDe({ resultado });
  assert.equal(qtd(m.sobreviventes), 0);
  assert.equal(qtd(m.equivalentes), 1);
  assert.match(textoDe(m.equivalentes), /só altera a mensagem de log/);
  assert.match(textoDe(m.equivalentes), /src\/a\.js/);
});

test('A5: confirmador de mutante que não retorna é erro nomeado, não verde', async () => {
  const { resultado } = await rodarMutar({
    mutar: c => c.evidencia({ candidatos: 3, amostrados: 2, mutantes: [mutante(1), SOBREVIVENTE] }),
    confirmarMutante: () => null,
  });
  assert.equal(resultado.status, 'erro');
});

test('A6: sobrevivente real que persiste até o teto escala com path:linha, troca, testes que rodaram e ação de reforço', async () => {
  const { resultado, chamadas } = await rodarMutar({
    mutar: c => c.evidencia({ candidatos: 3, amostrados: 2, mutantes: [mutante(1), SOBREVIVENTE] }),
    confirmarMutante: () => ({ real: true, porque: 'com a igual a b a saída muda' }),
  });
  assert.equal(resultado.status, 'escalado');
  assert.notEqual(resultado.status, 'erro');
  assert.equal(medicoes(chamadas).length, 3, 'cada iteração que chega verde mede de novo, até o teto');
  const sobreviventes = mutacaoDe({ resultado }).sobreviventes;
  assert.equal(qtd(sobreviventes), 1);
  const texto = textoDe(sobreviventes);
  assert.ok(texto.includes('src/a.js') && /\b4\b/.test(texto), 'path:linha');
  assert.ok(texto.includes('a >= b') && texto.includes('a < b'), 'a troca');
  assert.ok(texto.includes(COMANDO_SPEC), 'os testes que rodaram');
  assert.match(resultado.acao, /refor[cç]/i);
  const achados = resultado.historico.flatMap(h => h.findings);
  assert.ok(achados.some(f => f.natureza === 'mutacao' && f.arquivo === 'src/a.js' && f.linha === 4), textoDe(achados));
});

const naoMedida = { status: 'verde', iteracoes: 1 };
const casosDeNaoMedicao = [
  ['controle sem mutante falha', c => c.evidencia({ controleOk: false, mutantes: [], candidatos: 5, amostrados: 0 }), /controle/i],
  ['cópia não removida', c => c.evidencia({ removida: false }), /remov|c[oó]pia/i],
  ['worktree não ficou intacta', c => c.evidencia({ worktreeIntacta: false }), /worktree/i],
  ['nenhum candidato', c => c.evidencia({ mutantes: [], candidatos: 0, amostrados: 0 }), /candidat/i],
  ['script sem resposta', () => null, /./],
  ['conferência errada nas duas tentativas', c => ({ ...c.evidencia({}), conferencia: 'deadbeef' }), /confer|evid[eê]ncia/i],
];
for (const [nome, mutar, causa] of casosDeNaoMedicao) {
  test(`A7: ${nome} vira nao-medida com a causa e o run segue o desfecho que teria sem a fase`, async () => {
    const { resultado, chamadas } = await rodarMutar({ mutar });
    assert.equal(resultado.status, naoMedida.status, textoDe(resultado));
    assert.equal(resultado.iteracoes, naoMedida.iteracoes);
    const m = mutacaoDe({ resultado });
    assert.equal(m.status, 'nao-medida');
    assert.match(textoDe(m), causa);
    assert.ok(!qtd(m.mortos), 'ambiente e evidência ruim nunca viram mutante morto');
    assert.ok(!/100\s*%/.test(textoDe(m)), 'zero candidato nunca vira "100% morto"');
    assert.ok(!chamadas.some(c => c.label.startsWith('confirmar:mutante')));
  });
}

test('A7: evidência que não confere ganha uma única recoleta, e a segunda vale', async () => {
  const { resultado, chamadas } = await rodarMutar({ mutar: c => (c.tentativa === 1 ? { ...c.evidencia({}), conferencia: 'deadbeef' } : c.evidencia({})) });
  assert.equal(medicoes(chamadas, 1).length, 2);
  assert.equal(resultado.status, 'verde');
  assert.notEqual(mutacaoDe({ resultado }).status, 'nao-medida');
  assert.equal(qtd(mutacaoDe({ resultado }).mortos), 2);
});

test('A7: evidência que não confere nem na recoleta chama o mecânico só duas vezes', async () => {
  const { chamadas } = await rodarMutar({ mutar: c => ({ ...c.evidencia({}), conferencia: 'deadbeef' }) });
  assert.equal(medicoes(chamadas, 1).length, 2);
});

test('A7: reforço declarado cujo comando falha no controle volta ao operário como correção', async () => {
  let impls = 0;
  const { resultado, chamadas } = await rodarMutar({
    overrides: { 'impl:': () => (++impls === 2 ? { ...IMPL_OK, arquivosTocados: ['src/a.js', REFORCO], reforcos: [{ path: REFORCO, comando: COMANDO_REFORCO, mutante: SOBREVIVENTE.id }] } : IMPL_OK) },
    mutar: c => {
      if (c.iteracao === 1) return c.evidencia({ candidatos: 3, amostrados: 2, mutantes: [mutante(1), SOBREVIVENTE] });
      if (c.iteracao === 2) return c.evidencia({ controleOk: false, mutantes: [], candidatos: 3, amostrados: 0, execucoes: c.comandos.map(comando => ({ comando, exitCode: comando === COMANDO_REFORCO ? 1 : 0 })) });
      return c.evidencia({ candidatos: 3, amostrados: 2, mutantes: [mutante(1), MORTO_2] });
    },
    confirmarMutante: () => ({ real: true, porque: 'muda a saída' }),
  });
  assert.equal(resultado.status, 'verde', textoDe(resultado));
  assert.equal(resultado.iteracoes, 3, 'a iteração 2 não fecha como nao-medida: o reforço quebrado volta como correção');
  const correcao = implDaChamada(chamadas, 2).prompt;
  assert.ok(correcao.includes(REFORCO) || correcao.includes(COMANDO_REFORCO), 'a correção cita o reforço que falhou no controle');
});

const rev = (label, resumo) => label === 'rev:corretude:i1'
  ? { findings: [{ arquivo: 'src/a.js', linha: 2, resumo, cenario: 'entrada nula', severidade: 'bloqueante', confianca: 'plausivel' }] }
  : { findings: [] };

test('A8: verde traz paraConferir com no máximo três linhas, na prioridade da SPEC, e numeros', async () => {
  const { resultado } = await rodarMutar({
    overrides: { 'rev:': (o) => rev(o.label, 'falta checagem de nulo') },
    confirmarFinding: () => ({ real: false, porque: 'a entrada nula é validada antes' }),
    mutar: c => c.evidencia({ candidatos: 7, amostrados: 4, linhasAcrescentadas: { 'src/a.js': 5, 'src/b.js': 9 }, mutantes: [mutante(1), mutante(3), mutante(4), SOBREVIVENTE] }),
    confirmarMutante: () => ({ real: false, porque: 'a troca só altera o log' }),
  });
  assert.equal(resultado.status, 'verde', textoDe(resultado));
  const linhas = resultado.paraConferir;
  assert.ok(Array.isArray(linhas) && linhas.length === 3, textoDe(linhas));
  assert.match(linhas[0], /equivalente/i, 'primeiro: mutação com equivalentes');
  assert.ok(linhas[1].includes('falta checagem de nulo'), 'segundo: finding bloqueante refutado');
  assert.ok(linhas[2].includes('src/b.js') && linhas[2].includes('inspecionar-git.mjs') && linhas[2].includes('diff'), 'terceiro: arquivo com mais linhas acrescentadas e o comando do diff');
  const numeros = numerosDe(resultado.numeros);
  for (const n of [7, 4, 3, 1]) assert.ok(numeros.includes(n), `numeros sem ${n}: ${textoDe(resultado.numeros)}`);
});

test('A8: mutação medida e sem ressalvas deixa só a linha do arquivo com mais linhas acrescentadas', async () => {
  const { resultado } = await rodarMutar({
    mutar: c => c.evidencia({ linhasAcrescentadas: { 'src/a.js': 5, 'src/b.js': 9 } }),
  });
  assert.equal(resultado.status, 'verde');
  assert.ok(Array.isArray(resultado.paraConferir), 'o relatório traz paraConferir');
  assert.equal(resultado.paraConferir.length, 1);
  assert.ok(resultado.paraConferir[0].includes('src/b.js'));
});

test('A8: sem medição (perfil econômico) a linha de arquivo não aparece e a mutação não medida vem primeiro', async () => {
  const { resultado } = await rodarMutar({ args: { ...ARGS, perfil: 'economico' } });
  assert.equal(resultado.status, 'verde');
  assert.ok(Array.isArray(resultado.paraConferir), 'o relatório traz paraConferir');
  assert.match(resultado.paraConferir[0], /n[aã]o medida/i);
  assert.ok(!resultado.paraConferir.some(l => l.includes('inspecionar-git.mjs')));
  assert.ok(resultado.paraConferir.length <= 3);
});

test('A8: escalado também traz paraConferir e numeros', async () => {
  const { resultado } = await rodarMutar({
    mutar: c => c.evidencia({ candidatos: 3, amostrados: 2, mutantes: [mutante(1), SOBREVIVENTE] }),
    confirmarMutante: () => ({ real: true, porque: 'muda a saída' }),
  });
  assert.equal(resultado.status, 'escalado');
  assert.ok(Array.isArray(resultado.paraConferir) && resultado.paraConferir.length >= 1 && resultado.paraConferir.length <= 3);
  assert.ok(numerosDe(resultado.numeros).includes(3), textoDe(resultado.numeros));
});

test('A4: reforço não é aceito quando o mutante citado morre por outro comando (mortoPor), nem protegido por hash', async () => {
  let impls = 0;
  const { resultado, chamadas } = await rodarMutar({
    overrides: { 'impl:': () => (++impls === 2 ? { ...IMPL_OK, arquivosTocados: ['src/a.js', REFORCO], reforcos: [{ path: REFORCO, comando: COMANDO_REFORCO, mutante: SOBREVIVENTE.id }] } : IMPL_OK) },
    // i2: o mesmo id aparece morto, mas pelo comando da SPEC (o id é posicional: a linha pode ser outra troca);
    // surge outro sobrevivente para a iteração 3 acontecer e mostrar se o reforço ganhou hash.
    mutar: c => c.evidencia({ candidatos: 5, amostrados: 3, mutantes: c.iteracao === 1 ? [mutante(1), SOBREVIVENTE] : [mutante(1), { ...MORTO_2, mortoPor: COMANDO_SPEC }, mutante(3, 'sobrevivente')] }),
    confirmarMutante: () => ({ real: true, porque: 'muda a saída' }),
  });
  assert.equal(resultado.status, 'escalado', textoDe(resultado));
  const v3 = chamadas.find(c => c.label === 'validar:i3');
  assert.ok(!(pathsDoComandoDeHashes(v3.prompt) ?? []).includes(REFORCO), 'reforço que não derrubou o mutante não é congelado por hash');
  const declarado = (resultado.mutacao?.reforcos ?? []).find(x => x.path === REFORCO);
  assert.equal(declarado?.aceito, false, textoDe(resultado.mutacao));
});

test('A4: mutante morto sem mortoPor, ou com mortoPor fora dos comandos pedidos, é evidência inválida (nao-medida)', async () => {
  for (const mortoPor of [undefined, 'node --test outro.test.js']) {
    const { resultado } = await rodarMutar({
      // A chave presente (mesmo undefined, que some no JSON) impede o apoio de preencher o default.
      mutar: c => c.evidencia({ mutantes: [{ ...mutante(1), mortoPor }], candidatos: 1, amostrados: 1 }),
    });
    const m = mutacaoDe({ resultado });
    assert.equal(m.status, 'nao-medida', `mortoPor ${mortoPor}: ${textoDe(m)}`);
    assert.match(textoDe(m.causa), /mortoPor/);
  }
});

// Decisão do dono (2026-11-16): sobrevivente real só sai de cena com prova. A medição seguinte recebe a
// mesma troca (path, trecho, operador, de, para) em --prioridade; se ela não reaparece, o run não fecha verde.
const MESMA_TROCA_EM_6 = { ...MORTO_2, id: 'src/a.js:6:comparacao:0', linha: 6 };

test('A4: o sobrevivente real pendente vai em --prioridade na medição seguinte, identificado pelo trecho e pela troca', async () => {
  const { resultado, chamadas } = await rodarMutar({
    mutar: c => c.evidencia({ candidatos: 5, amostrados: 2, mutantes: [mutante(1), c.iteracao === 1 ? SOBREVIVENTE : MORTO_2] }),
    confirmarMutante: () => ({ real: true, porque: 'muda a saída' }),
  });
  assert.equal(resultado.status, 'verde', textoDe(resultado));
  assert.deepEqual(argumentosDoComandoMutar(medicoes(chamadas, 1)[0].prompt).prioridade, []);
  const [pendente] = argumentosDoComandoMutar(medicoes(chamadas, 2)[0].prompt).prioridade;
  assert.deepEqual(pendente, { path: SOBREVIVENTE.path, trecho: SOBREVIVENTE.trecho, operador: SOBREVIVENTE.operador, de: SOBREVIVENTE.de, para: SOBREVIVENTE.para });
});

test('A4: sobrevivente real que some da medição seguinte (linha mudou ou saiu da amostra) bloqueia até o teto', async () => {
  const { resultado } = await rodarMutar({
    mutar: c => c.evidencia({ candidatos: 5, amostrados: 1, mutantes: c.iteracao === 1 ? [SOBREVIVENTE] : [mutante(1)] }),
    confirmarMutante: () => ({ real: true, porque: 'muda a saída' }),
  });
  assert.equal(resultado.status, 'escalado', textoDe(resultado));
  const achados = resultado.historico.filter(h => h.iteracao > 1).flatMap(h => h.findings);
  assert.ok(achados.some(f => f.natureza === 'mutacao' && textoDe(f).includes(SOBREVIVENTE.trecho)), textoDe(achados));
  assert.match(resultado.acao, /não reapareceram/, 'a ação do escalado nomeia o pendente sem prova');
});

test('A4: o reforço vale pela mesma troca mesmo quando o id muda de linha', async () => {
  let impls = 0;
  const { chamadas } = await rodarMutar({
    overrides: { 'impl:': () => (++impls === 2 ? { ...IMPL_OK, arquivosTocados: ['src/a.js', REFORCO], reforcos: [{ path: REFORCO, comando: COMANDO_REFORCO, mutante: SOBREVIVENTE.id }] } : IMPL_OK) },
    mutar: c => c.evidencia({ candidatos: 5, amostrados: 3, mutantes: c.iteracao === 1 ? [mutante(1), SOBREVIVENTE] : [mutante(1), { ...MESMA_TROCA_EM_6, mortoPor: COMANDO_REFORCO }, mutante(7, 'sobrevivente')] }),
    confirmarMutante: () => ({ real: true, porque: 'muda a saída' }),
  });
  const v3 = chamadas.find(c => c.label === 'validar:i3');
  assert.ok(v3, 'a iteração 3 acontece');
  assert.ok(pathsDoComandoDeHashes(v3.prompt).includes(REFORCO), 'o reforço que derrubou a mesma troca é congelado por hash');
});

test('A4: com sobrevivente real pendente, medição nao-medida não fecha verde', async () => {
  const { resultado } = await rodarMutar({
    mutar: c => (c.iteracao === 1
      ? c.evidencia({ candidatos: 3, amostrados: 2, mutantes: [mutante(1), SOBREVIVENTE] })
      : c.evidencia({ controleOk: false, mutantes: [], candidatos: 3, amostrados: 0 })),
    confirmarMutante: () => ({ real: true, porque: 'muda a saída' }),
  });
  assert.notEqual(resultado.status, 'verde', textoDe(resultado));
});

test('A1: o pedido de medição manda rodar em segundo plano e esperar o fim, sem o timeout padrão do Bash', async () => {
  const { chamadas } = await rodarMutar({});
  const prompt = medicoes(chamadas)[0].prompt;
  assert.match(prompt, /segundo plano/i, 'a medição leva minutos: o timeout padrão do Bash a mataria e ela viraria nao-medida');
  assert.match(prompt, /esper[ea]/i);
});

// Teste COMPORTAMENTAL do script da skill analisar-produto (hermes 1.4.0, critérios B1-B9).
// O script roda de verdade como processo; fixtures SINTÉTICAS (o plugin é espelhado em repo
// público): nenhum nome real de estampa, e-mail, CPF, telefone ou endereço de pessoa.
//
// Contrato de CLI fixado por estes testes (references/ da skill o documenta):
//   node analisar-produto.mjs --entrada <entrada.json> --saida <dir>
//   - grava <dir>/analise-produto.md e <dir>/analise-produto.csv; exit 0
//   - stdout: JSON { parametros, comparacoes[], juncao, vitrine[] }
//   - PII na entrada: exit != 0, mensagem em stderr, NENHUM arquivo gravado
// Entrada: { periodo, casa_excluida, estampas:[{estampa, raca, estilo, meta_impressoes,
//   meta_cliques, ga4_views, ga4_compras}], catalogo:[{estampa, raca, estilo}], excecoes:[{de, para}],
//   parametros? }. Linha de estampas pode trazer só os campos de UMA fonte (meta_* ou ga4_*).

import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'analisar-produto');
const SCRIPT = join(SKILL_DIR, 'scripts', 'analisar-produto.mjs');

const CSV_CABECALHO = 'estampa,raca,estilo,impressoes,cliques,views,compras,taxa_compra,fatia_impressoes,sinal_vitrine,bloco';

function executar(entrada, { bruto } = {}) {
  assert.ok(existsSync(SCRIPT), `script ausente: ${SCRIPT} (funcionalidade não implementada)`);
  const dir = mkdtempSync(join(tmpdir(), 'hermes-produto-'));
  const arq = join(dir, 'entrada.json');
  writeFileSync(arq, bruto ?? JSON.stringify(entrada));
  const saida = join(dir, 'saida');
  const r = spawnSync(process.execPath, [SCRIPT, '--entrada', arq, '--saida', saida], { encoding: 'utf8' });
  const md = join(saida, 'analise-produto.md');
  const csv = join(saida, 'analise-produto.csv');
  const res = {
    status: r.status, stderr: r.stderr, stdout: r.stdout,
    md: existsSync(md) ? readFileSync(md, 'utf8') : null,
    csv: existsSync(csv) ? readFileSync(csv, 'utf8') : null,
    json: null, dir,
  };
  if (r.status === 0) {
    try { res.json = JSON.parse(r.stdout); } catch { assert.fail(`stdout não é JSON: ${r.stdout.slice(0, 200)}`); }
  }
  return res;
}
const limpar = (r) => rmSync(r.dir, { recursive: true, force: true });
const com = async (entrada, fn, opts) => { const r = executar(entrada, opts); try { return await fn(r); } finally { limpar(r); } };

// linha de ambas as fontes + item de catálogo
const L = (estampa, raca, estilo, imp, cli, views, compras) => ({ estampa, raca, estilo, meta_impressoes: imp, meta_cliques: cli, ga4_views: views, ga4_compras: compras });
const C = (estampa, raca, estilo) => ({ estampa, raca, estilo });
const entrada = (estampas, catalogo, extra = {}) => ({ periodo: '2026-09', casa_excluida: 0, estampas, catalogo, excecoes: [], ...extra });
const secaoAfirmado = (md) => md.split('## Leitura estatística: não comprovado')[0].split('## Leitura estatística: afirmado')[1] ?? '';
const secaoNao = (md) => md.split('## Leitura estatística: não comprovado')[1]?.split(/^## (?!Leitura)/m)[0] ?? '';
const cmp = (json, escopo) => json.comparacoes.find((c) => c.escopo === escopo);

// Duas raças, um estilo, uma estampa por raça. Referências calculadas FORA do script (python, erfc).
function duasRacas(comprasA, viewsA, comprasB, viewsB, extra = {}) {
  return entrada(
    [L('Lua Verde', 'RACA-A', 'X', 1000, 100, viewsA, comprasA), L('Sol Vermelho', 'RACA-B', 'X', 1000, 100, viewsB, comprasB)],
    [C('Lua Verde', 'RACA-A', 'X'), C('Sol Vermelho', 'RACA-B', 'X')], extra,
  );
}

// Paradoxo de Simpson sintético: total difere entre raças; dentro de cada estilo as taxas são iguais.
// Estilo X rende 6%, estilo Y rende 2%. RACA-A concentra X; RACA-B concentra Y.
function simpson(extra = {}) {
  return entrada([
    L('Lua Verde', 'RACA-A', 'X', 50000, 2000, 2000, 120), L('Mar Azul', 'RACA-A', 'X', 50000, 2000, 2000, 120),
    L('Noite Roxa', 'RACA-A', 'Y', 20000, 800, 1000, 20),
    L('Sol Vermelho', 'RACA-B', 'X', 20000, 800, 1000, 60),
    L('Vento Prata', 'RACA-B', 'Y', 50000, 2000, 2000, 40), L('Chuva Cinza', 'RACA-B', 'Y', 50000, 2000, 2000, 40),
  ], [
    C('Lua Verde', 'RACA-A', 'X'), C('Mar Azul', 'RACA-A', 'X'), C('Noite Roxa', 'RACA-A', 'Y'),
    C('Sol Vermelho', 'RACA-B', 'X'), C('Vento Prata', 'RACA-B', 'Y'), C('Chuva Cinza', 'RACA-B', 'Y'),
  ], { casa_excluida: 4, ...extra });
}

// ── B1: teste de duas proporções ─────────────────────────────────────────────
test('B1: z bicaudal bate o valor de referência e p < 0,05 (com poder) vira "comprovado"', async () => {
  // 200/4000 (5,0%) vs 120/4000 (3,0%): z = 4.56435, p = 5.0103e-06 (referência independente)
  await com(duasRacas(200, 4000, 120, 4000), (r) => {
    assert.equal(r.status, 0, r.stderr);
    const c = cmp(r.json, 'total');
    assert.ok(c, 'comparação total ausente');
    assert.ok(Math.abs(Math.abs(c.z) - 4.564354645876385) < 1e-3, `z=${c.z}`);
    assert.ok(Math.abs(c.p - 5.0103319563904386e-06) < 1e-7, `p=${c.p}`);
    assert.equal(c.rotulo, 'comprovado');
  });
});

test('B1: p >= 0,05 vira "não comprovado"', async () => {
  // 150/3000 vs 135/3000: z = 0.91041, p = 0.36261
  await com(duasRacas(150, 3000, 135, 3000), (r) => {
    const c = cmp(r.json, 'total');
    assert.ok(Math.abs(Math.abs(c.z) - 0.9104085692427798) < 1e-3, `z=${c.z}`);
    assert.ok(Math.abs(c.p - 0.36260708019282384) < 1e-3, `p=${c.p}`);
    assert.equal(c.rotulo, 'não comprovado');
  });
});

// ── B2: controle de confusão (raça dentro de cada estilo) ────────────────────
test('B2: total mostra diferença significativa; dentro de cada estilo ela some e a conclusão é "não comprovado"', async () => {
  await com(simpson(), (r) => {
    assert.equal(r.status, 0, r.stderr);
    const total = cmp(r.json, 'total');
    assert.ok(total && total.p < 1e-6 && total.rotulo === 'comprovado', 'o total deveria mostrar diferença significativa (referência z=6.1237)');
    for (const estilo of ['X', 'Y']) {
      const c = cmp(r.json, `estilo:${estilo}`);
      assert.ok(c, `comparação dentro do estilo ${estilo} ausente`);
      assert.ok(Math.abs(c.p - 1) < 1e-6, `p dentro de ${estilo}=${c.p}`);
      assert.equal(c.rotulo, 'não comprovado');
    }
    // sem o ajuste por estilo, o total ficaria "afirmado": estas duas linhas travam a mutação [M] "remover o ajuste"
    assert.equal(total.confundida, true, 'o total deve sair confundido pelo estilo');
    assert.ok(!/^- Total:/m.test(secaoAfirmado(r.md)), 'o total confundido não pode estar em "afirmado"');
    assert.match(r.md, /inversão \(paradoxo de Simpson\): o estilo explica o total/);
    assert.match(r.md, /dentro d[oe]s? estilo/i, 'o relatório traz a leitura dentro do estilo');
    assert.match(r.md, /total/i, 'o relatório traz a leitura do total');
    assert.match(r.md, /não comprovado/);
  });
});

// ── B3: a raça vem do catálogo, nunca do ledger (teste de cegueira) ──────────
test('B3: raça do ledger divergente é ignorada; a saída usa a tabela de catálogo', async () => {
  const e = duasRacas(200, 4000, 120, 4000);
  e.estampas = e.estampas.map((l) => ({ ...l, raca: 'RACA-ERRADA-DO-LEDGER' }));
  await com(e, (r) => {
    assert.equal(r.status, 0, r.stderr);
    assert.ok(!r.csv.includes('RACA-ERRADA-DO-LEDGER') && !r.md.includes('RACA-ERRADA-DO-LEDGER'));
    assert.ok(!r.stdout.includes('RACA-ERRADA-DO-LEDGER'));
    const linhas = r.csv.trim().split('\n').map((l) => l.split(','));
    const col = linhas[0].indexOf('raca');
    assert.ok(col >= 0, 'coluna raca ausente no csv');
    const porEstampa = Object.fromEntries(linhas.slice(1).map((l) => [l[0], l[col]]));
    assert.equal(porEstampa['Lua Verde'], 'RACA-A');
    assert.equal(porEstampa['Sol Vermelho'], 'RACA-B');
    const c = cmp(r.json, 'total');
    assert.deepEqual([c.a, c.b].sort(), ['RACA-A', 'RACA-B']);
  });
});

// ── B4: junção de nomes ──────────────────────────────────────────────────────
function entradaJuncao() {
  const catalogo = [
    C('Lua Verde', 'RACA-A', 'X'), C('Sol Vermelho', 'RACA-B', 'X'),
    C('Mar Azul Profundo', 'RACA-A', 'Y'), C('Vento Prata', 'RACA-B', 'Y'),
  ];
  const estampas = [
    { estampa: 'lua  verde!', ga4_views: 1000, ga4_compras: 50 },                      // normalização
    { estampa: 'Verde Lua', meta_impressoes: 9000, meta_cliques: 90 },                 // mesmos tokens
    { estampa: 'Mar Azul', meta_impressoes: 5000, meta_cliques: 50 },                  // Jaccard 2/3
    { estampa: 'Apelido Estranho', ga4_views: 800, ga4_compras: 20 },                  // só por exceção
    { estampa: 'Lua Dourada Rara', ga4_views: 300, ga4_compras: 3 },                   // Jaccard 1/4: não casa (ga4)
    { estampa: 'Brisa Escarlate', meta_impressoes: 700, meta_cliques: 7 },             // não casa (meta)
    { estampa: 'Sol Vermelho v1', meta_impressoes: 4000, meta_cliques: 40 },           // v1 e v2 caem em 'Sol Vermelho'
    { estampa: 'Sol Vermelho v2', meta_impressoes: 4000, meta_cliques: 40 },
    { estampa: 'Vento Prata', ga4_views: 500, ga4_compras: 10 },
  ];
  return entrada(estampas, catalogo, { excecoes: [{ de: 'Apelido Estranho', para: 'Mar Azul Profundo' }] });
}

test('B4: casa variações (normalização, Jaccard >= 0,5, exceção) e lista o que não casou por fonte', async () => {
  await com(entradaJuncao(), (r) => {
    assert.equal(r.status, 0, r.stderr);
    const nao = r.json.juncao.naoCasou;
    assert.ok(nao.some((n) => n.estampa === 'Lua Dourada Rara' && n.fonte === 'ga4'), JSON.stringify(nao));
    assert.ok(nao.some((n) => n.estampa === 'Brisa Escarlate' && n.fonte === 'meta'), JSON.stringify(nao));
    for (const casada of ['lua  verde!', 'Verde Lua', 'Mar Azul', 'Apelido Estranho', 'Sol Vermelho v1', 'Vento Prata']) {
      assert.ok(!nao.some((n) => n.estampa === casada), `"${casada}" deveria casar`);
    }
    assert.match(r.md, /Lua Dourada Rara/, 'o relatório lista o que não casou');
    // linhas das duas fontes da mesma estampa são somadas no alvo do catálogo
    const linhas = r.csv.trim().split('\n').map((l) => l.split(','));
    const h = linhas[0];
    const luaVerde = linhas.slice(1).find((l) => l[0] === 'Lua Verde');
    assert.equal(Number(luaVerde[h.indexOf('views')]), 1000);
    assert.equal(Number(luaVerde[h.indexOf('impressoes')]), 9000);
  });
});

test('B4: auditoria de colisões alerta quando duas estampas distintas caem no mesmo alvo', async () => {
  await com(entradaJuncao(), (r) => {
    const col = r.json.juncao.colisoes;
    assert.equal(col.length, 1, JSON.stringify(col));
    assert.equal(col[0].alvo, 'Sol Vermelho');
    assert.deepEqual([...col[0].origens].sort(), ['Sol Vermelho v1', 'Sol Vermelho v2']);
    assert.match(r.md, /colis/i);
  });
});

// ── B5: concentração da vitrine ──────────────────────────────────────────────
function entradaVitrine(extra = {}) {
  // fatias de impressões: H 50%, M1 24,5%, M2 24,5%, L 1%. Taxas: H 2%, M 6,8%, L 15% (média geral 7,65%).
  return entrada([
    L('Lua Verde', 'RACA-A', 'X', 500000, 5000, 5000, 100),
    L('Sol Vermelho', 'RACA-A', 'X', 245000, 5000, 5000, 340),
    L('Mar Azul', 'RACA-B', 'X', 245000, 5000, 5000, 340),
    L('Noite Roxa', 'RACA-B', 'X', 10000, 5000, 5000, 750),
  ], [C('Lua Verde', 'RACA-A', 'X'), C('Sol Vermelho', 'RACA-A', 'X'), C('Mar Azul', 'RACA-B', 'X'), C('Noite Roxa', 'RACA-B', 'X')], extra);
}
const PARAMETROS = { fatiaAlta: 0.4, fatiaBaixa: 0.05, razaoConversaoBaixa: 0.7, razaoConversaoAlta: 1.3 };

test('B5: sinaliza fatia alta com conversão baixa e fatia baixa com conversão alta', async () => {
  await com(entradaVitrine({ parametros: PARAMETROS }), (r) => {
    assert.equal(r.status, 0, r.stderr);
    const v = Object.fromEntries(r.json.vitrine.map((x) => [x.estampa, x]));
    assert.ok(Math.abs(v['Lua Verde'].fatia - 0.5) < 1e-9);
    assert.ok(Math.abs(v['Lua Verde'].taxaCompra - 0.02) < 1e-9);
    assert.equal(v['Lua Verde'].sinal, 'fatia-alta-conversao-baixa');
    assert.equal(v['Noite Roxa'].sinal, 'fatia-baixa-conversao-alta');
    assert.ok(!v['Sol Vermelho'].sinal && !v['Mar Azul'].sinal, 'estampas medianas não sinalizam');
    const linhas = r.csv.trim().split('\n').map((l) => l.split(','));
    const h = linhas[0];
    const lua = linhas.slice(1).find((l) => l[0] === 'Lua Verde');
    assert.equal(lua[h.indexOf('sinal_vitrine')], 'fatia-alta-conversao-baixa');
  });
});

test('B5: limiares são parâmetros nomeados — ecoados na saída, com e sem override', async () => {
  await com(entradaVitrine({ parametros: PARAMETROS }), (r) => {
    for (const [k, valor] of Object.entries(PARAMETROS)) assert.equal(r.json.parametros[k], valor, k);
  });
  await com(entradaVitrine(), (r) => {
    assert.equal(r.status, 0, r.stderr);
    for (const k of Object.keys(PARAMETROS)) assert.equal(typeof r.json.parametros[k], 'number', `parametro padrão ${k}`);
  });
});

// ── B6: poder estatístico ────────────────────────────────────────────────────
test('B6: amostra abaixo do mínimo declara "sem poder para afirmar" e nunca "comprovado"', async () => {
  // 50/1000 vs 30/1000: p = 0.02248 (< 0,05) mas o mínimo para detectar 5% vs 3% é ~1505,8 por grupo
  await com(duasRacas(50, 1000, 30, 1000), (r) => {
    assert.equal(r.status, 0, r.stderr);
    const c = cmp(r.json, 'total');
    assert.ok(Math.abs(c.p - 0.02247887336612527) < 1e-4, `p=${c.p}`);
    assert.ok(Math.abs(c.nMinimo - 1505.8) < 2, `nMinimo=${c.nMinimo}`);
    assert.equal(c.semPoder, true);
    assert.equal(c.rotulo, 'sem poder para afirmar');
    assert.notEqual(c.rotulo, 'comprovado');
    assert.match(r.md, /sem poder para afirmar/);
    const afirmado = r.md.split(/^#{1,4} .*[Nn]ão comprovado/m)[0].split(/^#{1,4} .*[Aa]firmado/m)[1] || '';
    assert.ok(!/RACA-A/.test(afirmado), 'a comparação sem poder não pode aparecer em "afirmado"');
  });
});

test('B6: amostra adequada tem semPoder false', async () => {
  await com(duasRacas(200, 4000, 120, 4000), (r) => {
    const c = cmp(r.json, 'total');
    assert.equal(c.semPoder, false);
    assert.ok(Math.abs(c.nMinimo - 1505.8) < 2, `nMinimo=${c.nMinimo}`);
  });
});

// ── B7: PII ──────────────────────────────────────────────────────────────────
const PII = {
  email: 'fulano.exemplo@example.com',
  cpf: '123.456.789-09',
  telefone: '(11) 91234-5678',
  endereco: 'Rua das Flores, 123',
};
for (const [tipo, valor] of Object.entries(PII)) {
  test(`B7: entrada com ${tipo} é recusada com erro, exit != 0 e nenhum arquivo gravado`, async () => {
    const e = simpson();
    e.estampas[0] = { ...e.estampas[0], observacao: `contato ${valor}` };
    await com(e, (r) => {
      assert.notEqual(r.status, 0, 'PII deveria derrubar o script');
      assert.ok(r.stderr.trim().length > 0, 'a recusa precisa de mensagem em stderr');
      assert.equal(r.md, null);
      assert.equal(r.csv, null);
    });
  });
}

test('B7: casa_excluida numérico é aceito e as saídas .md/.csv não têm padrão de e-mail/CPF/telefone', async () => {
  await com(simpson(), (r) => {
    assert.equal(r.status, 0, r.stderr);
    for (const texto of [r.md, r.csv]) {
      assert.ok(!/[\w.+-]+@[\w-]+\.[\w.-]+/.test(texto), 'e-mail na saída');
      assert.ok(!/\d{3}\.\d{3}\.\d{3}-\d{2}/.test(texto), 'CPF na saída');
      assert.ok(!/\(\d{2}\)\s?9?\d{4}-\d{4}|\b\d{2}\s?9\d{4}-\d{4}\b/.test(texto), 'telefone na saída');
    }
  });
});

test('N2: o relatório diz que a casa saiu só das vendas do ERP e que o GA4 pode incluí-la', async () => {
  await com(simpson(), (r) => {
    assert.equal(r.status, 0, r.stderr);
    assert.ok(r.md.includes('Compras da casa retiradas das vendas do ERP: 4 unidades. O GA4 não separa família: as taxas de compra abaixo (GA4) podem incluir compras da casa.'), 'frase nova ausente');
    assert.ok(!r.md.includes('excluídas antes da análise'), 'frase antiga ainda presente');
  });
});

// ── B8: relatório e contrato do csv ──────────────────────────────────────────
test('B8: relatório com os 3 blocos, separação afirmado × não comprovado e aviso do canal "sem anúncio"', async () => {
  await com(simpson(), (r) => {
    assert.equal(r.status, 0, r.stderr);
    for (const bloco of ['Produzir', 'Investir', 'Rever']) {
      assert.match(r.md, new RegExp(`^#{1,4} .*${bloco}`, 'm'), `bloco ${bloco} ausente`);
    }
    assert.ok(r.md.includes('afirmado (p < 0,05)'), 'seção "afirmado (p < 0,05)" ausente');
    assert.ok(r.md.includes('não comprovado'), 'seção "não comprovado" ausente');
    assert.match(r.md, /sem anúncio/i);
    assert.match(r.md, /fam[íi]lia/i);
    assert.match(r.md, /contamin/i);
  });
});

test('B8: o csv tem o cabeçalho do contrato de saída e linhas com o mesmo número de colunas', async () => {
  await com(simpson(), (r) => {
    const linhas = r.csv.trim().split('\n');
    assert.equal(linhas[0], CSV_CABECALHO);
    assert.equal(linhas.length, 7, 'uma linha por estampa do catálogo + cabeçalho');
    for (const l of linhas) assert.equal(l.split(',').length, 11, l);
  });
});

// ── B9: script autocontido ───────────────────────────────────────────────────
test('B9: script autocontido — sem import de pacote, sem require, sem package.json e passa node --check', () => {
  assert.ok(existsSync(SCRIPT), `script ausente: ${SCRIPT}`);
  const src = readFileSync(SCRIPT, 'utf8');
  for (const m of src.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)) {
    assert.ok(m[1].startsWith('node:'), `import de pacote não permitido: ${m[1]}`);
  }
  assert.ok(!/\brequire\(/.test(src), 'require não permitido');
  assert.ok(!existsSync(join(SKILL_DIR, 'package.json')) && !existsSync(join(SKILL_DIR, 'node_modules')));
  const r = spawnSync(process.execPath, ['--check', SCRIPT], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

// ── entrada incoerente: recusa por estampa, sem relatório parcial ─────────────
const recusada = async (estampas, campo) => {
  const ent = entrada(estampas, [C('Lua Verde', 'RACA-A', 'X'), C('Sol Vermelho', 'RACA-B', 'X')]);
  await com(ent, (r) => {
    assert.notEqual(r.status, 0, 'entrada incoerente deve ser recusada');
    assert.match(r.stderr, /Lua Verde/);
    assert.match(r.stderr, new RegExp(campo));
    assert.equal(r.md, null, 'sem relatório parcial');
    assert.equal(r.csv, null, 'sem relatório parcial');
  });
};
const OK = L('Sol Vermelho', 'RACA-B', 'X', 1000, 100, 500, 10);

test('entrada: ga4_compras > ga4_views é recusada com estampa e campo', async () => {
  await recusada([L('Lua Verde', 'RACA-A', 'X', 1000, 100, 50, 60), OK], 'ga4_compras');
});

test('entrada: ga4_compras sem ga4_views é recusada', async () => {
  await recusada([{ estampa: 'Lua Verde', ga4_compras: 3 }, OK], 'ga4_views');
});

test('entrada: meta_cliques > meta_impressoes é recusada com estampa e campo', async () => {
  await recusada([L('Lua Verde', 'RACA-A', 'X', 100, 200, 500, 10), OK], 'meta_cliques');
});

test('entrada: valor negativo é recusado com estampa e campo', async () => {
  await recusada([L('Lua Verde', 'RACA-A', 'X', 1000, 100, 500, -1), OK], 'ga4_compras');
});

test('entrada: valor não numérico é recusado com estampa e campo', async () => {
  await recusada([L('Lua Verde', 'RACA-A', 'X', '1000', 100, 500, 10), OK], 'meta_impressoes');
});

test('entrada válida: nenhum NaN/Infinity no .md, .csv ou stdout', async () => {
  await com(duasRacas(10, 500, 20, 500), (r) => {
    assert.equal(r.status, 0, r.stderr);
    for (const t of [r.md, r.csv, r.stdout]) assert.ok(!/NaN|Infinity/.test(t));
  });
});


// ══ Correção pós-revisão (itens 1-8) ═════════════════════════════════════════
const rodarEm = (dir, arq, saida) => spawnSync(process.execPath, [SCRIPT, '--entrada', arq, '--saida', saida], { encoding: 'utf8' });

// 1: paradoxo de Simpson com REVERSÃO. Total A 4,20% > B 3,00% (p=5e-6); dentro de cada estilo B > A.
const reversao = () => entrada([
  L('Lua Verde', 'RACA-A', 'X', 1000, 100, 8000, 400), L('Mar Azul', 'RACA-A', 'Y', 1000, 100, 2000, 20),
  L('Sol Vermelho', 'RACA-B', 'X', 1000, 100, 2000, 140), L('Vento Prata', 'RACA-B', 'Y', 1000, 100, 8000, 160),
], [C('Lua Verde', 'RACA-A', 'X'), C('Mar Azul', 'RACA-A', 'Y'), C('Sol Vermelho', 'RACA-B', 'X'), C('Vento Prata', 'RACA-B', 'Y')]);

test('1: reversão de Simpson: efeito ajustado em sentido oposto nunca vai para "afirmado"', async () => {
  await com(reversao(), (r) => {
    assert.equal(r.status, 0, r.stderr);
    const total = cmp(r.json, 'total');
    assert.equal(total.rotulo, 'comprovado');
    assert.ok(total.p < 1e-4 && total.taxaA > total.taxaB, 'o total mostra A > B');
    assert.equal(total.confundida, true);
    assert.ok(!/^- Total:/m.test(secaoAfirmado(r.md)), 'o total não pode estar em "afirmado"');
    assert.match(secaoNao(r.md), /^- Total:.*não comprovado após ajuste por estilo/m);
  });
});

test('1: efeito de mesmo sentido em todos os estratos continua afirmado para a raça', async () => {
  const e = entrada([
    L('Lua Verde', 'RACA-A', 'X', 1000, 100, 10000, 600), L('Mar Azul', 'RACA-A', 'Y', 1000, 100, 10000, 200),
    L('Sol Vermelho', 'RACA-B', 'X', 1000, 100, 10000, 400), L('Vento Prata', 'RACA-B', 'Y', 1000, 100, 10000, 100),
  ], [C('Lua Verde', 'RACA-A', 'X'), C('Mar Azul', 'RACA-A', 'Y'), C('Sol Vermelho', 'RACA-B', 'X'), C('Vento Prata', 'RACA-B', 'Y')]);
  await com(e, (r) => {
    const total = cmp(r.json, 'total');
    assert.equal(total.rotulo, 'comprovado');
    assert.ok(!total.confundida, 'mesmo sentido e significativo: não é confusão');
    assert.match(secaoAfirmado(r.md), /^- Total:/m);
  });
});

// 2: blocos de ação exigem p < 0,05 com poder (estampa vs resto)
test('2: estampa com 6/200 vs resto 200/10000 (p=0,32) não vai para Produzir; fica em Observações sem verbo de ação', async () => {
  const e = entrada([L('Lua Verde', 'RACA-A', 'X', 1000, 100, 200, 6), L('Sol Vermelho', 'RACA-B', 'X', 1000, 100, 10000, 200)],
    [C('Lua Verde', 'RACA-A', 'X'), C('Sol Vermelho', 'RACA-B', 'X')]);
  await com(e, (r) => {
    assert.equal(r.status, 0, r.stderr);
    const v = r.json.vitrine.find((x) => x.estampa === 'Lua Verde');
    assert.equal(v.bloco, '');
    assert.equal(v.evidencia, 'não comprovado');
    assert.ok('fatia' in v && 'taxaCompra' in v && 'sinal' in v, 'campos existentes preservados');
    const produzir = r.md.split('## Produzir')[1].split('## Investir')[0];
    assert.ok(!/Lua Verde/.test(produzir) && /nenhuma estampa com evid[eê]ncia/i.test(produzir), produzir);
    for (const t of ['Produzir', 'Investir', 'Rever']) assert.match(r.md, new RegExp(`^## ${t}`, 'm'));
    const obs = r.md.split(/^## Observações \(não comprovado\)/m)[1].split(/^## /m)[0];
    assert.match(obs, /Lua Verde/);
    assert.ok(!/produzir|investir|rever/i.test(obs), 'observação sem verbo de ação');
    assert.equal(r.csv.split('\n').find((l) => l.startsWith('Lua Verde')).split(',').pop(), '', 'coluna bloco vazia no csv');
  });
});

test('2: com evidência (p < 0,05 e poder) a estampa entra em Produzir', async () => {
  const e = entrada([L('Lua Verde', 'RACA-A', 'X', 5000, 100, 4000, 120), L('Sol Vermelho', 'RACA-B', 'X', 5000, 100, 20000, 400)],
    [C('Lua Verde', 'RACA-A', 'X'), C('Sol Vermelho', 'RACA-B', 'X')]);
  await com(e, (r) => {
    const v = r.json.vitrine.find((x) => x.estampa === 'Lua Verde');
    assert.equal(v.evidencia, 'comprovado');
    assert.equal(v.bloco, 'produzir');
    assert.match(r.md.split('## Produzir')[1].split('## Investir')[0], /Lua Verde/);
  });
});

// 3: PII, contornos
const comObs = (valor, extra) => { const e = simpson(); e.estampas[0] = { ...e.estampas[0], observacao: valor, ...extra }; return e; };
const FORMATOS = {
  'e-mail fullwidth': 'ｆｕｌａｎｏ＠ｅｘａｍｐｌｅ．ｃｏｍ',
  'e-mail com ZWSP no domínio': 'fulano@exam​ple.com',
  'e-mail com ZWSP no usuário': 'ful​ano@example.com',
  'e-mail [at] [dot]': 'fulano [at] example [dot] com',
  'e-mail (at)': 'fulano(at)example.com',
  'CPF formatado': '123.456.789-09',
  'CPF 11 dígitos puros': '12345678909',
  'telefone +55 espaços': '+55 11 98765 4321',
  'telefone parênteses espaço': '(11) 98765 4321',
  'telefone fixo hífen': '11 3456-7890',
  'telefone 11 dígitos': '11987654321',
  'telefone +55 colado': '+5511987654321',
  'endereço R.': 'R. das Flores 12',
  'endereço R espaço': 'R das Flores, 12',
  'endereço Av': 'Av Brasil 100',
  'endereço Av.': 'Av. Brasil, 100',
  'endereço com aspas': 'Rua "das Flores", 123',
  'endereço travessa': 'Travessa Alfa 9',
  'endereço alameda': 'Alameda Santos 10',
  'endereço estrada': 'Estrada Velha, 5',
  'endereço rodovia': 'Rodovia Norte 77',
  'endereço praça': 'Praça da Sé 1',
  'endereço praca': 'Praca Central 2',
};
for (const [nome, valor] of Object.entries(FORMATOS)) {
  test(`3: PII contornável recusada: ${nome}`, async () => {
    await com(comObs(valor), (r) => {
      assert.notEqual(r.status, 0, 'deveria recusar');
      assert.equal(r.md, null); assert.equal(r.csv, null);
      assert.match(r.stderr, /observacao/, 'a mensagem diz o campo');
      assert.match(r.stderr, /renome/i, 'a mensagem diz como proceder');
      assert.ok(!r.stderr.includes(valor), 'a mensagem não ecoa o valor');
    });
  });
}

test('3: 11 dígitos puros com dígito verificador inválido não é CPF (reduz falso positivo)', async () => {
  await com(comObs('Lote 12345678900'), (r) => assert.equal(r.status, 0, r.stderr));
});

test('3: PII escondida em escape \\uXXXX do JSON cru também é recusada (varre o valor decodificado)', async () => {
  await com(null, (r) => assert.notEqual(r.status, 0), { bruto: JSON.stringify(comObs('x')).replace('"x"', '"fulano@exam\\u0070le.com"') });
});

test('3: falso positivo documentado: "Estrada Real 2" é recusada e a mensagem manda renomear', async () => {
  const e = simpson();
  e.estampas[0].estampa = 'Estrada Real 2'; e.catalogo[0].estampa = 'Estrada Real 2';
  await com(e, (r) => { assert.notEqual(r.status, 0); assert.match(r.stderr, /renome/i); assert.match(r.stderr, /estampas\[0\]\.estampa/); });
  assert.match(readFileSync(join(SKILL_DIR, 'references', 'contrato.md'), 'utf8'), /Estrada Real 2/, 'limitação documentada no contrato');
});

test('3: a SAÍDA também é varrida: raça "Rua" ecoada no md vira endereço e bloqueia, sem arquivo', async () => {
  const e = entrada([L('Lua Verde', 'Rua', 'X', 1000, 100, 200, 6), L('Sol Vermelho', 'Beco', 'X', 1000, 100, 10000, 200)],
    [C('Lua Verde', 'Rua', 'X'), C('Sol Vermelho', 'Beco', 'X')]);
  await com(e, (r) => {
    assert.notEqual(r.status, 0, 'a saída continha padrão de endereço');
    assert.match(r.stderr, /saída bloqueada/);
    assert.equal(r.md, null); assert.equal(r.csv, null);
  });
});

// 4: junção aproximada nunca silenciosa
test('4: "Lua Verde Neon" (ga4) casada por aproximação aparece em aproximados (json e md)', async () => {
  const e = entrada([
    { estampa: 'Lua Verde', meta_impressoes: 1000, meta_cliques: 10 },
    { estampa: 'Lua Verde Neon', ga4_views: 1000, ga4_compras: 300 },
    L('Sol Vermelho', 'RACA-B', 'X', 1000, 100, 1000, 30),
  ], [C('Lua Verde', 'RACA-A', 'X'), C('Sol Vermelho', 'RACA-B', 'X')]);
  await com(e, (r) => {
    assert.equal(r.status, 0, r.stderr);
    const a = r.json.aproximados.find((x) => x.de === 'Lua Verde Neon');
    assert.ok(a && a.para === 'Lua Verde' && Math.abs(a.jaccard - 2 / 3) < 1e-9, JSON.stringify(r.json.aproximados));
    assert.ok(!r.json.aproximados.some((x) => x.de === 'Lua Verde'), 'match exato não é aproximado');
    assert.match(r.md, /Casamentos aproximados[\s\S]*Lua Verde Neon/);
  });
});

test('4: duas grafias aproximadas de fontes DIFERENTES que diferem em token de versão geram colisão', async () => {
  const e = entrada([
    { estampa: 'Lua Verde v1', meta_impressoes: 1000, meta_cliques: 10 },
    { estampa: 'Lua Verde Neon', ga4_views: 1000, ga4_compras: 30 },
    L('Sol Vermelho', 'RACA-B', 'X', 1000, 100, 1000, 30),
  ], [C('Lua Verde', 'RACA-A', 'X'), C('Sol Vermelho', 'RACA-B', 'X')]);
  await com(e, (r) => {
    const col = r.json.juncao.colisoes.find((c) => c.alvo === 'Lua Verde');
    assert.ok(col, JSON.stringify(r.json.juncao));
    assert.deepEqual([...col.origens].sort(), ['Lua Verde Neon', 'Lua Verde v1']);
  });
});

// 5: injeção em csv/markdown
test('5: csv neutraliza células = + - @ e aspa \\r; md não injeta seção por quebra de linha', async () => {
  const e = entrada([
    L('=SOMA(A1)', 'RACA-A', 'X', 1000, 100, 1000, 10), L('@cmd', 'RACA-B', 'X', 1000, 100, 1000, 10),
    L('+soma', 'RACA-B', 'X', 1000, 100, 1000, 10), L('-menos', 'RACA-B', 'X', 1000, 100, 1000, 10),
    L('Com\rCR', 'RACA-B', 'X', 1000, 100, 1000, 10),
    { estampa: 'Falsa\n## Seção Falsa\n- injetado', ga4_views: 10, ga4_compras: 1 },
  ], [C('=SOMA(A1)', 'RACA-A', 'X'), C('@cmd', 'RACA-B', 'X'), C('+soma', 'RACA-B', 'X'), C('-menos', 'RACA-B', 'X'), C('Com\rCR', 'RACA-B', 'X')]);
  await com(e, (r) => {
    assert.equal(r.status, 0, r.stderr);
    for (const ini of ["'=SOMA(A1)", "'@cmd", "'+soma", "'-menos"]) assert.ok(r.csv.split('\n').some((l) => l.startsWith(ini)), `célula ${ini} não neutralizada`);
    assert.ok(r.csv.includes('"Com\rCR"'), 'CR deve ser aspeado');
    assert.ok(!/^## Seção Falsa/m.test(r.md) && !/^- injetado/m.test(r.md), 'quebra de linha injetou seção no md');
    assert.match(r.md, /Falsa ## Seção Falsa - injetado/);
  });
});

// 6: entrada malformada
for (const [nome, extra] of [['excecoes: 5', { excecoes: 5 }], ['excecoes: {}', { excecoes: {} }], ['excecoes: [5]', { excecoes: [5] }],
  ['parametros: constructor', { parametros: { constructor: 1 } }], ['parametros: toString', { parametros: { toString: 5 } }],
  ['parametros: array', { parametros: [1] }], ['parametros: número', { parametros: 5 }]]) {
  test(`6: entrada malformada (${nome}) sai com exit 1, sem stack trace e sem arquivo`, async () => {
    await com({ ...duasRacas(200, 4000, 120, 4000), ...extra }, (r) => {
      assert.equal(r.status, 1, r.stderr);
      assert.ok(!/TypeError|\n\s+at /.test(r.stderr), `stack trace: ${r.stderr}`);
      assert.equal(r.md, null);
    });
  });
}

test('6: JSON inválido não ecoa trecho da entrada', async () => {
  await com(null, (r) => {
    assert.equal(r.status, 1);
    assert.ok(!r.stderr.includes('fulano'), r.stderr);
  }, { bruto: 'fulano.exemplo@example.com isto nao e json' });
});

// 7: mensagem por escopo
test('7: "não separável" diz "da raça" na comparação Entre estilos e "do estilo" na de raças', async () => {
  const e = entrada([L('Lua Verde', 'RACA-A', 'X', 1000, 100, 4000, 200), L('Sol Vermelho', 'RACA-B', 'Y', 1000, 100, 4000, 120)],
    [C('Lua Verde', 'RACA-A', 'X'), C('Sol Vermelho', 'RACA-B', 'Y')]);
  await com(e, (r) => {
    const linhas = secaoNao(r.md).split('\n');
    const entre = linhas.find((l) => l.startsWith('- Entre estilos'));
    const total = linhas.find((l) => l.startsWith('- Total'));
    assert.ok(entre && /não separável da raça/.test(entre) && !/do estilo/.test(entre), entre);
    assert.ok(total && /não separável do estilo/.test(total), total);
  });
});

// 8: sobrescrita avisa em stderr
test('8: sobrescrita de analise-produto.md/csv avisa em stderr e mantém exit 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hermes-produto-'));
  try {
    const arq = join(dir, 'entrada.json'); const saida = join(dir, 'saida');
    writeFileSync(arq, JSON.stringify(duasRacas(200, 4000, 120, 4000)));
    const a = rodarEm(dir, arq, saida);
    assert.equal(a.status, 0, a.stderr); assert.ok(!/sobrescrevendo/.test(a.stderr), 'primeira execução não avisa');
    const b = rodarEm(dir, arq, saida);
    assert.equal(b.status, 0, b.stderr);
    assert.match(b.stderr, /sobrescrevendo .*analise-produto\.md/);
    assert.match(b.stderr, /sobrescrevendo .*analise-produto\.csv/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── Sugestão de conjunto (Fase 1: SÓ sugestão; a skill nunca cria nada) ──────
// Duas estampas com evidência (Produzir) e uma abaixo da média, fixture sintética.
const comEvidencia = (extra = {}) => entrada([
  L('Lua Verde', 'RACA-A', 'X', 5000, 100, 4000, 120), L('Mar Azul', 'RACA-A', 'X', 5000, 100, 4000, 120),
  L('Sol Vermelho', 'RACA-B', 'X', 5000, 100, 40000, 400),
], [C('Lua Verde', 'RACA-A', 'X'), C('Mar Azul', 'RACA-A', 'X'), C('Sol Vermelho', 'RACA-B', 'X')], extra);
const secaoConjunto = (md) => md.split(/^## Sugestão de conjunto/m)[1]?.split(/^## /m)[0] ?? null;
const AVISO_FIM = 'Isto é só sugestão: a skill não cria nada. Antes de criar, avalie usar um conjunto existente compatível; cada conjunto novo reinicia o aprendizado da plataforma e divide a verba.';
const TEXTO_AUSENTE = 'Não foi informada a lista de conjuntos existentes: não dá para checar se algum já serve. Confira na conta antes de criar qualquer um.';
const TEXTO_NENHUMA = 'Nenhuma estampa tem evidência estatística para conjunto próprio. Não criar conjunto agora.';

test('conjunto: estampa com evidência coberta por conjuntos existentes vira "reusar" (todos listados, com status)', async () => {
  const e = comEvidencia({ conjuntos: [
    { conjunto: 'Conjunto Alfa', status: 'veiculando', estampas: ['lua  verde', 'Mar Azul'] },
    { conjunto: 'Conjunto Beta', status: 'pausado', estampas: ['Lua Verde'] },
  ] });
  await com(e, (r) => {
    assert.equal(r.status, 0, r.stderr);
    const s = secaoConjunto(r.md);
    assert.ok(s, 'seção ausente');
    assert.match(s, /Lua Verde.*reusar: Conjunto Alfa \(veiculando\), Conjunto Beta \(pausado\)/);
    assert.match(s, /Mar Azul.*reusar: Conjunto Alfa \(veiculando\)/);
    assert.ok(!/Beta.*Mar Azul|Mar Azul.*Beta/.test(s), 'Beta não cobre Mar Azul');
    assert.ok(!/candidatas a um conjunto novo/i.test(s));
    assert.ok(s.includes(AVISO_FIM));
    const sc = r.json.sugestao_conjunto;
    assert.equal(sc.checou_conta, true);
    assert.deepEqual(sc.reusar, [
      { estampa: 'Lua Verde', conjuntos: [{ conjunto: 'Conjunto Alfa', status: 'veiculando' }, { conjunto: 'Conjunto Beta', status: 'pausado' }] },
      { estampa: 'Mar Azul', conjuntos: [{ conjunto: 'Conjunto Alfa', status: 'veiculando' }] },
    ]);
    assert.deepEqual(sc.candidatas_novo, []);
    assert.deepEqual(sc.fora_do_catalogo, []);
    assert.equal(sc.aviso, AVISO_FIM);
  });
});

test('conjunto: com evidência e sem cobertura vira "candidatas a um conjunto novo: A, B" (só candidatas)', async () => {
  const e = comEvidencia({ conjuntos: [{ conjunto: 'Conjunto Alfa', status: 'veiculando', estampas: ['Lua Verde'] }] });
  await com(e, (r) => {
    const s = secaoConjunto(r.md);
    assert.match(s, /Lua Verde.*reusar: Conjunto Alfa/);
    assert.match(s, /candidatas a um conjunto novo: Mar Azul/);
    assert.deepEqual(r.json.sugestao_conjunto.candidatas_novo, ['Mar Azul']);
    assert.ok(!/Sol Vermelho/.test(s), 'sem evidência não entra');
  });
});

test('conjunto: duas sem cobertura listam as duas, separadas por vírgula', async () => {
  await com(comEvidencia({ conjuntos: [{ conjunto: 'Outro', status: 'pausado', estampas: ['Sol Vermelho'] }] }), (r) => {
    assert.match(secaoConjunto(r.md), /candidatas a um conjunto novo: Lua Verde, Mar Azul/);
    assert.deepEqual(r.json.sugestao_conjunto.candidatas_novo, ['Lua Verde', 'Mar Azul']);
    assert.deepEqual(r.json.sugestao_conjunto.reusar, []);
  });
});

test('conjunto: sem o campo "conjuntos" o texto é exato, checou_conta=false e nada recomenda "criar"', async () => {
  await com(comEvidencia(), (r) => {
    assert.equal(r.status, 0, r.stderr);
    const s = secaoConjunto(r.md);
    assert.ok(s.includes(TEXTO_AUSENTE), s);
    assert.match(s, /candidatas a conjunto próprio: Lua Verde, Mar Azul/);
    const semFixos = s.replace(TEXTO_AUSENTE, '').replace(AVISO_FIM, '');
    assert.ok(!/\bcria[rm]?\b/i.test(semFixos), `recomenda criar: ${semFixos}`);
    assert.ok(!/candidatas a um conjunto novo|reusar/i.test(s));
    assert.ok(s.includes(AVISO_FIM));
    const sc = r.json.sugestao_conjunto;
    assert.equal(sc.checou_conta, false);
    assert.deepEqual(sc.reusar, []);
    assert.deepEqual(sc.candidatas_novo, ['Lua Verde', 'Mar Azul']);
    assert.deepEqual(sc.fora_do_catalogo, []);
  });
});

test('conjunto: "conjuntos": [] = nenhum conjunto existente cobre (candidatas a um conjunto novo)', async () => {
  await com(comEvidencia({ conjuntos: [] }), (r) => {
    const s = secaoConjunto(r.md);
    assert.ok(!s.includes(TEXTO_AUSENTE));
    assert.match(s, /candidatas a um conjunto novo: Lua Verde, Mar Azul/);
    assert.equal(r.json.sugestao_conjunto.checou_conta, true);
    assert.deepEqual(r.json.sugestao_conjunto.candidatas_novo, ['Lua Verde', 'Mar Azul']);
  });
});

for (const [nome, extra] of [['sem o campo', {}], ['com conjuntos', { conjuntos: [{ conjunto: 'Conjunto Alfa', status: 'veiculando', estampas: ['Lua Verde'] }] }]]) {
  test(`conjunto: nenhuma estampa com evidência => texto fixo (${nome})`, async () => {
    await com(duasRacas(150, 3000, 135, 3000, extra), (r) => {
      assert.equal(r.status, 0, r.stderr);
      const s = secaoConjunto(r.md);
      assert.ok(s.includes(TEXTO_NENHUMA), s);
      assert.ok(!s.includes(TEXTO_AUSENTE), 'independe de conjuntos');
      assert.ok(s.includes(AVISO_FIM));
      assert.deepEqual(r.json.sugestao_conjunto.reusar, []);
      assert.deepEqual(r.json.sugestao_conjunto.candidatas_novo, []);
    });
  });
}

test('conjunto: estampa de conjunto fora do catálogo é listada (md e json) e não quebra', async () => {
  const e = comEvidencia({ conjuntos: [{ conjunto: 'Conjunto Alfa', status: 'veiculando', estampas: ['Lua Verde', 'Estampa Fantasma'] }] });
  await com(e, (r) => {
    assert.equal(r.status, 0, r.stderr);
    assert.match(secaoConjunto(r.md), /estampas de conjunto fora do catálogo: Estampa Fantasma/i);
    assert.deepEqual(r.json.sugestao_conjunto.fora_do_catalogo, ['Estampa Fantasma']);
  });
});

test('conjunto: o CSV e o resto do relatório não mudam quando o campo é informado', async () => {
  const a = executar(comEvidencia());
  const b = executar(comEvidencia({ conjuntos: [{ conjunto: 'Conjunto Alfa', status: 'veiculando', estampas: ['Lua Verde'] }] }));
  try {
    assert.equal(a.csv, b.csv);
    assert.equal(a.csv.split('\n')[0], CSV_CABECALHO);
    const semSecao = (md) => md.replace(/^## Sugestão de conjunto[\s\S]*?(?=^## )/m, '');
    assert.equal(semSecao(a.md), semSecao(b.md));
  } finally { limpar(a); limpar(b); }
});

test('conjunto: sem o campo, a saída antiga segue igual e a seção nova fica entre Observações e a junção', async () => {
  await com(comEvidencia(), (r) => {
    const ordem = ['## Produzir', '## Investir', '## Rever', '## Observações (não comprovado)', '## Sugestão de conjunto', '## Qualidade da junção de nomes'].map((t) => r.md.indexOf(t));
    assert.ok(ordem.every((i) => i >= 0) && ordem.every((i, k) => k === 0 || i > ordem[k - 1]), String(ordem));
    assert.ok(r.json.comparacoes && r.json.juncao && r.json.vitrine && r.json.parametros, 'campos antigos preservados');
  });
});

for (const [nome, conjuntos] of [
  ['não array', 5], ['objeto', {}], ['item não objeto', [5]], ['item array', [[]]], ['item null', [null]],
  ['conjunto ausente', [{ status: 'x', estampas: [] }]], ['conjunto vazio', [{ conjunto: '', estampas: [] }]],
  ['conjunto branco', [{ conjunto: '   ', estampas: [] }]], ['conjunto número', [{ conjunto: 3, estampas: [] }]],
  ['estampas ausente', [{ conjunto: 'A' }]], ['estampas não array', [{ conjunto: 'A', estampas: 'Lua Verde' }]],
  ['estampas com número', [{ conjunto: 'A', estampas: ['Lua Verde', 7] }]], ['status número', [{ conjunto: 'A', status: 1, estampas: [] }]],
]) {
  test(`conjunto: entrada inválida (${nome}) sai com exit 1, mensagem clara e nenhum arquivo`, async () => {
    await com(comEvidencia({ conjuntos }), (r) => {
      assert.equal(r.status, 1, r.stderr);
      assert.match(r.stderr, /conjuntos/);
      assert.ok(!/TypeError|\n\s+at /.test(r.stderr), r.stderr);
      assert.equal(r.md, null); assert.equal(r.csv, null);
    });
  });
}

test('conjunto: PII dentro de "conjuntos" é recusada, com o campo na mensagem e sem arquivo', async () => {
  const e = comEvidencia({ conjuntos: [{ conjunto: 'Conjunto fulano@example.com', status: 'x', estampas: ['Lua Verde'] }] });
  await com(e, (r) => {
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /conjuntos\[0\]\.conjunto/);
    assert.equal(r.md, null); assert.equal(r.csv, null);
  });
  const e2 = comEvidencia({ conjuntos: [{ conjunto: 'A', status: 'x', estampas: ['Av. Brasil, 100'] }] });
  await com(e2, (r) => { assert.notEqual(r.status, 0); assert.match(r.stderr, /conjuntos\[0\]\.estampas\[0\]/); });
});

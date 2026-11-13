// Teste COMPORTAMENTAL do script da skill analisar-produto (hermes 1.4.0, critérios B1-B9; eixos do perfil desde a 2.0.0).
// O script roda de verdade como processo; fixtures SINTÉTICAS (o plugin é espelhado em repo
// público): nenhum nome real de item, e-mail, CPF, telefone ou endereço de pessoa.
//
// Contrato de CLI fixado por estes testes (references/ da skill o documenta):
//   node analisar-produto.mjs --entrada <entrada.json> --saida <dir>
//   - grava <dir>/analise-produto.md e <dir>/analise-produto.csv; exit 0
//   - stdout: JSON { parametros, comparacoes[], juncao, vitrine[] }
//   - PII na entrada: exit != 0, mensagem em stderr, NENHUM arquivo gravado
// Entrada: { periodo, vendas_internas_excluidas, eixos:[nomes], itens:[{item, meta_impressoes, meta_cliques,
//   ga4_views, ga4_compras}], catalogo:[{item, eixos:{<eixo>: <valor>}}], excecoes:[{de, para}],
//   parametros? }. Linha de itens pode trazer só os campos de UMA fonte (meta_* ou ga4_*).
// Os dois eixos fictícios dos helpers (familia, acabamento) reproduzem a análise de dois campos fixos de antes.

import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'analisar-produto');
const SCRIPT = join(SKILL_DIR, 'scripts', 'analisar-produto.mjs');

const CSV_CABECALHO = 'item,familia,acabamento,impressoes,cliques,views,compras,taxa_compra,fatia_impressoes,sinal_vitrine,bloco';

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
const EIXOS = ['familia', 'acabamento'];
const L = (item, imp, cli, views, compras) => ({ item, meta_impressoes: imp, meta_cliques: cli, ga4_views: views, ga4_compras: compras });
const C = (item, familia, acabamento) => ({ item, eixos: { familia, acabamento } });
const entrada = (itens, catalogo, extra = {}) => ({ periodo: '2026-09', vendas_internas_excluidas: 0, eixos: EIXOS, itens, catalogo, excecoes: [], ...extra });
const secaoAfirmado = (md) => md.split('## Leitura estatística: não comprovado')[0].split('## Leitura estatística: afirmado')[1] ?? '';
const secaoNao = (md) => md.split('## Leitura estatística: não comprovado')[1]?.split(/^## (?!Leitura)/m)[0] ?? '';
const cmp = (json, escopo, eixo = 'familia') => json.comparacoes.find((c) => c.eixo === eixo && c.escopo === escopo);

// Duas famílias, um acabamento, um item por família. Referências calculadas FORA do script (python, erfc).
function duasFamilias(comprasA, viewsA, comprasB, viewsB, extra = {}) {
  return entrada(
    [L('Lua Verde', 1000, 100, viewsA, comprasA), L('Sol Vermelho', 1000, 100, viewsB, comprasB)],
    [C('Lua Verde', 'FAM-A', 'X'), C('Sol Vermelho', 'FAM-B', 'X')], extra,
  );
}

// Paradoxo de Simpson sintético: total difere entre famílias; dentro de cada acabamento as taxas são iguais.
// Acabamento X rende 6%, acabamento Y rende 2%. FAM-A concentra X; FAM-B concentra Y.
function simpson(extra = {}) {
  return entrada([
    L('Lua Verde', 50000, 2000, 2000, 120), L('Mar Azul', 50000, 2000, 2000, 120),
    L('Noite Roxa', 20000, 800, 1000, 20),
    L('Sol Vermelho', 20000, 800, 1000, 60),
    L('Vento Prata', 50000, 2000, 2000, 40), L('Chuva Cinza', 50000, 2000, 2000, 40),
  ], [
    C('Lua Verde', 'FAM-A', 'X'), C('Mar Azul', 'FAM-A', 'X'), C('Noite Roxa', 'FAM-A', 'Y'),
    C('Sol Vermelho', 'FAM-B', 'X'), C('Vento Prata', 'FAM-B', 'Y'), C('Chuva Cinza', 'FAM-B', 'Y'),
  ], { vendas_internas_excluidas: 4, ...extra });
}

// ── B1: teste de duas proporções ─────────────────────────────────────────────
test('B1: z bicaudal bate o valor de referência e p < 0,05 (com poder) vira "comprovado"', async () => {
  // 200/4000 (5,0%) vs 120/4000 (3,0%): z = 4.56435, p = 5.0103e-06 (referência independente)
  await com(duasFamilias(200, 4000, 120, 4000), (r) => {
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
  await com(duasFamilias(150, 3000, 135, 3000), (r) => {
    const c = cmp(r.json, 'total');
    assert.ok(Math.abs(Math.abs(c.z) - 0.9104085692427798) < 1e-3, `z=${c.z}`);
    assert.ok(Math.abs(c.p - 0.36260708019282384) < 1e-3, `p=${c.p}`);
    assert.equal(c.rotulo, 'não comprovado');
  });
});

// ── B2: controle de confusão (família dentro de cada acabamento) ─────────────
test('B2: total mostra diferença significativa; dentro de cada acabamento ela some e a conclusão é "não comprovado"', async () => {
  await com(simpson(), (r) => {
    assert.equal(r.status, 0, r.stderr);
    const total = cmp(r.json, 'total');
    assert.ok(total && total.p < 1e-6 && total.rotulo === 'comprovado', 'o total deveria mostrar diferença significativa (referência z=6.1237)');
    for (const acabamento of ['X', 'Y']) {
      const c = cmp(r.json, `acabamento:${acabamento}`);
      assert.ok(c, `comparação dentro do acabamento ${acabamento} ausente`);
      assert.ok(Math.abs(c.p - 1) < 1e-6, `p dentro de ${acabamento}=${c.p}`);
      assert.equal(c.rotulo, 'não comprovado');
    }
    // sem o ajuste por acabamento, o total ficaria "afirmado": estas duas linhas travam a mutação [M] "remover o ajuste"
    assert.equal(total.confundida, true, 'o total deve sair confundido pelo acabamento');
    assert.ok(!/^- Total \(familia\):/m.test(secaoAfirmado(r.md)), 'o total confundido não pode estar em "afirmado"');
    assert.match(r.md, /inversão \(paradoxo de Simpson\): acabamento explica o total/);
    assert.match(r.md, /dentro de acabamento/i, 'o relatório traz a leitura dentro do acabamento');
    assert.match(r.md, /total/i, 'o relatório traz a leitura do total');
    assert.match(r.md, /não comprovado/);
  });
});

// ── B3: os eixos vêm do catálogo, nunca do ledger (teste de cegueira) ────────
test('B3: eixo do ledger divergente é ignorada; a saída usa a tabela de catálogo', async () => {
  const e = duasFamilias(200, 4000, 120, 4000);
  e.itens = e.itens.map((l) => ({ ...l, eixos: { familia: 'FAM-ERRADA-DO-LEDGER', acabamento: 'ACAB-ERRADO-DO-LEDGER' } }));
  await com(e, (r) => {
    assert.equal(r.status, 0, r.stderr);
    assert.ok(!r.csv.includes('FAM-ERRADA-DO-LEDGER') && !r.md.includes('FAM-ERRADA-DO-LEDGER'));
    assert.ok(!r.stdout.includes('FAM-ERRADA-DO-LEDGER'));
    const linhas = r.csv.trim().split('\n').map((l) => l.split(','));
    const col = linhas[0].indexOf('familia');
    assert.ok(col >= 0, 'coluna familia ausente no csv');
    const porItem = Object.fromEntries(linhas.slice(1).map((l) => [l[0], l[col]]));
    assert.equal(porItem['Lua Verde'], 'FAM-A');
    assert.equal(porItem['Sol Vermelho'], 'FAM-B');
    const c = cmp(r.json, 'total');
    assert.deepEqual([c.a, c.b].sort(), ['FAM-A', 'FAM-B']);
  });
});

// ── B4: junção de nomes ──────────────────────────────────────────────────────
function entradaJuncao() {
  const catalogo = [
    C('Lua Verde', 'FAM-A', 'X'), C('Sol Vermelho', 'FAM-B', 'X'),
    C('Mar Azul Profundo', 'FAM-A', 'Y'), C('Vento Prata', 'FAM-B', 'Y'),
  ];
  const itens = [
    { item: 'lua  verde!', ga4_views: 1000, ga4_compras: 50 },                      // normalização
    { item: 'Verde Lua', meta_impressoes: 9000, meta_cliques: 90 },                 // mesmos tokens
    { item: 'Mar Azul', meta_impressoes: 5000, meta_cliques: 50 },                  // Jaccard 2/3
    { item: 'Apelido Estranho', ga4_views: 800, ga4_compras: 20 },                  // só por exceção
    { item: 'Lua Dourada Rara', ga4_views: 300, ga4_compras: 3 },                   // Jaccard 1/4: não casa (ga4)
    { item: 'Brisa Escarlate', meta_impressoes: 700, meta_cliques: 7 },             // não casa (meta)
    { item: 'Sol Vermelho v1', meta_impressoes: 4000, meta_cliques: 40 },           // v1 e v2 caem em 'Sol Vermelho'
    { item: 'Sol Vermelho v2', meta_impressoes: 4000, meta_cliques: 40 },
    { item: 'Vento Prata', ga4_views: 500, ga4_compras: 10 },
  ];
  return entrada(itens, catalogo, { excecoes: [{ de: 'Apelido Estranho', para: 'Mar Azul Profundo' }] });
}

test('B4: casa variações (normalização, Jaccard >= 0,5, exceção) e lista o que não casou por fonte', async () => {
  await com(entradaJuncao(), (r) => {
    assert.equal(r.status, 0, r.stderr);
    const nao = r.json.juncao.naoCasou;
    assert.ok(nao.some((n) => n.item === 'Lua Dourada Rara' && n.fonte === 'ga4'), JSON.stringify(nao));
    assert.ok(nao.some((n) => n.item === 'Brisa Escarlate' && n.fonte === 'meta'), JSON.stringify(nao));
    for (const casada of ['lua  verde!', 'Verde Lua', 'Mar Azul', 'Apelido Estranho', 'Sol Vermelho v1', 'Vento Prata']) {
      assert.ok(!nao.some((n) => n.item === casada), `"${casada}" deveria casar`);
    }
    assert.match(r.md, /Lua Dourada Rara/, 'o relatório lista o que não casou');
    // linhas das duas fontes da mesmo item são somadas no alvo do catálogo
    const linhas = r.csv.trim().split('\n').map((l) => l.split(','));
    const h = linhas[0];
    const luaVerde = linhas.slice(1).find((l) => l[0] === 'Lua Verde');
    assert.equal(Number(luaVerde[h.indexOf('views')]), 1000);
    assert.equal(Number(luaVerde[h.indexOf('impressoes')]), 9000);
  });
});

test('B4: auditoria de colisões alerta quando dois itens distintos caem no mesmo alvo', async () => {
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
    L('Lua Verde', 500000, 5000, 5000, 100),
    L('Sol Vermelho', 245000, 5000, 5000, 340),
    L('Mar Azul', 245000, 5000, 5000, 340),
    L('Noite Roxa', 10000, 5000, 5000, 750),
  ], [C('Lua Verde', 'FAM-A', 'X'), C('Sol Vermelho', 'FAM-A', 'X'), C('Mar Azul', 'FAM-B', 'X'), C('Noite Roxa', 'FAM-B', 'X')], extra);
}
const PARAMETROS = { fatiaAlta: 0.4, fatiaBaixa: 0.05, razaoConversaoBaixa: 0.7, razaoConversaoAlta: 1.3 };

test('B5: sinaliza fatia alta com conversão baixa e fatia baixa com conversão alta', async () => {
  await com(entradaVitrine({ parametros: PARAMETROS }), (r) => {
    assert.equal(r.status, 0, r.stderr);
    const v = Object.fromEntries(r.json.vitrine.map((x) => [x.item, x]));
    assert.ok(Math.abs(v['Lua Verde'].fatia - 0.5) < 1e-9);
    assert.ok(Math.abs(v['Lua Verde'].taxaCompra - 0.02) < 1e-9);
    assert.equal(v['Lua Verde'].sinal, 'fatia-alta-conversao-baixa');
    assert.equal(v['Noite Roxa'].sinal, 'fatia-baixa-conversao-alta');
    assert.ok(!v['Sol Vermelho'].sinal && !v['Mar Azul'].sinal, 'itens medianos não sinalizam');
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
  await com(duasFamilias(50, 1000, 30, 1000), (r) => {
    assert.equal(r.status, 0, r.stderr);
    const c = cmp(r.json, 'total');
    assert.ok(Math.abs(c.p - 0.02247887336612527) < 1e-4, `p=${c.p}`);
    assert.ok(Math.abs(c.nMinimo - 1505.8) < 2, `nMinimo=${c.nMinimo}`);
    assert.equal(c.semPoder, true);
    assert.equal(c.rotulo, 'sem poder para afirmar');
    assert.notEqual(c.rotulo, 'comprovado');
    assert.match(r.md, /sem poder para afirmar/);
    const afirmado = r.md.split(/^#{1,4} .*[Nn]ão comprovado/m)[0].split(/^#{1,4} .*[Aa]firmado/m)[1] || '';
    assert.ok(!/FAM-A/.test(afirmado), 'a comparação sem poder não pode aparecer em "afirmado"');
  });
});

test('B6: amostra adequada tem semPoder false', async () => {
  await com(duasFamilias(200, 4000, 120, 4000), (r) => {
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
    e.itens[0] = { ...e.itens[0], observacao: `contato ${valor}` };
    await com(e, (r) => {
      assert.notEqual(r.status, 0, 'PII deveria derrubar o script');
      assert.ok(r.stderr.trim().length > 0, 'a recusa precisa de mensagem em stderr');
      assert.equal(r.md, null);
      assert.equal(r.csv, null);
    });
  });
}

test('B7: vendas_internas_excluidas numérico é aceito e as saídas .md/.csv não têm padrão de e-mail/CPF/telefone', async () => {
  await com(simpson(), (r) => {
    assert.equal(r.status, 0, r.stderr);
    for (const texto of [r.md, r.csv]) {
      assert.ok(!/[\w.+-]+@[\w-]+\.[\w.-]+/.test(texto), 'e-mail na saída');
      assert.ok(!/\d{3}\.\d{3}\.\d{3}-\d{2}/.test(texto), 'CPF na saída');
      assert.ok(!/\(\d{2}\)\s?9?\d{4}-\d{4}|\b\d{2}\s?9\d{4}-\d{4}\b/.test(texto), 'telefone na saída');
    }
  });
});

test('N2: o relatório diz que as vendas internas saíram só da fonte de vendas e que o GA4 pode incluí-las', async () => {
  await com(simpson(), (r) => {
    assert.equal(r.status, 0, r.stderr);
    assert.ok(r.md.includes('Vendas internas retiradas da fonte de vendas: 4 unidades. A fonte de tráfego (GA4) não as separa: as taxas de compra abaixo (GA4) podem incluí-las.'), 'frase nova ausente');
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
    assert.equal(linhas.length, 7, 'uma linha por item do catálogo + cabeçalho');
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

// ── entrada incoerente: recusa por item, sem relatório parcial ─────────────
const recusada = async (itens, campo) => {
  const ent = entrada(itens, [C('Lua Verde', 'FAM-A', 'X'), C('Sol Vermelho', 'FAM-B', 'X')]);
  await com(ent, (r) => {
    assert.notEqual(r.status, 0, 'entrada incoerente deve ser recusada');
    assert.match(r.stderr, /Lua Verde/);
    assert.match(r.stderr, new RegExp(campo));
    assert.equal(r.md, null, 'sem relatório parcial');
    assert.equal(r.csv, null, 'sem relatório parcial');
  });
};
const OK = L('Sol Vermelho', 1000, 100, 500, 10);

test('entrada: ga4_compras > ga4_views é recusada com item e campo', async () => {
  await recusada([L('Lua Verde', 1000, 100, 50, 60), OK], 'ga4_compras');
});

test('entrada: ga4_compras sem ga4_views é recusada', async () => {
  await recusada([{ item: 'Lua Verde', ga4_compras: 3 }, OK], 'ga4_views');
});

test('entrada: meta_cliques > meta_impressoes é recusada com item e campo', async () => {
  await recusada([L('Lua Verde', 100, 200, 500, 10), OK], 'meta_cliques');
});

test('entrada: valor negativo é recusado com item e campo', async () => {
  await recusada([L('Lua Verde', 1000, 100, 500, -1), OK], 'ga4_compras');
});

test('entrada: valor não numérico é recusado com item e campo', async () => {
  await recusada([L('Lua Verde', '1000', 100, 500, 10), OK], 'meta_impressoes');
});

test('entrada válida: nenhum NaN/Infinity no .md, .csv ou stdout', async () => {
  await com(duasFamilias(10, 500, 20, 500), (r) => {
    assert.equal(r.status, 0, r.stderr);
    for (const t of [r.md, r.csv, r.stdout]) assert.ok(!/NaN|Infinity/.test(t));
  });
});


// ══ Correção pós-revisão (itens 1-8) ═════════════════════════════════════════
const rodarEm = (dir, arq, saida) => spawnSync(process.execPath, [SCRIPT, '--entrada', arq, '--saida', saida], { encoding: 'utf8' });

// 1: paradoxo de Simpson com REVERSÃO. Total A 4,20% > B 3,00% (p=5e-6); dentro de cada acabamento B > A.
const reversao = () => entrada([
  L('Lua Verde', 1000, 100, 8000, 400), L('Mar Azul', 1000, 100, 2000, 20),
  L('Sol Vermelho', 1000, 100, 2000, 140), L('Vento Prata', 1000, 100, 8000, 160),
], [C('Lua Verde', 'FAM-A', 'X'), C('Mar Azul', 'FAM-A', 'Y'), C('Sol Vermelho', 'FAM-B', 'X'), C('Vento Prata', 'FAM-B', 'Y')]);

test('1: reversão de Simpson: efeito ajustado em sentido oposto nunca vai para "afirmado"', async () => {
  await com(reversao(), (r) => {
    assert.equal(r.status, 0, r.stderr);
    const total = cmp(r.json, 'total');
    assert.equal(total.rotulo, 'comprovado');
    assert.ok(total.p < 1e-4 && total.taxaA > total.taxaB, 'o total mostra A > B');
    assert.equal(total.confundida, true);
    assert.ok(!/^- Total \(familia\):/m.test(secaoAfirmado(r.md)), 'o total não pode estar em "afirmado"');
    assert.match(secaoNao(r.md), /^- Total \(familia\):.*não comprovado após ajuste por acabamento/m);
  });
});

test('1: efeito de mesmo sentido em todos os estratos continua afirmado para a família', async () => {
  const e = entrada([
    L('Lua Verde', 1000, 100, 10000, 600), L('Mar Azul', 1000, 100, 10000, 200),
    L('Sol Vermelho', 1000, 100, 10000, 400), L('Vento Prata', 1000, 100, 10000, 100),
  ], [C('Lua Verde', 'FAM-A', 'X'), C('Mar Azul', 'FAM-A', 'Y'), C('Sol Vermelho', 'FAM-B', 'X'), C('Vento Prata', 'FAM-B', 'Y')]);
  await com(e, (r) => {
    const total = cmp(r.json, 'total');
    assert.equal(total.rotulo, 'comprovado');
    assert.ok(!total.confundida, 'mesmo sentido e significativo: não é confusão');
    assert.match(secaoAfirmado(r.md), /^- Total \(familia\):/m);
  });
});

// 2: blocos de ação exigem p < 0,05 com poder (item vs resto)
test('2: item com 6/200 vs resto 200/10000 (p=0,32) não vai para Produzir; fica em Observações sem verbo de ação', async () => {
  const e = entrada([L('Lua Verde', 1000, 100, 200, 6), L('Sol Vermelho', 1000, 100, 10000, 200)],
    [C('Lua Verde', 'FAM-A', 'X'), C('Sol Vermelho', 'FAM-B', 'X')]);
  await com(e, (r) => {
    assert.equal(r.status, 0, r.stderr);
    const v = r.json.vitrine.find((x) => x.item === 'Lua Verde');
    assert.equal(v.bloco, '');
    assert.equal(v.evidencia, 'não comprovado');
    assert.ok('fatia' in v && 'taxaCompra' in v && 'sinal' in v, 'campos existentes preservados');
    const produzir = r.md.split('## Produzir')[1].split('## Investir')[0];
    assert.ok(!/Lua Verde/.test(produzir) && /nenhum item com evid[eê]ncia/i.test(produzir), produzir);
    for (const t of ['Produzir', 'Investir', 'Rever']) assert.match(r.md, new RegExp(`^## ${t}`, 'm'));
    const obs = r.md.split(/^## Observações \(não comprovado\)/m)[1].split(/^## /m)[0];
    assert.match(obs, /Lua Verde/);
    assert.ok(!/produzir|investir|rever/i.test(obs), 'observação sem verbo de ação');
    assert.equal(r.csv.split('\n').find((l) => l.startsWith('Lua Verde')).split(',').pop(), '', 'coluna bloco vazia no csv');
  });
});

test('2: com evidência (p < 0,05 e poder) o item entra em Produzir', async () => {
  const e = entrada([L('Lua Verde', 5000, 100, 4000, 120), L('Sol Vermelho', 5000, 100, 20000, 400)],
    [C('Lua Verde', 'FAM-A', 'X'), C('Sol Vermelho', 'FAM-B', 'X')]);
  await com(e, (r) => {
    const v = r.json.vitrine.find((x) => x.item === 'Lua Verde');
    assert.equal(v.evidencia, 'comprovado');
    assert.equal(v.bloco, 'produzir');
    assert.match(r.md.split('## Produzir')[1].split('## Investir')[0], /Lua Verde/);
  });
});

// 3: PII, contornos
const comObs = (valor, extra) => { const e = simpson(); e.itens[0] = { ...e.itens[0], observacao: valor, ...extra }; return e; };
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
  e.itens[0].item = 'Estrada Real 2'; e.catalogo[0].item = 'Estrada Real 2';
  await com(e, (r) => { assert.notEqual(r.status, 0); assert.match(r.stderr, /renome/i); assert.match(r.stderr, /itens\[0\]\.item/); });
  assert.match(readFileSync(join(SKILL_DIR, 'references', 'contrato.md'), 'utf8'), /Estrada Real 2/, 'limitação documentada no contrato');
});

test('3: a SAÍDA também é varrida: valor de eixo "Rua" ecoado no md vira endereço e bloqueia, sem arquivo', async () => {
  const e = entrada([L('Lua Verde', 1000, 100, 200, 6), L('Sol Vermelho', 1000, 100, 10000, 200)],
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
    { item: 'Lua Verde', meta_impressoes: 1000, meta_cliques: 10 },
    { item: 'Lua Verde Neon', ga4_views: 1000, ga4_compras: 300 },
    L('Sol Vermelho', 1000, 100, 1000, 30),
  ], [C('Lua Verde', 'FAM-A', 'X'), C('Sol Vermelho', 'FAM-B', 'X')]);
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
    { item: 'Lua Verde v1', meta_impressoes: 1000, meta_cliques: 10 },
    { item: 'Lua Verde Neon', ga4_views: 1000, ga4_compras: 30 },
    L('Sol Vermelho', 1000, 100, 1000, 30),
  ], [C('Lua Verde', 'FAM-A', 'X'), C('Sol Vermelho', 'FAM-B', 'X')]);
  await com(e, (r) => {
    const col = r.json.juncao.colisoes.find((c) => c.alvo === 'Lua Verde');
    assert.ok(col, JSON.stringify(r.json.juncao));
    assert.deepEqual([...col.origens].sort(), ['Lua Verde Neon', 'Lua Verde v1']);
  });
});

// 5: injeção em csv/markdown
test('5: csv neutraliza células = + - @ e aspa \\r; md não injeta seção por quebra de linha', async () => {
  const e = entrada([
    L('=SOMA(A1)', 1000, 100, 1000, 10), L('@cmd', 1000, 100, 1000, 10),
    L('+soma', 1000, 100, 1000, 10), L('-menos', 1000, 100, 1000, 10),
    L('Com\rCR', 1000, 100, 1000, 10),
    { item: 'Falsa\n## Seção Falsa\n- injetado', ga4_views: 10, ga4_compras: 1 },
  ], [C('=SOMA(A1)', 'FAM-A', 'X'), C('@cmd', 'FAM-B', 'X'), C('+soma', 'FAM-B', 'X'), C('-menos', 'FAM-B', 'X'), C('Com\rCR', 'FAM-B', 'X')]);
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
    await com({ ...duasFamilias(200, 4000, 120, 4000), ...extra }, (r) => {
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
test('7: "não separável" nomeia o eixo controlado: acabamento no total de famílias, família no total de acabamentos', async () => {
  const e = entrada([L('Lua Verde', 1000, 100, 4000, 200), L('Sol Vermelho', 1000, 100, 4000, 120)],
    [C('Lua Verde', 'FAM-A', 'X'), C('Sol Vermelho', 'FAM-B', 'Y')]);
  await com(e, (r) => {
    const linhas = secaoNao(r.md).split('\n');
    const deFamilia = linhas.find((l) => l.startsWith('- Total (familia)'));
    const deAcabamento = linhas.find((l) => l.startsWith('- Total (acabamento)'));
    assert.ok(deFamilia && /não separável de acabamento/.test(deFamilia) && !/de familia/.test(deFamilia), deFamilia);
    assert.ok(deAcabamento && /não separável de familia/.test(deAcabamento) && !/de acabamento/.test(deAcabamento), deAcabamento);
  });
});

// 8: sobrescrita avisa em stderr
test('8: sobrescrita de analise-produto.md/csv avisa em stderr e mantém exit 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hermes-produto-'));
  try {
    const arq = join(dir, 'entrada.json'); const saida = join(dir, 'saida');
    writeFileSync(arq, JSON.stringify(duasFamilias(200, 4000, 120, 4000)));
    const a = rodarEm(dir, arq, saida);
    assert.equal(a.status, 0, a.stderr); assert.ok(!/sobrescrevendo/.test(a.stderr), 'primeira execução não avisa');
    const b = rodarEm(dir, arq, saida);
    assert.equal(b.status, 0, b.stderr);
    assert.match(b.stderr, /sobrescrevendo .*analise-produto\.md/);
    assert.match(b.stderr, /sobrescrevendo .*analise-produto\.csv/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── Sugestão de conjunto (Fase 1: SÓ sugestão; a skill nunca cria nada) ──────
// Dois itens com evidência (Produzir) e uma abaixo da média, fixture sintética.
const comEvidencia = (extra = {}) => entrada([
  L('Lua Verde', 5000, 100, 4000, 120), L('Mar Azul', 5000, 100, 4000, 120),
  L('Sol Vermelho', 5000, 100, 40000, 400),
], [C('Lua Verde', 'FAM-A', 'X'), C('Mar Azul', 'FAM-A', 'X'), C('Sol Vermelho', 'FAM-B', 'X')], extra);
const secaoConjunto = (md) => md.split(/^## Sugestão de conjunto/m)[1]?.split(/^## /m)[0] ?? null;
const AVISO_FIM = 'Isto é só sugestão: a skill não cria nada. Antes de criar, avalie usar um conjunto existente compatível; cada conjunto novo reinicia o aprendizado da plataforma e divide a verba.';
const TEXTO_AUSENTE = 'Não foi informada a lista de conjuntos existentes: não dá para checar se algum já serve. Confira na conta antes de criar qualquer um.';
const TEXTO_NENHUMA = 'Nenhum item tem evidência estatística para conjunto próprio. Não criar conjunto agora.';

test('conjunto: item com evidência coberta por conjuntos existentes vira "reusar" (todos listados, com status)', async () => {
  const e = comEvidencia({ conjuntos: [
    { conjunto: 'Conjunto Alfa', status: 'veiculando', itens: ['lua  verde', 'Mar Azul'] },
    { conjunto: 'Conjunto Beta', status: 'pausado', itens: ['Lua Verde'] },
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
      { item: 'Lua Verde', conjuntos: [{ conjunto: 'Conjunto Alfa', status: 'veiculando' }, { conjunto: 'Conjunto Beta', status: 'pausado' }] },
      { item: 'Mar Azul', conjuntos: [{ conjunto: 'Conjunto Alfa', status: 'veiculando' }] },
    ]);
    assert.deepEqual(sc.candidatas_novo, []);
    assert.deepEqual(sc.fora_do_catalogo, []);
    assert.equal(sc.aviso, AVISO_FIM);
  });
});

test('conjunto: com evidência e sem cobertura vira "candidatas a um conjunto novo: A, B" (só candidatas)', async () => {
  const e = comEvidencia({ conjuntos: [{ conjunto: 'Conjunto Alfa', status: 'veiculando', itens: ['Lua Verde'] }] });
  await com(e, (r) => {
    const s = secaoConjunto(r.md);
    assert.match(s, /Lua Verde.*reusar: Conjunto Alfa/);
    assert.match(s, /candidatas a um conjunto novo: Mar Azul/);
    assert.deepEqual(r.json.sugestao_conjunto.candidatas_novo, ['Mar Azul']);
    assert.ok(!/Sol Vermelho/.test(s), 'sem evidência não entra');
  });
});

test('conjunto: duas sem cobertura listam as duas, separadas por vírgula', async () => {
  await com(comEvidencia({ conjuntos: [{ conjunto: 'Outro', status: 'pausado', itens: ['Sol Vermelho'] }] }), (r) => {
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

for (const [nome, extra] of [['sem o campo', {}], ['com conjuntos', { conjuntos: [{ conjunto: 'Conjunto Alfa', status: 'veiculando', itens: ['Lua Verde'] }] }]]) {
  test(`conjunto: nenhum item com evidência => texto fixo (${nome})`, async () => {
    await com(duasFamilias(150, 3000, 135, 3000, extra), (r) => {
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

test('conjunto: item de conjunto fora do catálogo é listada (md e json) e não quebra', async () => {
  const e = comEvidencia({ conjuntos: [{ conjunto: 'Conjunto Alfa', status: 'veiculando', itens: ['Lua Verde', 'Item Fantasma'] }] });
  await com(e, (r) => {
    assert.equal(r.status, 0, r.stderr);
    assert.match(secaoConjunto(r.md), /itens de conjunto fora do catálogo: Item Fantasma/i);
    assert.deepEqual(r.json.sugestao_conjunto.fora_do_catalogo, ['Item Fantasma']);
  });
});

test('conjunto: o CSV e o resto do relatório não mudam quando o campo é informado', async () => {
  const a = executar(comEvidencia());
  const b = executar(comEvidencia({ conjuntos: [{ conjunto: 'Conjunto Alfa', status: 'veiculando', itens: ['Lua Verde'] }] }));
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
  ['conjunto ausente', [{ status: 'x', itens: [] }]], ['conjunto vazio', [{ conjunto: '', itens: [] }]],
  ['conjunto branco', [{ conjunto: '   ', itens: [] }]], ['conjunto número', [{ conjunto: 3, itens: [] }]],
  ['itens ausente', [{ conjunto: 'A' }]], ['itens não array', [{ conjunto: 'A', itens: 'Lua Verde' }]],
  ['itens com número', [{ conjunto: 'A', itens: ['Lua Verde', 7] }]], ['status número', [{ conjunto: 'A', status: 1, itens: [] }]],
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
  const e = comEvidencia({ conjuntos: [{ conjunto: 'Conjunto fulano@example.com', status: 'x', itens: ['Lua Verde'] }] });
  await com(e, (r) => {
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /conjuntos\[0\]\.conjunto/);
    assert.equal(r.md, null); assert.equal(r.csv, null);
  });
  const e2 = comEvidencia({ conjuntos: [{ conjunto: 'A', status: 'x', itens: ['Av. Brasil, 100'] }] });
  await com(e2, (r) => { assert.notEqual(r.status, 0); assert.match(r.stderr, /conjuntos\[0\]\.itens\[0\]/); });
});

// ══ hermes 1.5.0 (SPEC pós-Q4, critério A7, Apêndice 3): lacunas de portfólio e re-estética ══════════
// Contrato fixado por estes casos (references/contrato.md da skill o documenta):
//   - parametros ganha lacunaMaxItens (1), razaoCliqueAlta (1,3) e razaoCompraBaixa (0,7): nomeados,
//     ecoados em stdout.parametros e sobrescrevíveis; chave desconhecida continua exit 1.
//   - stdout.lacunas[] = { celula: {<eixo>: <valor>}, itens }: cada célula (um valor por eixo) presente no
//     CATÁLOGO com contagem de itens do catálogo <= lacunaMaxItens, ordenada por contagem e depois pela
//     ordem dos eixos. No .md: seção "## Lacunas de portfólio".
//   - stdout.reestetica[]: item com CTR (cliques/impressões) >= razaoCliqueAlta x o CTR médio e taxa de
//     compra <= razaoCompraBaixa x a média, com >= minViewsSinal views. comprovada: true só com CTR maior que
//     o resto E compra menor que o resto, os dois com p < 0,05 e poder; senão comprovada: false. No .md: a
//     comprovada vai para "## Candidatas a re-estética" (mesma ideia, nova cor, fonte ou estrutura); a sem
//     evidência só aparece em "## Observações (não comprovado)", sem recomendação.
//   - CSV inalterado: mesmo cabeçalho e mesmas linhas.

// texto da seção "## <titulo>" até o próximo "## " (null se a seção não existe)
const secaoMd = (md, titulo) => {
  const linhas = md.split('\n');
  const i = linhas.findIndex((l) => l.startsWith(`## ${titulo}`));
  if (i < 0) return null;
  const fim = linhas.findIndex((l, k) => k > i && l.startsWith('## '));
  return linhas.slice(i + 1, fim < 0 ? linhas.length : fim).join('\n');
};
// linhas da seção que citam a célula: a família, o acabamento como palavra inteira e (se dada) a contagem como número inteiro
const linhasDaCelula = (secao, familia, valor, n) => secao.split('\n').filter((l) => {
  if (!l.includes(familia)) return false;
  const resto = l.split(familia).join(' ');
  return new RegExp(`\\b${valor}\\b`).test(resto) && (n === undefined || new RegExp(`(^|\\D)${n}(\\D|$)`).test(resto));
});

// Catálogo FAM-A/FAM-B × acabamentos X/Y com (A,X)=2, (A,Y)=1, (B,X)=1, (B,Y)=0. A lacuna conta itens do
// CATÁLOGO: 'Noite Roxa' não tem linha de dados e conta em (A,Y); 'Brisa Escarlate' diz FAM-B/Y no ledger mas
// não está no catálogo, e o ledger de 'Sol Vermelho' diz acabamento Y (o catálogo diz X): nenhum dos dois preenche (B,Y).
const lacunasPortfolio = (extra = {}) => entrada([
  L('Lua Verde', 1000, 30, 500, 20), L('Mar Azul', 1000, 30, 500, 20),
  L('Sol Vermelho', 1000, 30, 500, 20), L('Brisa Escarlate', 1000, 30, 500, 20),
], [C('Lua Verde', 'FAM-A', 'X'), C('Mar Azul', 'FAM-A', 'X'), C('Noite Roxa', 'FAM-A', 'Y'), C('Sol Vermelho', 'FAM-B', 'X')], extra);
const lacuna = (familia, acabamento, itens) => ({ celula: { familia, acabamento }, itens });
const LACUNAS_PADRAO = [ // lacunaMaxItens 1: contagem crescente, depois a ordem dos eixos
  lacuna('FAM-B', 'Y', 0), lacuna('FAM-A', 'Y', 1), lacuna('FAM-B', 'X', 1),
];

test('A7: lacunas de portfólio listam as células familia × acabamento do catálogo com até lacunaMaxItens itens, por contagem e nome', async () => {
  await com(lacunasPortfolio(), (r) => {
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(r.json.lacunas, LACUNAS_PADRAO);
    const secao = secaoMd(r.md, 'Lacunas de portfólio');
    assert.ok(secao !== null, 'seção "## Lacunas de portfólio" ausente no .md');
    for (const { celula, itens } of LACUNAS_PADRAO) {
      assert.ok(linhasDaCelula(secao, celula.familia, celula.acabamento, itens).length > 0, `célula ${celula.familia} × ${celula.acabamento} (${itens}) não listada:\n${secao}`);
    }
    assert.equal(linhasDaCelula(secao, 'FAM-A', 'X').length, 0, `FAM-A × X tem 2 itens e não é lacuna:\n${secao}`);
  });
});

test('A7: lacunaMaxItens 0 deixa só a célula zerada e parametros ecoa os defaults novos 1, 1,3 e 0,7', async () => {
  await com(lacunasPortfolio({ parametros: { lacunaMaxItens: 0 } }), (r) => {
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.json.parametros.lacunaMaxItens, 0);
    assert.deepEqual(r.json.lacunas, [lacuna('FAM-B', 'Y', 0)]);
    const secao = secaoMd(r.md, 'Lacunas de portfólio');
    assert.ok(secao !== null, 'seção "## Lacunas de portfólio" ausente no .md');
    assert.ok(linhasDaCelula(secao, 'FAM-B', 'Y', 0).length > 0, `célula FAM-B × Y (0) não listada:\n${secao}`);
    assert.ok(!secao.includes('FAM-A') && linhasDaCelula(secao, 'FAM-B', 'X').length === 0, `só a célula zerada:\n${secao}`);
    assert.equal(r.json.parametros.razaoCliqueAlta, 1.3, 'não informado: default de razaoCliqueAlta');
    assert.equal(r.json.parametros.razaoCompraBaixa, 0.7, 'não informado: default de razaoCompraBaixa');
  });
  await com(lacunasPortfolio(), (r) => {
    assert.equal(r.status, 0, r.stderr);
    const { lacunaMaxItens, razaoCliqueAlta, razaoCompraBaixa } = r.json.parametros;
    assert.deepEqual({ lacunaMaxItens, razaoCliqueAlta, razaoCompraBaixa }, { lacunaMaxItens: 1, razaoCliqueAlta: 1.3, razaoCompraBaixa: 0.7 });
  });
});

// Re-estética: 'Lua Verde' (FAM-A, Y) chama clique e não vende; o resto ('Mar Azul', 'Sol Vermelho') tem CTR 3% e
// compra 4%. Referências calculadas FORA do script (python, erfc, mesma fórmula de contrato.md):
//   clique 300/2000 (15%) vs 600/20000: z=25,8, p=3,9e-147, n mínimo 88 (menor grupo 2000);
//   compra 2/1000 (0,2%) vs 400/10000: z=-6,11, p=1,0e-9, n mínimo 222 (menor grupo 1000).
// CTR da candidata = 3,7x o CTR agregado (5x o resto, 2,1x a média simples); compra = 0,055x a média: corte com folga.
const reestetica = ({ imp, cli, views, compras }, extra = {}) => entrada([
  L('Lua Verde', imp, cli, views, compras),
  L('Mar Azul', 10000, 300, 5000, 200), L('Sol Vermelho', 10000, 300, 5000, 200),
], [C('Lua Verde', 'FAM-A', 'Y'), C('Mar Azul', 'FAM-A', 'X'), C('Sol Vermelho', 'FAM-B', 'X')], extra);
const REESTETICA_COMPROVADA = { imp: 2000, cli: 300, views: 1000, compras: 2 };
const candidatasReestetica = (r) => secaoMd(r.md, 'Candidatas a re-estética');
const observacoes = (r) => secaoMd(r.md, 'Observações (não comprovado)');

test('A7: re-estética comprovada exige CTR acima e compra abaixo do resto, os dois com p < 0,05 e poder', async () => {
  await com(reestetica(REESTETICA_COMPROVADA), (r) => {
    assert.equal(r.status, 0, r.stderr);
    assert.ok(Array.isArray(r.json.reestetica), `stdout sem reestetica[]: ${Object.keys(r.json)}`);
    const lua = r.json.reestetica.filter((x) => x.item === 'Lua Verde');
    assert.equal(lua.length, 1, JSON.stringify(r.json.reestetica));
    assert.equal(lua[0].comprovada, true);
    assert.ok(!r.json.reestetica.some((x) => x.item === 'Mar Azul' || x.item === 'Sol Vermelho'), 'CTR e compra na média não são candidatas');
    const secao = candidatasReestetica(r);
    assert.ok(secao !== null, 'seção "## Candidatas a re-estética" ausente no .md');
    assert.match(secao, /Lua Verde/);
    assert.ok(secao.includes('nova cor, fonte ou estrutura'), secao);
    assert.ok(!/Mar Azul|Sol Vermelho/.test(secao), secao);
    assert.ok(!/Lua Verde/.test(observacoes(r) ?? ''), 'a comprovada não se repete em Observações');
  });
});

// Mesmo padrão (CTR alto, compra baixa, corte atingido) sem evidência em um dos lados. Referências FORA do script:
const SEM_EVIDENCIA = [
  // compra 5/250 (2%) vs 400/10000: z=-1,60, p=0,109; clique 60/400 comprovado (p=4e-41, n mínimo 88)
  ['compra não significativa', { imp: 400, cli: 60, views: 250, compras: 5 }],
  // compra 2/250 (0,8%) vs 400/10000: p=0,010, mas n mínimo 358 > 250 views (sem poder); clique comprovado
  ['compra sem poder', { imp: 400, cli: 60, views: 250, compras: 2 }],
  // clique 24/400 (6%) vs 600/20000: p=0,00056, mas n mínimo 748 > 400 impressões (sem poder); compra comprovada
  ['clique sem poder', { imp: 400, cli: 24, views: 1000, compras: 2 }],
];
for (const [nome, lua] of SEM_EVIDENCIA) {
  test(`A7: re-estética sem evidência por ${nome}: comprovada false e só em Observações, sem recomendação`, async () => {
    await com(reestetica(lua), (r) => {
      assert.equal(r.status, 0, r.stderr);
      assert.ok(Array.isArray(r.json.reestetica), `stdout sem reestetica[]: ${Object.keys(r.json)}`);
      const x = r.json.reestetica.find((c) => c.item === 'Lua Verde');
      assert.ok(x, `o item passou no corte e deve ser listada: ${JSON.stringify(r.json.reestetica)}`);
      assert.equal(x.comprovada, false);
      assert.ok(!/Lua Verde/.test(candidatasReestetica(r) ?? ''), 'sem evidência não entra em "Candidatas a re-estética"');
      const obs = observacoes(r);
      assert.ok(obs !== null, 'seção "## Observações (não comprovado)" ausente');
      const linhas = obs.split('\n').filter((l) => l.includes('Lua Verde'));
      assert.ok(linhas.length > 0, `sem evidência, a candidata aparece em Observações:\n${obs}`);
      assert.ok(!linhas.some((l) => l.includes('nova cor, fonte ou estrutura')), `Observações não recomenda:\n${linhas.join('\n')}`);
    });
  });
}

test('A7: parâmetros novos são aceitos e sobrescrevem os defaults; parâmetro desconhecido junto continua recusado', async () => {
  await com(reestetica(REESTETICA_COMPROVADA, { parametros: { razaoCliqueAlta: 2 } }), (r) => {
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.json.parametros.razaoCliqueAlta, 2);
    assert.equal(r.json.parametros.razaoCompraBaixa, 0.7, 'o que não veio fica no default');
    assert.equal(r.json.parametros.lacunaMaxItens, 1, 'o que não veio fica no default');
    assert.ok(Array.isArray(r.json.reestetica) && r.json.reestetica.some((x) => x.item === 'Lua Verde'), 'CTR 3,7x a média passa no corte de 2x');
  });
  // o override muda o corte de verdade: cada um destes tira 'Lua Verde' das candidatas
  for (const parametros of [{ razaoCliqueAlta: 10 }, { razaoCompraBaixa: 0.01 }, { minViewsSinal: 5000 }]) {
    await com(reestetica(REESTETICA_COMPROVADA, { parametros }), (r) => {
      assert.equal(r.status, 0, r.stderr);
      for (const [k, v] of Object.entries(parametros)) assert.equal(r.json.parametros[k], v, k);
      assert.ok(Array.isArray(r.json.reestetica), 'stdout sem reestetica[]');
      assert.ok(!r.json.reestetica.some((x) => x.item === 'Lua Verde'), `com ${JSON.stringify(parametros)} o item sai do corte`);
    });
  }
  await com(lacunasPortfolio({ parametros: { lacunaMaxItens: 2 } }), (r) => {
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.json.parametros.lacunaMaxItens, 2);
    assert.deepEqual(r.json.lacunas, [...LACUNAS_PADRAO, lacuna('FAM-A', 'X', 2)]);
  });
  await com(reestetica(REESTETICA_COMPROVADA, { parametros: { razaoCliqueAlta: 2, parametroInventado: 1 } }), (r) => {
    assert.equal(r.status, 1, r.stderr);
    assert.match(r.stderr, /parametros/);
    assert.equal(r.md, null); assert.equal(r.csv, null);
  });
});

test('A7 preservação: o CSV mantém o cabeçalho fixo de contrato.md e as mesmas linhas por item do catálogo', async () => {
  const contrato = join(SKILL_DIR, 'references', 'contrato.md');
  assert.ok(existsSync(contrato), `contrato ausente: ${contrato}`);
  const documentado = readFileSync(contrato, 'utf8').match(/^item,familia,[^\n]*$/m)?.[0];
  assert.equal(documentado, CSV_CABECALHO, 'o cabeçalho do CSV documentado em contrato.md mudou');
  // valores à mão: taxa = compras/views e fatia = impressões/total casado, 6 casas; sinal e bloco vazios
  const esperado = [
    [lacunasPortfolio(), [
      'Lua Verde,FAM-A,X,1000,30,500,20,0.040000,0.333333,,', 'Mar Azul,FAM-A,X,1000,30,500,20,0.040000,0.333333,,',
      'Noite Roxa,FAM-A,Y,0,0,0,0,,0.000000,,', 'Sol Vermelho,FAM-B,X,1000,30,500,20,0.040000,0.333333,,',
    ]],
    [reestetica(REESTETICA_COMPROVADA), [
      'Lua Verde,FAM-A,Y,2000,300,1000,2,0.002000,0.090909,,', 'Mar Azul,FAM-A,X,10000,300,5000,200,0.040000,0.454545,,',
      'Sol Vermelho,FAM-B,X,10000,300,5000,200,0.040000,0.454545,,',
    ]],
  ];
  for (const [e, linhas] of esperado) {
    await com(e, (r) => {
      assert.equal(r.status, 0, r.stderr);
      assert.equal(r.csv, [CSV_CABECALHO, ...linhas].join('\n') + '\n');
    });
  }
});

test('A7 preservação: parâmetro desconhecido ou não numérico é recusado com exit 1, sem stack trace e sem arquivo', async () => {
  for (const parametros of [{ parametroInventado: 1 }, { lacuna_max_itens: 1 }, { razaoCliqueAlta: '2' }]) {
    await com(lacunasPortfolio({ parametros }), (r) => {
      assert.equal(r.status, 1, `${JSON.stringify(parametros)}: ${r.stderr}`);
      assert.match(r.stderr, /parametros/);
      assert.ok(!/TypeError|\n\s+at /.test(r.stderr), `stack trace: ${r.stderr}`);
      assert.equal(r.md, null); assert.equal(r.csv, null);
    });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// E3 (hermes 2.0.0), C2 e C8: eixos configuráveis no lugar de dois campos fixos.
//
// Contrato fixado por estes testes (references/contrato.md da skill o documenta):
//   Entrada: { periodo, vendas_internas_excluidas, eixos: ['familia', ...], itens: [{ item, meta_*, ga4_* }],
//     catalogo: [{ item, eixos: { <eixo>: <valor> } }], excecoes: [{ de, para }], parametros?, conjuntos? }
//   - `eixos` lista os nomes de eixo do perfil; todo item do catálogo traz um valor para cada um.
//     Os valores vêm SÓ do catálogo (um `eixos` em linha de `itens` é ignorado).
//   - não existe alias: o formato antigo é recusado e nenhum rótulo de nicho sobra nas saídas (cobrados em
//     scripts/tests/publicacao.test.mjs, privado, que pode citar os termos).
//   - CSV: `item`, um coluna por eixo (na ordem do perfil), depois as colunas de sempre.
//   - cada comparação do stdout traz `eixo` (o eixo cujos valores se comparam) e `escopo`
//     ('total' para o grupo todo); `confundida` indica que outro eixo explica o total.
//   - a comparação de um eixo é controlada pelos demais (Cochran-Mantel-Haenszel nos estratos).
// ═════════════════════════════════════════════════════════════════════════════
const executarGolden = (entrada) => executar(entrada);

const r8 = (x) => (x === null || x === undefined ? null : Number(Number(x).toPrecision(8)));
const nomeDe = (x) => x.item;
const nomesDaSecao = (md, titulo) => (secaoMd(md, titulo) ?? '').split('\n').filter((l) => l.startsWith('- ') && !l.startsWith('- Nenhum')).map((l) => l.slice(2).split(' (')[0].split(':')[0]);
// Resumo sem rótulos de nicho: só números, vereditos e nomes de item.
function resumo(r) {
  const j = r.json;
  const cabecalho = r.csv.trim().split('\n')[0].split(',');
  const colunas = ['impressoes', 'cliques', 'views', 'compras', 'taxa_compra', 'fatia_impressoes', 'sinal_vitrine', 'bloco'];
  return {
    comparacoes: j.comparacoes.map((c) => [c.a, c.b, c.viewsA, c.viewsB, c.comprasA, c.comprasB, r8(c.z), r8(c.p), r8(c.nMinimo), c.rotulo, c.semPoder, c.confundida ?? false, c.inseparavel ?? false, c.motivo ?? null, r8(c.pAjustado)].join('|')).sort(),
    vitrine: j.vitrine.map((v) => [nomeDe(v), v.bloco, v.sinal, v.evidencia, r8(v.fatia), r8(v.taxaCompra)].join('|')).sort(),
    lacunas: j.lacunas.map((l) => Object.values(l).find((v) => typeof v === 'number')).sort(),
    reestetica: (j.reestetica ?? []).map((x) => [nomeDe(x), x.comprovada, r8(x.ctr), r8(x.razaoClique), r8(x.taxaCompra), r8(x.razaoCompra), x.evidenciaClique, x.evidenciaCompra].join('|')).sort(),
    juncao: {
      naoCasou: j.juncao.naoCasou.map((n) => `${nomeDe(n)}|${n.fonte}`).sort(),
      colisoes: j.juncao.colisoes.map((c) => `${c.alvo}|${[...c.origens].sort().join('+')}`).sort(),
      aproximados: j.juncao.aproximados.map((a) => `${a.de}|${a.para}|${r8(a.jaccard)}`).sort(),
    },
    csv: r.csv.trim().split('\n').slice(1).map((l) => { const c = l.split(','); return [c[0], ...colunas.map((k) => c[cabecalho.indexOf(k)])].join('|'); }).sort(),
    blocos: Object.fromEntries(['Produzir', 'Investir', 'Rever', 'Candidatas a re-estética'].map((t) => [t, nomesDaSecao(r.md, t)])),
  };
}
const DATASETS_GOLDEN = {
  'duas famílias, um acabamento (B1)': () => duasFamilias(200, 4000, 120, 4000),
  'paradoxo de Simpson (B2)': () => simpson(),
  'vitrine com fatia alta e baixa (B5)': () => entradaVitrine({ parametros: PARAMETROS }),
  'junção de nomes, exceção e colisão (B4)': () => entradaJuncao(),
  're-estética comprovada (A7)': () => reestetica(REESTETICA_COMPROVADA),
  'lacunas de portfólio (A7)': () => lacunasPortfolio(),
};

// Golden medido no script de hoje (antes da generalização), por dataset. Só números, vereditos e nomes de item.
const GOLDEN_AP = {
  "duas famílias, um acabamento (B1)": {
    "comparacoes": [
      "FAM-A|FAM-B|4000|4000|200|120|4.5643546|0.0000050103321|1505.8052|comprovado|false|false|false||",
      "FAM-A|FAM-B|4000|4000|200|120|4.5643546|0.0000050103321|1505.8052|comprovado|false|false|false||0.0000050171492"
    ],
    "vitrine": [
      "Lua Verde|||comprovado|0.5|0.05",
      "Sol Vermelho|||comprovado|0.5|0.03"
    ],
    "lacunas": [
      1,
      1
    ],
    "reestetica": [],
    "juncao": {
      "naoCasou": [],
      "colisoes": [],
      "aproximados": []
    },
    "csv": [
      "Lua Verde|1000|100|4000|200|0.050000|0.500000||",
      "Sol Vermelho|1000|100|4000|120|0.030000|0.500000||"
    ],
    "blocos": {
      "Produzir": [],
      "Investir": [],
      "Rever": [],
      "Candidatas a re-estética": []
    }
  },
  "paradoxo de Simpson (B2)": {
    "comparacoes": [
      "FAM-A|FAM-B|1000|4000|20|80|0|1||não comprovado|false|false|false||",
      "FAM-A|FAM-B|4000|1000|240|60|0|1||não comprovado|false|false|false||",
      "FAM-A|FAM-B|5000|5000|260|140|6.1237244|9.1412975e-10|1045.3374|comprovado|false|true|false|estrato-explica-total|1",
      "X|Y|5000|5000|300|100|10.206207|1.8599352e-24|375.56507|comprovado|false|false|false||2.8502349e-16"
    ],
    "vitrine": [
      "Chuva Cinza|rever|fatia-alta-conversao-baixa|comprovado|0.20833333|0.02",
      "Lua Verde|produzir||comprovado|0.20833333|0.06",
      "Mar Azul|produzir||comprovado|0.20833333|0.06",
      "Noite Roxa|||comprovado|0.083333333|0.02",
      "Sol Vermelho|||sem poder para afirmar|0.083333333|0.06",
      "Vento Prata|rever|fatia-alta-conversao-baixa|comprovado|0.20833333|0.02"
    ],
    "lacunas": [
      1,
      1
    ],
    "reestetica": [],
    "juncao": {
      "naoCasou": [],
      "colisoes": [],
      "aproximados": []
    },
    "csv": [
      "Chuva Cinza|50000|2000|2000|40|0.020000|0.208333|fatia-alta-conversao-baixa|rever",
      "Lua Verde|50000|2000|2000|120|0.060000|0.208333||produzir",
      "Mar Azul|50000|2000|2000|120|0.060000|0.208333||produzir",
      "Noite Roxa|20000|800|1000|20|0.020000|0.083333||",
      "Sol Vermelho|20000|800|1000|60|0.060000|0.083333||",
      "Vento Prata|50000|2000|2000|40|0.020000|0.208333|fatia-alta-conversao-baixa|rever"
    ],
    "blocos": {
      "Produzir": [
        "Lua Verde",
        "Mar Azul"
      ],
      "Investir": [],
      "Rever": [
        "Vento Prata",
        "Chuva Cinza"
      ],
      "Candidatas a re-estética": []
    }
  },
  "vitrine com fatia alta e baixa (B5)": {
    "comparacoes": [
      "FAM-A|FAM-B|10000|10000|440|1090|-17.292158|5.3896394e-67|261.30582|comprovado|false|false|false||",
      "FAM-A|FAM-B|10000|10000|440|1090|-17.292158|5.3896394e-67|261.30582|comprovado|false|false|false||5.4302153e-67"
    ],
    "vitrine": [
      "Lua Verde|rever|fatia-alta-conversao-baixa|comprovado|0.5|0.02",
      "Mar Azul|||sem poder para afirmar|0.245|0.068",
      "Noite Roxa|investir|fatia-baixa-conversao-alta|comprovado|0.01|0.15",
      "Sol Vermelho|||sem poder para afirmar|0.245|0.068"
    ],
    "lacunas": [],
    "reestetica": [],
    "juncao": {
      "naoCasou": [],
      "colisoes": [],
      "aproximados": []
    },
    "csv": [
      "Lua Verde|500000|5000|5000|100|0.020000|0.500000|fatia-alta-conversao-baixa|rever",
      "Mar Azul|245000|5000|5000|340|0.068000|0.245000||",
      "Noite Roxa|10000|5000|5000|750|0.150000|0.010000|fatia-baixa-conversao-alta|investir",
      "Sol Vermelho|245000|5000|5000|340|0.068000|0.245000||"
    ],
    "blocos": {
      "Produzir": [],
      "Investir": [
        "Noite Roxa"
      ],
      "Rever": [
        "Lua Verde"
      ],
      "Candidatas a re-estética": []
    }
  },
  "junção de nomes, exceção e colisão (B4)": {
    "comparacoes": [
      "FAM-A|FAM-B|1800|500|70|10|2.0392483|0.041425251|1256.1483|sem poder para afirmar|true|false|false||",
      "FAM-A|FAM-B|800|500|20|10|0.58412957|0.5591331|13808.923|não comprovado|true|false|false||",
      "X|Y|1000|1300|50|30|3.4933235|0.00047704826|761.20239|comprovado|false|false|false||0.006422575"
    ],
    "vitrine": [
      "Lua Verde|produzir||comprovado|0.40909091|0.05",
      "Mar Azul Profundo|||não comprovado|0.22727273|0.025",
      "Sol Vermelho||||0.36363636|",
      "Vento Prata|||sem poder para afirmar|0|0.02"
    ],
    "lacunas": [
      1,
      1,
      1,
      1
    ],
    "reestetica": [],
    "juncao": {
      "naoCasou": [
        "Brisa Escarlate|meta",
        "Lua Dourada Rara|ga4"
      ],
      "colisoes": [
        "Sol Vermelho|Sol Vermelho v1+Sol Vermelho v2"
      ],
      "aproximados": [
        "Mar Azul|Mar Azul Profundo|0.66666667",
        "Sol Vermelho v1|Sol Vermelho|0.66666667",
        "Sol Vermelho v2|Sol Vermelho|0.66666667",
        "Verde Lua|Lua Verde|1"
      ]
    },
    "csv": [
      "Lua Verde|9000|90|1000|50|0.050000|0.409091||produzir",
      "Mar Azul Profundo|5000|50|800|20|0.025000|0.227273||",
      "Sol Vermelho|8000|80|0|0||0.363636||",
      "Vento Prata|0|0|500|10|0.020000|0.000000||"
    ],
    "blocos": {
      "Produzir": [
        "Lua Verde"
      ],
      "Investir": [],
      "Rever": [],
      "Candidatas a re-estética": []
    }
  },
  "re-estética comprovada (A7)": {
    "comparacoes": [
      "FAM-A|FAM-B|5000|5000|200|200|0|1||não comprovado|false|false|false||",
      "FAM-A|FAM-B|6000|5000|202|200|-1.7626429|0.077960735|13882.846|não comprovado|true|false|false||",
      "X|Y|10000|1000|400|2|6.1059741|1.0217559e-9|222.31477|comprovado|false|false|false||1.192452e-9"
    ],
    "vitrine": [
      "Lua Verde|||comprovado|0.090909091|0.002",
      "Mar Azul|||não comprovado|0.45454545|0.04",
      "Sol Vermelho|||não comprovado|0.45454545|0.04"
    ],
    "lacunas": [
      0,
      1,
      1,
      1
    ],
    "reestetica": [
      "Lua Verde|true|0.15|3.6666667|0.002|0.054726368|comprovado|comprovado"
    ],
    "juncao": {
      "naoCasou": [],
      "colisoes": [],
      "aproximados": []
    },
    "csv": [
      "Lua Verde|2000|300|1000|2|0.002000|0.090909||",
      "Mar Azul|10000|300|5000|200|0.040000|0.454545||",
      "Sol Vermelho|10000|300|5000|200|0.040000|0.454545||"
    ],
    "blocos": {
      "Produzir": [],
      "Investir": [],
      "Rever": [],
      "Candidatas a re-estética": [
        "Lua Verde"
      ]
    }
  },
  "lacunas de portfólio (A7)": {
    "comparacoes": [
      "FAM-A|FAM-B|1000|500|40|20|0|1||não comprovado|false|false|false||",
      "FAM-A|FAM-B|1000|500|40|20|0|1||não comprovado|false|false|false||"
    ],
    "vitrine": [
      "Lua Verde|||não comprovado|0.33333333|0.04",
      "Mar Azul|||não comprovado|0.33333333|0.04",
      "Noite Roxa||||0|",
      "Sol Vermelho|||não comprovado|0.33333333|0.04"
    ],
    "lacunas": [
      0,
      1,
      1
    ],
    "reestetica": [],
    "juncao": {
      "naoCasou": [
        "Brisa Escarlate|ga4",
        "Brisa Escarlate|meta"
      ],
      "colisoes": [],
      "aproximados": []
    },
    "csv": [
      "Lua Verde|1000|30|500|20|0.040000|0.333333||",
      "Mar Azul|1000|30|500|20|0.040000|0.333333||",
      "Noite Roxa|0|0|0|0||0.000000||",
      "Sol Vermelho|1000|30|500|20|0.040000|0.333333||"
    ],
    "blocos": {
      "Produzir": [],
      "Investir": [],
      "Rever": [],
      "Candidatas a re-estética": []
    }
  }
};

test('C8: com dois eixos e os mesmos dados, os números, vereditos, CSV e blocos são os do golden de hoje', async () => {
  const divergentes = [];
  for (const [nome, dataset] of Object.entries(DATASETS_GOLDEN)) {
    const r = executarGolden(dataset());
    try {
      assert.equal(r.status, 0, `${nome}: ${r.stderr}`);
      try { assert.deepEqual(resumo(r), GOLDEN_AP[nome]); } catch (e) { divergentes.push(`${nome}: ${e.message.split('\n').slice(0, 12).join('\n')}`); }
    } finally { limpar(r); }
  }
  assert.deepEqual(divergentes, []);
});

// ── C2: eixos configuráveis (fictícios: familia, acabamento, porte) ───────────
const EIXOS3 = ['familia', 'acabamento', 'porte'];
const CN = (item, familia, acabamento, porte) => ({ item, eixos: { familia, acabamento, porte } });
const LN = (item, imp, cli, views, compras) => ({ item, meta_impressoes: imp, meta_cliques: cli, ga4_views: views, ga4_compras: compras });
const entradaN = (itens, catalogo, extra = {}) => ({ periodo: '2026-09', vendas_internas_excluidas: 0, eixos: EIXOS3, itens, catalogo, excecoes: [], ...extra });

// Mesmos números do paradoxo de Simpson do golden: X rende 6%, Y rende 2%; FAM-A concentra X e FAM-B concentra Y.
// `quemEhQuem` escolhe qual eixo faz o papel de "grupo" (A/B) e qual faz o de "estrato" (X/Y); o terceiro é constante.
const SIMPSON_ITENS = [
  ['Lua Verde', 'FAM-A', 'X', 50000, 2000, 2000, 120], ['Mar Azul', 'FAM-A', 'X', 50000, 2000, 2000, 120],
  ['Noite Roxa', 'FAM-A', 'Y', 20000, 800, 1000, 20],
  ['Sol Vermelho', 'FAM-B', 'X', 20000, 800, 1000, 60],
  ['Vento Prata', 'FAM-B', 'Y', 50000, 2000, 2000, 40], ['Chuva Cinza', 'FAM-B', 'Y', 50000, 2000, 2000, 40],
];
function simpsonEmEixos({ grupo, estrato }) {
  const valores = (g, s) => Object.fromEntries(EIXOS3.map((eixo) => [eixo, eixo === grupo ? g : eixo === estrato ? s : 'unico']));
  return entradaN(
    SIMPSON_ITENS.map(([n, , , imp, cli, views, compras]) => LN(n, imp, cli, views, compras)),
    SIMPSON_ITENS.map(([n, g, s]) => ({ item: n, eixos: valores(g, s) })),
    { vendas_internas_excluidas: 4 },
  );
}
const totalDe = (r, eixo) => r.json.comparacoes.find((c) => c.eixo === eixo && c.escopo === 'total');

test('C2: o CSV usa item e uma coluna por eixo do perfil, na ordem declarada', async () => {
  const e = simpsonEmEixos({ grupo: 'familia', estrato: 'acabamento' });
  await com(e, (r) => {
    assert.equal(r.status, 0, r.stderr);
    const linhas = r.csv.trim().split('\n');
    assert.equal(linhas[0], 'item,familia,acabamento,porte,impressoes,cliques,views,compras,taxa_compra,fatia_impressoes,sinal_vitrine,bloco');
    assert.equal(linhas.length, 7);
    const lua = linhas.find((l) => l.startsWith('Lua Verde,'));
    assert.ok(lua.startsWith('Lua Verde,FAM-A,X,unico,'), lua);
  });
});

test('C2: cada eixo é comparado e controlado pelos demais: familia explicada por acabamento (paradoxo de Simpson)', async () => {
  await com(simpsonEmEixos({ grupo: 'familia', estrato: 'acabamento' }), (r) => {
    assert.equal(r.status, 0, r.stderr);
    const total = totalDe(r, 'familia');
    assert.ok(total, `comparação total do eixo familia ausente: ${JSON.stringify(r.json.comparacoes.map((c) => [c.eixo, c.escopo]))}`);
    assert.equal(total.rotulo, 'comprovado');
    assert.equal(total.confundida, true, 'o acabamento explica a diferença entre famílias');
    assert.ok(Math.abs(total.z) > 6, `z=${total.z}`);
    const afirmado = secaoAfirmado(r.md);
    assert.ok(!/FAM-A.*FAM-B/.test(afirmado), 'o total confundido não pode estar em "afirmado"');
    const linha = r.md.split('\n').find((l) => /Simpson/.test(l));
    assert.ok(linha && /acabamento/.test(linha), `a inversão cita o eixo que explica: ${linha}`);
  });
});

test('C2: o controle vale para qualquer eixo: acabamento explicado por familia, e familia explicada por porte', async () => {
  await com(simpsonEmEixos({ grupo: 'acabamento', estrato: 'familia' }), (r) => {
    assert.equal(r.status, 0, r.stderr);
    const total = totalDe(r, 'acabamento');
    assert.ok(total, 'comparação total do eixo acabamento ausente');
    assert.equal(total.confundida, true, 'a família explica a diferença entre acabamentos');
    const linha = r.md.split('\n').find((l) => /Simpson/.test(l));
    assert.ok(linha && /familia/.test(linha), `a inversão cita o eixo que explica: ${linha}`);
  });
  await com(simpsonEmEixos({ grupo: 'familia', estrato: 'porte' }), (r) => {
    assert.equal(r.status, 0, r.stderr);
    const total = totalDe(r, 'familia');
    assert.ok(total, 'comparação total do eixo familia ausente');
    assert.equal(total.confundida, true, 'o porte explica a diferença entre famílias');
  });
});

test('C2: os valores dos eixos vêm só do catálogo: eixos em linha de itens são ignorados', async () => {
  const e = simpsonEmEixos({ grupo: 'familia', estrato: 'acabamento' });
  e.itens = e.itens.map((l) => ({ ...l, eixos: { familia: 'FAMILIA-DO-LEDGER', acabamento: 'ACABAMENTO-DO-LEDGER', porte: 'PORTE-DO-LEDGER' } }));
  await com(e, (r) => {
    assert.equal(r.status, 0, r.stderr);
    for (const texto of [r.md, r.csv, r.stdout]) assert.ok(!/DO-LEDGER/.test(texto));
    assert.deepEqual([totalDe(r, 'familia').a, totalDe(r, 'familia').b].sort(), ['FAM-A', 'FAM-B']);
  });
});

test('C2: item do catálogo sem valor para um eixo declarado é recusado citando o eixo e o item, nada gravado', async () => {
  const e = simpsonEmEixos({ grupo: 'familia', estrato: 'acabamento' });
  delete e.catalogo[2].eixos.acabamento;
  await com(e, (r) => {
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /acabamento/);
    assert.match(r.stderr, /Noite Roxa/);
    assert.equal(r.md, null);
    assert.equal(r.csv, null);
  });
});

test('C2: a lista de eixos é obrigatória, sem duplicata e sem eixo desconhecido no catálogo', async () => {
  const base = simpsonEmEixos({ grupo: 'familia', estrato: 'acabamento' });
  const { eixos: _fora, ...semEixos } = base;
  for (const [nome, e] of [
    ['sem eixos', semEixos],
    ['eixos vazio', { ...base, eixos: [] }],
    ['eixo duplicado', { ...base, eixos: ['familia', 'familia', 'porte'] }],
    ['eixo do catálogo fora da lista', { ...base, catalogo: base.catalogo.map((c) => ({ ...c, eixos: { ...c.eixos, cor: 'x' } })) }],
  ]) {
    await com(e, (r) => {
      assert.notEqual(r.status, 0, nome);
      assert.match(r.stderr, /eixos?|cor/i, nome);
      assert.equal(r.md, null, nome);
    });
  }
});

// ── Revisão do PR 20: lacunas por par de eixos, nomes de eixo e chave desconhecida ─────────────────────
// 3 eixos: a célula é um PAR de eixos (um valor em cada); o produto cartesiano das três explodia.
const catalogo3 = () => [
  CN('Item 1', 'FAM-A', 'X', 'P'), CN('Item 2', 'FAM-A', 'X', 'Q'), CN('Item 3', 'FAM-A', 'Y', 'P'),
  CN('Item 4', 'FAM-B', 'X', 'P'), CN('Item 5', 'FAM-B', 'Y', 'Q'),
];
const itens3 = () => catalogo3().map((c, i) => LN(c.item, 1000 + i, 50, 500 + i, 20));

test('L1: com 3 eixos a lacuna é a célula de um PAR de eixos, não o produto dos três', async () => {
  await com(entradaN(itens3(), catalogo3()), (r) => {
    assert.equal(r.status, 0, r.stderr);
    const pares = new Set(r.json.lacunas.map((l) => Object.keys(l.celula).join('+')));
    assert.ok([...pares].every((p) => ['familia+acabamento', 'familia+porte', 'acabamento+porte'].includes(p)), [...pares].join(' | '));
    assert.ok(r.json.lacunas.every((l) => Object.keys(l.celula).length === 2));
    const contagem = (celula) => r.json.lacunas.find((l) => JSON.stringify(l.celula) === JSON.stringify(celula));
    assert.equal(contagem({ familia: 'FAM-B', porte: 'Q' })?.itens, 1, 'FAM-B × Q tem 1 item (Item 5)');
    assert.equal(contagem({ familia: 'FAM-A', acabamento: 'X' }), undefined, 'FAM-A × X tem 2 itens e não é lacuna');
    assert.equal(r.json.lacunas_omitidas, 0);
    assert.match(r.md, /Células por PAR de eixos/);
  });
});

test('L2: com 2 eixos a lacuna segue o produto dos dois e o relatório não fala em par', async () => {
  await com(lacunasPortfolio(), (r) => {
    assert.deepEqual(r.json.lacunas, LACUNAS_PADRAO);
    assert.doesNotMatch(r.md, /por PAR de eixos/);
    assert.equal(r.json.lacunas_omitidas, 0);
  });
});

test('L3: 4 eixos de 30 valores: o run não morre, a lista tem teto de 500 e o excedente é avisado', async () => {
  const eixos = ['aa', 'bb', 'cc', 'dd'];
  const valores = Array.from({ length: 30 }, (_, i) => `v${String.fromCharCode(97 + (i % 26))}${i}`);
  const catalogo = valores.map((v, i) => ({ item: `Item ${i}`, eixos: Object.fromEntries(eixos.map((x, k) => [x, valores[(i + k) % 30]])) }));
  const itens = catalogo.map((c, i) => LN(c.item, 1000, 50, 500, 20 + (i % 3)));
  await com({ periodo: '2026-09', vendas_internas_excluidas: 0, eixos, itens, catalogo, excecoes: [], parametros: { lacunaMaxItens: 5 } }, (r) => {
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.json.lacunas.length, 500);
    assert.ok(r.json.lacunas_omitidas > 0);
    assert.match(r.md, /lista limitada a 500 linhas/);
  });
});

test('L4: 3 eixos de 10 valores e 30 itens não geram 117 de 120 células: o tamanho fica pelo número de pares', async () => {
  const eixos = ['aa', 'bb', 'cc'];
  const catalogo = Array.from({ length: 30 }, (_, i) => ({ item: `Item ${i}`, eixos: { aa: `a${i % 10}`, bb: `b${i % 4}`, cc: `c${i % 3}` } }));
  const itens = catalogo.map((c) => LN(c.item, 1000, 50, 500, 20));
  await com({ periodo: '2026-09', vendas_internas_excluidas: 0, eixos, itens, catalogo, excecoes: [] }, (r) => {
    assert.equal(r.status, 0, r.stderr);
    const celulasPossiveis = 10 * 4 + 10 * 3 + 4 * 3;
    assert.ok(r.json.lacunas.length <= celulasPossiveis, `${r.json.lacunas.length} > ${celulasPossiveis}`);
  });
});

const EIXOS_INVALIDOS = [['item', 'acabamento'], ['familia', 'views'], ['bloco'], ['a,b'], ['familia\nacabamento'], ['Familia'], ['com espaço'], ['x'.repeat(90)]];
test('E1: eixo reservado ou fora do formato é recusado (a mesma lista do preflight, em references/eixos.json)', async () => {
  const compartilhado = JSON.parse(readFileSync(join(SKILL_DIR, '..', '..', 'references', 'eixos.json'), 'utf8'));
  for (const eixos of [...EIXOS_INVALIDOS, ...compartilhado.reservados.map((x) => [x])]) {
    const catalogo = [{ item: 'Item 1', eixos: Object.fromEntries(eixos.map((x) => [x, 'v'])) }];
    await com({ periodo: '2026-09', vendas_internas_excluidas: 0, eixos, itens: [LN('Item 1', 1000, 50, 500, 20)], catalogo, excecoes: [] }, (r) => {
      assert.notEqual(r.status, 0, JSON.stringify(eixos));
      assert.match(r.stderr, /eixo/, JSON.stringify(eixos));
      assert.equal(r.md, null);
    });
  }
});

test('E2: chave de topo desconhecida não passa calada (um campo da versão anterior ao lado do novo)', async () => {
  for (const extra of [{ itens_antigos: [] }, { casa_excluida: 4 }, { lacunaMax: 1 }]) {
    await com(entradaN(itens3(), catalogo3(), extra), (r) => {
      assert.notEqual(r.status, 0, JSON.stringify(extra));
      assert.match(r.stderr, new RegExp(`campo desconhecido na entrada: "${Object.keys(extra)[0]}"`));
      assert.equal(r.md, null);
    });
  }
});

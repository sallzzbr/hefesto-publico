// hermes pós-Q4 na distribuição Codex (SPEC hermes-pos-q4, critérios B1, A1, A4 e A8): skills
// nativas novas com RUNTIME, contrato em shared e links reais para os scripts sincronizados;
// inventário dos recursos novos; a cópia empacotada da regua-decisao roda fora do repositório;
// resumos nativos das skills alteradas; hermes Codex 0.3.0 e README com 66 skills.
// Arquivo ausente vira asserção (existsSync antes de ler): antes da implementação o vermelho é por
// comportamento ausente, nunca por ENOENT. Termo presente não prova que a skill aplica a regra: a
// árvore de decisão tem teste comportamental próprio na suíte Claude (regua-decisao.test.mjs).
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const CODEX = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACOTE = join(CODEX, 'plugins', 'hermes');
const SKILLS_NOVAS = ['regua-decisao'];
const rel = (path) => relative(CODEX, path);
// Moeda e heurísticas vêm do perfil do negócio (E3): a régua não guarda valor próprio.
const PERFIL_DA_REGUA = {
  moeda: 'BRL',
  config: {
    piso_diagnostico: 50, piso_opiniao_fadiga: 100, piso_veredito_pausa: 200, conversoes_minimas_escala: 10,
    intervalo_minimo_degrau_dias: 7, lucro_por_real_referencia_min: 0.7, lucro_por_real_referencia_max: 1.5,
  },
};

// Ênfase markdown e quebra de linha não contam: sem isso uma proibição passaria verde à toa
// (`**50** eventos`) e um termo quebrado pela largura do parágrafo contaria como ausente.
const prosa = (texto) => texto.replace(/[*`]/g, '').replace(/\s+/g, ' ');
// Caixa livre só na primeira letra: o termo pode abrir frase ou item.
const contem = (texto, termo) => {
  const t = prosa(texto);
  return t.includes(termo) || t.includes(termo[0].toUpperCase() + termo.slice(1));
};

function frontmatter(texto) {
  const bloco = texto.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const campos = {};
  if (!bloco) return campos;
  for (const linha of bloco[1].split(/\r?\n/)) {
    const m = linha.match(/^([a-z][a-z0-9-]*):\s*(.*)$/i);
    if (m) campos[m[1]] = m[2].trim().replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, '$1$2');
  }
  return campos;
}

function lerJson(path) {
  assert.ok(existsSync(path), `${rel(path)} ausente`);
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch (e) { assert.fail(`${rel(path)}: JSON inválido: ${e.message}`); }
}

// Lê a skill nativa ou registra a falta; null quando o arquivo não existe.
function nativa(nome, faltas) {
  const path = join(PACOTE, 'skills', nome, 'SKILL.md');
  if (!existsSync(path)) { faltas.push(`${rel(path)} ausente`); return null; }
  return { path, texto: readFileSync(path, 'utf8') };
}

test('skills nativas novas têm frontmatter, RUNTIME e contrato em shared', () => {
  const faltas = [];
  for (const nome of SKILLS_NOVAS) {
    const skill = nativa(nome, faltas);
    if (!skill) continue;
    const fm = frontmatter(skill.texto);
    if (fm.name !== nome) faltas.push(`${rel(skill.path)}: frontmatter name "${fm.name}" difere do diretório`);
    if (!fm.description?.trim()) faltas.push(`${rel(skill.path)}: frontmatter description vazia`);
    for (const link of ['../../RUNTIME.md', `../../shared/skills/${nome}/CONTRATO.md`]) {
      if (!skill.texto.includes(link)) faltas.push(`${rel(skill.path)} sem ${link}`);
      else if (!existsSync(resolve(dirname(skill.path), link))) faltas.push(`${rel(skill.path)}: ${link} não resolve no pacote (falta sync?)`);
    }
  }
  assert.deepEqual(faltas, []);
});

test('skills nativas novas linkam os scripts sincronizados do pacote', () => {
  const links = {
    'regua-decisao': ['../../shared/skills/regua-decisao/scripts/regua-decisao.mjs'],
  };
  const faltas = [];
  for (const [nome, alvos] of Object.entries(links)) {
    const skill = nativa(nome, faltas);
    if (!skill) continue;
    for (const link of alvos) {
      if (!skill.texto.includes(link)) faltas.push(`${rel(skill.path)} sem ${link}`);
      else if (!existsSync(resolve(dirname(skill.path), link))) faltas.push(`${rel(skill.path)}: ${link} não resolve no pacote (falta sync?)`);
    }
  }
  assert.deepEqual(faltas, []);
});

test('resources.json inventaria os recursos novos do hermes', () => {
  const novos = [
    ['plugins/hermes/skills/regua-decisao/SKILL.md', 'plugins/hermes/shared/skills/regua-decisao/CONTRATO.md'],
    ['plugins/hermes/skills/regua-decisao/scripts/regua-decisao.mjs', 'plugins/hermes/shared/skills/regua-decisao/scripts/regua-decisao.mjs'],
  ];
  const { arquivos } = lerJson(join(CODEX, 'resources.json'));
  assert.ok(Array.isArray(arquivos), 'resources.json sem a lista arquivos');
  const faltam = novos
    .filter(([source, target]) => !arquivos.some((e) => e.source === source && e.target === target))
    .map(([source, target]) => `${source} -> ${target}`);
  assert.deepEqual(faltam, []);
});

test('regua-decisao empacotada roda fora do repositório: janela curta mantém por janela-minima', (t) => {
  const script = join(PACOTE, 'shared', 'skills', 'regua-decisao', 'scripts', 'regua-decisao.mjs');
  assert.ok(existsSync(script), `cópia sincronizada ausente: ${rel(script)}`);
  // Pacote copiado para fora do checkout: prova que o script não depende do repositório nem do cwd.
  const dir = mkdtempSync(join(tmpdir(), 'codex-hermes-regua-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const pacote = join(dir, 'hermes');
  cpSync(PACOTE, pacote, { recursive: true });
  const entrada = join(dir, 'entrada.json');
  writeFileSync(entrada, JSON.stringify({
    ...PERFIL_DA_REGUA,
    gasto: 40,
    janela_dias: 3,
    conversoes: 0,
    dias_desde_ultima_edicao: 10,
    reguas: { fonte: 'x.md', cac_breakeven: 100, cac_alvo: 80, roas_breakeven: 2 },
  }));
  const r = spawnSync(process.execPath, [join(pacote, relative(PACOTE, script)), '--entrada', entrada], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, `regua-decisao.mjs saiu ${r.status}: ${r.stderr}`);
  let saida;
  try { saida = JSON.parse(r.stdout); }
  catch (e) { assert.fail(`stdout não é JSON: ${e.message}\n${r.stdout}`); }
  assert.equal(saida.decisao, 'manter', JSON.stringify(saida));
  assert.equal(saida.gatilho, 'janela-minima', JSON.stringify(saida));
});

test('fadiga-criativa e otimizar-verba nativas trocam a guarda fixa de 50 eventos pela regua-decisao', () => {
  const faltas = [];
  for (const nome of ['fadiga-criativa', 'otimizar-verba']) {
    const skill = nativa(nome, faltas);
    if (!skill) continue;
    if (/50\s*eventos/.test(prosa(skill.texto))) faltas.push(`${rel(skill.path)} ainda traz a guarda fixa de 50 eventos`);
    if (!contem(skill.texto, 'regua-decisao')) faltas.push(`${rel(skill.path)} sem regua-decisao`);
  }
  assert.deepEqual(faltas, []);
});

test('analise-diaria e sintese-semanal nativas apontam para a regua-decisao', () => {
  const faltas = [];
  for (const nome of ['analise-diaria', 'sintese-semanal']) {
    const skill = nativa(nome, faltas);
    if (skill && !contem(skill.texto, 'regua-decisao')) faltas.push(`${rel(skill.path)} sem regua-decisao`);
  }
  assert.deepEqual(faltas, []);
});

test('saude-do-funil nativa traz a linha P/V', () => {
  const faltas = [];
  const skill = nativa('saude-do-funil', faltas);
  if (skill && !contem(skill.texto, 'P/V')) faltas.push(`${rel(skill.path)} sem P/V`);
  assert.deepEqual(faltas, []);
});

test('analisar-produto nativa traz lacunas e re-estética', () => {
  const faltas = [];
  const skill = nativa('analisar-produto', faltas);
  if (skill) for (const termo of ['lacunas', 're-estética']) {
    if (!contem(skill.texto, termo)) faltas.push(`${rel(skill.path)} sem "${termo}"`);
  }
  assert.deepEqual(faltas, []);
});

test('auditoria-cro nativa traz modo concorrente, celular a 390 e capacidades do painel', () => {
  const faltas = [];
  const skill = nativa('auditoria-cro', faltas);
  if (skill) for (const termo of ['concorrente', '390', 'capacidades do painel']) {
    if (!contem(skill.texto, termo)) faltas.push(`${rel(skill.path)} sem "${termo}"`);
  }
  assert.deepEqual(faltas, []);
});

test('hermes Codex 0.3.x ou maior, com CHANGELOG da versão empacotada', () => {
  // Fixar 0.3.0 exato quebrava a cada patch. O que importa: a versão não regride abaixo da que
  // trouxe a régua, e o CHANGELOG tem a entrada da versão empacotada (o gate de bump
  // cobra o mesmo no diff; aqui vale para o estado do pacote).
  const versao = lerJson(join(PACOTE, '.codex-plugin', 'plugin.json')).version;
  const [maior, menor] = versao.split('.').map(Number);
  assert.ok(maior > 0 || menor >= 3, `hermes Codex ${versao} abaixo de 0.3.0`);
  const changelog = join(PACOTE, 'CHANGELOG.md');
  assert.ok(existsSync(changelog), `${rel(changelog)} ausente`);
  const entrada = new RegExp(`^## ${versao.replace(/\./g, '\\.')}(\\s|$)`, 'm');
  assert.match(readFileSync(changelog, 'utf8'), /^## 0\.3\.0(\s|$)/m);
  assert.match(readFileSync(changelog, 'utf8'), entrada, `CHANGELOG sem ## ${versao}`);
});

test('README Codex anuncia 66 skills com Hermes em 18', () => {
  const path = join(CODEX, 'README.md');
  assert.ok(existsSync(path), `${rel(path)} ausente`);
  const readme = readFileSync(path, 'utf8');
  assert.ok(contem(readme, '66 skills'), 'README Codex sem "66 skills"');
  assert.match(readme, /^\|\s*Hermes\s*\|\s*18\s*\|/m, 'linha do Hermes na tabela do README Codex sem 18 skills');
  assert.ok(!contem(readme, '61 skills'), 'README Codex ainda cita "61 skills"');
});

// ── Iteração 2 (revisão adversarial de 2026-11-01) ───────────────────────────

// Os resumos nativos repetem a regra que o contrato Claude mudou: sem estes marcadores, o
// fluxo Codex recomendaria pausa sem veredito da régua ou coletaria sem o denominador do P/V.

function rodarReguaEmpacotada(t, entradaJson) {
  const script = join(PACOTE, 'shared', 'skills', 'regua-decisao', 'scripts', 'regua-decisao.mjs');
  assert.ok(existsSync(script), `cópia sincronizada ausente: ${rel(script)}`);
  const dir = mkdtempSync(join(tmpdir(), 'codex-hermes-regua-it2-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const entrada = join(dir, 'entrada.json');
  writeFileSync(entrada, JSON.stringify({ ...PERFIL_DA_REGUA, ...entradaJson }));
  const r = spawnSync(process.execPath, [script, '--entrada', entrada], { cwd: dir, encoding: 'utf8' });
  return r;
}

test('iteração 2: a cópia empacotada da regua-decisao decide a fronteira em centavos', (t) => {
  const r = rodarReguaEmpacotada(t, {
    gasto: 213.43, conversoes: 7, janela_dias: 7, dias_desde_ultima_edicao: 10,
    reguas: { fonte: 'x.md', cac_breakeven: 30.49, cac_alvo: 25, roas_breakeven: 1.5 },
  });
  assert.equal(r.status, 0, r.stderr);
  const saida = JSON.parse(r.stdout);
  assert.deepEqual([saida.decisao, saida.gatilho], ['manter', 'dentro-da-regua'], saida.motivo);
});

test('iteração 2: a cópia empacotada recusa campo desconhecido em reguas', (t) => {
  const r = rodarReguaEmpacotada(t, {
    gasto: 500, conversoes: 10, receita: 1500, janela_dias: 7, dias_desde_ultima_edicao: 10,
    reguas: { fonte: 'x.md', cac_breakeven: 100, cac_alvo: 80, roas_breakeven: 2, roas_alvoo: 4 },
  });
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stderr, /roas_alvoo/);
});

test('iteração 2: resumos nativos refletem régua e P/V corrigidos', () => {
  const exigido = {
    'otimizar-verba': ['veredito pausar', 'intervalo_minimo_degrau_dias', 'prioridade de revisão'],
    'saude-do-funil': ['view_content', 'landing_page_view'],
    'regua-decisao': ['piso de diagnóstico', 'janela-mista', 'consolidado', 'criação conta como edição', 'centavos'],
  };
  const faltas = [];
  for (const [nome, termos] of Object.entries(exigido)) {
    const skill = nativa(nome, faltas);
    if (skill) for (const termo of termos) if (!contem(skill.texto, termo)) faltas.push(`${rel(skill.path)} sem "${termo}"`);
  }
  const verba = nativa('otimizar-verba', faltas);
  if (verba && /<60 candidata a pausa/.test(prosa(verba.texto))) faltas.push(`${rel(verba.path)}: score < 60 ainda vira pausa sem veredito da régua`);
  assert.deepEqual(faltas, []);
});

test('iteração 2: resumos nativos do hermes não carregam régua com centavos', () => {
  const faltas = [];
  const dir = join(PACOTE, 'skills');
  for (const nome of readdirSync(dir)) {
    const path = join(dir, nome, 'SKILL.md');
    if (!existsSync(path)) continue;
    readFileSync(path, 'utf8').split('\n').forEach((linha, i) => {
      if (/CAC|ROAS|breakeven/i.test(linha) && /(?<![\d.,])\d+[,.]\d{2}(?!\d)/.test(linha)) faltas.push(`${rel(path)}:${i + 1}`);
    });
  }
  assert.deepEqual(faltas, []);
});

// ── Iteração 3 (adendo do material oficial da plataforma de referência) ────────────────

test('iteração 3: a cópia empacotada da regua-decisao entrega o lucro do período e por real', (t) => {
  const r = rodarReguaEmpacotada(t, {
    gasto: 100, conversoes: 3, receita: 440, janela_dias: 7, dias_desde_ultima_edicao: 10,
    reguas: { fonte: 'x.md', cac_breakeven: 100, cac_alvo: 80, roas_breakeven: 2 },
  });
  assert.equal(r.status, 0, r.stderr);
  const saida = JSON.parse(r.stdout);
  assert.ok(saida.lucro, `saída sem lucro: ${r.stdout.slice(0, 300)}`);
  assert.equal(saida.lucro.periodo, 120);
  assert.equal(saida.lucro.por_real_investido, 1.2);
});

test('iteração 3: resumos nativos refletem lucro e checklist novo de CRO', () => {
  const exigido = {
    'regua-decisao': ['lucro do período', 'lucro por real investido'],
    'otimizar-verba': ['lucro do período', 'mostre os dois'],
    'auditoria-cro': ['margem por pedido', 'Pix', 'ordem das opções de frete', 'prazo de entrega por região', 'favicon', 'ícones de confiança'],
  };
  const faltas = [];
  for (const [nome, termos] of Object.entries(exigido)) {
    const skill = nativa(nome, faltas);
    if (skill) for (const termo of termos) if (!contem(skill.texto, termo)) faltas.push(`${rel(skill.path)} sem "${termo}"`);
  }
  assert.deepEqual(faltas, []);
});

test('iteração 3b: resumo nativo da régua trata a reversão como edição e a janela do degrau', () => {
  const faltas = [];
  const skill = nativa('regua-decisao', faltas);
  if (skill) for (const termo of ['reversão conta como edição', 'qualquer veredito']) {
    if (!contem(skill.texto, termo)) faltas.push(`${rel(skill.path)} sem "${termo}"`);
  }
  assert.deepEqual(faltas, []);
});

test('iteração 3c: resumos nativos listam a faixa de lucro e o CAC real do período', () => {
  const exigido = {
    'regua-decisao': ['lucro_por_real_referencia_min'],
    'auditoria-cro': ['CAC real do período'],
  };
  const faltas = [];
  for (const [nome, termos] of Object.entries(exigido)) {
    const skill = nativa(nome, faltas);
    if (skill) for (const termo of termos) if (!contem(skill.texto, termo)) faltas.push(`${rel(skill.path)} sem "${termo}"`);
  }
  assert.deepEqual(faltas, []);
});

// Revisão do HERMES-1 (decisão 14 do dono, 2026-11-03): o resumo nativo e a referência de
// execução diziam só "o resto sobre a headline vira sinalização" e calavam a exceção de render.
// No Solo o próprio agente aplica a regra e sinalizaria uma headline cortada em vez de corrigi-la.
test('HERMES-1: resumo nativo e execução do criativo-fluxo mantêm o defeito de render da headline travada no fluxo normal', () => {
  const faltas = [];
  const skill = nativa('criativo-fluxo', faltas);
  const execucao = join(PACOTE, 'skills', 'criativo-fluxo', 'references', 'execucao.md');
  const textos = [...(skill ? [[skill.path, skill.texto]] : []), ...(existsSync(execucao) ? [[execucao, readFileSync(execucao, 'utf8')]] : [])];
  if (!existsSync(execucao)) faltas.push(`${rel(execucao)} ausente`);
  for (const [path, texto] of textos) {
    for (const termo of ['defeito de render com alvo headline (custo overlay ou ia) segue o fluxo normal', 'tres_segundos', 'coerencia_imagem_copy', 'severidade declarada']) {
      if (!contem(texto, termo)) faltas.push(`${rel(path)} sem "${termo}"`);
    }
  }
  assert.deepEqual(faltas, []);
});

// O resumo nativo do validar-criativo cobrava "headline nos quatro testes" em Q: a promessa falsa
// da headline podia sair como headline_tem_ideia, que a trava rebaixa a sinalização.
test('HERMES-1: resumo nativo do validar-criativo manda a verdade comercial da headline para P', () => {
  const faltas = [];
  const skill = nativa('validar-criativo', faltas);
  if (skill) {
    if (!contem(skill.texto, 'promessa falsa da headline é verdade_comercial, nunca headline_tem_ideia')) faltas.push(`${rel(skill.path)} sem a regra de P para a promessa da headline`);
    if (contem(skill.texto, 'headline nos quatro testes')) faltas.push(`${rel(skill.path)} ainda põe os quatro testes em Q`);
  }
  assert.deepEqual(faltas, []);
});

// Decisões 17A e 18C do dono (2026-11-03): o resumo nativo e a referência de execução do
// criativo-fluxo, e o resumo do validar-criativo, precisam dizer que refutação sem porque não
// descarta o achado e que, com a trava, headline_tem_ideia na headline passa pela confirmação de
// promessa. No Solo o próprio agente aplica a regra; sem isso, a promessa falsa registrada como
// headline_tem_ideia voltaria a virar sinalização.
test('17A e 18C: resumos nativos e execução descrevem a refutação com porque e a confirmação de promessa', () => {
  const faltas = [];
  const fluxo = nativa('criativo-fluxo', faltas);
  const validar = nativa('validar-criativo', faltas);
  const execucao = join(PACOTE, 'skills', 'criativo-fluxo', 'references', 'execucao.md');
  if (!existsSync(execucao)) faltas.push(`${rel(execucao)} ausente`);
  const textos = [...(fluxo ? [[fluxo.path, fluxo.texto]] : []), ...(existsSync(execucao) ? [[execucao, readFileSync(execucao, 'utf8')]] : [])];
  for (const [path, texto] of textos) {
    for (const termo of ['refutação sem porque', 'confirmação de promessa', 'promessa:i<N>', 'produto, variação, serviço ou condição que o negócio não oferece', 'headline_tem_ideia reclassificad']) {
      if (!contem(texto, termo)) faltas.push(`${rel(path)} sem "${termo}"`);
    }
  }
  if (validar && !contem(validar.texto, 'refutação sem porque não descarta o achado')) faltas.push(`${rel(validar.path)} sem a regra da refutação com porque`);
  assert.deepEqual(faltas, []);
});

// ── Contrato 2.0 nas skills nativas (revisão do PR 20) ───────────────────────
// O teste de execução acima injeta o perfil por conta própria: ele não pega uma skill nativa que ainda
// manda o agente usar valor padrão em moeda. Estes casos leem o TEXTO das skills nativas do hermes.
const NATIVAS_DO_HERMES = () => {
  const raiz = join(PACOTE, 'skills');
  return readdirSync(raiz).map((nome) => [nome, join(raiz, nome, 'SKILL.md')]).filter(([, p]) => existsSync(p));
};

test('nenhuma skill nativa do hermes manda usar valor padrão em moeda para heurística', () => {
  const achados = [];
  for (const [nome, caminho] of NATIVAS_DO_HERMES()) {
    const texto = prosa(readFileSync(caminho, 'utf8'));
    for (const m of texto.matchAll(/[^.;]{0,80}(?:default|padrão|valor-padrão)[^.;]{0,40}R\$ ?\d[^.;]{0,40}|[^.;]{0,60}\b(?:piso|passo|degrau|janela)[^.;]{0,60}R\$ ?\d[^.;]{0,40}|[^.;]{0,40}R\$ ?\d[^.;]{0,40}\b(?:piso|sobrescrev)[^.;]{0,40}/gi)) {
      achados.push(`${nome}: ${m[0].trim()}`);
    }
  }
  assert.deepEqual(achados, []);
});

test('a régua nativa exige moeda e config completos, sem default, e cita as sete heurísticas', () => {
  const texto = prosa(readFileSync(join(PACOTE, 'skills', 'regua-decisao', 'SKILL.md'), 'utf8'));
  assert.match(texto, /sem moeda ou sem config completo o script sai com exit 1/i, 'moeda e config obrigatórios');
  assert.match(texto, /`?config`?/, 'config citado');
  for (const campo of ['piso_diagnostico', 'piso_opiniao_fadiga', 'piso_veredito_pausa', 'conversoes_minimas_escala', 'intervalo_minimo_degrau_dias', 'lucro_por_real_referencia_min', 'lucro_por_real_referencia_max']) {
    assert.ok(texto.includes(campo), `heurística ${campo} ausente`);
  }
  assert.doesNotMatch(texto, /fica no default do contrato/i);
});

test('o criativo-fluxo nativo passa o segmento do perfil nos args', () => {
  const execucao = readFileSync(join(PACOTE, 'skills', 'criativo-fluxo', 'references', 'execucao.md'), 'utf8');
  assert.match(execucao, /"segmento":/);
});

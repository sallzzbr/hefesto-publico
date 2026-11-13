// Contratos do iris. O plugin é markdown: estes testes travam o que é verificável sem modelo —
// toda orientação aponta para uma fonte declarada, toda fonte tem URL e data, as skills apontam
// para referências que existem, nada de dado privado entra no pacote e os evals têm estrutura.
// Não medem se um modelo segue as skills: isso é `evals/` numa sessão real.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const PLUGIN = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ler = p => readFileSync(join(PLUGIN, p), 'utf8');
const arquivos = (dir, ext = '.md') => readdirSync(join(PLUGIN, dir), { recursive: true })
  .map(p => join(dir, String(p))).filter(p => p.endsWith(ext) && statSync(join(PLUGIN, p)).isFile());
const frontmatter = texto => {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(texto);
  assert.ok(m, 'frontmatter ausente');
  return Object.fromEntries(m[1].split('\n').map(l => /^([a-zA-Z]+):\s*(.*)$/.exec(l)).filter(Boolean).map(x => [x[1], x[2].replace(/^"|"$/g, '')]));
};
const CARTOES = arquivos('references');
const FONTES = ler('references/fontes.md');
const linhasFonte = FONTES.split('\n').map(l => /^\| ([AOG]\d+) \| (.*?) \| .*\| (direto|espelho oficial|trecho de busca) \| (baixa|média|alta) \|$/.exec(l)).filter(Boolean);
const IDS = new Set(linhasFonte.map(m => m[1]));
const ISO = /^\d{4}-\d{2}-\d{2}$/;

test('toda fonte da tabela tem URL https e acesso declarado; nenhuma orientação se apoia em trecho de busca', () => {
  assert.ok(IDS.size >= 10, `fontes lidas: ${IDS.size}`);
  for (const m of linhasFonte) {
    assert.match(m[2], /\]\(https:\/\/[^)]+\)/, `${m[1]} sem link https`);
    assert.notEqual(m[3], 'trecho de busca', `${m[1]}: trecho de busca não sustenta orientação`);
  }
});

test('todo cartão declara destino, escopo, data de consulta, prazo de revisão e fontes existentes', () => {
  assert.ok(CARTOES.length >= 7);
  for (const c of CARTOES) {
    const f = frontmatter(ler(c));
    for (const campo of ['destino', 'aplicaA', 'consultadoEm', 'revisarAte', 'fontes']) assert.ok(f[campo], `${c}: ${campo}`);
    assert.match(f.consultadoEm, ISO, c); assert.match(f.revisarAte, ISO, c);
    assert.ok(f.revisarAte > f.consultadoEm, `${c}: revisarAte precisa ser posterior à consulta`);
    const declaradas = f.fontes.replace(/[[\]\s]/g, '').split(',').filter(Boolean);
    assert.ok(declaradas.length > 0, `${c}: sem fontes`);
    for (const id of declaradas) assert.ok(IDS.has(id), `${c}: fonte ${id} não está em fontes.md`);
  }
});

test('toda citação [X1] no corpo de um cartão existe na tabela e está declarada no frontmatter do cartão', () => {
  for (const c of CARTOES) {
    const texto = ler(c), f = frontmatter(texto);
    const declaradas = new Set(f.fontes.replace(/[[\]\s]/g, '').split(','));
    const corpo = texto.replace(/^---\n[\s\S]*?\n---\n/, '');
    const citadas = [...corpo.matchAll(/\[([AOG]\d+)(?:[–-]([AOG]\d+))?\]/g)].flatMap(m => m[2] ? [m[1], m[2]] : [m[1]]);
    for (const id of citadas) {
      assert.ok(IDS.has(id), `${c}: cita ${id}, ausente de fontes.md`);
      assert.ok(declaradas.has(id), `${c}: cita ${id} sem declará-la no frontmatter`);
    }
  }
});

test('cartões de destino cobrem Claude, OpenAI, Gemini e desconhecido; princípios só citam fontes de dois provedores', () => {
  for (const d of ['claude', 'openai', 'gemini', 'desconhecido']) assert.ok(existsSync(join(PLUGIN, 'references/destinos', `${d}.md`)), d);
  const f = frontmatter(ler('references/principios.md'));
  const ids = f.fontes.replace(/[[\]\s]/g, '').split(',');
  assert.ok(ids.some(i => i.startsWith('A')) && ids.some(i => i.startsWith('O')), 'princípios comuns exigem fonte Anthropic e OpenAI');
});

test('skills: name igual ao diretório, description com verbo inglês, referências citadas existem', () => {
  for (const skill of readdirSync(join(PLUGIN, 'skills'))) {
    const texto = ler(`skills/${skill}/SKILL.md`), f = frontmatter(texto);
    assert.equal(f.name, skill);
    assert.match(f.description, /^(Write|Create|Improve|Review)\b/);
    assert.ok(f.description.length <= 1024);
    for (const m of texto.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^\s`)]+)/g)) {
      const alvo = m[1].replace(/[.,;:]+$/, '');
      assert.ok(existsSync(join(PLUGIN, alvo)), `${skill}: referência inexistente ${alvo}`);
    }
  }
});

test('escrever-prompt preserva o destino informado e tem saída portátil declarada para destino desconhecido', () => {
  const t = ler('skills/escrever-prompt/SKILL.md');
  assert.match(t, /não pergunte de novo/);
  assert.match(t, /references\/destinos\/desconhecido\.md/);
  assert.match(t, /Configuração recomendada/);
  assert.match(t, /Incertezas/);
});

test('fronteira pública: nenhum dado privado, path de máquina ou nome de projeto real no pacote', () => {
  // O prenome do autor não é checado aqui (o literal não pode morar em arquivo público); a defesa é o guard
  // do espelho (regra de autoria com retenções por linha) e a suíte privada de publicação.
  const proibidos = [/HUAH/i, /onda 2\.1/i, /privado\//, /\/home\/|\/Users\/|[A-Z]:\\/, /hefesto-privado/i];
  for (const p of [...arquivos('references'), ...arquivos('skills'), ...arquivos('commands'), ...arquivos('evals'), 'README.md', 'CHANGELOG.md']) {
    const texto = ler(p);
    for (const r of proibidos) assert.doesNotMatch(texto, r, `${p}: ${r}`);
  }
});

test('evals: cada caso tem prompt e critério com Esperado e Score', () => {
  const base = join(PLUGIN, 'evals', 'comportamento');
  const casos = readdirSync(base);
  assert.ok(casos.length >= 6);
  for (const caso of casos) {
    assert.ok(readFileSync(join(base, caso, 'prompt.md'), 'utf8').trim(), caso);
    const criterio = readFileSync(join(base, caso, 'graders', 'criteria.md'), 'utf8');
    assert.match(criterio, /^## Esperado$/m, caso); assert.match(criterio, /^## Score$/m, caso);
  }
});

test('nenhum cartão recomenda ênfase agressiva como técnica', () => {
  for (const c of CARTOES) {
    const corpo = ler(c).replace(/^---\n[\s\S]*?\n---\n/, '');
    // Unidade = item de lista, linha de tabela ou parágrafo (linhas quebradas se juntam).
    for (const bloco of corpo.split(/\n(?=- |\| |\d+\. |#|\n)/)) {
      if (/\b(CRITICAL|MUST)\b/.test(bloco)) assert.match(bloco, /atrapalha|evite|agressiv|Sem |não /i, `${c}: ${bloco}`);
    }
  }
});

test('ao cortar perguntas preserva no prompt a fronteira de ações destrutivas e efeitos externos', () => {
  const nativa = readFileSync(join(PLUGIN, '../../codex/plugins/iris/skills/escrever-prompt/SKILL.md'), 'utf8');
  for (const texto of [ler('skills/escrever-prompt/SKILL.md'), nativa]) {
    assert.match(texto, /no prompt entregue/);
    assert.match(texto, /a[çc][õo]es destrutivas e efeitos externos/);
    assert.match(texto, /autoriza[çc][ãa]o[^.]*j[áa][^.]*sess[ãa]o/);
    assert.match(texto, /leitura e testes locais/);
    assert.match(texto, /n[ãa]o[^.]*aprova[çc][ãa]o[^.]*cada a[çc][ãa]o/);
  }
});

test('isolamento Codex depende do schema exposto, não da flag histórica', () => {
  for (const arquivo of ['references/delegacao.md', 'references/destinos/openai.md']) {
    const t = ler(arquivo);
    assert.match(t, /2026-11-03/);
    assert.match(t, /0\.155\.1/);
    assert.match(t, /schema/);
    assert.match(t, /não deduza[^.]*flag/i);
    assert.match(t, /fork_turns: "none"/);
    assert.match(t, /históric[oa]/);
    assert.doesNotMatch(t, /na versão\s+1, só com `fork_context` verdadeiro/);
  }
});

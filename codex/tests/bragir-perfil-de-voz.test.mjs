// Perfil de voz no Codex, alinhado ao desenho do integrador (2026-11-02) dentro da decisão do dono:
// o perfil pessoal fica fora do pacote e sobrevive à atualização. Regra única de local_voz:
// (1) AGENTS.md do workspace; (2) defaults Codex, se o usuário já configurou; (3) perfil existente no
// workspace; (4) default documentado ~/.codex/hefesto/bragir/perfil-de-voz.md (o RUNTIME.md mapeia
// ~/.claude/<plugin>/ para ~/.codex/hefesto/<plugin>/). A cópia empacotada em shared/ é reserva
// somente leitura depois do nível (4). analisar-voz não oferece mais registrar local_voz nos
// defaults: o registro fazia o perfil pessoal prevalecer sobre o perfil de todo projeto.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const CODEX = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACOTE = join(CODEX, 'plugins', 'bragir');
const PESSOAL = '~/.codex/hefesto/bragir/perfil-de-voz.md';
const SKILLS = readdirSync(join(PACOTE, 'skills'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
const nativa = (nome) => readFileSync(join(PACOTE, 'skills', nome, 'SKILL.md'), 'utf8');

// Parágrafos desembrulhados e partidos em frases; item de lista e linha de tabela são unidades
// próprias, para que uma linha sobre o pacote e a vizinha sobre gravar não se misturem.
const frases = (texto) => texto.replace(/^[ \t]*(?:\||[-*] |\d+\. )/gm, (inicio) => `\n${inicio}`)
  .split(/\r?\n\s*\r?\n/)
  .map((p) => p.replace(/\s*\r?\n\s*/g, ' ').trim())
  .flatMap((p) => p.split(/(?<=[.!?])\s+/))
  .filter(Boolean);

test('todo leitor nativo do perfil de voz lê o perfil pessoal Codex antes da reserva empacotada', () => {
  const leitores = SKILLS.filter((s) => s !== 'analisar-voz' && /local_voz|perfil-de-voz/.test(nativa(s)));
  for (const s of ['escrever-como-autor', 'revisar-naturalidade', 'analisar-metricas']) {
    assert.ok(leitores.includes(s), `${s} deixou de resolver o perfil de voz`);
  }
  for (const s of leitores) {
    const texto = nativa(s);
    const pessoal = texto.indexOf(PESSOAL);
    assert.ok(pessoal >= 0, `${s}: falta o nível (4) ${PESSOAL}`);
    const reserva = texto.search(/shared\/perfil-de-voz\.md|\breserva\b|\bfallback\b/i);
    if (reserva >= 0) assert.ok(pessoal < reserva, `${s}: a reserva empacotada aparece antes do perfil pessoal`);
  }
  const escrever = nativa('escrever-como-autor');
  const ordem = ['AGENTS.md', 'defaults.md', './voz/perfil-de-voz.md', PESSOAL].map((m) => escrever.indexOf(m));
  assert.ok(ordem.every((i, n) => i >= 0 && (n === 0 || ordem[n - 1] < i)), `escrever-como-autor: cadeia fora de ordem: ${ordem}`);
});

test('analisar-voz nativa grava no local_voz resolvido até o perfil pessoal Codex e anuncia antes de sobrescrever', () => {
  const texto = nativa('analisar-voz');
  const ordem = ['AGENTS.md', '~/.codex/hefesto/bragir/defaults.md', './voz/perfil-de-voz.md', PESSOAL].map((m) => texto.indexOf(m));
  assert.ok(ordem.every((i, n) => i >= 0 && (n === 0 || ordem[n - 1] < i)), `ordem: AGENTS.md, defaults, workspace e só então o perfil pessoal: ${ordem}`);
  const ditas = frases(texto);
  const padrao = ditas.find((f) => /default documentado/i.test(f));
  assert.ok(padrao && padrao.includes(PESSOAL), `o default documentado do destino é o perfil pessoal: ${padrao}`);
  const sobrescrita = ditas.find((f) => /sobrescrev/i.test(f) && /anunci/i.test(f));
  assert.ok(sobrescrita, 'falta anunciar o destino antes de sobrescrever arquivo existente');
  assert.match(sobrescrita, /n[íi]vel/i, 'o anúncio precisa dizer de qual nível veio o destino');
  assert.match(sobrescrita, /pe[çc]a ok|confirma/i, 'sobrescrever exige ok do usuário');
  assert.match(texto, /Nunca grave perfil no pacote nem no cache/);
});

// Negação que rege a escrita, não qualquer "não" da oração: "Se o usuário não tiver projeto,
// registre local_voz nos defaults" tem "não" e reintroduz o registro proibido. Valem o verbo
// negado ("não registra", "nunca grave"), o lugar negado ("nunca no plugin", "fora do plugin"),
// "sem registro" e "somente leitura".
const NEG_VERBO = /\b(?:n[ãa]o|nunca|jamais)\s+(?:(?:o|a|os|as|se|mais|deve|devem|pode|podem|precisa|ofere[çc]a|oferece|é)\s+){0,2}(?:registr|grav|atualiz|escrev|sobrescrev|edit|ofere[çc])/i;
const NEG_LUGAR = /\b(?:n[ãa]o|nunca|jamais)\s+(?:(?:em|n[oa]|dentro d[oa])\s+)?(?:o\s+)?(?:plugin|pacote|\$\{CLAUDE_PLUGIN_ROOT\})|fora d[oa] (?:plugin|pacote)|somente leitura|s[óo] leitura/i;
const NEG_REGISTRO = /\bsem registr|\bn[ãa]o (?:h[áa] )?registr/i;
const NENHUMA_ESCRITA = /\bnenhuma? (?:skill|etapa|fluxo) (?:\S+ )?(?:grava|registra|atualiza|escreve)/i;
const negaEscrita = (f) => NEG_VERBO.test(f) || NEG_LUGAR.test(f) || NENHUMA_ESCRITA.test(f);
const negaRegistro = (f) => NEG_VERBO.test(f) || NEG_REGISTRO.test(f);
const FALA_DE_REGISTRO = /registr\w*\s+(?:\S+\s+){0,2}?`?local_voz|registr\w*[^.;]{0,40}\bdefaults\b/i;
const FRASES_PROIBIDAS = [
  'Se o usuário não tiver projeto, registre local_voz nos defaults.',
  'Quando não houver local_voz, grave o perfil no plugin.',
  'Sem nenhum perfil no projeto, atualize o perfil do plugin.',
  'Se não houver perfil, nenhum aviso é necessário: grave o perfil no plugin.',
];
test('a guarda de negação reprova condicional que reintroduz a escrita proibida', () => {
  for (const f of FRASES_PROIBIDAS) {
    assert.ok(!(negaEscrita(f) || negaRegistro(f)), `a guarda aceitaria: ${f}`);
  }
  assert.ok(negaEscrita('grava no local_voz resolvido, nunca no plugin.'));
  assert.ok(negaRegistro('Vale sem registro nos defaults.'));
});

test('analisar-voz nativa não oferece registrar local_voz nos defaults', () => {
  const texto = nativa('analisar-voz');
  const registro = frases(texto).filter((f) => FALA_DE_REGISTRO.test(f));
  for (const f of registro) assert.ok(negaRegistro(f), `oferta de registrar local_voz nos defaults: ${f}`);
  assert.doesNotMatch(texto, /registre\s+`?local_voz`?\s+nos defaults apenas quando/i, 'voltou o registro de local_voz nos defaults');
});

// A negação vale para a oração, não para a frase inteira: "grave no plugin; sem nenhum, entregue"
// passaria na frase pelo "nenhum" da oração vizinha.
const clausulas = (texto) => frases(texto).flatMap((f) => f.split(/;\s+/));
const ESCRITA = /\b(?:grav|atualiz|escrev|sobrescrev)(?:a|e|ar|er|ou|am|em)?(?![\wà-ÿ-])/i;
const MENCIONA_PACOTE = /\bplugin\b|\bpacote\b|shared\/perfil-de-voz/i;
const ASSOCIACOES = [/perfil (?:de voz )?default do (?:plugin|pacote)/i, /atualiz\w* o (?:perfil )?default/i, /atualiz\w* o perfil de voz do bragir/i];
test('skills nativas não associam o pacote a gravar o perfil nem leem configuração Claude', () => {
  for (const s of SKILLS) {
    const texto = nativa(s);
    for (const re of ASSOCIACOES) assert.doesNotMatch(texto, re, `${s} associa o pacote à atualização do perfil`);
    for (const f of clausulas(texto).filter((x) => /perfil/i.test(x) && MENCIONA_PACOTE.test(x) && ESCRITA.test(x))) {
      assert.ok(negaEscrita(f), `${s}: frase põe o pacote como destino de escrita do perfil: ${f}`);
    }
    assert.doesNotMatch(texto, /~\/\.claude\//, `${s}: skill nativa lê configuração Claude em vez dos defaults Codex`);
  }
});

test('CHANGELOG 0.4.0 e README Codex descrevem o perfil pessoal e a cópia anterior à atualização', () => {
  const changelog = readFileSync(join(PACOTE, 'CHANGELOG.md'), 'utf8');
  const entrada = /^## 0\.4\.0\b[^\n]*\n([\s\S]*?)(?=^## )/m.exec(changelog)?.[1];
  assert.ok(entrada, 'CHANGELOG sem a entrada 0.4.0');
  assert.ok(entrada.includes(PESSOAL), 'a entrada 0.4.0 não diz onde fica o perfil pessoal');
  const ditas = frases(entrada);
  assert.ok(ditas.some((f) => /antes de atualizar/i.test(f) && /cop(?:ie|iar)/i.test(f)), 'falta a cópia anterior à atualização para quem editou a reserva empacotada');
  assert.ok(ditas.some((f) => /registr/i.test(f) && /local_voz/.test(f) && /\b(?:n[ãa]o|nunca)\b/i.test(f)), 'falta dizer que analisar-voz não registra mais local_voz nos defaults');
  const readme = readFileSync(join(CODEX, 'README.md'), 'utf8');
  const item = readme.split(/\r?\n/).find((l) => /^- Bragir\b/.test(l) && /perfil de voz/i.test(l));
  assert.ok(item, 'README Codex sem o item sobre o perfil de voz do Bragir');
  assert.ok(item.includes(PESSOAL), 'README Codex não anuncia o perfil pessoal fora do pacote');
  assert.match(item, /pacote não contém perfil de voz/i);
});

// Isolamento (revisão do PR 15): o RUNTIME resolve defaults por <CODEX_HOME>; o perfil pessoal e o
// defaults.md citados nas skills precisam seguir a mesma regra, senão uma sessão com CODEX_HOME
// temporário lê ou grava a configuração real.
test('perfil pessoal e defaults do Bragir seguem CODEX_HOME nas quatro skills que os usam', () => {
  const COM_HOME = '<CODEX_HOME>/hefesto/bragir/';
  for (const s of ['analisar-voz', 'analisar-metricas', 'escrever-como-autor', 'revisar-naturalidade']) {
    const texto = nativa(s);
    assert.ok(texto.includes(`${COM_HOME}perfil-de-voz.md`), `${s}: falta ${COM_HOME}perfil-de-voz.md`);
    for (const m of texto.matchAll(/~\/\.codex\/hefesto\/bragir\/[\w.-]+/g)) {
      const janela = texto.slice(Math.max(0, m.index - 300), m.index + 300).replace(/\s+/g, ' ');
      assert.ok(janela.includes(COM_HOME), `${s}: ${m[0]} aparece sem a regra de CODEX_HOME por perto`);
      assert.match(janela, /CODEX_HOME.{0,80}(?:definid|vazi)|(?:definid|vazi).{0,80}CODEX_HOME/i, `${s}: ${m[0]} sem a condição de CODEX_HOME definido e não vazio`);
    }
  }
  assert.ok(nativa('analisar-voz').includes(`${COM_HOME}defaults.md`), 'analisar-voz: falta <CODEX_HOME> no defaults.md');
});

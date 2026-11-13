// Contratos das skills do bragir — o plugin não tinha diretório tests/ (auditoria de 2026-09-01).
//
// O que trava: o contrato de personas (CRÍTICO no AGENTS.md — personas são do projeto, nunca
// do plugin), a dependência do perfil de voz via ${CLAUDE_PLUGIN_ROOT}, frontmatter com
// gatilhos, versões em sincronia e ausência de dado pessoal. O validar.mjs já cobre frontmatter
// e paths; aqui entra o que é específico do bragir e que ninguém mais olha.

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const PLUGIN = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ = resolve(PLUGIN, '..', '..');
const SKILLS = readdirSync(resolve(PLUGIN, 'skills')).filter((s) => statSync(resolve(PLUGIN, 'skills', s)).isDirectory());
const skill = (nome) => readFileSync(resolve(PLUGIN, 'skills', nome, 'SKILL.md'), 'utf8');
const descricao = (texto) => /^---\r?\n[\s\S]*?description:\s*"?([^\n]*?)"?\r?\n[\s\S]*?^---/m.exec(texto)?.[1] ?? '';

function arquivosDoPlugin(dir = PLUGIN) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'tests') out.push(...arquivosDoPlugin(p)); }
    else out.push(p);
  }
  return out;
}

test('as doze skills existem e cada description tem gatilho de uso e tamanho de roteamento', () => {
  assert.deepEqual(SKILLS.sort(), ['analisar-metricas', 'analisar-voz', 'avaliar-vagas', 'curar-portfolio', 'direcionar-comunicacao-visual', 'escrever-como-autor', 'gerenciar-personas', 'mapear-perfil-profissional', 'planejar-agenda', 'preparar-candidatura', 'revisar-linkedin', 'revisar-naturalidade']);
  for (const s of SKILLS) {
    const d = descricao(skill(s));
    assert.ok(d.length >= 80, `${s}: description curta demais para rotear (${d.length})`);
    assert.match(d, /Use (when|quando|sempre)/i, `${s}: description sem gatilho "Use when/quando"`);
  }
});

test('plugin.json e marketplace.json concordam na versão', () => {
  const pj = JSON.parse(readFileSync(resolve(PLUGIN, '.claude-plugin', 'plugin.json'), 'utf8'));
  const mp = JSON.parse(readFileSync(resolve(RAIZ, '.claude-plugin', 'marketplace.json'), 'utf8'));
  assert.equal(pj.name, 'bragir');
  assert.equal(mp.plugins.find((p) => p.name === 'bragir').version, pj.version);
});

test('pacote não distribui perfil e escrita sem perfil oferece analisar-voz', () => {
  assert.equal(existsSync(resolve(PLUGIN, 'perfil-de-voz.md')), false);
  const texto = skill('escrever-como-autor');
  assert.ok(!texto.includes('${CLAUDE_PLUGIN_ROOT}/perfil-de-voz.md'));
  assert.match(texto, /Sem perfil preenchido, pare/);
  assert.match(texto, /bragir:analisar-voz/);
  assert.match(texto, /scaffold/i);
});

test('personas são do projeto: gerenciar-personas escreve em ./personas/ e proíbe o plugin como destino', () => {
  const texto = skill('gerenciar-personas');
  assert.match(texto, /\.\/personas\//, 'destino ./personas/ ausente');
  assert.match(texto, /Nunca escreva personas dentro do plugin/i, 'a proibição explícita de escrever em ${CLAUDE_PLUGIN_ROOT} sumiu');
  assert.ok(!existsSync(resolve(PLUGIN, 'personas')) && !existsSync(resolve(PLUGIN, 'personas.md')), 'há personas dentro do plugin — contrato CRÍTICO violado');
});

test('escrever-como-autor descobre personas do projeto e oferece gerenciar-personas quando não há', () => {
  const texto = skill('escrever-como-autor');
  assert.match(texto, /\.\/personas\//);
  assert.match(texto, /gerenciar-personas/);
});

test('nenhum arquivo do plugin carrega path pessoal, e-mail ou dado de projeto', () => {
  const proibidos = [/\/Users\//, /@gmail\.com/];
  for (const arquivo of arquivosDoPlugin()) {
    const texto = readFileSync(arquivo, 'utf8');
    for (const re of proibidos) assert.doesNotMatch(texto, re, `${arquivo} casa ${re}`);
  }
});

// Parágrafos desembrulhados e partidos em frases: a unidade em que "grave em X" e "X é somente
// leitura" são lidas juntas. Linha não serve, porque o markdown quebra a frase no meio. Linha de
// tabela e item de lista viram unidade própria: juntos, uma linha falaria do plugin e a vizinha
// de gravar.
function frases(texto) {
  return texto.replace(/^[ \t]*(?:\||[-*] |\d+\. )/gm, (inicio) => `\n${inicio}`)
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.replace(/\s*\r?\n\s*/g, ' ').trim())
    .flatMap((p) => p.split(/(?<=[.!?])\s+/))
    .filter(Boolean);
}

const PESSOAL = '~/.claude/bragir/perfil-de-voz.md';
const RESERVA = '${CLAUDE_PLUGIN_ROOT}/perfil-de-voz.md';
const secaoBragirRaiz = () => /^## Plugin bragir[^\n]*\n([\s\S]*?)(?=^## )/m.exec(readFileSync(resolve(RAIZ, 'README.md'), 'utf8'))?.[1] ?? '';
const linhaDaTabela = (texto, nome) => texto.split(/\r?\n/).find((l) => l.startsWith(`| \`${nome}\``)) ?? '';

// BRAGIR-02: o override "atualiza meu perfil de voz padrão" gravava em
// ${CLAUDE_PLUGIN_ROOT}/perfil-de-voz.md, a cópia instalada que toda atualização substitui. O perfil
// sumia sem aviso. Decisão do dono (2026-11-02): o plugin é reserva somente leitura.
test('analisar-voz nunca grava no plugin: toda menção a ${CLAUDE_PLUGIN_ROOT} declara a reserva somente leitura', () => {
  const texto = skill('analisar-voz');
  const comPlugin = frases(texto).filter((f) => f.includes('${CLAUDE_PLUGIN_ROOT}'));
  assert.ok(comPlugin.length > 0, 'analisar-voz precisa nomear a reserva do plugin para proibi-la como destino');
  for (const f of comPlugin) {
    assert.match(f, /somente leitura|nunca (grave|escreva|sobrescreva)/i, `frase trata o plugin como destino de escrita: ${f}`);
    assert.doesNotMatch(f, /(?<!(nunca|não)\s+)\b(grave|gravar|escreva|escrever|sobrescreva|sobrescrever)\s+(em|no|o)\s+`?\$\{CLAUDE_PLUGIN_ROOT\}/i, `instrução positiva de escrita no plugin: ${f}`);
  }
});

// Desenho do integrador (2026-11-02), dentro da decisão do dono: o perfil pessoal é o nível (4),
// default documentado da regra única de local_voz, e a reserva do plugin só vem depois dele. Sem
// leitor nesse nível, o arquivo que analisar-voz grava ali ficava órfão quando ninguém registrava
// local_voz nos defaults.
test('todo leitor do perfil de voz lê o perfil pessoal (nível 4) antes da reserva do plugin', () => {
  const leitores = SKILLS.filter((s) => s !== 'analisar-voz' && /local_voz|perfil-de-voz\.md/.test(skill(s)));
  for (const s of ['escrever-como-autor', 'revisar-naturalidade', 'analisar-metricas']) {
    assert.ok(leitores.includes(s), `${s} deixou de resolver o perfil de voz`);
  }
  for (const s of leitores) {
    const texto = skill(s);
    const pessoal = texto.indexOf(PESSOAL);
    assert.ok(pessoal >= 0, `${s}: falta o nível (4) ${PESSOAL}`);
    const reserva = texto.search(/\$\{CLAUDE_PLUGIN_ROOT\}\/perfil-de-voz\.md|\breserva\b/i);
    if (reserva >= 0) assert.ok(pessoal < reserva, `${s}: a reserva do plugin aparece antes do perfil pessoal`);
  }
  const escrever = skill('escrever-como-autor');
  const ordem = ['./voice-profile.md', PESSOAL].map((m) => escrever.indexOf(m));
  assert.ok(ordem[0] >= 0 && ordem[0] < ordem[1]);
  assert.ok(!escrever.includes(RESERVA));
  assert.match(escrever, /Sem perfil preenchido, pare/);
});

test('analisar-voz grava no local_voz resolvido de (1) a (4), com o perfil pessoal como default documentado', () => {
  const texto = skill('analisar-voz');
  const secao = /^### Destino do perfil\r?\n([\s\S]*?)(?=^#{2,3} )/m.exec(texto)?.[1];
  assert.ok(secao, 'analisar-voz sem a seção "### Destino do perfil"');
  const ordem = ['## Paths do workspace', '~/.claude/bragir/defaults.md', './voz/perfil-de-voz.md', PESSOAL].map((m) => secao.indexOf(m));
  assert.ok(ordem.every((i) => i >= 0), `seção sem algum nível da resolução: ${ordem}`);
  assert.ok(ordem[0] < ordem[1] && ordem[1] < ordem[2] && ordem[2] < ordem[3], 'ordem: CLAUDE.md do repo, defaults, convenção do cwd e só então o perfil pessoal');
  const ditas = frases(secao);
  const padrao = ditas.find((f) => /default documentado/i.test(f));
  assert.ok(padrao && padrao.includes(PESSOAL), `o default documentado do destino é o perfil pessoal: ${padrao}`);
  const sobrescrita = ditas.find((f) => /sobrescrev/i.test(f) && /anunci/i.test(f));
  assert.ok(sobrescrita, 'falta anunciar o destino antes de sobrescrever arquivo existente');
  assert.match(sobrescrita, /n[íi]vel/i, 'o anúncio precisa dizer de qual nível veio o destino');
  assert.match(sobrescrita, /pe[çc]a ok|confirma/i, 'sobrescrever exige ok do usuário');
  const nuvem = ditas.find((f) => /nuvem/i.test(f));
  assert.ok(nuvem, 'falta o aviso de sessão de nuvem');
  assert.match(nuvem, /~\/\.claude/, 'o aviso de nuvem precisa dizer que ~/.claude não persiste');
  assert.match(nuvem, /projeto/i, 'o aviso de nuvem precisa dizer que só o perfil no projeto persiste');
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

// Achado da revisão: registrar local_voz nos defaults fazia o perfil pessoal prevalecer (nível 2)
// sobre ./perfil-de-voz.md e ./voz/perfil-de-voz.md de todo projeto sem local_voz no CLAUDE.md.
test('analisar-voz não oferece registrar local_voz nos defaults', () => {
  const texto = skill('analisar-voz');
  const registro = frases(texto).filter((f) => FALA_DE_REGISTRO.test(f));
  for (const f of registro) assert.ok(negaRegistro(f), `oferta de registrar local_voz nos defaults: ${f}`);
  assert.doesNotMatch(texto, /pergunte se pode registrar/i, 'voltou a pergunta para registrar local_voz');
});

// Atualizar ou gravar o perfil "do plugin" é exatamente o que some na próxima atualização. Casa a
// associação em prosa, sem exigir o literal ${CLAUDE_PLUGIN_ROOT}.
// A negação vale para a oração, não para a frase inteira: "grave no plugin; sem nenhum, entregue"
// passaria na frase pelo "nenhum" da oração vizinha.
const clausulas = (texto) => frases(texto).flatMap((f) => f.split(/;\s+/));
const ESCRITA = /\b(?:grav|atualiz|escrev|sobrescrev)(?:a|e|ar|er|ou|am|em)?(?![\wà-ÿ-])/i;
const MENCIONA_PLUGIN = /\bplugin\b|\$\{CLAUDE_PLUGIN_ROOT\}/i;
const ASSOCIACOES = [/perfil (?:de voz )?default do plugin/i, /atualiz\w* o (?:perfil )?default/i, /atualiz\w* o perfil de voz do bragir/i];
test('nenhuma frase das skills ou dos READMEs associa o plugin a gravar ou atualizar o perfil de voz', () => {
  const fontes = arquivosDoPlugin()
    .filter((p) => p.endsWith('.md') && !p.endsWith('CHANGELOG.md') && p !== resolve(PLUGIN, 'perfil-de-voz.md'))
    .map((p) => [p, readFileSync(p, 'utf8')]);
  fontes.push(['README.md (raiz, seção bragir)', secaoBragirRaiz()]);
  assert.ok(fontes.some(([p]) => p.endsWith(join('analisar-voz', 'SKILL.md'))), 'varredura sem as skills');
  for (const [arquivo, texto] of fontes) {
    for (const re of ASSOCIACOES) assert.doesNotMatch(texto, re, `${arquivo} associa o plugin à atualização do perfil`);
    for (const f of clausulas(texto).filter((x) => /perfil/i.test(x) && MENCIONA_PLUGIN.test(x) && ESCRITA.test(x))) {
      assert.ok(negaEscrita(f), `${arquivo}: frase põe o plugin como destino de escrita do perfil: ${f}`);
    }
  }
});

test('READMEs anunciam a cadeia nova: perfil pessoal antes da reserva e analisar-voz sem registro nos defaults', () => {
  const readmes = [[resolve(PLUGIN, 'README.md'), readFileSync(resolve(PLUGIN, 'README.md'), 'utf8')], ['README.md (raiz)', secaoBragirRaiz()]];
  for (const [arquivo, texto] of readmes) {
    const escrever = linhaDaTabela(texto, 'escrever-como-autor');
    assert.ok(escrever.includes(PESSOAL) && !escrever.includes(RESERVA), `${arquivo}: a linha de escrever-como-autor precisa citar o perfil pessoal e a reserva`);
    const analisar = linhaDaTabela(texto, 'analisar-voz');
    assert.ok(analisar.includes(PESSOAL), `${arquivo}: a linha de analisar-voz não diz o destino default`);
    const sobreAnalise = frases(texto).filter((f) => f.includes('analisar-voz') && f.includes('${CLAUDE_PLUGIN_ROOT}'));
    for (const f of sobreAnalise) assert.match(f, /somente leitura|nunca/i, `${arquivo}: ${f}`);
    for (const f of frases(texto).filter((x) => FALA_DE_REGISTRO.test(x))) {
      assert.ok(negaRegistro(f), `${arquivo}: ainda divulga o registro de local_voz nos defaults: ${f}`);
    }
  }
});

// A orientação antiga ("rode analisar-voz de novo depois de atualizar") chegava tarde: a própria
// atualização substitui a cópia instalada e apaga o perfil personalizado. A cópia precisa vir antes.
test('CHANGELOG 1.5.0 manda copiar o perfil personalizado antes de atualizar', () => {
  const changelog = readFileSync(resolve(PLUGIN, 'CHANGELOG.md'), 'utf8');
  const entrada = /^## 1\.5\.0\b[^\n]*\n([\s\S]*?)(?=^## )/m.exec(changelog)?.[1];
  assert.ok(entrada, 'CHANGELOG sem a entrada 1.5.0');
  const ditas = frases(entrada);
  const antes = ditas.find((f) => /antes de atualizar/i.test(f));
  assert.ok(antes, 'falta a instrução anterior à atualização');
  const copia = ditas.find((f) => /cop(?:ie|iar)/i.test(f) && f.includes(PESSOAL));
  assert.ok(copia, `falta mandar copiar o perfil do plugin para ${PESSOAL}`);
  assert.match(copia, /local_voz/, 'a cópia também pode ir para o local_voz do projeto');
  assert.ok(ditas.some((f) => /j[áa] atualizou/i.test(f) && /amostras/i.test(f)), 'falta o caminho de quem já atualizou: refazer a análise com as amostras');
  assert.doesNotMatch(entrada, /de novo depois de atualizar/i, 'voltou a orientação que perde o perfil');
});

test('referências internas CLAUDE_PLUGIN_ROOT apontam arquivos existentes', () => {
  for (const arquivo of arquivosDoPlugin().filter(p => p.endsWith('.md') && !p.endsWith('CHANGELOG.md'))) {
    for (const [, relativo] of readFileSync(arquivo, 'utf8').matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^\s`"'<>]+)/g)) {
      assert.ok(existsSync(resolve(PLUGIN, relativo.replace(/[),.;]+$/, ''))), `${arquivo}: referência ausente ${relativo}`);
    }
  }
});

test('perfis locais concorrentes exigem escolha nas duas distribuições, sem prioridade pelo nome', () => {
  for (const nome of ['analisar-voz', 'escrever-como-autor']) {
    for (const texto of [skill(nome), readFileSync(resolve(RAIZ, 'codex/plugins/bragir/skills', nome, 'SKILL.md'), 'utf8')]) {
      assert.match(texto, /dois ou mais perfis locais preenchidos/i);
      assert.match(texto, /configuração explícita.*prioridade/i);
      assert.match(texto, /inclusive quando ela aponta para scaffold vazio/);
      assert.match(texto, /pergunte.*perfil/i);
      assert.match(texto, /encerre o turno/i);
      assert.doesNotMatch(texto, /mais prioritário sobrescreve|Use o primeiro perfil preenchido/);
    }
  }
});

test('escolha de voz é reaproveitada sem autorizar escrita ou alterar defaults', () => {
  for (const nome of ['analisar-voz', 'escrever-como-autor']) {
    for (const texto of [skill(nome), readFileSync(resolve(RAIZ, 'codex/plugins/bragir/skills', nome, 'SKILL.md'), 'utf8')]) {
      assert.match(texto, /reaproveite.*mesma sessão/i);
      assert.match(texto, /mesmo workspace/i);
      assert.match(texto, /não autoriza sobrescrever/i);
      assert.match(texto, /não mescle/i);
      assert.match(texto, /não grave.*defaults/i);
    }
  }
});

test('analisar-voz oferece agendamento opt-in nas duas distribuições, sem instalar ou executar', () => {
  for (const texto of [skill('analisar-voz'), readFileSync(resolve(RAIZ, 'codex/plugins/bragir/skills/analisar-voz/SKILL.md'), 'utf8')]) {
    assert.match(texto, /agendamento opcional/i);
    assert.match(texto, /pedido explícito/);
    assert.match(texto, /rotina-mensal\.md/);
    assert.match(texto, /não.*instalação/i);
    assert.match(texto, /sem ferramenta.*passo a passo/i);
    assert.match(texto, /teste.*autorização separada/i);
  }
});

test('rotina mensal é parametrizada e preserva isolamento, ausência de material e autorização', () => {
  const texto = readFileSync(resolve(PLUGIN, 'skills/analisar-voz/references/rotina-mensal.md'), 'utf8');
  assert.doesNotMatch(texto, /sallzzbr|trig_01|\/Users\/|decisão de 2026-11-03/);
  for (const termo of ['<checkout-voz>', '<checkout-metodo>', '<repositorio-voz>', '<autorizacao-registrada>', 'git --no-optional-locks', '--detach', 'HEAD:refs/heads/', 'sem perfil local e sem material novo; forneça amostras para analisar-voz', 'fechado sem merge', 'material_incorporado', 'sem force', 'Nunca faça merge']) assert.ok(texto.includes(termo), termo);
  assert.match(texto, /Não.*checkout, switch, pull, stash, reset ou worktree.*método/);
  assert.match(texto, /Computador ligado.*app aberto/i);
  assert.match(texto, /fuso.*confirm/i);
  assert.match(texto, /posts e análises vêm de <sha-voz-base>, não do HEAD do PR/);
  assert.match(texto, /Explicitar sandbox, modo de aprovação/);
  assert.match(texto, /Não selecionar acesso total/);
});

test('referência de rotina integra recursos Codex e inventário público nas duas distribuições', () => {
  const source='plugins/bragir/skills/analisar-voz/references/rotina-mensal.md';
  const target='plugins/bragir/shared/skills/analisar-voz/references/rotina-mensal.md';
  const recursos=JSON.parse(readFileSync(resolve(RAIZ,'codex/resources.json'),'utf8')).arquivos;
  assert.ok(recursos.some(r=>r.source===source && r.target===target));
  // scripts/espelho-publico.json é interno e não existe no espelho público; lá só vale a parte
  // acima. Na árvore privada, scripts/tests/publicacao.test.mjs cobra a existência e a classificação.
  const arquivoInventario=resolve(RAIZ,'scripts/espelho-publico.json');
  if(existsSync(arquivoInventario)){
    const inventario=JSON.parse(readFileSync(arquivoInventario,'utf8')).arquivos;
    assert.ok(inventario.includes(source));assert.ok(inventario.includes('codex/'+target));
  }
});

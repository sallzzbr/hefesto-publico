// Contrato de documentação do portão TDD (2.5.0 e o porte da 2.6.0), nas duas distribuições.
//
// O comportamento está travado em `harness-dev-loop.test.mjs`, que roda o script. Este arquivo
// cobra o que a sessão precisa saber para MONTAR a invocação e conversar com o dono: os tipos de
// teste, como registrar a exceção, como pedir o rebaseline e o reuso. É marcador de prosa (camada
// fraca, de propósito): se a skill não diz que os args existem, ninguém os passa. Desde a 2.6.0
// ele também lê as skills nativas do pacote Codex (não geradas) e o fluxo da `entregar` fora do
// harness: o check de sync só cobra as cópias em `shared/`, e uma nativa desatualizada passava.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ODIN = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ = resolve(ODIN, '..', '..');
const ler = (rel) => readFileSync(resolve(ODIN, rel), 'utf8');
const CODEX = resolve(RAIZ, 'codex', 'plugins', 'odin');
const lerCodex = (rel) => readFileSync(resolve(CODEX, rel), 'utf8');
const REVISAO = '2026-11-02-r8';

// Trecho entre dois marcadores (o fim é opcional). Marcador ausente falha alto, em vez de
// devolver o arquivo inteiro e deixar a asserção casar em outra seção.
function recorte(texto, inicio, fim) {
  const i = texto.indexOf(inicio);
  assert.ok(i >= 0, `marcador ausente: ${inicio}`);
  const j = fim ? texto.indexOf(fim, i + inicio.length) : texto.length;
  assert.ok(j >= 0, `marcador ausente: ${fim}`);
  return texto.slice(i, j);
}
const linhaCom = (texto, marca) => texto.split('\n').find((l) => l.includes(marca)) ?? '';

test('a skill dev-loop descreve reprodução, preservação e verificações complementares', () => {
  const s = ler('skills/dev-loop/SKILL.md');
  for (const termo of ['reprodução', 'preservação', 'verificações complementares', 'evidência inválida', 'controle vermelho']) {
    assert.ok(s.includes(termo), `dev-loop/SKILL.md sem "${termo}"`);
  }
});

test('a skill dev-loop documenta a exceção humana sem falsificar o vermelho', () => {
  const s = ler('skills/dev-loop/SKILL.md');
  for (const termo of ['autorizacoesTdd', 'escopo', 'evidência', 'vermelhoConfirmado', 'run novo']) {
    assert.ok(s.includes(termo), `dev-loop/SKILL.md sem "${termo}"`);
  }
  assert.match(s, /sem autorização registrada[^.\n]*não presum/i);
  assert.match(s, /não altera relatório anterior|não edita o relatório anterior/i);
});

test('a skill dev-loop documenta rebaseline da retomada tardia e reuso de validação', () => {
  const s = ler('skills/dev-loop/SKILL.md');
  for (const termo of ['rebaselineTdd', 'criteriosAprovados', 'validacaoAnterior', 'validacaoFinal', '--impressao']) {
    assert.ok(s.includes(termo), `dev-loop/SKILL.md sem "${termo}"`);
  }
  assert.match(s, /nunca reverta|não reverta/i);
});

test('a skill manda explicar reprodução e preservação ao dono antes de pedir decisão', () => {
  const s = ler('skills/dev-loop/SKILL.md');
  assert.match(s, /antes de pedir (a )?decisão[^\n]*(reprodução|preservação)|(reprodução|preservação)[^\n]*antes de pedir (a )?decisão/i);
});

test('o resumo canônico do portão e a entregar acompanham o contrato novo', () => {
  const canon = ler('skills/dev-loop/references/escada-ponytail.md');
  for (const termo of ['reprodução', 'preservação', 'evidência inválida', 'rebaselineTdd']) {
    assert.ok(canon.includes(termo), `escada-ponytail.md sem "${termo}"`);
  }
  assert.ok(ler('skills/entregar/SKILL.md').includes('rebaselineTdd'), 'entregar precisa apontar o rebaseline na retomada');
});

test('a revisão de contratos do harness mudou e a skill cita a mesma', () => {
  const harness = ler('skills/dev-loop/harness/loop.mjs');
  assert.ok(harness.includes(`log('odin-dev-loop: revisão de contratos ${REVISAO}')`), 'harness sem a revisão nova');
  assert.ok(ler('skills/dev-loop/SKILL.md').includes(`odin-dev-loop: revisão de contratos ${REVISAO}`));
});

test('odin 3.0.2 com marketplace sincronizado, CHANGELOG e dependência da iris', () => {
  const plugin = JSON.parse(ler('.claude-plugin/plugin.json'));
  assert.equal(plugin.version, '3.0.2');
  // O planner monta o brief do arquiteto com iris:delegar-agente sem condicional (docs-fluxo-14):
  // a iris é dependência declarada, resolvida neste marketplace.
  assert.deepEqual(plugin.dependencies, ['iris']);
  const mp = JSON.parse(readFileSync(resolve(RAIZ, '.claude-plugin', 'marketplace.json'), 'utf8'));
  assert.equal(mp.plugins.find((p) => p.name === 'odin').version, '3.0.2');
  assert.ok(mp.plugins.some((p) => p.name === 'iris'), 'iris fora do marketplace: a dependência não resolve');
  assert.match(ler('CHANGELOG.md'), /^## 3\.0\.2(\s|$)/m);
});

// Iteração 2 (revisão adversarial): o portão antigo sobrevivia na entregar e no resumo canônico.
test('a entregar não descreve mais o portão antigo de "testes executáveis vermelhos"', () => {
  const s = ler('skills/entregar/SKILL.md');
  assert.doesNotMatch(s, /testes executáveis vermelhos/);
  // A lista NUNCA sobreviveu à iteração 2 com o portão antigo (achado docs-fluxo-13).
  assert.doesNotMatch(s, /sem critérios de aceite \+ testes vermelhos \(portão TDD\)/);
  assert.match(s, /reprodução/);
  assert.match(s, /preservação/);
});

test('o resumo canônico manda explicar reprodução e preservação antes de pedir a decisão do dono', () => {
  assert.match(ler('skills/dev-loop/references/escada-ponytail.md'), /antes de pedir (a )?decisão/i);
});

test('a skill dev-loop declara o limite da impressão e o run novo para execução incompleta', () => {
  const s = ler('skills/dev-loop/SKILL.md');
  assert.match(s, /arquivos ignorados/);
  assert.match(s, /execução independente incompleta[^\n]*run novo|run novo[^\n]*execução independente incompleta/i);
  assert.match(s, /casos/);
});

// ── Porte da 2.6.0: fluxo da conversa e da `entregar` (fora do harness) ─────────────────────

test('contrato de conversa: a pergunta encerra a vez e fica registrada como [pendente] antes de ser feita', () => {
  const c = ler('skills/descobrir/references/contrato-de-conversa.md');
  const regras = (c.match(/^\d+\. \*\*/gm) ?? []).length;
  assert.match(c, /^## As 8 regras$/m);
  assert.equal(regras, 8, `o título diz 8 regras e o corpo numera ${regras}`);
  assert.match(c, /encerra a vez/);
  assert.match(c, /ainda abertas/);
  // A marca de Log segue o invariante do Log (toda entrada começa por `[Step N]`).
  assert.match(c, /`\[Step N\] \[pendente\] <pergunta>`/);
  assert.match(c, /antes de perguntar/i);
  assert.match(c, /não é apagada/);
  assert.match(c, /no Codex, pergunta direta que encerra o turno/);
});

test('contrato de conversa: mecânico se verifica e autorização registrada se reaproveita, nunca para mutação externa', () => {
  const c = ler('skills/descobrir/references/contrato-de-conversa.md');
  assert.match(c, /`\[Step N\] \[autorização\] <data> · <autor> · <ação> · <escopo> · <citação>`/);
  assert.match(c, /git symbolic-ref/);
  assert.match(c, /criteriosAprovados/);
  assert.match(c, /merge-base/);
  assert.match(c, /commit, push, PR e publicação[^.]*sessão corrente/);
});

test('a retomada reapresenta a pergunta [pendente] sem resposta antes de seguir', () => {
  const entregar = recorte(ler('skills/entregar/SKILL.md'), '## 🔄 Retomada', '## Quando NÃO usar');
  assert.match(entregar, /\[pendente\][^\n]*reapresent/);
  const protocolo = recorte(ler('skills/entregar/references/steps-detalhados.md'), '## Protocolo de retomada', '## Reporte final');
  assert.match(protocolo, /\[pendente\][^\n]*reapresent/);
  assert.match(protocolo, /nunca presum/i);
  assert.match(protocolo, /\[autorização\]/);
});

test('a entregar não pergunta antes de passo mecânico nem pede OK de novo para o que está autorizado no Log', () => {
  const s = ler('skills/entregar/SKILL.md');
  assert.match(linhaCom(s, '**Regra geral'), /exceto[^.]*Exceções[^.]*autorizado no Log/);
  assert.match(s, /❌ Encadear steps sem pedir OK entre eles \(salvo/);
  assert.doesNotMatch(s, /e antes de \*\*cada\*\* step\/fase/);
});

test('desvio fora do escopo vira pendência pela P14 sem perguntar', () => {
  const s = ler('skills/entregar/SKILL.md');
  const passos = ler('skills/entregar/references/steps-detalhados.md');
  assert.match(s, /Fora do escopo vira pendência pela P14, sem perguntar; pergunte só se o desvio impede um critério da SPEC/);
  assert.doesNotMatch(s, /perguntar se corrige agora ou depois/);
  assert.doesNotMatch(s, /desvio agora × depois/);
  assert.doesNotMatch(passos, /Perguntar ao usuário se quer corrigir o desvio/);
  assert.match(passos, /Decisão: <corrigido agora \| registrado para depois/);
});

test('Step 3 usa a branch principal detectada e só pergunta com falha ou mais de um candidato', () => {
  const step3 = recorte(ler('skills/entregar/SKILL.md'), '### Step 3', '### Step 4');
  assert.doesNotMatch(step3, /^### Step 3[^\n]*\n\n`AskUserQuestion`: \*\*"Em qual branch/);
  assert.match(step3, /informe em uma linha/);
  assert.match(step3, /mais de um candidato/);
  assert.match(step3, /patterns-por-projeto/);
  assert.doesNotMatch(ler('skills/entregar/references/steps-detalhados.md'), /Step 3 — qual branch base\?/);
});

test('Step 8 é passo mecânico e reporta falha de ambiente como ambiente', () => {
  const step8 = recorte(ler('skills/entregar/SKILL.md'), '### Step 8', '### Step 9');
  assert.doesNotMatch(step8, /após OK/);
  assert.match(step8, /passo mecânico/);
  assert.match(step8, /ambiente[^\n]*path[^\n]*variável/);
  assert.match(step8, /nunca código ou teste da entrega/);
  assert.doesNotMatch(ler('skills/entregar/references/steps-detalhados.md'), /Step 8 — validações \+ testes \(preciso do seu OK\)/);
});

test('Step 8 reaproveita a validação verde do loop pela impressão com a mesma exclusão', () => {
  const step8 = recorte(ler('skills/entregar/SKILL.md'), '### Step 8', '### Step 9');
  for (const termo of ['validacaoFinal', 'hashes-testes.mjs" --impressao', 'validacaoFinal.excluidos', 'validacaoFinal.excluidosNaoRastreados', 'validacaoFinal.comandos', 'validação reaproveitada do dev-loop']) {
    assert.ok(step8.includes(termo), `Step 8 sem "${termo}"`);
  }
  const nativa = lerCodex('skills/entregar/SKILL.md');
  assert.match(nativa, /validacaoFinal/);
  assert.match(nativa, /--impressao '<validacaoFinal\.excluidos em JSON>' '<validacaoFinal\.excluidosNaoRastreados em JSON>'/);
});

test('Step 7 Loop passa baseRef (SHA do merge-base gravado no Log), pendenciasPath e vermelhoNaBase', () => {
  const loop = linhaCom(ler('skills/entregar/SKILL.md'), '**Modo LOOP**');
  assert.match(loop, /`baseRef`[^\n]*git merge-base <branchBase> HEAD/);
  assert.match(loop, /nunca o nome da branch/);
  assert.match(loop, /`pendenciasPath`/);
  assert.match(loop, /`vermelhoNaBase: true`/);
  assert.match(lerCodex('skills/entregar/SKILL.md'), /baseRef[^\n]*merge-base/);
});

// Decisão 24 do dono (2026-11-03): baseRef só como SHA completo, fora disso erro de Args antes de
// qualquer agente. As docs das duas distribuições mandam gravar e passar o SHA completo do
// merge-base e dizem como obtê-lo; a leitura por prefixo e a ref só com hex somem da prosa.
test('d24: baseRef é o SHA completo do merge-base nas duas distribuições, e outra forma é erro de Args', () => {
  for (const [nome, texto] of [['dev-loop/SKILL.md', ler('skills/dev-loop/SKILL.md')], ['execucao.md', lerCodex('skills/dev-loop/references/execucao.md')]]) {
    assert.match(texto, /SHA completo/, nome);
    assert.match(texto, /40 ou 64/, nome);
    assert.match(texto, /maiúsculas valem como minúsculas/i, `${nome}: diz o que acontece com maiúsculas`);
    assert.ok(texto.includes("git rev-parse --verify '<ref>^{commit}'"), `${nome}: comando do SHA a partir de uma ref`);
    assert.doesNotMatch(texto, /só hex|só com hex|esse prefixo|começa(?:r|ndo)? por ela/, `${nome}: a leitura por prefixo deixou de existir`);
  }
  assert.match(linhaCom(ler('skills/entregar/SKILL.md'), '**Modo LOOP**'), /`baseRef` = SHA completo de `git merge-base <branchBase> HEAD`/);
  assert.match(lerCodex('skills/entregar/SKILL.md'), /`baseRef` \(SHA completo de `git merge-base <branchBase> HEAD`/);
  assert.match(ler('skills/entregar/references/steps-detalhados.md'), /baseRef: <SHA completo do merge-base>/);
  assert.match(ler('skills/descobrir/references/contrato-de-conversa.md'), /`baseRef` \(o SHA completo de\s+`git merge-base <branchBase> HEAD`/);
  const cabecalho = recorte(ler('skills/dev-loop/harness/loop.mjs'), '//   baseRef?:', '//   vermelhoNaBase?:');
  assert.match(cabecalho, /SHA completo/);
  assert.match(cabecalho, /erro de Args/);
});

// A lista acima é fechada e deixou o README de fora: ele citava `baseRef` sem dizer que é o SHA
// completo. Esta varredura abre: toda doc `.md` das duas distribuições do odin que cita `baseRef`
// diz "SHA completo". O CHANGELOG fica de fora porque narra a regra anterior, por prefixo.
// A varredura cobra os arquivos conhecidos, para não passar em vazio se a descoberta quebrar.
function docsQueCitamBaseRef(raiz) {
  const achados = new Map();
  const andar = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = resolve(dir, e.name);
      if (e.isDirectory()) andar(p);
      else if (e.name.endsWith('.md') && e.name !== 'CHANGELOG.md') {
        const texto = readFileSync(p, 'utf8');
        if (texto.includes('baseRef')) achados.set(relative(raiz, p).split(sep).join('/'), texto);
      }
    }
  };
  andar(raiz);
  return achados;
}

test('d24: toda doc do odin que cita baseRef diz que é o SHA completo, e o README diz como obtê-lo', () => {
  const conhecidas = {
    plugins: ['README.md', 'skills/dev-loop/SKILL.md', 'skills/entregar/SKILL.md', 'skills/entregar/references/steps-detalhados.md',
      'skills/descobrir/references/contrato-de-conversa.md', 'skills/dev-loop/references/escada-ponytail.md'],
    codex: ['skills/dev-loop/SKILL.md', 'skills/entregar/SKILL.md', 'skills/dev-loop/references/execucao.md'],
  };
  for (const [rotulo, raiz] of [['plugins', ODIN], ['codex', CODEX]]) {
    const docs = docsQueCitamBaseRef(raiz);
    for (const rel of conhecidas[rotulo]) assert.ok(docs.has(rel), `${rotulo}/odin/${rel} não entrou na varredura`);
    const semSha = [...docs].filter(([, texto]) => !texto.includes('SHA completo')).map(([rel]) => `${rotulo}/odin/${rel}`);
    assert.deepEqual(semSha, [], 'doc que cita baseRef sem dizer que é o SHA completo');
  }
  assert.match(ler('README.md').replace(/\s+/g, ' '), /`baseRef` \(o SHA completo de `git merge-base <branchBase> HEAD`; outra forma é erro de Args\) \+ `vermelhoNaBase`/);
});

test('Solo com a implementação já presente mede o vermelho numa cópia da base, sem reverter', () => {
  const solo = recorte(ler('skills/entregar/SKILL.md'), '**Modo SOLO**', '**Exceções');
  assert.match(solo, /copia-base\.mjs" criar <baseRef do Log>/);
  assert.match(solo, /sem reverter a worktree/);
  assert.match(solo, /vermelho não medido/);
  const soloCodex = recorte(lerCodex('skills/dev-loop/references/execucao.md'), 'Solo permitido');
  assert.match(soloCodex, /copia-base\.mjs/);
});

test('o planner da SPEC monta o brief do arquiteto com iris:delegar-agente', () => {
  for (const rel of ['skills/entregar/SKILL.md', 'skills/dev-loop/SKILL.md']) {
    const s = ler(rel);
    assert.match(s, /monte o brief do `odin:arquiteto` com `iris:delegar-agente`/, rel);
    // Dependência declarada no plugin: sem condicional de instalação no Claude.
    assert.doesNotMatch(s, /iris[^\n]{0,40}instalad/, rel);
  }
  assert.match(lerCodex('skills/entregar/SKILL.md'), /delegar-agente[^\n]*pacote iris[^\n]*disponível no ambiente/);
});

test('o template de FUP registra a continuidade, a declaração do operário e a validação final', () => {
  const fup = recorte(ler('skills/entregar/references/steps-detalhados.md'), '**Template — FUP do dev-loop**', '**Template — FUP de desvio');
  assert.doesNotMatch(fup, /vermelho confirmado → verde final/);
  for (const termo of ['tdd.continuidade', 'tdd.execucoes', 'tdd.declaracaoDoOperario', 'validacaoFinal', 'baseRef']) {
    assert.ok(fup.includes(termo), `FUP do dev-loop sem "${termo}"`);
  }
});

test('o README descreve o portão da 2.5/2.6, não o antigo', () => {
  const r = ler('README.md');
  assert.doesNotMatch(r, /só abre com vermelho confirmado pelo motivo certo/);
  for (const termo of ['preservação', 'autorizacoesTdd', 'rebaselineTdd', 'vermelhoNaBase', 'semCriacao']) {
    assert.ok(r.includes(termo), `README sem "${termo}"`);
  }
});

// ── Porte da 2.6.0: documentação dos recursos do harness e dos scripts ──────────────────────

test('o tipo do critério vem da coluna Tipo da SPEC, não do operário', () => {
  const s = ler('skills/dev-loop/SKILL.md');
  assert.match(s, /coluna `Tipo` da SPEC/);
  assert.match(s, /tipo-divergente/);
  const t = ler('skills/dev-loop/references/spec-template.md');
  assert.match(t, /\| # \| Critério \| Tipo \| Teste que o cobre \(path\) \| Verificação complementar \|/);
  assert.match(t, /sufixo `\(R\)`\/`\(P\)`[^\n]*não é lido/);
  assert.match(ler('skills/dev-loop/references/escada-ponytail.md'), /coluna `Tipo`/);
  assert.match(lerCodex('skills/dev-loop/references/execucao.md'), /tipo-divergente/);
});

test('o desfecho bloqueado lista todos os motivos do portão, nas duas distribuições', () => {
  const bloqueado = recorte(ler('skills/dev-loop/SKILL.md'), '- **`status: "bloqueado"`**', '- **`status: "escalado"`**');
  const codex = recorte(lerCodex('skills/dev-loop/references/execucao.md'), '- `bloqueado`', '- `escalado`');
  assert.doesNotMatch(bloqueado, /um dos três `motivo`/);
  for (const motivo of ['evidencia-invalida', 'controle-vermelho', 'sem-vermelho', 'tipo-divergente', 'implementacao-preexistente', 'nao-confirmado']) {
    assert.ok(bloqueado.includes(`\`${motivo}\``), `dev-loop/SKILL.md, bloqueado, sem "${motivo}"`);
    assert.ok(codex.includes(`\`${motivo}\``), `execucao.md, bloqueado, sem "${motivo}"`);
  }
});

test('a exceção humana exige perfil máximo e a citação literal do dono, e não se estende ao rebaseline', () => {
  const excecao = recorte(ler('skills/dev-loop/SKILL.md'), '**Exceção humana (`autorizacoesTdd`).**', '**Retomada tardia');
  assert.match(excecao, /perfil `maximo`/);
  assert.match(excecao, /fase `Args`/);
  assert.match(excecao, /`autorizacao`[^\n]*citação literal/);
  assert.match(excecao, /`rebaselineTdd` não exige perfil/);
  const args = recorte(lerCodex('skills/dev-loop/references/execucao.md'), '- `autorizacoesTdd`', '- `rebaselineTdd`');
  assert.match(args, /"autorizacao"/);
  assert.match(args, /perfil `maximo`/);
  assert.match(lerCodex('skills/dev-loop/SKILL.md'), /autorizacoesTdd[^\n]*perfil `maximo`/);
  assert.match(ler('skills/dev-loop/references/escada-ponytail.md'), /perfil `maximo`/);
});

test('a retomada com a implementação presente mede o vermelho na base (baseRef + vermelhoNaBase)', () => {
  const s = ler('skills/dev-loop/SKILL.md');
  for (const termo of ['vermelhoNaBase', 'copia-base.mjs', 'git merge-base', '`apoio`', 'implementacaoPreexistente', 'criado pela entrega']) {
    assert.ok(s.includes(termo), `dev-loop/SKILL.md sem "${termo}"`);
  }
  const erro = recorte(s, '- **`status: "erro"`**', '**Destino do relatório');
  assert.match(erro, /`baseRef` \+ `vermelhoNaBase: true`/);
  const codex = lerCodex('skills/dev-loop/references/execucao.md');
  for (const termo of ['vermelhoNaBase', 'copia-base.mjs', 'git merge-base', 'apoio']) {
    assert.ok(codex.includes(termo), `execucao.md sem "${termo}"`);
  }
  assert.match(ler('skills/dev-loop/references/escada-ponytail.md'), /copia-base\.mjs/);
  // Revisão adversarial do porte: na base o "não" do operário bloqueia; as duas distribuições dizem.
  for (const [nome, texto] of [['dev-loop/SKILL.md', s], ['execucao.md', codex]]) {
    assert.doesNotMatch(texto, /não decide/, nome);
    assert.match(texto, /prontos e cobr/, nome);
    assert.match(texto, /bloqueia\s+com `nao-confirmado` depois da medição/, nome);
  }
});

test('auditoria e lentes leem o diff contra a base quando há baseRef', () => {
  const inspecao = recorte(ler('skills/dev-loop/SKILL.md'), '## Inspeção do trabalho sem escrita', '## 📋 A SPEC');
  assert.match(inspecao, /inspecionar-git\.mjs diff <paths> \[baseRef\]/);
  assert.match(inspecao, /commits da entrega/);
  assert.doesNotMatch(ler('skills/dev-loop/SKILL.md'), /o script não tem SHA\s+base/);
  assert.match(recorte(lerCodex('skills/dev-loop/references/execucao.md'), '## Inspeção Git', '## Args'), /baseRef/);
});

test('o relato de escada aceita semCriacao e a auditoria confronta o diff com o relato', () => {
  const s = ler('skills/dev-loop/SKILL.md');
  assert.match(s, /sem `semCriacao: true`/);
  assert.match(s, /criacoesSemRelato/);
  assert.match(s, /buscaChamadores/);
  assert.match(ler('skills/dev-loop/references/escada-ponytail.md'), /semCriacao: true/);
  const codex = lerCodex('skills/dev-loop/references/execucao.md');
  assert.match(codex, /semCriacao/);
  assert.match(codex, /criacoesSemRelato/);
  assert.doesNotMatch(codex, /escada vazia em unidade com arquivos tocados bloqueiam\./);
});

test('o escalado traz resumoDaEscalada e só-procedimento não é verde nem falha funcional', () => {
  const escalado = recorte(ler('skills/dev-loop/SKILL.md'), '- **`status: "escalado"`**', '- **`status: "erro"`**');
  assert.match(escalado, /resumoDaEscalada/);
  assert.match(escalado, /somenteProcedimento: true` não é verde/);
  for (const natureza of ['procedimento', 'integridade-dos-testes', 'dependencia', 'funcional', 'evidencia', 'peso-de-diff', 'revisao']) {
    assert.ok(escalado.includes(`\`${natureza}\``), `escalado sem a natureza "${natureza}"`);
  }
  assert.match(recorte(lerCodex('skills/dev-loop/references/execucao.md'), '- `escalado`', '- `erro`'), /resumoDaEscalada[^\n]*somenteProcedimento/);
});

test('falha de ambiente na validação tem natureza própria, para o run e não vira correção de código', () => {
  const s = ler('skills/dev-loop/SKILL.md');
  assert.match(s, /`natureza` \(`funcional`, `ambiente`, `indeterminada`\)/);
  assert.match(s, /UV_CACHE_DIR=\.cache\/uv/);
  const erro = recorte(s, '- **`status: "erro"`**', '**Destino do relatório');
  assert.match(erro, /`motivo: "ambiente"`[^\n]*fase Validar/);
  assert.match(erro, /rebaselineTdd/);
  assert.match(erro, /resumeFromRunId/);
  const codex = lerCodex('skills/dev-loop/references/execucao.md');
  assert.match(codex, /natureza/);
  assert.match(codex, /motivo: "ambiente"/);
});

test('a impressão deixa de fora a SPEC e o pendenciasPath, e a skill diz o limite disso', () => {
  const s = ler('skills/dev-loop/SKILL.md');
  assert.match(s, /pendenciasPath: "<arquivo de pendências resolvido>"/);
  assert.match(s, /`validacaoFinal\.excluidos`/);
  assert.match(s, /`validacaoFinal\.excluidosNaoRastreados`/);
  assert.match(s, /lint de markdown/);
  assert.match(s, /bit de execução/);
  // Revisão adversarial do porte: pendências só como não rastreadas; rastreadas recusam a impressão.
  assert.doesNotMatch(s, /rastreado ou não/);
  assert.match(s, /pendências rastreadas \(HEAD ou índice\), symlink ou diretório fazem o script\s+recusar a impressão/);
  const codex = lerCodex('skills/dev-loop/references/execucao.md');
  assert.match(codex, /pendenciasPath/);
  assert.match(codex, /pendências rastreadas \(HEAD ou índice\), symlink ou diretório fazem o script recusar a impressão/);
  assert.match(codex, /`validacaoFinal\.excluidosNaoRastreados`/);
});

test('o relatório tdd traz a declaração do operário e as execuções medidas no portão', () => {
  const s = ler('skills/dev-loop/SKILL.md');
  for (const termo of ['tdd.declaracaoDoOperario', 'tdd.execucoes', 'modelos.nota']) {
    assert.ok(s.includes(termo), `dev-loop/SKILL.md sem "${termo}"`);
  }
  const codex = lerCodex('skills/dev-loop/references/execucao.md');
  assert.match(codex, /declaracaoDoOperario/);
  assert.match(codex, /tdd\.execucoes/);
});

test('afirmação mecânica (uso único, nenhum chamador) só vale com a busca executada e recontada', () => {
  const p = ler('skills/dev-loop/references/protocolo-revisao-adversarial.md');
  assert.match(p, /Afirmação mecânica se confere, não se presume/);
  assert.match(p, /reconta/);
  assert.match(p, /--untracked/);
  assert.match(ler('skills/dev-loop/SKILL.md'), /afirmação mecânica/i);
});

test('perfil com acento ou caixa é normalizado e perfil desconhecido é erro de Args', () => {
  const s = ler('skills/dev-loop/SKILL.md');
  assert.match(s, /`"Máximo"` vale `maximo`/);
  assert.match(s, /perfil desconhecido[^\n]*fase `Args`/);
});

test('nativas Codex: a pergunta encerra o turno e a autorização registrada no Log é reaproveitada', () => {
  for (const rel of ['skills/entregar/SKILL.md', 'skills/dev-loop/SKILL.md']) {
    const s = lerCodex(rel);
    assert.match(s, /encerra o turno/, rel);
    assert.match(s, /autorizações registradas no Log/, rel);
    assert.doesNotMatch(s, /Reutilize autorizações da sessão;/, rel);
    assert.match(s, /commit, push, PR e publicação[^.]*sessão corrente/, rel);
  }
  const exec = lerCodex('skills/dev-loop/references/execucao.md');
  assert.match(exec, /pare e pergunte \(a pergunta encerra o turno\)[^\n]*`proximo` retoma/);
});

test('execucao.md Codex orienta o diretório do run e a recusa por fonte alterada sem apagar à mão', () => {
  const exec = lerCodex('skills/dev-loop/references/execucao.md');
  assert.match(exec, /precisa existir e ser gravável/);
  assert.match(exec, /reinstalando a mesma versão/);
  assert.match(exec, /sem `state\.json` não é run/);
  assert.doesNotMatch(exec, /Mudança da fonte\/fingerprint exige run novo/);
});

test('nenhuma doc do odin usa nomes da 2.5 paralela que o porte trocou pelos do master', () => {
  // A 2.5 paralela chamava a exceção de `excecaoTdd`, o rebaseline de `rebaseline` e media a
  // árvore com `inspecionar-git.mjs arvore`/`validacao.assinatura`. O porte fica com os nomes
  // do master; citar o nome antigo manda a sessão passar um arg que o harness ignora.
  const proibidos = [/`excecaoTdd`/, /`rebaseline`/, /excluidosDaAssinatura/, /validacao\.assinatura/, /inspecionar-git\.mjs arvore/,
    /`criterios-sem-caso`/, /`reproducao-verde`/, /`controle-quebrado`/, /`sem-reproducao`/];
  const docs = [
    ['skills/dev-loop/SKILL.md', ler], ['skills/entregar/SKILL.md', ler], ['skills/entregar/references/steps-detalhados.md', ler],
    ['skills/dev-loop/references/escada-ponytail.md', ler], ['skills/dev-loop/references/spec-template.md', ler],
    ['skills/descobrir/references/contrato-de-conversa.md', ler], ['README.md', ler],
    ['agents/operario.md', ler], ['agents/mecanico.md', ler], ['agents/revisor.md', ler],
    ['skills/dev-loop/SKILL.md', lerCodex], ['skills/entregar/SKILL.md', lerCodex], ['skills/dev-loop/references/execucao.md', lerCodex],
  ];
  for (const [rel, leitor] of docs) {
    const texto = leitor(rel);
    for (const re of proibidos) assert.doesNotMatch(texto, re, `${leitor === ler ? 'plugins' : 'codex'}/odin/${rel}`);
  }
});

// ── Decisão do dono de 2026-11-03: no Solo, a exceção passa para o Loop no perfil máximo ─────
//
// Estes casos travam a INSTRUÇÃO ESCRITA, não o comportamento do agente: provam que as docs dizem
// a regra sem ambiguidade (no harness, só no perfil `maximo`, e fora dele erro de Args; no Solo,
// a entrega passa para o Loop no perfil máximo, com opt-in registrado no Log, e nunca segue no
// Solo com a exceção). O efeito do harness está em `harness-dev-loop.test.mjs` (casos re1); o
// Solo não tem script, então nada aqui prova que um agente obedece ao que está escrito.

// Espaço em branco normalizado: as docs quebram linha no meio da frase.
const plano = (texto) => texto.replace(/\s+/g, ' ');
const EXCECAO = /sem (nenhuma reprodução )?vermelh|nenhuma reprodução vermelha|autorizacoesTdd|exceção humana|a exceção/i;
const PERFIL_MAXIMO = /perfil (\*\*)?(`maximo`|[Mm]áximo)/;
const CONTEXTO_LOOP = /Loop|harness|dev-loop|script|\brun\b|Args/i;
// "sem passar para o Loop" não sai do Solo: a negação logo antes não conta como passagem.
const SAI_DO_SOLO = /(?<!sem |não )passa(r)? (a entrega )?para (o modo Loop|o Loop|este Loop|cá)|nunca segue no Solo|não segue no Solo/;
// Frase ambígua: fala da exceção e condiciona ao perfil máximo sem dizer que é no Loop/harness
// (vale para o Solo, que não tem as lentes que compensam), ou fala da exceção no Solo sem mandar
// a entrega para o Loop, cite perfil ou não.
function frasesAmbiguas(texto) {
  return plano(texto).split(/\.\s/).filter((f) => EXCECAO.test(f) && (
    (PERFIL_MAXIMO.test(f) && !CONTEXTO_LOOP.test(f)) ||
    (/\bSolo\b/.test(f) && !SAI_DO_SOLO.test(f))
  ));
}

test('decisão 12: a heurística reprova frase que deixa a exceção seguir no Solo, com ou sem perfil', () => {
  for (const f of [
    'No Solo da entregar, a exceção segue com a autorização do dono registrada no Log, citada literalmente. ',
    'No Solo, a exceção vale no perfil Máximo, sem passar para o Loop. ',
    'No Solo, com a frase do dono citada literalmente no Log, a entrega segue sem nenhuma reprodução vermelha no próprio Solo. ',
    'Sem nenhuma reprodução vermelha, a exceção vale no perfil Máximo. ',
  ]) assert.equal(frasesAmbiguas(f).length, 1, f);
  for (const f of [
    'No Solo, a exceção não segue: a entrega passa para o Loop no perfil Máximo. ',
    'A exceção só vale no perfil `maximo` do harness. ',
  ]) assert.deepEqual(frasesAmbiguas(f), [], f);
});

test('decisão 12: a regra canônica separa os modos (harness só no maximo; Solo passa para o Loop no máximo com opt-in)', () => {
  const portao = plano(recorte(ler('skills/dev-loop/references/escada-ponytail.md'), '## 🔴 Portão TDD (resumo canônico)', 'No harness esses invariantes'));
  // A redação de 2026-11-02 punha "no perfil `maximo`" numa regra que "vale pra qualquer modo".
  assert.doesNotMatch(portao, /citada literalmente e no perfil `maximo`/);
  assert.match(portao, /2026-11-03/);
  const harness = recorte(portao, '**Harness do `dev-loop`:**', '**Solo da `entregar`');
  assert.match(harness, /só vale no perfil `maximo`/);
  assert.match(harness, /erro na fase `Args`, antes de qualquer agente/);
  const solo = recorte(portao, '**Solo da `entregar`');
  assert.match(solo, /nunca segue no Solo/);
  assert.match(solo, /passa para o modo Loop \(skill `dev-loop`\) no perfil `maximo`/);
  assert.match(solo, /run novo com `autorizacoesTdd`/);
  assert.match(solo, /opt-in de custo do Loop[^.]*registrado no Log/);
  assert.match(solo, /escopo e custo não aumentaram/);
  assert.match(solo, /Sem esse opt-in[^.]*bloqueada no portão/);
  assert.match(solo, /sem harness multi-agente para rodar o Loop, a entrega fica bloqueada no portão/);
  // A condição é medida por fase, critério a critério, e fase já implementada no Solo é
  // implementação anterior: sem `vermelhoNaBase`, o run bloqueia (caso re-solo do harness).
  assert.match(solo, /Vale por fase, critério a critério/);
  assert.match(solo, /mesmo ao lado de outras vermelhas/);
  assert.match(solo, /fases já implementadas no Solo[^.]*implementação anterior[^.]*`baseRef` do Log com `vermelhoNaBase: true`[^.]*`autorizacoesTdd` cobre só os critérios sem vermelho/);
  assert.match(solo, /sem `vermelhoNaBase`, o portão bloqueia com `implementacao-preexistente`/);
  // Nada muda para os controles de preservação nem para a retomada.
  assert.match(portao, /\*\*Controles de preservação\*\* podem nascer verdes/);
  assert.match(solo, /`rebaselineTdd` e `baseRef` não mudam/);
});

test('decisão 12: a entregar manda a exceção do Solo para o Loop no perfil Máximo, com opt-in, e remete à regra canônica', () => {
  const s = ler('skills/entregar/SKILL.md');
  const cabecalho = plano(linhaCom(s, '🔴 Portão TDD (vale pros DOIS modos'));
  assert.doesNotMatch(cabecalho, /citada literalmente, e no perfil Máximo\./);
  assert.match(cabecalho, /só roda no modo Loop, perfil Máximo/);
  assert.match(cabecalho, /no Solo, a entrega passa para o Loop/);
  const excecao = recorte(plano(recorte(s, '**Modo SOLO**', '**Exceções')), '**Solo sem nenhuma reprodução vermelha**', 'Ao **fim de cada fase**');
  assert.match(excecao, /escada-ponytail\.md/);
  assert.match(excecao, /não segue no Solo/);
  assert.match(excecao, /passe para o modo Loop no perfil Máximo/);
  assert.match(excecao, /run novo do `dev-loop` com `autorizacoesTdd`/);
  assert.match(excecao, /citada literalmente/);
  assert.match(excecao, /opt-in de custo do Loop[^.]*registrado no Log/);
  assert.match(excecao, /escopo e custo não aumentaram/);
  assert.match(excecao, /Sem esse opt-in[^.]*bloqueada no portão/);
  // O Solo também é o modo de quem não tem harness: aí bloqueia sem pedir o opt-in.
  assert.match(excecao, /sem harness multi-agente[^.]*bloqueada no portão, sem perguntar pelo opt-in quando não há harness/);
  assert.match(excecao, /Vale por fase, critério a critério/);
  assert.match(excecao, /fases já implementadas no Solo[^.]*`baseRef` do Log com `vermelhoNaBase: true`[^.]*`autorizacoesTdd` cobre só os critérios sem vermelho/);
  assert.match(plano(linhaCom(s, '**Modo LOOP**')), /`vermelhoNaBase: true` só quando a implementação já existe \(retomada, ou fases já implementadas no Solo quando a entrega passa para o Loop\)/);
  assert.match(plano(linhaCom(s, '❌ Começar implementação sem critérios')), /Loop em perfil Máximo/);
});

test('decisão 12: o dev-loop recebe a exceção do Solo em run novo no perfil maximo, com opt-in pedido e registrado', () => {
  const s = ler('skills/dev-loop/SKILL.md');
  const excecao = plano(recorte(s, '**Exceção humana (`autorizacoesTdd`).**', '**Retomada tardia'));
  assert.match(excecao, /No Solo da `entregar` não há exceção[^.]*passa para cá[^.]*perfil `maximo`/);
  assert.match(excecao, /passa para cá com fases já implementadas no Solo[^.]*`baseRef` \+ `vermelhoNaBase: true`[^.]*só os critérios sem vermelho/);
  const custo = plano(recorte(s, 'Run com `autorizacoesTdd` só roda no perfil **Máximo**', 'Invariantes que NENHUM perfil remove'));
  assert.match(custo, /chega do Solo[^.]*opt-in[^.]*registrad[^.]*Log/);
  assert.match(custo, /sem opt-in, ou sem harness multi-agente \(sem a tool Workflow\), ela fica bloqueada no portão/);
  // O fallback sequencial é autorrevisão: a exceção, arg do harness, não vale nele.
  const fallback = plano(recorte(s, '## 🔁 Fallback sem multi-agente', '## NUNCA fazer'));
  assert.match(fallback, /Sem vermelho, nada de implementação: a exceção humana \(`autorizacoesTdd`\) é arg do harness e não vale neste fallback, nem com as lentes do perfil uma por vez/);
  assert.match(fallback, /bloqueada no portão/);
  assert.match(plano(ler('README.md')), /fallback sequencial[^.]*mesmas regras, sem paralelismo e sem a exceção ao portão TDD, que só o harness aplica, no perfil Máximo/);
  // As regras da SPEC (Step 4c, os dois modos) não deixam a autorização abrir o portão no Solo.
  const spec = plano(ler('skills/dev-loop/references/spec-template.md'));
  assert.doesNotMatch(spec, /não abre o portão sem autorização registrada do dono \(ou rebaseline/);
  assert.match(spec, /não abre o portão sem autorização registrada do dono num Loop em perfil `maximo` \(no Solo, a entrega passa para o Loop; regra canônica em `escada-ponytail\.md`\) ou rebaseline aprovado na retomada/);
});

test('decisão 12: nenhuma doc condiciona a exceção ao perfil máximo fora do Loop, nem a deixa seguir no Solo', () => {
  const docs = [
    ['skills/dev-loop/references/escada-ponytail.md', ler], ['skills/entregar/SKILL.md', ler],
    ['skills/entregar/references/steps-detalhados.md', ler], ['skills/dev-loop/SKILL.md', ler],
    ['skills/dev-loop/references/spec-template.md', ler], ['skills/descobrir/references/contrato-de-conversa.md', ler],
    ['README.md', ler], ['commands/entregar.md', ler],
    ['skills/entregar/SKILL.md', lerCodex], ['skills/dev-loop/SKILL.md', lerCodex], ['skills/dev-loop/references/execucao.md', lerCodex],
  ];
  for (const [rel, leitor] of docs) {
    assert.deepEqual(frasesAmbiguas(leitor(rel)), [], `${leitor === ler ? 'plugins' : 'codex/plugins'}/odin/${rel}`);
  }
});

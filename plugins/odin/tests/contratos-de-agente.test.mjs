// Contrato dos agents de papel fixo do odin.
//
// Por que este arquivo existe: a revisão adversarial de 2026-07-28 apontou que o
// `disallowedTools` entrou nos três agents que não escrevem e NADA falharia se sumisse — o
// `validar.mjs` não lê frontmatter de agent, e nenhuma suíte olhava para `plugins/odin/agents/`.
// P17 exige que lógica não-trivial deixe UM check executável pra trás, e um "read-only por
// configuração" sem teste é exatamente o pedido educado que a configuração veio substituir.
// Alguém "limpando o frontmatter" num PR de docs devolveria `Write` ao revisor em silêncio.
//
// O padrão (ler frontmatter e travar o contrato de papel) é reuso de
// `plugins/hermes/tests/test_harness_contracts.py` — P2, não invenção nova.
//
// ⚠️ O QUE ESTE TESTE **NÃO** GARANTE: que o runtime honre `disallowedTools`. Ele verifica a
// DECLARAÇÃO no frontmatter, não o enforcement. O campo é suportado em agents de plugin (a
// referência de plugins lista `tools` e `disallowedTools` entre os campos suportados e nomeia
// só `hooks`, `mcpServers` e `permissionMode` como não suportados), mas verde aqui significa
// "a restrição continua declarada", não "o revisor não consegue escrever" — o furo do `Bash`
// segue aberto por desenho. Não leia mais do que está escrito.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const AGENTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'agents');

// Papel fixo → piso de modelo. Promoções (consulta: opus→fable) e rebaixamentos (validar:
// sonnet→haiku) são override de runtime do harness, dirigidos pela whitelist MODELOS_STEP;
// o frontmatter guarda o PISO, nunca o teto.
const PISO_DE_MODELO = {
  operario: 'sonnet',
  revisor: 'opus',
  arquiteto: 'opus',
  mecanico: 'haiku',
};

// Quem julga não toca no artefato que julga. Os agents abaixo declaram isso na própria prosa
// ("você não corrige nada" / "você não grava arquivo de entrega"); aqui vira configuração
// verificável. `operario` é a ÚNICA exceção — é ele quem implementa.
//
// A lista é por EXCEÇÃO, não por enumeração: o teste varre o diretório e cobra de todo agent
// que não esteja na allowlist. Enumerar os três por nome (versão anterior) deixava passar
// agent NOVO de julgamento — nasceria sem restrição e a suíte ficaria verde. É o mesmo modo
// de falha que o `ignorePatterns` do stryker.conf.json proíbe no comentário ao lado.
const PODE_ESCREVER = new Set(['operario']);

// Spawnar subagent é escrever por procuração: sem a tool de subagent na denylist, o revisor
// despacha um `odin:operario` (que tem Write/Edit) e edita o código que está julgando.
//
// `Task` E `Agent`, os dois: a tool chamava-se `Task` e foi renomeada para `Agent`, com
// `Task(...)` seguindo válido como alias em definições de agent (docs de subagents: "In
// version 2.1.63, the Task tool was renamed to Agent"). O que sustenta a exigência não é o
// número da versão — é os dois nomes coexistirem, e nome desconhecido numa denylist ser no-op
// silencioso (não gera erro). Declarar ambos custa nada. Exigir só um dos dois foi
// bloqueante achado pela lente R1: o teste aprovava a config furada (sem `Task`, o furo
// reabria) e reprovava a config correta mínima.
const TOOLS_DE_ESCRITA = ['Write', 'Edit', 'NotebookEdit', 'Task', 'Agent'];

// Aceita as QUATRO formas válidas de escrever o campo, e recusa YAML inválido. As duas coisas
// importam pelo mesmo motivo: um parser que erra em qualquer direção inverte o gate. Aceitar
// inválido aprova config que o runtime pode recusar (a restrição não se aplica e o teste diz
// que sim); recusar válido reprova config correta.
//   disallowedTools: Write, Edit            → escalar inline
//   disallowedTools: "Write, Edit"          → escalar entre aspas
//   disallowedTools: [Write, Edit]          → sequência inline (flow)
//   disallowedTools:\n  - Write\n  - Edit   → lista em bloco
//
// TAB é rejeitado de propósito: YAML proíbe tabulação como indentação, e `^\s+-` (versão
// anterior) a aceitava — frontmatter inválido passava como restrição válida. Achado do Codex,
// verificado: com tab, este teste saía 0.
function frontmatter(nome) {
  const texto = readFileSync(resolve(AGENTS_DIR, `${nome}.md`), 'utf8');
  const bloco = /^---\r?\n(.*?)\r?\n---\r?\n/s.exec(texto);
  assert.ok(bloco, `${nome}.md precisa começar com frontmatter YAML`);
  const campos = {};
  let chaveAberta = null;
  for (const linha of bloco[1].split('\n')) {
    if (linha.trim() === '') continue;
    assert.ok(
      !/^[ ]*\t/.test(linha),
      `${nome}.md: frontmatter usa TAB para indentar — YAML não aceita, e o runtime pode ` +
      `recusar o bloco inteiro. Use espaços. Linha: ${JSON.stringify(linha)}`,
    );
    const item = /^ +-\s+(.*)$/.exec(linha);
    if (item && chaveAberta) {
      campos[chaveAberta] = campos[chaveAberta]
        ? `${campos[chaveAberta]}, ${desaspar(item[1])}`
        : desaspar(item[1]);
      continue;
    }
    const i = linha.indexOf(':');
    if (i <= 0) continue;
    const chave = linha.slice(0, i).trim();
    const valor = desflow(desaspar(linha.slice(i + 1).trim()));
    // Valor vazio = provável lista em bloco nas linhas seguintes; segura a chave em aberto.
    if (valor === '') { chaveAberta = chave; campos[chave] = ''; continue; }
    chaveAberta = null;
    campos[chave] = valor;
  }
  return campos;
}

// `[Write, Edit]` → `Write, Edit`. Normaliza a sequência inline para a mesma forma das outras
// três, para o resto do teste comparar contra uma representação só.
function desflow(v) {
  const m = /^\[(.*)\]$/.exec(v);
  return m ? m[1].split(',').map((t) => desaspar(t.trim())).join(', ') : v;
}

function desaspar(v) {
  const m = /^(["'])(.*)\1$/.exec(v);
  return m ? m[2] : v;
}

function todosOsAgents() {
  const nomes = readdirSync(AGENTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.slice(0, -3));
  // Diretório vazio passaria todo `for` abaixo em silêncio — a mesma falha de glob vazio que
  // o runner de testes cobre no `scripts/testes-node.mjs`. Piso explícito.
  assert.ok(nomes.length >= 4, `esperado ao menos 4 agents em ${AGENTS_DIR}, achei ${nomes.length}`);
  return nomes;
}

// VARRE o diretório, não a tabela: iterar sobre `PISO_DE_MODELO` (versão anterior) deixava
// agent NOVO sem nenhuma checagem de `name`/`model` — nascia sem piso declarado e a suíte
// ficava verde. Mesmo modo de falha por enumeração que a allowlist `PODE_ESCREVER` evita
// abaixo, e que o `ignorePatterns` do stryker.conf.json proíbe. Achado do Codex.
test('todo agent do odin declara nome e piso de modelo no frontmatter', () => {
  for (const nome of todosOsAgents()) {
    const campos = frontmatter(nome);
    assert.equal(campos.name, nome, `${nome}.md: campo name divergente`);
    assert.ok(
      campos.model,
      `${nome}.md: agent sem campo model. O piso de modelo é contrato de papel — sem ele o ` +
      `agente herda o modelo da sessão e o custo/qualidade do step vira acidente.`,
    );
    const esperado = PISO_DE_MODELO[nome];
    if (esperado) {
      assert.equal(campos.model, esperado, `${nome}.md: piso de modelo deve ser ${esperado}`);
    }
  }
});

test('agents que julgam são read-only por configuração, não por promessa', () => {
  for (const nome of todosOsAgents().filter((n) => !PODE_ESCREVER.has(n))) {
    const declarado = frontmatter(nome).disallowedTools;
    assert.ok(
      declarado,
      `${nome}.md perdeu o campo disallowedTools — sem ele o agente herda Write/Edit e o ` +
      `read-only volta a ser só a frase na prosa`,
    );
    // Grafia exata importa: o campo é case-sensitive e um typo não gera erro, só deixa de
    // restringir. Comparar contra a lista literal é o que pega "disallowedtools" ou "Wrtie".
    const tools = declarado.split(',').map((t) => t.trim());
    for (const tool of TOOLS_DE_ESCRITA) {
      assert.ok(
        tools.includes(tool),
        `${nome}.md: disallowedTools precisa negar ${tool} (declarado: "${declarado}")`,
      );
    }
  }
});

test('o operario mantém escrita — a assimetria é o ponto, não um esquecimento', () => {
  const campos = frontmatter('operario');
  assert.equal(
    campos.disallowedTools,
    undefined,
    'operario.md não pode negar tools de escrita: é o único agente que implementa. ' +
    'Se este teste falhar porque alguém "uniformizou" os agents, o dev-loop parou de escrever código.',
  );
});

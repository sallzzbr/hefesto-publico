# Metodologias de DEVELOP — abrir e testar soluções

> Camada de pensamento do **DEVELOP** (skill `desenvolver`): **divergir** em alavancas e **testar barato** antes de comprometer construção. A **convergência** — rankear as alavancas e decidir prototipar × construir — é a matriz **aprendizado × reversibilidade** em `priorizacao-ai-era.md`. Este arquivo é o complemento: **gerar** o leque e **testar** a aposta; a matriz **escolhe** dentro dele.
>
> **A IA é a guia, não o cardápio.** Escolha **UM** método pelo roteador, recomende com o porquê, deixe o humano confirmar. Divergir é abrir de propósito — não é indecisão.

## Roteador — escolha pela pergunta

| A pergunta do momento é… | Método | Complementa |
|---|---|---|
| "Só temos a ideia óbvia — como abrir o leque de alavancas?" | **Ideação divergente** (§1) | alimenta o ranking da `priorizacao-ai-era.md` |
| "Qual fidelidade de protótipo responde essa pergunta?" | **Fidelity ladder** (§2) | liga divergência ao invariante "definição fechada antes de construir" |
| "Dá pra testar valor/demanda SEM construir o back?" | **Fake door / Wizard of Oz / Concierge** (§3) | é o "prototipe primeiro" da matriz |
| "Qual suposição, se falsa, derruba a alavanca?" | **Riskiest Assumption Test** (§4) | foca a hipótese (Hypothesis canvas do DEFINE) |

---

## §1. Ideação divergente — Crazy 8s · SCAMPER · benchmarks

**Responde:** quais alavancas existem além da primeira ideia — de UI, copy, fluxo, CRM, dado, regra de negócio, processo, arquitetura.

**Como aplicar (IA gera candidatos, humano julga):**
1. **Separe gerar de julgar** — na divergência não se critica; o corte é depois, na `priorizacao-ai-era.md`.
2. **Crazy 8s:** 8 alavancas rápidas pra a mesma hipótese (a IA pode rascunhar as 8 a partir do DISCOVER — JTBD, VOC).
3. **SCAMPER** sobre a alavanca atual: Substituir, Combinar, Adaptar, Modificar, Propor outro uso, Eliminar, Reverter — cada verbo gera uma variante não-óbvia.
4. **Benchmarks/analogias:** como outros produtos (dentro e fora do setor) resolvem o mesmo *job*. Inclua sempre "não fazer nada" como alavanca de comparação.

**Como conecta aos gates:** produz o leque que o **GATE 3** manda ranquear. Sem divergência real, o ranking é entre uma ideia e ela mesma.

**Armadilhas:** ❌ julgar enquanto gera (mata o leque); ❌ 8 variações triviais da mesma ideia; ❌ esquecer "não fazer nada" como baseline honesto.

## §2. Fidelity ladder — a menor fidelidade que responde

**Responde:** que fidelidade de protótipo a pergunta exige — pra não gastar alto-fi testando o que baixo-fi já responde.

**Como aplicar:**
1. Case a **pergunta** com o **degrau**: "o fluxo faz sentido?" → papel/wireframe · "a UI comunica e cabe nos padrões?" → mockup/protótipo navegável · "a interação/estado funciona?" → protótipo codado.
2. Suba a escada **só quando a pergunta exigir** — cada degrau custa mais e compromete mais.
3. O **topo da escada em entrega com UI é a tela/protótipo fechado** — exatamente a definição fechada que a skill `entregar` leva pro `dev-loop` implementar. Entrega sem UI: a própria SPEC verificável é essa definição fechada.

**Como conecta aos gates:** liga a divergência ao invariante "definição fechada antes de construir" e à reversibilidade da `priorizacao-ai-era.md` — quanto mais difícil reverter, mais vale subir devagar.

**Protótipo não é sinônimo de interface.** A pergunta que escolhe a forma é sempre: *qual é a maior incerteza, e qual é a forma mais barata de produzir evidência sobre ela?* Formas válidas de protótipo, conforme a alavanca: wireframe, protótipo navegável, **prompt**, **skill/agente**, **script**, **consulta (query)**, **planilha**, **API simulada (mock)**, **processo manual**, **mensagem/comunicação**, **automação**, **documento** — além dos fake door/WoZ/concierge do §3. Uma consulta que responde a pergunta em 10 minutos vence um protótipo navegável de 2 dias.

**Armadilhas:** ❌ alto-fi pra validar o que um wireframe resolveria; ❌ protótipo tão polido que ninguém aceita jogar fora (vira "quase produção").

## §3. Fake door · Wizard of Oz · Concierge — testar sem construir

**Responde:** há demanda/valor real nesta alavanca antes de construir o backend/automação?

**Como aplicar:**
- **Fake door:** uma entrada (botão/banner) que mede **intenção** — o usuário clica e vê "em breve"/lista de espera. Mede demanda com quase nada de código.
- **Wizard of Oz:** o usuário acha que é o sistema, mas um **humano opera** atrás. Testa a experiência sem construir a máquina.
- **Concierge:** entrega o valor **manualmente**, sem produto, pra poucos usuários — valida que o valor existe antes de automatizar.

**Como conecta aos gates:** é o "**Prototipe primeiro**" do quadrante *alto aprendizado + difícil reversão* da `priorizacao-ai-era.md`. Testa a hipótese barato antes de acionar o `dev-loop`.

**Ética (inegociável):** fake door **não pode enganar de forma danosa** nem coletar PII sob falso pretexto — mede intenção, sinaliza "em breve" com honestidade, não frustra o cliente por nada. WoZ/concierge precisam de critério de "**quando parar de operar na mão**" pra não virar operação permanente disfarçada de teste.

**Armadilhas:** ❌ fake door que frustra sem retorno de aprendizado; ❌ WoZ que não escala e vira dívida operacional; ❌ concierge sem gatilho de automação.

## §4. Riskiest Assumption Test (RAT) — teste a suposição fatal primeiro

**Responde:** de tudo que a alavanca assume, qual suposição — se for falsa — derruba tudo? Teste ELA primeiro, com o menor experimento.

**Como aplicar:**
1. Liste as suposições da alavanca em três eixos: **desejabilidade** (o usuário quer?), **viabilidade** (faz sentido pro negócio?), **exequibilidade** (dá pra construir/operar?).
2. Marque a que é **mais incerta E mais fatal** (não a mais fácil de testar — a que mais mata a aposta se cair).
3. Desenhe o **menor teste** que a valida/refuta (muitas vezes um §3 fake door/WoZ, ou um §2 wireframe).
4. Antes de "MVP", RAT: um MVP testa tudo de uma vez; o RAT ataca o ponto único de falha.

**Como conecta aos gates:** afia a **hipótese** (formato do Hypothesis canvas, no DEFINE) e desenha o experimento que a skill `acompanhar` vai ler (experiment readout). Concentra a aposta no que decide.

**Armadilhas:** ❌ testar a suposição fácil em vez da fatal; ❌ chamar de MVP o que é a coisa inteira; ❌ tratar suposição como fato ("óbvio que o cliente quer").

---

## Fechamento

**Obrigatório antes de comprometer construção difícil de reverter:** a alavanca escolhida tem a **suposição mais arriscada identificada** e um **teste barato desenhado** (§4), na **menor fidelidade que responde** (§2). Os demais métodos entram **conforme a pergunta** — não são checklist. A escolha final de qual alavanca entra na rodada é da matriz **aprendizado × reversibilidade** (`priorizacao-ai-era.md`); este playbook garante que ela escolhe dentro de um leque real e testável, não da primeira ideia.

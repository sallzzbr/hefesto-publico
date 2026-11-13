# Regras ponytail do odin (FONTE ÚNICA) + portão TDD

> **Crédito e propriedade:** importadas e adaptadas do projeto
> [ponytail](https://github.com/DietrichGebert/ponytail) — *"The best code is the code you never
> wrote."* A partir daqui **são regras do odin e evoluem aqui**: cite pelo número (P1…P18), não
> re-explique.
>
> Reference **compartilhada**: a `entregar` (Step 4 e gate de qualidade do modo Solo) e a
> `dev-loop` (harness, agentes e fallback) citam este arquivo em vez de duplicar as regras.
> O modo Solo carrega este arquivo e `quality-contract.md`, sem carregar a `dev-loop/SKILL.md` inteira.
>
> **Não confundir com as lentes de revisão** R1/R2/R3 (`protocolo-revisao-adversarial.md`):
> `P` = regra ponytail (o que fazer ao escrever), `R` = lente de revisão (como refutar depois).

## 🪜 P1–P7 — A escada

Antes de escrever QUALQUER código — na spec, em cada unidade e em cada correção — desça a
escada e **pare no primeiro degrau que resolve**. No harness, cada função, arquivo ou
dependência **criada** vira um item do relato de escada (degrau e porquê); unidade que só
modificou o que existia declara `semCriacao: true`, e a auditoria confronta o diff com o relato:

- **P1.** Não escreva o que não precisa existir — YAGNI é a primeira pergunta, não a última.
- **P2.** Já existe no codebase? Reuse. Grep/find ANTES de criar — não reescreva o que a base resolve.
- **P3.** A stdlib da linguagem faz isso? Use a stdlib.
- **P4.** É feature nativa da plataforma? Use a plataforma.
- **P5.** Alguma dependência **já instalada** faz isso? Use ela.
- **P6.** Prefira a expressão direta legível; não comprima passos distintos para caber em uma linha.
- **P7.** Só então: implementação suficiente, coesa e testável, conforme `quality-contract.md`.

## ⛔ P8–P9 — O que a escada nunca corta

- **P8. Lazy, not negligent (INEGOCIÁVEL).** Validação em fronteiras de confiança, tratamento de
  erro que evita perda de dados, segurança e acessibilidade NUNCA entram no corte. Preguiça é
  sobre a solução, nunca sobre o cuidado.
- **P9. Preguiçoso na solução, nunca na leitura.** Entenda o problema e trace o fluxo real ponta
  a ponta ANTES de escolher o degrau. Escolher degrau sem ler é chute, não economia.

## 📏 P10–P14 — Peso do diff

- **P10.** Dependência NOVA exige justificativa durável de por que P1–P5 falharam, em SPEC,
  plano, ADR, PR acessível ou comentário útil. Cite arquivo:linha ou URL com âncora e o contexto
  observado; booleano ou nome de manifesto não basta. Sem evidência, bloqueia. Não instalar
  dependência por conta própria nem exigir comentário de processo no código.
- **P11.** Abstração precisa proteger responsabilidade, fronteira ou testabilidade. Interface
  mínima do consumidor pode ter uso único; número de chamadores sozinho não prova qualidade.
- **P12.** Escolha arquivo por coesão e motivo de mudança. Extrair responsabilidade pode ser
  melhor que ampliar arquivo gigante; use a decisão de decomposição de `quality-contract.md`.
- **P13.** Mantenha o diff focado e legível, com correção nas bordas e testes suficientes.
  Menos linhas não substituem qualidade; evite tanto complexidade gratuita quanto compressão.
- **P14.** Não reformate nem refatore código fora do escopo. Achou problema fora da unidade →
  **vira pendência, não vira diff**.

## 🎯 P15–P18 — Qualidade da escolha

- **P15.** Conserte a causa raiz, não o sintoma: patch na função compartilhada uma vez, não em
  cada chamador.
- **P16.** Empate de tamanho entre duas soluções → escolha a que está correta nas bordas.
- **P17.** Lógica não trivial exige testes proporcionais ao risco, com oráculo independente,
  casos negativos e controles válidos. Um teste que espelha a implementação não demonstra o contrato.
- **P18.** Registre restrição assumida e caminho de evolução em fonte durável útil ao mantenedor
  (SPEC/plano/ADR ou comentário quando necessário à leitura). Não crie comentário `ponytail:`
  obrigatório nem narrativa de processo; JSDoc/comentários seguem Q-COMMENTS.

## 🔴 Portão TDD (resumo canônico)

Vale pra qualquer modo de implementação (Solo da `entregar` ou harness do `dev-loop`):

- Implementação NÃO começa sem os critérios de aceite materializados em **testes de
  reprodução vermelhos, falhando por asserção** (teste que nasce verde é suspeito: ou o critério
  já está atendido → cortar, ou o teste é inútil → reescrever). **Controles de preservação**
  podem nascer verdes e precisam continuar verdes; verificações complementares (lint, preview)
  não contam como teste. O tipo de cada critério vem da coluna `Tipo` da SPEC aprovada, nunca de
  quem escreve o teste. Erro de import, sintaxe ou infraestrutura é **evidência inválida**,
  nunca vermelho. Implementação que já existia
  numa retomada nunca se reverte: o vermelho é medido numa cópia descartável da base
  (`../scripts/copia-base.mjs`, a partir do `baseRef` gravado no Log, o SHA completo do
  merge-base), e teste que passa também na base é teste inútil; quando a base não pode ser
  medida, segue por `rebaselineTdd` declarado.
- **Exceção humana: suíte sem nenhuma reprodução vermelha** (decisões do dono de 2026-11-02 e
  2026-11-03). Só segue com autorização do dono registrada no Log, com a frase dele citada
  literalmente. Antes de pedir a decisão do dono, explique a diferença entre reprodução e
  preservação e mostre o que foi medido. A regra muda com o modo:
  - **Harness do `dev-loop`:** a exceção só vale no perfil `maximo`. `autorizacoesTdd` com
    qualquer item em outro perfil efetivo é erro na fase `Args`, antes de qualquer agente.
  - **Solo da `entregar`:** sem as lentes independentes do harness, a exceção nunca segue no
    Solo, nem com autorrevisão pelas lentes de um perfil. A entrega passa para o modo Loop (skill
    `dev-loop`) no perfil `maximo`, em run novo com `autorizacoesTdd`. Vale por fase, critério a
    critério: basta uma reprodução da fase que não fica vermelha e que o dono quer manter, em vez
    de cortar o critério já atendido ou reescrever o teste inútil, mesmo ao lado de outras
    vermelhas (no harness, é a mesma ausência de vermelho, que só `autorizacoesTdd` cobre).
    Quando a entrega passa para o Loop com fases já implementadas no Solo (com ou sem checkpoint
    commitado), elas contam como implementação anterior: o run leva o `baseRef` do Log com
    `vermelhoNaBase: true`, e `autorizacoesTdd` cobre só os critérios sem vermelho; sem
    `vermelhoNaBase`, o portão bloqueia com `implementacao-preexistente`. A passagem exige o opt-in de
    custo do Loop, pedido e registrado no Log como em qualquer Loop (autorização já registrada
    vale quando escopo e custo não aumentaram). Sem esse opt-in, ou sem harness multi-agente para
    rodar o Loop, a entrega fica bloqueada no portão; sem harness, o opt-in nem se pede.
  - Controles de preservação continuam podendo nascer verdes, sem exceção, e `rebaselineTdd` e
    `baseRef` não mudam em nenhum dos modos.
- **O implementador não edita o teste** que precisa passar — nem afrouxa/skipa pra ficar verde.
- Critério sem teste → volta pra SPEC (Step 4c da `entregar`).
- Exceção justificada: critério puramente visual/não-executável → verificação complementar
  explícita (preview/screenshot/review); em entrega não-software, a variante SPEC-lite
  (`spec-template.md`, nesta pasta) troca a coluna de teste por forma de verificação.

No harness esses invariantes estão em código (`../harness/loop.mjs`), junto com a auditoria
ponytail de cada iteração; este resumo existe pra quem implementa sem o harness.

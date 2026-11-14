# Hefesto para Codex

Oito plugins e 66 skills nativas Codex, distribuídos no [marketplace público Hefesto](https://github.com/sallzzbr/hefesto-publico). Esta pasta é a raiz do marketplace Codex; a distribuição Claude Code fica em `../plugins/`.

| Plugin | Skills | Função |
|---|---:|---|
| Hefesto | 4 | Criar, validar e versionar plugins e skills Codex |
| Bragir | 12 | Voz, escrita, editorial, carreira e comunicação visual |
| Hestia | 6 | Orçamento, gastos, compras e investimentos |
| Odin | 8 | Investigar, definir e entregar desafios com SPEC e TDD |
| Mimyr | 5 | Planejar, escrever e revisar cursos |
| Hermes | 18 | Diagnóstico de marketing, réguas de decisão e produção de criativos |
| TitBits | 11 | GDD, direção audiovisual, produção, playtests e aprendizados privados |
| Iris | 2 | Prompts e briefs de delegação adequados ao modelo de destino |

> Snapshot 6.0.2: oito plugins, 66 skills nesta distribuição. A instalação por tag abaixo requer esta versão publicada no espelho.

## Instalação

Com Git e a CLI Codex disponíveis, obtenha a release pública e registre a pasta do marketplace:

```sh
git clone --branch v6.0.2 --depth 1 https://github.com/sallzzbr/hefesto-publico.git
cd hefesto-publico
codex plugin marketplace add ./codex
codex plugin add hefesto@hefesto
```

Troque o nome antes de `@` por outro plugin da tabela. Instale Bragir junto de Mimyr para cumprir a dependência de voz. Abra uma nova sessão para carregar as skills instaladas. O registro local do marketplace e a instalação foram verificados com `codex-cli 0.153.4`.

A instalação usa a configuração de quem executar os comandos. Os testes de distribuição usam somente perfis descartáveis. Ao atualizar, obtenha a nova release e repita o registro e a instalação a partir dela; preserve os dados do seu workspace fora do checkout de distribuição.

## Uso e dependências

Peça a capacidade pelo nome da skill ou descreva a tarefa. Cada skill nativa contém seu fluxo e aponta para o RUNTIME do pacote, cuja fonte de manutenção é [runtime/RUNTIME.md](runtime/RUNTIME.md). As instruções nativas governam ferramentas, paths, autorização e identidade do executor; sem perfil preenchido, a escrita para e oferece `analisar-voz`. O pacote não contém perfil de voz.

Configure paths em `AGENTS.md` do workspace, seção `## Paths do workspace`, ou em `~/.codex/hefesto/<plugin>/defaults.md`. Um caminho explícito no pedido tem prioridade. Recursos obrigatórios ausentes bloqueiam o passo dependente; descoberta ambígua exige esclarecimento. Dados do projeto e personas ficam fora do pacote instalado.

- Node.js 22+ para a Forja e os controladores de Odin, Mimyr e Hermes.
- Python e ambiente virtual com as dependências declaradas pelos scripts usados; não há instalação automática.
- Google Drive, documentos, ferramentas de imagem e outros conectores são necessários nos fluxos que os usam. Configure-os no ambiente consumidor. O plugin não fornece credenciais ou geradores.
- Revisão independente exige contexto/subagente disponível e autorizado. Sua ausência deixa a revisão pendente onde o contrato exigir independência.
- Bragir usa o perfil de voz preenchido do workspace ou o perfil pessoal `~/.codex/hefesto/bragir/perfil-de-voz.md` (em `<CODEX_HOME>/hefesto/bragir/` quando definido), fora do pacote. Sem perfil, a escrita para e oferece `analisar-voz`. O pacote não contém perfil de voz.

O adaptador dos três controladores emite trabalho, recebe JSON validado e retoma o algoritmo. Não chama API nem escolhe modelos. A [política nativa de modelos](runtime/MODELOS.md) mantém herança da sessão por padrão e preferências OpenAI explícitas separadas da identidade efetiva. Falha operacional encerra o run sem fallback histórico, preservando evidências para reconciliação. O executor realiza as ações e informa o modelo efetivo quando conhecido.

O replay preserva respostas salvas, mas não oferece transação sobre ferramentas externas; após interrupção, reconcilie efeitos antes de repetir ações. O custo de replay cresce com o histórico, limitado pelos tetos dos controladores. Aprovação de uma proposta não autoriza automaticamente publicação, alterações de conta ou geração paga.

## Validação e limites

As 42 skills da distribuição inicial foram avaliadas na etapa de testes comportamentais, com sessões reais e dados sintéticos, incluindo integração de teste com Drive e produção de imagem sob orçamento autorizado. Casos de controlador também usam fixtures técnicas e injeção de falhas identificadas. Essas evidências são internas e não integram este espelho público.

Os comandos abaixo verificam empacotamento, contratos e controles determinísticos. O smoke instala oito plugins, descobre as 66 skills e verifica o veto de argumentos do controlador Hermes em perfil temporário; não faz chamadas de modelo, não testa a qualidade de respostas nem comprova acesso aos seus conectores.

```sh
npm --prefix codex test
npm --prefix codex run smoke:install
```

Ferramentas externas, validações visuais/manuais e regras de aprovação continuam sujeitas às capacidades e decisões disponíveis em cada workspace. Ausência de evidência não equivale a validação concluída.

## Manutenção

Há uma fonte editável para cada tipo de conteúdo:

- `plugins/<nome>/skills/` nesta pasta: instruções nativas Codex.
- `../plugins/<nome>/`: domínio, scripts e controladores compartilhados com Claude.
- `runtime/`: adaptador e instruções comuns Codex.
- `resources.json`: inventário das cópias empacotadas. `SKILL.md` herdado vira `CONTRATO.md` em `shared/`.

Não edite `shared/`, `plugins/*/runtime/`, `plugins/*/RUNTIME.md`, `plugins/*/MODELOS.md` ou licenças copiadas diretamente. Após alterar uma fonte, materialize e confira:

```sh
npm --prefix codex run sync
npm --prefix codex test
```

Os pacotes instalados já contêm os recursos; não há build, dependência npm ou symlink necessário ao consumidor. CI e estágio de publicação verificam ambas as distribuições. Cada plugin mantém sua versão no manifesto e seu CHANGELOG; a tag do marketplace identifica o snapshot público conjunto.

Formato nativo baseado na [documentação oficial de plugins](https://developers.openai.com/plugins/build/plugins). Marketplace: `.agents/plugins/marketplace.json`. Manifesto por pacote: `.codex-plugin/plugin.json`.

As seis skills de carreira/comunicação acrescentadas no Bragir 0.2.0 têm validação separada da rodada inicial. Testes de pacote não comprovam edição de LinkedIn, envio de candidatura ou publicação de portfólio.

## Autoria com Iris

Hefesto e Odin verificam na sessão as skills Iris necessárias antes de redigir prompts ou briefs. Ausência bloqueia essa etapa e orienta habilitação pelo dono; não há instalação transitiva automática. Consulte o [contrato de dependência](plugins/hefesto/DEPENDENCIAS.md). Odin oferece as skills nativas `desafio` e `defaults`, além das seis etapas de domínio. Os nomes de comandos Claude nos contratos são traduzidos para essas entradas, sem pressupor suporte a slash commands no host.

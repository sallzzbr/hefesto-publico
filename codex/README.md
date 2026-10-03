# Hefesto para Codex

Seis plugins e 49 skills nativas Codex, distribuídos no [marketplace público Hefesto](https://github.com/sallzzbr/hefesto-publico). Esta pasta é a raiz do marketplace Codex; a distribuição Claude Code fica em `../plugins/`.

| Plugin | Skills | Função |
|---|---:|---|
| Hefesto | 4 | Criar, validar e versionar plugins e skills Codex |
| Bragir | 11 | Voz, escrita, editorial, carreira e comunicação visual |
| Hestia | 6 | Orçamento, gastos, compras e investimentos |
| Odin | 6 | Investigar, definir e entregar desafios com SPEC e TDD |
| Mimyr | 5 | Planejar, escrever e revisar cursos |
| Hermes | 17 | Diagnóstico de marketing e produção de criativos |

> Esta versão reúne 49 skills em seis plugins. Bragir Claude 1.3.0/Codex 0.2.0 acrescenta seis skills de carreira e comunicação. Os comandos abaixo usam a tag v3.19.0 da release correspondente a esta árvore.

## Instalação

Com Git e a CLI Codex disponíveis, obtenha a release pública e registre a pasta do marketplace:

```sh
git clone --branch v3.19.0 --depth 1 https://github.com/sallzzbr/hefesto-publico.git
cd hefesto-publico
codex plugin marketplace add ./codex
codex plugin add hefesto@hefesto
```

Troque o nome antes de `@` por outro plugin da tabela. Instale Bragir junto de Mimyr para cumprir a dependência de voz. Abra uma nova sessão para carregar as skills instaladas. O registro local do marketplace e a instalação foram verificados com `codex-cli 0.153.4`.

A instalação usa a configuração de quem executar os comandos. Os testes de distribuição usam somente perfis descartáveis. Ao atualizar, obtenha a nova release e repita o registro e a instalação a partir dela; preserve os dados do seu workspace fora do checkout de distribuição.

## Uso e dependências

Peça a capacidade pelo nome da skill ou descreva a tarefa. Cada skill nativa contém seu fluxo e aponta para o RUNTIME do pacote, cuja fonte de manutenção é [runtime/RUNTIME.md](runtime/RUNTIME.md). As instruções nativas governam ferramentas, paths, autorização e identidade do executor; contratos herdados em `shared/` preservam o domínio e não são skills concorrentes.

Configure paths em `AGENTS.md` do workspace, seção `## Paths do workspace`, ou em `~/.codex/hefesto/<plugin>/defaults.md`. Um caminho explícito no pedido tem prioridade. Recursos obrigatórios ausentes bloqueiam o passo dependente; descoberta ambígua exige esclarecimento. Dados do projeto e personas ficam fora do pacote instalado.

- Node.js 22+ para a Forja e os controladores de Odin, Mimyr e Hermes.
- Python e ambiente virtual com as dependências declaradas pelos scripts usados; não há instalação automática.
- Google Drive, documentos, ferramentas de imagem e outros conectores são necessários nos fluxos que os usam. Configure-os no ambiente consumidor. O plugin não fornece credenciais ou geradores.
- Revisão independente exige contexto/subagente disponível e autorizado. Sua ausência deixa a revisão pendente onde o contrato exigir independência.
- Bragir inclui o perfil de voz padrão de Antonio Salgado como fallback intencional, também distribuído no plugin Claude. Seu uso é anunciado. Um perfil preenchido do workspace tem prioridade; use `analisar-voz` para construir o seu.

O adaptador dos três controladores emite trabalho, recebe JSON validado e retoma o algoritmo. Não chama API nem escolhe modelos. A [política nativa de modelos](runtime/MODELOS.md) mantém herança da sessão por padrão e preferências OpenAI explícitas separadas da identidade efetiva. Falha operacional encerra o run sem fallback histórico, preservando evidências para reconciliação. O executor realiza as ações e informa o modelo efetivo quando conhecido.

O replay preserva respostas salvas, mas não oferece transação sobre ferramentas externas; após interrupção, reconcilie efeitos antes de repetir ações. O custo de replay cresce com o histórico, limitado pelos tetos dos controladores. Aprovação de uma proposta não autoriza automaticamente publicação, alterações de conta ou geração paga.

## Validação e limites

As 42 skills da distribuição inicial foram avaliadas na etapa de testes comportamentais, com sessões reais e dados sintéticos, incluindo integração de teste com Drive e produção de imagem sob orçamento autorizado. Casos de controlador também usam fixtures técnicas e injeção de falhas identificadas. Essas evidências são internas e não integram este espelho público.

Os comandos abaixo verificam empacotamento, contratos e controles determinísticos. O smoke instala seis plugins, descobre as 49 skills e verifica o veto de argumentos do controlador Hermes em perfil temporário; não faz chamadas de modelo, não testa a qualidade de respostas nem comprova acesso aos seus conectores.

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

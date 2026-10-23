# Bragir

> Paths de workspace citados neste README resolvem pela regra única do plugin
> (`skills/analisar-metricas/SKILL.md` e `skills/gerenciar-personas/SKILL.md`: CLAUDE.md do
> workspace → defaults `local_*` do usuário → convenção descoberta no cwd → default
> documentado); os literais abaixo são ilustrativos do default, não hardcode.

> Plugin de voz, escrita, editorial e carreira. As capacidades de carreira são opcionais e não alteram a escrita em outros projetos. O nome vem de Bragi, o deus nórdico da poesia e da eloquência — aqui moram as skills que escrevem na voz do Antonio, calibram para cada audiência e operam o ciclo editorial de um workspace de conteúdo.

Até a v2.x do marketplace, as skills de voz viviam no plugin `hefesto`. Migraram para cá quando o hefesto virou a forja de plugins. As skills editoriais (`planejar-agenda`, `analisar-metricas`) nasceram como comandos do workspace bragir e foram promovidas ao plugin.

## Skills

| Skill | O que faz |
|---|---|
| `escrever-como-antonio` | Escreve na voz do Antonio. Resolve o perfil na ordem `local_voz` (CLAUDE.md do workspace) → `./perfil-de-voz.md` (projeto) → `./voz/perfil-de-voz.md` (workspace de conteúdo) → `./voice-profile.md` (nome legado, só leitura) → `${CLAUDE_PLUGIN_ROOT}/perfil-de-voz.md` (default Antonio). Perfil só-scaffold (placeholders) conta como ausente. Descobre personas em `./personas/`. |
| `analisar-voz` | Analisa documentos e publicações acessíveis, registra procedência e diferenças entre canais e gera o perfil no workspace consumidor. Para DOCX, requer leitor compatível com o runtime. |
| `revisar-naturalidade` | Revisa um rascunho quanto a ritmo, clareza e fidelidade à voz, preservando fatos e incertezas. Pode ser chamada isoladamente e integra a escrita de artigos e posts. Sem perfil do autor, anuncia o limite da calibração. |
| `gerenciar-personas` | Cria, lista e edita personas de audiência em `./personas/` do projeto atual. |
| `planejar-agenda` | Planeja o ciclo do calendário editorial (12 slots, 3 posts/semana, 4 semanas) a partir de ideias e rascunhos. Opera sobre `./agenda/calendario.md` do workspace; sem a estrutura, PARA. |
| `analisar-metricas` | Analisa o CSV de métricas do workspace, ranqueia posts, aponta padrões e gera relatório datado; propõe aprendizados para o perfil de voz. Só leitura no CSV; sem a estrutura, PARA. |
| `mapear-perfil-profissional` | Mapear Perfil Profissional. |
| `avaliar-vagas` | Avaliar Vagas. |
| `revisar-linkedin` | Revisar LinkedIn. |
| `curar-portfolio` | Curadoria de cases e revisão por URL pela ótica de contratação, com evidências, rubrica e melhorias prioritárias. |
| `preparar-candidatura` | Preparar Candidatura. |
| `direcionar-comunicacao-visual` | Direcionar Comunicação Visual. |

## Instalação

    /plugin marketplace add sallzzbr/hefesto-publico
    /plugin install bragir@hefesto

## Contratos

- **Personas são do projeto**, nunca do plugin: `./personas/<nome>.md` (preferido) ou `./personas.md` (fallback).
- **Perfil de voz é do projeto** quando existe (`./perfil-de-voz.md`, ou `./voz/perfil-de-voz.md` em workspaces de conteúdo); o plugin só carrega o default do Antonio como fallback.
- Projetos com `./voice-profile.md` legado continuam funcionando; as skills oferecem renomear, nunca renomeiam sozinhas.

## Consumidores conhecidos

- **mimyr** (pipeline de cursos) — usa as skills de voz e personas para os cursos.
- **bragir** (workspace de carreira e conteúdo, repo homônimo) — usa as skills de voz para posts e as editoriais (`planejar-agenda`, `analisar-metricas`) para o ciclo.

## Carreira e comunicação

Comece pela entrega necessária: retomar LinkedIn não exige vaga nem perfil completo. `mapear-perfil-profissional` organiza contexto quando útil; as demais skills funcionam independentemente. O workspace guarda fontes, propostas e continuidade; o plugin não distribui experiências ou candidaturas pessoais. Portfólios externos permanecem em seus repositórios canônicos.

Exemplos: “retome a revisão do meu LinkedIn”, “avalie esta vaga contra meu perfil”, “selecione cases para esta oportunidade”, “prepare minha candidatura sem enviar”, “defina a direção visual desta apresentação”. Busca depende de acesso à web; alterações em plataformas e produção visual dependem das ferramentas do executor. Ausência dessas ferramentas não impede entregar conteúdo revisável.

## Revisão de portfólio

Peça “avalie meu portfólio pela ótica de contratação” ou forneça uma URL à `curar-portfolio`. O fluxo reutiliza objetivo e fontes do workspace, distingue evidência visual de texto extraído e entrega até cinco melhorias com critérios de conclusão. A nota de 0 a 100 só aparece com cobertura suficiente e usa pesos heurísticos.

Método adaptado de [pd-portfolio-review](https://github.com/leonardobetti/pd-portfolio-review), de Leonardo Betti (MIT). [Origem, alterações e licença](skills/curar-portfolio/references/origem-e-licenca.md). A pesquisa UXfolio 2026 informa os critérios; as estatísticas herdadas exigem conferência da fonte antes de citação.

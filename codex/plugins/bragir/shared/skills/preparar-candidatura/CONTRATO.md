---
name: preparar-candidatura
description: "Prepare and track applications. Use quando pedir currículo ou apresentação para uma vaga, preparação de entrevista, envio autorizado de candidatura, atualização de etapa ou retomada de um processo seletivo existente."
---

# Preparar Candidatura

## Input e contexto

Leia `${CLAUDE_PLUGIN_ROOT}/skills/mapear-perfil-profissional/references/carreira.md`. Receba vaga/processo e evidências profissionais. Consulte primeiro a ficha existente pelo id da oportunidade; não crie outra candidatura para cada sessão.

## Fluxo

1. Confirme objetivo da rodada: preparar material, executar envio autorizado, ensaiar entrevista ou registrar evento. Se faltar avaliação da vaga e isso mudar a adaptação, use `bragir:avaliar-vagas`; não torne a avaliação um bloqueio à tarefa simples.
2. Escolha experiências que respondem aos requisitos. Prepare CV, apresentação ou respostas usando `bragir:escrever-como-antonio`. Não crie métricas, gestão de pessoas, datas ou qualificações para preencher lacunas. Para entrevista, perguntas e respostas propostas são ensaio, não acontecimentos reais.
3. Referencie versões exatas de currículo, LinkedIn e cases. Material restrito exige versão apropriada ao destinatário. Não altere o posicionamento público inteiro a cada vaga.
4. Estado da candidatura: `identificada | em_avaliacao | preparada | enviada | entrevista | proposta | encerrada`. Avance por evento observado ou relato datado do usuário, não por inferência. Registre origem do evento; relato não é recibo independente. Preparar materiais adicionais em entrevista/proposta não regride o processo para preparada; conserve a etapa atual até um evento que justifique a mudança. Erro/retorno incerto em envio mantém pendência de reconciliação antes de repetir.
5. Envio de candidatura ou mensagem só quando explicitamente solicitado, por canal disponível e com conteúdo/destinatário definidos. Se não houver canal, entregue material e instrução prática; não marque enviada. Acompanhar prazos não cria lembretes/agendamentos sem pedido.

## Execução autorizada e retomada

- Reutilize autorização explícita para vagas identificadas, preservando exclusões e candidaturas anteriores. Registre escopo, canal, materiais e quem executará o próximo passo. Se o usuário assumir o preenchimento, passe a acompanhar seus relatos; não continue enviando em paralelo nem trate intenção futura como envio.
- Revalide a abertura e o canal oficial antes do envio. Reconcilie LinkedIn/ATS/ID externo com a ficha existente. Se o anúncio orientar candidatura por e-mail, registre a origem do endereço e confirme os materiais enviados.
- Preencha apenas fatos confirmados e pertinentes. Não invente telefone, salário, regime, disponibilidade, autorização de trabalho, deficiência ou resposta demográfica. Campos opcionais desconhecidos ficam vazios; obrigatórios geram uma pergunta curta, enquanto outras ações independentes continuam. Dados sensíveis seguem as regras de consentimento do runtime; prefira entrada direta pelo usuário para identificadores e credenciais. Não crie senha padrão compartilhada nem registre segredos.
- Abrir formulário, preencher e selecionar arquivo são passos distintos de enviar. Após cada transição relevante, confira os campos persistidos e o anexo efetivamente selecionado. Sessões retomadas exigem nova leitura; ausência de erro da ferramenta não prova upload ou submissão.
- Confirme envio por recibo, página de sucesso, registro do provedor ou relato atribuído. Envio confirmado não prova recebimento, leitura ou avanço. Preserve cópia exata do material, versão, data, canal, destinatário e identificador do recibo quando disponível; hash é auxiliar, não prova de envio.
- Em timeout, retorno incerto ou interrupção, reconcilie antes de repetir. Registre o bloqueio e o menor passo necessário; não repita tentativas idênticas sem nova evidência. Use capacidades e instruções atuais das ferramentas para uploads, login e permissões, sem transformar uma falha de navegador em regra permanente do plugin.

## Output

Descubra e preserve a estrutura existente, o board e os índices por empresa; não crie controles concorrentes nem migre fichas sem necessidade. Sem estrutura prévia, `candidaturas/<id>.md` é uma opção inicial. Mantenha cada ficha com oportunidade, estado, materiais/versionamento, eventos datados, feedback, pendências e próxima ação. Reuse identidade da oportunidade; releia antes de atualizar e não duplique evento já registrado. Mudanças de etapas devem ser rastreáveis, inclusive correções. Não armazene senhas ou documentos de identidade no registro.

## Resolução de paths

Paths literais de saída são ilustrativos, relativos a `local_carreira` resolvido: CLAUDE.md do workspace (incluindo AGENTS.md importado) → defaults `local_*` do usuário → convenção descoberta no cwd → default documentado. Exatamente um candidato existente é usado; mais de um exige perguntar. Detalhes na referência canônica de carreira indicada acima; no Codex prevalece RUNTIME.md.

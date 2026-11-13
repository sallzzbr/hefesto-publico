# Changelog

## 0.2.3

- Separa propostas de revisão em propostas/, mantendo hashes no inventário sem duplicar nós vigentes. Diagnostica gdd/propostas e IDs duplicados com caminhos, orientando migração autorizada sem mover arquivos. Testes executam as duas distribuições.

## 0.2.2

- Normaliza local_jogo com ./ inicial e / final; remove o prazo do hook da CLI sem reduzir limites de inventário; cobre os comandos reais dos hooks.

## 0.2.1
- Índice do GDD criado pelo preparar-jogo nasce em estado rascunho e sem versão; o criar-gdd o preenche no lugar e registra a versão 1, sem gerar revisão 2 proposta sobre o template vazio (achado TB-1).
- Continuidade aceita o rascunho sem versão: verificar e hooks informam o motivo sem acusar fonte inconsistente, reconciliar não gera baseline antes da versão 1 e, com baseline existente, a falta de versão vira divergência de versão. Linha de versão malformada continua erro.
- Índices com versão de projetos 0.2.0 continuam aceitos; preencher no lugar o template legado com versão 1 exige confirmação do responsável.

## 0.2.0
- Relações derivadas e baseline persistente com inspeção de impactos; reconciliação exige revisão dos documentos afetados inalterados ou confirmação explícita, válida apenas com baseline existente.
- Correções de continuidade: raiz do workspace fixada por identidade, exemplos cercados ignorados pelo parser, prazo compartilhado até a inspeção e novo alerta após transição limpa.
- Hooks consultivos opcionais de retomada e alerta, sem bloqueio ou escrita de decisões.
- Skills planejar-prototipo e preparar-lancamento; UX, acessibilidade, assets e retrospectiva integrados.
- Migração explícita preserva projetos 0.1 e privacidade. Compatibilidade nativa depende de validação dos eventos nos runtimes usados.

## 0.1.0

- Primeira versão: nove skills e seis contratos de papéis para GDD, direção audiovisual, produção, playtest e aprendizado local/privado.
- Templates e exemplos sintéticos; sem hooks, executor próprio ou dados de projetos.

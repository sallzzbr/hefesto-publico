---
name: revisar-naturalidade
description: "Use quando o usuário pedir para revisar a naturalidade de um rascunho, deixar o texto mais humano, tirar cara de IA ou preservar sua voz em artigos, posts e outras comunicações."
---

# Revisar naturalidade

Na primeira utilização, leia `../../RUNTIME.md` e
`../../shared/skills/revisar-naturalidade/CONTRATO.md`. O runtime governa paths e autorização;
o contrato governa a revisão editorial.

## Fluxo nativo

1. Receba rascunho, objetivo, canal e público. Pedido de diagnóstico entrega só diagnóstico.
2. Resolva `local_voz` pela cadeia de `escrever-como-antonio`, sem executar o escritor.
   Leia um único perfil preenchido. Sem perfil do autor, informe que a revisão não está
   calibrada à sua voz; não atribua o fallback do Antonio a outro autor.
3. Faça a menor revisão útil de ritmo, clareza e expressão. Preserve fatos, opinião,
   hipóteses e incertezas; diferencie regra documentada de restrição aplicada no código.
4. Entregue no formato pedido, com até três justificativas quando cabíveis. Texto já adequado
   pode permanecer igual. Não prometa autoria humana, alcance ou aprovação por detector de IA.

Perfis, amostras e feedback ficam no workspace. Não escreva no cache nem registre memória
automaticamente. Não chame o escritor de volta nem apresente autocorreção como revisão independente.

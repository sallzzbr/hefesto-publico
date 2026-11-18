// CRC-32 (IEEE) em JS puro: a conferência dos JSON que um agente transporta entre os scripts e o harness.
// Unidade UTF-16 abaixo de 256 entra como um byte, as demais como byte baixo e byte alto. `harness/loop.mjs`
// tem uma cópia (o script de Workflow não importa módulos); `tests/scripts-comuns.test.mjs` compara as duas
// e confere esta contra um oráculo independente.
export function crc32(texto) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < texto.length; i++) {
    const u = texto.charCodeAt(i);
    for (const b of u < 256 ? [u] : [u & 0xFF, u >>> 8]) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
    }
  }
  return ((c ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0');
}

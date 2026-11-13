// Subconjunto YAML deliberado: campos escalares e metadata como mapa de strings.
// Não interpreta YAML geral nem ignora sintaxe desconhecida.
function scalar(raw, key) {
  let value;
  if (raw.startsWith('"')) {
    try { value = JSON.parse(raw); }
    catch { throw new Error(`string inválida em ${key}`); }
  } else if (raw.startsWith("'")) {
    if (!/^'(?:[^']|'')*'$/.test(raw)) throw new Error(`string inválida em ${key}`);
    value = raw.slice(1, -1).replace(/''/g, "'");
  } else {
    if (/^[\[\]{}&*!|>@`#%?,:-]|:(?:\s|$)|\s#/.test(raw)
        || /^(?:null|true|false|~|[-+]?0[xob][0-9a-f_]+|[-+]?\d[\d.eE+_-]*|[-+]?\.\d.*|[-+]?\.(?:inf|nan))$/i.test(raw)) {
      throw new Error(`scalar YAML não suportado em ${key}; use string entre aspas`);
    }
    value = raw;
  }
  if (typeof value !== 'string' || !value.trim()) throw new Error(`string vazia ou inválida em ${key}`);
  return value;
}

export function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return { text, values: null, problem: 'ausente ou não fechado' };
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uD800-\uDFFF\uFFFE\uFFFF]/u.test(match[1])) {
    return { text, values: null, problem: 'caractere literal proibido em YAML' };
  }
  const values = Object.create(null);
  let metadataOpen = false;
  let metadataIndent = null;
  try {
    for (const line of match[1].split(/\r?\n/)) {
      if (!line.trim() || /^ *#/.test(line)) continue;
      if (/^ *\t/.test(line)) throw new Error('indentação com tab não suportada');
      const field = line.match(/^( *)([a-z][a-z0-9-]*):(?:[ \t]+(.*?))? *$/i);
      if (!field) throw new Error(`linha não suportada: ${line}`);
      const [, spaces, key, raw = ''] = field;
      if (spaces.length) {
        if (!metadataOpen) throw new Error('indentação fora de metadata');
        metadataIndent ??= spaces.length;
        if (spaces.length !== metadataIndent) throw new Error('indentação inconsistente em metadata');
        if (Object.hasOwn(values.metadata, key)) throw new Error(`campo duplicado: metadata.${key}`);
        values.metadata[key] = scalar(raw, `metadata.${key}`);
      } else {
        metadataOpen = false;
        if (Object.hasOwn(values, key)) throw new Error(`campo duplicado: ${key}`);
        if (key === 'metadata') {
          if (raw) throw new Error('metadata deve ser mapa de strings indentado');
          values.metadata = Object.create(null);
          metadataOpen = true;
        } else {
          values[key] = scalar(raw, key);
        }
      }
    }
    if (values.metadata && !Object.keys(values.metadata).length) throw new Error('metadata vazio');
    return { text, values, problem: null };
  } catch (cause) { return { text, values: null, problem: cause.message }; }
}

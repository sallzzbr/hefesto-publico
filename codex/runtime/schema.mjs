// Subconjunto JSON Schema utilizado pelos três controladores compartilhados.
const KEYS = new Set(['type', 'enum', 'required', 'properties', 'additionalProperties', 'items', 'minItems', 'maxItems', 'minimum', 'maximum', 'minLength', 'maxLength', 'pattern', 'description', 'title']);
export function validarDefinicao(schema) {
  if (typeof schema === 'boolean') return;
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) throw new Error('schema: definição inválida');
  for (const key of Object.keys(schema)) if (!KEYS.has(key)) throw new Error(`schema: restrição não suportada: ${key}`);
  for (const child of Object.values(schema.properties || {})) validarDefinicao(child);
  if (schema.items !== undefined) validarDefinicao(schema.items);
  if (typeof schema.additionalProperties === 'object') validarDefinicao(schema.additionalProperties);
}
export function validarSchema(value, schema, path = '$') {
  validarDefinicao(schema);
  const fail = msg => { throw new Error(`schema ${path}: ${msg}`); };
  if (schema === true) return;
  if (schema === false) fail('valor proibido');
  if (schema.enum && !schema.enum.some(x => JSON.stringify(x) === JSON.stringify(value))) fail('fora do enum');
  const tipos = schema.type ? [].concat(schema.type) : [];
  const tipo = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (tipos.length && !tipos.includes(tipo) && !(tipos.includes('integer') && Number.isInteger(value))) fail(`esperado ${tipos.join('|')}, recebi ${tipo}`);
  if (tipo === 'object') {
    for (const k of schema.required || []) if (!Object.hasOwn(value, k)) fail(`campo obrigatório ${k}`);
    for (const [k, v] of Object.entries(value)) {
      if (Object.hasOwn(schema.properties || {}, k)) validarSchema(v, schema.properties[k], `${path}.${k}`);
      else if (schema.additionalProperties === false) fail(`campo extra ${k}`);
      else if (typeof schema.additionalProperties === 'object') validarSchema(v, schema.additionalProperties, `${path}.${k}`);
    }
  }
  if (tipo === 'array') {
    if (schema.minItems !== undefined && value.length < schema.minItems) fail('array curto');
    if (schema.maxItems !== undefined && value.length > schema.maxItems) fail('array longo');
    if (schema.items !== undefined) value.forEach((v, i) => validarSchema(v, schema.items, `${path}[${i}]`));
  }
  if (tipo === 'number') {
    if (!Number.isFinite(value)) fail('número não finito');
    if (schema.minimum !== undefined && value < schema.minimum) fail('abaixo do mínimo');
    if (schema.maximum !== undefined && value > schema.maximum) fail('acima do máximo');
  }
  if (tipo === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) fail('texto curto');
    if (schema.maxLength !== undefined && value.length > schema.maxLength) fail('texto longo');
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) fail('formato inválido');
  }
}

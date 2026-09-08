import test from 'node:test';
import assert from 'node:assert/strict';
import { validarSchema } from '../runtime/schema.mjs';

test('schema cobra obrigatórios, tipos aninhados, enum e limites do contrato', () => {
  const schema = { type: 'object', additionalProperties: false, required: ['itens'], properties: {
    itens: { type: 'array', minItems: 1, items: { type: 'object', required: ['id','grau'], properties: {
      id: { type: 'string', minLength: 1, pattern: '^C' }, grau: { type: 'integer', minimum: 1, maximum: 7 },
      status: { enum: ['verde','vermelho'] },
    } } },
  } };
  assert.doesNotThrow(() => validarSchema({ itens: [{ id: 'C1', grau: 2 }] }, schema));
  for (const v of [{}, { itens: [] }, { itens: [{ id: 'X1', grau: 2 }] }, { itens: [{ id: 'C1', grau: 8 }] },
    { itens: [{ id: 'C1', grau: 1.5 }] }, { itens: [{ id: 'C1', grau: 2, status: 'azul' }] },
    { itens: [{ id: 'C1', grau: 2 }], extra: true }]) {
    assert.throws(() => validarSchema(v, schema), /schema/);
  }
});
test('schema não ignora restrição desconhecida ou items false', () => {
  for (const schema of [{ const: 'obrigatório' }, { not: { type: 'string' } }, { type: 'array', items: false }]) {
    assert.throws(() => validarSchema(['indevido'], schema), /schema/);
  }
  assert.doesNotThrow(() => validarSchema([], { type: 'array', items: false }));
});

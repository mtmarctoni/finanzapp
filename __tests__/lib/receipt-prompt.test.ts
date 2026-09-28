import { RECEIPT_PARSE_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { STANDARD_CATEGORIES } from '@/lib/categories';

describe('RECEIPT_PARSE_SYSTEM_PROMPT', () => {
  it('tells the model the exact date format it must return', () => {
    expect(RECEIPT_PARSE_SYSTEM_PROMPT).toContain('YYYY-MM-DD');
  });

  it('grounds relative dates in today', () => {
    expect(RECEIPT_PARSE_SYSTEM_PROMPT).toContain(
      new Date().toISOString().split('T')[0] ?? '',
    );
  });

  it('names every field the schema requires', () => {
    for (const field of [
      'fecha',
      'cantidad',
      'comercio',
      'tipo',
      'plataforma_pago',
      'detalle1',
      'confianza',
    ]) {
      expect(RECEIPT_PARSE_SYSTEM_PROMPT).toContain(field);
    }
  });

  it('lists every standard category so the answer is normalizable', () => {
    for (const category of STANDARD_CATEGORIES) {
      expect(RECEIPT_PARSE_SYSTEM_PROMPT).toContain(category);
    }
  });

  it('forbids inventing a category outside the list', () => {
    expect(RECEIPT_PARSE_SYSTEM_PROMPT).toContain('No inventes categorías');
  });

  it('has no unresolved template placeholder', () => {
    expect(RECEIPT_PARSE_SYSTEM_PROMPT).not.toContain('${');
  });

  it('never asks for accion, which the route fixes to Gasto', () => {
    expect(RECEIPT_PARSE_SYSTEM_PROMPT).not.toContain('accion');
  });

  it('renders the field code spans instead of closing the literal', () => {
    // A raw backtick inside the template literal would truncate the string
    // and break compilation, so every code span must be escaped as \`field\`.
    for (const field of ['cantidad', 'detalle1', 'confianza']) {
      expect(RECEIPT_PARSE_SYSTEM_PROMPT).toContain(`\`${field}\``);
    }
  });
});

import { render, screen } from '@testing-library/react';
import { useSearchParams } from 'next/navigation';

import NewEntryPage from '@/app/new/page';

jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));

/**
 * The `mock` prefix is required, not decorative: `jest.mock` factories are
 * hoisted above the imports, and jest-plugin only lets a factory reference
 * out-of-scope variables whose names begin with `mock`. A plain `captured`
 * would fail the transform with "Invalid variable access: captured".
 */
const mockCaptured: { parsedData?: Record<string, unknown> } = {};

jest.mock('@/components/finance-form', () => ({
  FinanceForm: ({ parsedData }: { parsedData?: Record<string, unknown> }) => {
    mockCaptured.parsedData = parsedData;
    return <div data-testid="finance-form" />;
  },
}));

const params = new Map<string, string>();

beforeEach(() => {
  mockCaptured.parsedData = undefined;
  params.clear();
  (useSearchParams as jest.Mock).mockReturnValue({
    get: (key: string) => params.get(key) ?? null,
    has: (key: string) => params.has(key),
  });
});

describe('/new with a receipt prefill', () => {
  it('passes nothing for a plain manual visit', () => {
    render(<NewEntryPage />);
    expect(mockCaptured.parsedData).toBeUndefined();
    expect(screen.getByText('Nuevo registro')).toBeInTheDocument();
  });

  it('recognises rcpt as an AI prefill', () => {
    params.set('rcpt', '1');
    params.set('fecha', '2026-09-20');
    params.set('tipo', 'Supermercado');
    params.set('accion', 'Gasto');
    params.set('que', 'Mercadona');
    params.set('plataforma_pago', 'Visa');
    params.set('cantidad', '43.2');
    params.set('content_hash', 'a'.repeat(64));
    params.set('confianza', '0.92');
    params.set('comercio', 'Mercadona');

    render(<NewEntryPage />);

    expect(screen.getByText('Revisar entrada')).toBeInTheDocument();
    expect(mockCaptured.parsedData).toMatchObject({
      fecha: '2026-09-20',
      tipo: 'Supermercado',
      accion: 'Gasto',
      que: 'Mercadona',
      plataforma_pago: 'Visa',
      cantidad: 43.2,
      rcpt: '1',
      content_hash: 'a'.repeat(64),
      confianza: 0.92,
      comercio: 'Mercadona',
      needs_review: false,
    });
  });

  it('flags a low-confidence read', () => {
    params.set('rcpt', '1');
    params.set('confianza', '0.4');
    params.set('needs_review', '1');
    render(<NewEntryPage />);
    expect(mockCaptured.parsedData).toMatchObject({
      confianza: 0.4,
      needs_review: true,
    });
  });

  it('still handles a text-parsing prefill', () => {
    params.set('ai_text', 'gasto 20 euros en mercadona');
    params.set('cantidad', '20');
    render(<NewEntryPage />);
    expect(mockCaptured.parsedData).toMatchObject({
      ai_text: 'gasto 20 euros en mercadona',
      cantidad: 20,
    });
    // `rcpt` is present-but-undefined for a text parse, and that is fine: the
    // form's gate is `rcpt === '1'`, so what must not happen is a `'1'` here.
    expect(mockCaptured.parsedData?.rcpt).toBeUndefined();
  });

  // A receipt is an expense. The model's category proposal is allowed to fill
  // `tipo`; `accion` is a fact of the flow, not a reading, so a hand-edited
  // `?rcpt=1&accion=Ingreso` must not turn a photographed receipt into income.
  it('never lets a URL param turn a receipt into an income', () => {
    params.set('rcpt', '1');
    params.set('accion', 'Ingreso');
    params.set('cantidad', '10');
    render(<NewEntryPage />);
    expect(mockCaptured.parsedData).toMatchObject({ accion: 'Gasto' });
  });

  // Everything in the URL is user-supplied. `content_hash` feeds a unique
  // index and `merchant_id` a UUID foreign key, so a hand-edited value would
  // fail the insert with no error UI; `confianza` lands in `NUMERIC(3, 2)`.
  it('drops values the parse route could not have produced', () => {
    params.set('rcpt', '1');
    params.set('fecha', 'ayer');
    params.set('hora', '99');
    params.set('content_hash', 'not-a-sha256');
    params.set('merchant_id', 'm-1');
    params.set('confianza', '7');
    render(<NewEntryPage />);
    expect(mockCaptured.parsedData).toMatchObject({
      fecha: undefined,
      hora: undefined,
      content_hash: undefined,
      merchant_id: undefined,
      confianza: 1,
    });
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

import { ReceiptUpload } from '@/components/ai/ReceiptUpload';
import { downscaleImageFile } from '@/components/ai/imageDownscale';

jest.mock('next/navigation', () => ({ useRouter: jest.fn() }));
jest.mock('next-auth/react', () => ({ useSession: jest.fn() }));
jest.mock('@/components/ai/imageDownscale', () => ({
  ...jest.requireActual('@/components/ai/imageDownscale'),
  downscaleImageFile: jest.fn(),
}));

const push = jest.fn();
const downscaleMock = downscaleImageFile as jest.MockedFunction<
  typeof downscaleImageFile
>;

const RECEIPT = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'r.jpg', {
  type: 'image/jpeg',
});

function mockFetch(payload: unknown, status = 200) {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => payload,
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function pick() {
  fireEvent.change(screen.getByLabelText(/recibo/i), {
    target: { files: [RECEIPT] },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue({ push });
  (useSession as jest.Mock).mockReturnValue({
    status: 'authenticated',
    data: { user: { id: 'user-1' } },
  });
  downscaleMock.mockResolvedValue(RECEIPT);
});

describe('ReceiptUpload', () => {
  it('stays hidden for an anonymous visitor', () => {
    (useSession as jest.Mock).mockReturnValue({ status: 'loading' });
    render(<ReceiptUpload />);
    expect(screen.queryByLabelText(/recibo/i)).not.toBeInTheDocument();
  });

  it('sends the downscaled file and redirects to the prefilled form', async () => {
    const fetchMock = mockFetch({
      success: true,
      duplicate: false,
      parsedData: {
        fecha: '2026-09-20',
        tipo: 'Supermercado',
        accion: 'Gasto',
        que: 'Mercadona',
        plataforma_pago: 'Visa',
        cantidad: 43.2,
      },
      receipt: { contentHash: 'abc', confianza: 0.9, comercio: 'Mercadona' },
      providerUsed: 'opencode',
      modelUsed: 'mimo-v2.5-free',
    });

    render(<ReceiptUpload />);
    pick();
    fireEvent.click(screen.getByRole('button', { name: /analizar/i }));

    await waitFor(() => expect(push).toHaveBeenCalled());

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/ai/parse-receipt');
    expect((init as RequestInit).method).toBe('POST');
    const body = (init as RequestInit).body as FormData;
    expect(body.get('image')).toBe(RECEIPT);
    expect(downscaleMock).toHaveBeenCalledWith(RECEIPT);

    const target = String(push.mock.calls[0]?.[0] ?? '');
    expect(target.startsWith('/new?')).toBe(true);
    expect(target).toContain('rcpt=1');
    expect(target).toContain('tipo=Supermercado');
    expect(target).toContain('content_hash=abc');
    expect(target).toContain('comercio=Mercadona');
  });

  it('marks a low-confidence read for review', async () => {
    mockFetch({
      success: true,
      duplicate: false,
      parsedData: { fecha: '2026-09-20', cantidad: 12 },
      receipt: { contentHash: 'abc', confianza: 0.4, needsReview: true },
    });
    render(<ReceiptUpload />);
    pick();
    fireEvent.click(screen.getByRole('button', { name: /analizar/i }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(String(push.mock.calls[0]?.[0] ?? '')).toContain('needs_review=1');
  });

  it('tells the user the receipt is already saved instead of redirecting', async () => {
    mockFetch({
      success: true,
      duplicate: true,
      duplicateKind: 'exact',
      entry: { id: 'e-1', que: 'Mercadona', cantidad: 43.2 },
    });
    render(<ReceiptUpload />);
    pick();
    fireEvent.click(screen.getByRole('button', { name: /analizar/i }));

    expect(
      await screen.findByText(/ya tienes esta entrada/i),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('shows the field-level message when the amount cannot be read', async () => {
    mockFetch(
      {
        success: false,
        field: 'cantidad',
        message: 'Haz una foto más cerca del total.',
      },
      422,
    );
    render(<ReceiptUpload />);
    pick();
    fireEvent.click(screen.getByRole('button', { name: /analizar/i }));
    expect(
      await screen.findByText('Haz una foto más cerca del total.'),
    ).toBeInTheDocument();
  });

  it('explains a 503 without pretending the receipt was saved', async () => {
    mockFetch(
      { success: false, message: 'Prueba con una foto más nítida.' },
      503,
    );
    render(<ReceiptUpload />);
    pick();
    fireEvent.click(screen.getByRole('button', { name: /analizar/i }));
    expect(
      await screen.findByText('Prueba con una foto más nítida.'),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('does nothing without a file', () => {
    mockFetch({});
    render(<ReceiptUpload />);
    fireEvent.click(screen.getByRole('button', { name: /analizar/i }));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // The magic-byte guard answers with `error` and no `message`, because the
  // model was never reached. If the component only reads `message`, the user
  // gets the generic string and no idea what to fix.
  it('surfaces the guard error, which arrives without a message', async () => {
    mockFetch(
      {
        success: false,
        error:
          'El archivo no es una imagen válida. Se aceptan JPEG, PNG, WebP, HEIC y HEIF.',
      },
      415,
    );
    render(<ReceiptUpload />);
    pick();
    fireEvent.click(screen.getByRole('button', { name: /analizar/i }));
    expect(
      await screen.findByText(/no es una imagen válida/i),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

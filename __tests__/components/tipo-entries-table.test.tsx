import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { TipoEntriesTable } from '@/components/analytics/tipo-entries-table';
import { type PaginatedEntriesResponse } from '@/types/api';

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

function entry(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    fecha: '2026-01-10',
    tipo: 'Vivienda',
    accion: 'Gasto',
    que: 'Alquiler',
    plataforma_pago: 'Transferencia',
    cantidad: 800,
    detalle1: null,
    detalle2: null,
    quien: 'Yo',
    created_at: '2026-01-10',
    updated_at: '2026-01-10',
    ...overrides,
  };
}

function listResponse(
  data: ReturnType<typeof entry>[],
  totalItems: number,
  totalPages: number,
  currentPage = 1,
): PaginatedEntriesResponse {
  return { data, totalItems, totalPages, currentPage };
}

describe('TipoEntriesTable', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('renders entries and the tipo-scoped header', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest
        .fn()
        .mockResolvedValue(
          listResponse(
            [entry('1', { que: 'Alquiler' }), entry('2', { que: 'Comunidad' })],
            2,
            1,
          ),
        ),
    });

    render(<TipoEntriesTable tipo="Vivienda" />);

    expect(await screen.findByText('Alquiler')).toBeInTheDocument();
    expect(screen.getByText('Comunidad')).toBeInTheDocument();
    expect(screen.getByText(/movimientos en/)).toBeInTheDocument();
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal).toBeInstanceOf(
      AbortSignal,
    );
  });

  it('requests the requested filters and requests a sort change', async () => {
    fetchMock.mockResolvedValue(
      Promise.resolve({
        ok: true,
        json: jest.fn().mockResolvedValue(listResponse([entry('1')], 1, 1)),
      }),
    );

    render(<TipoEntriesTable tipo="Vivienda" que="Alquiler" />);

    await screen.findByText('Alquiler');
    expect(fetchMock.mock.calls[0][0]).toContain('tipo=Vivienda');
    expect(fetchMock.mock.calls[0][0]).toContain('que=Alquiler');

    fireEvent.click(
      screen.getByRole('button', { name: 'Ordenar por Importe' }),
    );

    await screen.findByText('Alquiler');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toContain('sortBy=cantidad');
    expect(fetchMock.mock.calls[1][0]).toContain('sortOrder=desc');

    fireEvent.click(
      screen.getByRole('button', { name: 'Ordenar por Importe' }),
    );
    await screen.findByText('Alquiler');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[2][0]).toContain('sortBy=cantidad');
    expect(fetchMock.mock.calls[2][0]).toContain('sortOrder=asc');
  });

  it('paginates to the next page', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(
        listResponse(
          Array.from({ length: 10 }, (_, i) =>
            entry(String(i), { que: `Item ${i}` }),
          ),
          15,
          2,
        ),
      ),
    });

    render(<TipoEntriesTable tipo="Vivienda" />);

    expect(await screen.findByText('Página 1 de 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toContain('page=2');
    expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument();
  });

  it('resets pagination and sorting when the filters change', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(listResponse([entry('1')], 1, 1)),
    });

    const { rerender } = render(<TipoEntriesTable tipo="Vivienda" />);
    await screen.findByText('Alquiler');

    fireEvent.click(
      screen.getByRole('button', { name: 'Ordenar por Importe' }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    rerender(<TipoEntriesTable tipo="Comida" />);
    await waitFor(() => {
      const url = fetchMock.mock.calls[
        fetchMock.mock.calls.length - 1
      ][0] as string;
      expect(url).toContain('tipo=Comida');
      expect(url).toContain('page=1');
      expect(url).toContain('sortBy=fecha');
      expect(url).toContain('sortOrder=desc');
    });
  });

  it('shows an empty state when there is no data', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(listResponse([], 0, 0)),
    });

    render(<TipoEntriesTable tipo="Vivienda" />);

    expect(await screen.findByText('No hay datos')).toBeInTheDocument();
  });

  it('shows an error state with a working retry', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue(listResponse([entry('1')], 1, 1)),
    });

    render(<TipoEntriesTable tipo="Vivienda" />);

    expect(
      await screen.findByText('No se pudieron cargar los movimientos'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Reintentar' })[0]);

    expect(await screen.findByText('Alquiler')).toBeInTheDocument();
  });
});

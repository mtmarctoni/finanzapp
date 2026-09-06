import { fireEvent, render, screen } from '@testing-library/react';
import { type ReactElement } from 'react';

import TipoPageContent from '@/components/analytics/tipo-page-content';
import { type AnalyticsData } from '@/hooks/use-analytics-data';

let mockParams: URLSearchParams;
const mockUseRouter = jest.fn(() => ({ replace: routerReplace }));
const mockUseSearchParams = jest.fn(() => mockParams);
jest.mock('next/navigation', () => ({
  useRouter: () => mockUseRouter(),
  useSearchParams: () => mockUseSearchParams(),
  usePathname: jest.fn(() => '/analytics/tipo'),
}));

const routerReplace = jest.fn();
const rerenderHolder: { rerender: (el: ReactElement) => void } = {
  rerender: () => undefined,
};

const mockUseAnalyticsData = jest.fn();
jest.mock('@/hooks/use-analytics-data', () => ({
  useAnalyticsData: () => mockUseAnalyticsData(),
}));

jest.mock('react-chartjs-2', () => ({
  Doughnut: () => <div data-testid="doughnut" />,
}));

jest.mock('@/components/analytics/TipoExplorer', () => ({
  TipoExplorer: ({ selectedTipo }: { selectedTipo?: string }) => (
    <div data-testid="tipo-explorer">{selectedTipo ?? ''}</div>
  ),
}));
jest.mock('@/components/analytics/TrendExplorer', () => ({
  TrendExplorer: ({ selectedTipo }: { selectedTipo?: string }) => (
    <div data-testid="trend-explorer">{selectedTipo ?? ''}</div>
  ),
}));
jest.mock('@/components/analytics/SavingsRateCard', () => ({
  SavingsRateCard: () => <div data-testid="savings-rate" />,
}));
jest.mock('@/components/analytics/SpendingVelocity', () => ({
  SpendingVelocity: () => <div data-testid="spending-velocity" />,
}));

const euro = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
}).format;

function cardText(label: string): string {
  const title = screen.getByText(label);
  return title.closest('.rounded-lg')?.textContent ?? '';
}

const baseData: AnalyticsData = {
  temporalData: [{ period: '2025-03-01', action: 'Gasto', total: 800 }],
  categoryData: [],
  platformData: [],
  typeData: [],
  topTransactions: [],
  categoryPlatformData: [],
  tipoQueData: [
    {
      type: 'Vivienda',
      category: 'Alquiler',
      action: 'Gasto',
      total: 800,
      count: 2,
    },
    {
      type: 'Vivienda',
      category: 'Alquiler',
      action: 'Ingreso',
      total: 500,
      count: 1,
    },
    {
      type: 'Salario',
      category: 'Trabajo',
      action: 'Ingreso',
      total: 2500,
      count: 1,
    },
  ],
  categoryTemporalData: [
    {
      period: '2025-01-01',
      category: 'Alquiler',
      type: 'Vivienda',
      action: 'Gasto',
      total: 100,
      count: 1,
    },
    {
      period: '2025-02-01',
      category: 'Alquiler',
      type: 'Vivienda',
      action: 'Gasto',
      total: 100,
      count: 1,
    },
  ],
  typeTemporalData: [
    {
      period: '2025-01-01',
      type: 'Vivienda',
      action: 'Gasto',
      total: 100,
    },
    {
      period: '2025-02-01',
      type: 'Vivienda',
      action: 'Gasto',
      total: 300,
    },
    {
      period: '2025-03-01',
      type: 'Vivienda',
      action: 'Gasto',
      total: 200,
    },
  ],
  categoryStats: [],
  availableYears: [2025, 2024, 2023],
  sums: { gastos: 0, ingresos: 0, inversion: 0 },
  metrics: undefined,
  netTemporal: [],
};

describe('TipoPageContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = new URLSearchParams();
    rerenderHolder.rerender = () => undefined;
    mockUseRouter.mockReturnValue({ replace: routerReplace });
    routerReplace.mockImplementation((url: string) => {
      mockParams = new URLSearchParams(
        new URL(url, 'http://localhost:3000').search,
      );
      rerenderHolder.rerender(<TipoPageContent />);
    });
    mockUseAnalyticsData.mockReturnValue({
      data: baseData,
      filters: { groupBy: 'month' },
      loading: false,
    });
  });

  it('renders the tipo-scoped summary cards and expense doughnut', () => {
    mockParams = new URLSearchParams('type=Vivienda');

    render(<TipoPageContent />);

    expect(
      screen.getByRole('heading', { name: 'Analíticas por Tipo' }),
    ).toBeInTheDocument();
    // Gastos / Inversión / Ingresos / Neto for Vivienda only
    expect(cardText('Gastos')).toContain(euro(800));
    expect(cardText('Inversión')).toContain(euro(0));
    expect(cardText('Ingresos')).toContain(euro(500));
    expect(cardText('Neto')).toContain(euro(300));
    expect(cardText('Gastos')).toContain('2 mov.');
    expect(screen.getByTestId('doughnut')).toBeInTheDocument();
  });

  it('writes the selected tipo to the URL and passes it to the explorers', () => {
    const view = render(<TipoPageContent />);
    rerenderHolder.rerender = view.rerender;

    // Default selects the first tipo (Salario); clicking Vivienda syncs it.
    expect(screen.getByTestId('tipo-explorer')).toHaveTextContent('Salario');

    fireEvent.click(screen.getByRole('button', { name: 'Vivienda' }));

    expect(routerReplace).toHaveBeenCalledWith('/analytics/tipo?type=Vivienda');
    expect(screen.getByTestId('tipo-explorer')).toHaveTextContent('Vivienda');
  });

  it('writes the selected period to the URL as from/to date range', () => {
    mockParams = new URLSearchParams('type=Vivienda');

    const view = render(<TipoPageContent />);
    rerenderHolder.rerender = view.rerender;

    fireEvent.click(screen.getByRole('button', { name: '2025' }));

    expect(routerReplace).toHaveBeenCalledWith(
      '/analytics/tipo?type=Vivienda&from=2025-01-01&to=2025-12-31',
    );
  });

  it('keeps the full year list visible after a year is selected', () => {
    mockParams = new URLSearchParams(
      'type=Vivienda&from=2025-01-01&to=2025-12-31',
    );

    const view = render(<TipoPageContent />);
    rerenderHolder.rerender = view.rerender;

    for (const year of ['2025', '2024', '2023']) {
      expect(screen.getByRole('button', { name: year })).toBeInTheDocument();
    }
  });

  it('handles a stale tipo bookmark without crashing (empty chart state)', () => {
    mockParams = new URLSearchParams('type=Stale');

    render(<TipoPageContent />);

    expect(screen.getByTestId('tipo-explorer')).toHaveTextContent('Stale');
    expect(screen.getByText('No hay datos disponibles')).toBeInTheDocument();
  });

  it('shows a monthly average line on each summary card', () => {
    mockParams = new URLSearchParams('type=Vivienda');

    render(<TipoPageContent />);

    // Vivienda has 3 calendar months of Gasto (100+300+200) -> 600/3 = 200/mes.
    expect(cardText('Gastos')).toContain(euro(200));
    expect(cardText('Gastos')).toContain('/mes');
    expect(cardText('Inversión')).toContain('/mes');
    expect(cardText('Ingresos')).toContain('/mes');
    // Neto average = |Ingreso - Gasto - Inversión| over the same months.
    expect(cardText('Neto')).toContain(euro(200));
  });

  it('keeps the averages tipo-scoped when a que category is selected', () => {
    mockParams = new URLSearchParams('type=Vivienda');

    render(<TipoPageContent />);

    fireEvent.click(screen.getByRole('button', { name: 'Alquiler' }));

    // The summary cards (and their averages) always cover the whole tipo.
    expect(cardText('Gastos')).toContain(euro(200));
  });
});

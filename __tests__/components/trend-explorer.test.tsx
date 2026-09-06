import { render, screen } from '@testing-library/react';

import { TrendExplorer } from '@/components/analytics/TrendExplorer';
import { type CategoryTemporalDatum } from '@/lib/analytics-charts';

jest.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="line-chart" />,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }): React.ReactNode =>
    children,
  SelectContent: ({
    children,
  }: {
    children: React.ReactNode;
  }): React.ReactNode => children,
  SelectItem: (): null => null,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  SelectValue: () => <span />,
}));

const emptyLine = () => ({
  labels: [] as string[],
  datasets: [] as { label: string; data: number[] }[],
  counts: [] as number[],
  trendSlope: 0,
});

const tipoQueData = [
  {
    type: 'Vivienda',
    category: 'Hipoteca',
    action: 'Gasto',
    total: -1200,
    count: 1,
  },
  {
    type: 'Vivienda',
    category: 'Hipoteca',
    action: 'Ingreso',
    total: 300,
    count: 1,
  },
  {
    type: 'Vivienda',
    category: 'Seguro',
    action: 'Gasto',
    total: -40,
    count: 1,
  },
];

function renderTrendExplorer() {
  return render(
    <TrendExplorer
      categoryTemporalData={[] as CategoryTemporalDatum[]}
      typeTemporalData={[]}
      tipoQueData={tipoQueData}
      types={['Vivienda']}
      groupBy="month"
      loading={false}
      getCategoryTrendData={() => emptyLine()}
      getTipoTrendData={() => emptyLine()}
      getLineChartOptions={() => ({})}
      selectedTipo="Vivienda"
      onTipoChange={jest.fn()}
    />,
  );
}

describe('TrendExplorer category breakdown keys', () => {
  it('renders one row per category+action without duplicate-key warnings', () => {
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    renderTrendExplorer();

    expect(screen.getAllByText('Hipoteca')).toHaveLength(2);
    expect(screen.getAllByText('Seguro')).toHaveLength(1);
    expect(screen.getAllByText('Gasto')).toHaveLength(2);
    expect(screen.getByText('Ingreso')).toBeInTheDocument();

    const dupKeyWarnings = errorSpy.mock.calls.filter((args) =>
      args.some((arg) => String(arg).includes('same key')),
    );
    expect(dupKeyWarnings).toHaveLength(0);

    errorSpy.mockRestore();
  });
});

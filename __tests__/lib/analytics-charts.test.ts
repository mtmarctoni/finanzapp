import {
  getDoughnutChartOptions,
  getTipoQueDoughnutData,
  type TipoQueDatum,
} from '@/lib/analytics-charts';

type Hook = {
  plugins: {
    title: { display: boolean; text: string };
    tooltip: {
      callbacks: {
        label: (ctx: {
          label?: string;
          raw?: unknown;
          dataset?: { data: unknown[] };
        }) => string;
      };
    };
  };
};

const euro = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
}).format;

describe('getTipoQueDoughnutData', () => {
  const tipoQueData: TipoQueDatum[] = [
    {
      type: 'Vivienda',
      category: 'Alquiler',
      action: 'Gasto',
      total: 800,
      count: 2,
    },
    {
      type: 'Vivienda',
      category: 'Comunidad',
      action: 'Gasto',
      total: -100,
      count: 1,
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
      action: 'Gasto',
      total: 999,
      count: 1,
    },
  ];

  it('keeps only the selected tipo and expense actions, with absolute totals', () => {
    const result = getTipoQueDoughnutData(tipoQueData, 'Vivienda');

    expect(result.labels).toEqual(['Alquiler', 'Comunidad']);
    expect(result.datasets[0].label).toBe('Gasto');
    expect(result.datasets[0].data).toEqual([800, 100]);
    expect(result.total).toBe(900);
  });

  it('returns empty buckets when the tipo has no expenses', () => {
    const result = getTipoQueDoughnutData(tipoQueData, 'Ocio');

    expect(result.labels).toEqual([]);
    expect(result.datasets[0].data).toEqual([]);
    expect(result.total).toBe(0);
  });
});

describe('getDoughnutChartOptions', () => {
  it('shows the total in the title', () => {
    const options = getDoughnutChartOptions(900, [
      { category: 'Alquiler', total: 800, count: 2, action: 'Gasto' },
    ]);

    const hooked = options as unknown as Hook;
    expect(hooked.plugins.title.display).toBe(true);
    expect(hooked.plugins.title.text).toBe(`Total: ${euro(900)}`);
  });

  it('formats tooltip labels with the percentage and movement count', () => {
    const options = getDoughnutChartOptions(900, [
      { category: 'Alquiler', total: 800, count: 2, action: 'Gasto' },
    ]);

    const hooked = options as unknown as Hook;
    const label = hooked.plugins.tooltip.callbacks.label({
      label: 'Alquiler',
      raw: 800,
      dataset: { data: [800, 100] },
    });

    expect(label).toContain(euro(800));
    expect(label).toContain('89%');
    expect(label).toContain('• 2 mov.');
  });
});

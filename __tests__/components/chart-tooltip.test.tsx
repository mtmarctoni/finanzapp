import { render, screen } from '@testing-library/react';

import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

jest.mock('recharts', () => {
  const OriginalRecharts = jest.requireActual('recharts');
  return {
    ...OriginalRecharts,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 800, height: 400 }}>{children}</div>
    ),
  };
});

const config = {
  ingreso: { label: 'Ingreso', color: 'hsl(120 70% 50%)' },
} satisfies ChartConfig;

describe('ChartTooltipContent label lookup', () => {
  it('falls back to the raw label when it is not present in the chart config', () => {
    render(
      <ChartContainer config={config}>
        <ChartTooltipContent
          active
          label="EtiquetaDesconocida"
          payload={[
            {
              dataKey: 'ingreso',
              name: 'ingreso',
              value: 100,
              payload: { ingreso: 100 },
            },
          ]}
        />
      </ChartContainer>,
    );

    expect(screen.getByText('EtiquetaDesconocida')).toBeInTheDocument();
  });

  it('uses the configured label when the label is present in the config', () => {
    render(
      <ChartContainer config={config}>
        <ChartTooltipContent
          active
          label="ingreso"
          payload={[
            {
              dataKey: 'ingreso',
              name: 'ingreso',
              value: 100,
              payload: { ingreso: 100 },
            },
          ]}
        />
      </ChartContainer>,
    );

    const matches = screen.getAllByText('Ingreso');
    expect(matches.length).toBeGreaterThan(0);
  });
});

import { render } from '@testing-library/react';

import { IntelligenceExplorer } from '@/components/analytics/IntelligenceExplorer';

describe('IntelligenceExplorer', () => {
  // Regression: commit 76ebf2b removed the optional chain on topPlatform
  // (platformBreakdown[0] is undefined when no tipo is selected), which made
  // /analytics crash during SSR/hydration with
  // "TypeError: Cannot read properties of undefined (reading 'platform')".
  it('mounts without crashing when no tipo is selected and platform data is empty', () => {
    const { getByText } = render(
      <IntelligenceExplorer
        categoryStats={[]}
        categoryPlatformData={[]}
        categoryData={[]}
        temporalData={[]}
        types={[]}
        loading={false}
      />,
    );
    expect(getByText('Inteligencia Financiera')).toBeInTheDocument();
  });

  it('mounts without crashing with real-shaped data before any selection', () => {
    expect(() =>
      render(
        <IntelligenceExplorer
          categoryStats={[
            {
              action: 'Gasto',
              category: 'Comida',
              type: 'Necesario',
              count: 3,
              avg: 10,
              min: 5,
              max: 15,
            },
          ]}
          categoryPlatformData={[]}
          categoryData={[
            {
              action: 'Gasto',
              category: 'Comida',
              type: 'Necesario',
              total: 30,
            },
          ]}
          temporalData={[{ period: '2026-01' }]}
          types={['Necesario']}
          loading={false}
        />,
      ),
    ).not.toThrow();
  });
});

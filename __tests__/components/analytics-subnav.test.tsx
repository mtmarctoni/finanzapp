import { render, screen } from '@testing-library/react';

import { AnalyticsSubnav } from '@/components/analytics/analytics-subnav';

const mockUsePathname = jest.fn(() => '/analytics/tipo');
const mockUseSearchParams = jest.fn(() => new URLSearchParams());
jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useSearchParams: () => mockUseSearchParams(),
}));

describe('AnalyticsSubnav', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePathname.mockReturnValue('/analytics/tipo');
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
  });

  it('renders both links and marks the current page as active', () => {
    render(<AnalyticsSubnav />);

    const general = screen.getByRole('link', { name: 'General' });
    const porTipo = screen.getByRole('link', { name: 'Por Tipo' });

    expect(general).toHaveAttribute('href', '/analytics');
    expect(general).not.toHaveAttribute('aria-current');
    expect(porTipo).toHaveAttribute('href', '/analytics/tipo');
    expect(porTipo).toHaveAttribute('aria-current', 'page');
  });

  it('preserves the query string when building the links', () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams('type=Salario&groupBy=year'),
    );

    render(<AnalyticsSubnav />);

    expect(screen.getByRole('link', { name: 'General' })).toHaveAttribute(
      'href',
      '/analytics?type=Salario&groupBy=year',
    );
    expect(screen.getByRole('link', { name: 'Por Tipo' })).toHaveAttribute(
      'href',
      '/analytics/tipo?type=Salario&groupBy=year',
    );
  });

  it('flips the active link when navigating to the general page', () => {
    mockUsePathname.mockReturnValue('/analytics');

    render(<AnalyticsSubnav />);

    expect(screen.getByRole('link', { name: 'General' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Por Tipo' })).not.toHaveAttribute(
      'aria-current',
    );
  });
});

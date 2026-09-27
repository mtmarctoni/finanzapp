import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { RecordForm } from '@/components/recurring/record-form';
import { INITIAL_RECURRING_FORM } from '@/components/recurring/types';

jest.mock('@/components/ui/combobox', () => ({
  Combobox: ({
    options,
    value,
    onChange,
    placeholder,
    loading,
  }: {
    options: string[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    loading?: boolean;
  }) => (
    <div>
      <button type="button" onClick={() => onChange('Salario')}>
        {value || placeholder}
      </button>
      <span data-testid="combobox-loading">{String(Boolean(loading))}</span>
      <ul data-testid="combobox-options">
        {options.map((option) => (
          <li key={option}>{option}</li>
        ))}
      </ul>
    </div>
  ),
}));

const mockFetch = jest.fn();

beforeAll(() => {
  global.fetch = mockFetch as unknown as typeof fetch;
});

const props = {
  formData: INITIAL_RECURRING_FORM,
  loading: false,
  isEditing: false,
  onChange: jest.fn(),
  onCancel: jest.fn(),
  onSubmit: jest.fn(),
};

function setOptions(tipo: string[]) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ tipo, que: [], plataforma_pago: [], quien: [] }),
  });
}

async function renderForm() {
  render(<RecordForm {...props} />);
  // Wait for the options request to settle so the list is populated.
  await waitFor(() => expect(mockFetch).toHaveBeenCalled());
  await waitFor(() =>
    expect(screen.getByTestId('combobox-loading')).toHaveTextContent('false'),
  );
}

function optionList() {
  return screen.getByTestId('combobox-options');
}

describe('RecordForm categoría dropdown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('offers the categories returned by the API, not a hardcoded list', async () => {
    // 'Salario' and 'Vivienda' were never in the old hardcoded CATEGORIES array,
    // so rendering them proves the list is now sourced from the database.
    setOptions(['Salario', 'Vivienda', 'Ocio']);

    await renderForm();

    const options = within(optionList()).getAllByRole('listitem');
    expect(options.map((o) => o.textContent)).toEqual([
      'Salario',
      'Vivienda',
      'Ocio',
    ]);
  });

  it('requests the shared options endpoint that both forms read', async () => {
    setOptions(['Ocio']);

    await renderForm();

    expect(mockFetch).toHaveBeenCalledWith('/api/options');
  });

  it('does not hardcode the legacy category list', async () => {
    setOptions(['Ocio']);

    await renderForm();

    // These came from the deleted types/categories.ts. If any reappear without
    // coming from the API, the hardcoded source has been reintroduced.
    expect(within(optionList()).queryByText('QFI')).not.toBeInTheDocument();
    expect(
      within(optionList()).queryByText('Cripto W'),
    ).not.toBeInTheDocument();
  });

  it('shows a loading state until options arrive', async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    mockFetch.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    render(<RecordForm {...props} />);

    expect(screen.getByTestId('combobox-loading')).toHaveTextContent('true');

    resolveFetch({
      ok: true,
      json: async () => ({ tipo: ['Ocio'] }),
    });

    await waitFor(() =>
      expect(screen.getByTestId('combobox-loading')).toHaveTextContent('false'),
    );
  });

  it('still renders the form when the options request fails', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));

    render(<RecordForm {...props} />);

    await waitFor(() =>
      expect(screen.getByTestId('combobox-loading')).toHaveTextContent('false'),
    );
    expect(screen.getByText('Crear registro recurrente')).toBeInTheDocument();
    expect(within(optionList()).queryAllByRole('listitem')).toHaveLength(0);
  });

  it('tolerates a response missing the tipo key', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

    await renderForm();

    expect(within(optionList()).queryAllByRole('listitem')).toHaveLength(0);
  });

  it('reports a newly chosen category to the parent', async () => {
    setOptions(['Salario']);
    const onChange = jest.fn();

    render(<RecordForm {...props} onChange={onChange} />);
    await waitFor(() =>
      expect(screen.getByTestId('combobox-loading')).toHaveTextContent('false'),
    );

    fireEvent.click(screen.getByRole('button', { name: /seleccionar/i }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'Salario' }),
    );
  });
});

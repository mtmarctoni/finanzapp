import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { getProviders, signIn, useSession } from 'next-auth/react';

import SignIn from '@/app/auth/signin/page';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams('callbackUrl=/records'),
}));
jest.mock('next-auth/react', () => ({
  getProviders: jest.fn(),
  signIn: jest.fn(),
  useSession: jest.fn(),
}));

const providers = jest.mocked(getProviders);
const login = jest.mocked(signIn);
const session = jest.mocked(useSession);
const fetchMock = jest.fn();
const publicDemo = { email: 'test@example.com', password: 'password123' };

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock;
  providers.mockResolvedValue({
    credentials: {
      id: 'credentials',
      name: 'Credentials',
      type: 'credentials',
      signinUrl: '',
      callbackUrl: '',
    },
  } as Awaited<ReturnType<typeof getProviders>>);
  session.mockReturnValue({
    data: null,
    status: 'unauthenticated',
    update: jest.fn(),
  });
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ demo: publicDemo }),
  });
  login.mockResolvedValue({
    error: null,
    status: 200,
    ok: true,
    url: '/records',
  });
});

it('fills only on shortcut activation, then submits with the existing callback', async () => {
  render(<SignIn />);
  const shortcut = await screen.findByRole('button', {
    name: 'Usar usuario de prueba',
  });
  expect(screen.getByLabelText('Correo electrónico')).toHaveValue('');
  expect(screen.getByText(/Los datos son compartidos/)).toBeInTheDocument();
  fireEvent.click(shortcut);
  expect(screen.getByLabelText('Correo electrónico')).toHaveValue(
    publicDemo.email,
  );
  expect(screen.getByLabelText('Contraseña')).toHaveValue(publicDemo.password);
  expect(login).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
  await waitFor(() =>
    expect(login).toHaveBeenCalledWith('credentials', {
      redirect: false,
      ...publicDemo,
      callbackUrl: '/records',
    }),
  );
  await waitFor(() => expect(push).toHaveBeenCalledWith('/records'));
});

it.each(['http://localhost/server-callback', null])(
  'navigates to the returned success URL or callback fallback: %s',
  async (url) => {
    login.mockResolvedValue({ error: null, status: 200, ok: true, url });
    render(<SignIn />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Usar usuario de prueba' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(url ?? '/records'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Iniciar sesión' }),
    ).toBeEnabled();
  },
);

it.each(['no-demo', 'metadata-error', 'metadata-rejected'])(
  'keeps ordinary credentials without a hint: %s',
  async (mode) => {
    if (mode === 'no-demo')
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ demo: null }),
      });
    if (mode === 'metadata-error')
      fetchMock.mockRejectedValue(new Error('offline'));
    if (mode === 'metadata-rejected')
      fetchMock.mockResolvedValue({ ok: false });
    render(<SignIn />);
    await screen.findByLabelText('Correo electrónico');
    await act(async () => {});
    expect(
      screen.queryByRole('button', { name: 'Usar usuario de prueba' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/test@example.com/)).not.toBeInTheDocument();
  },
);

it.each(['production', 'null', 'discovery-failure'])(
  'hides the form and does not request demo metadata: %s',
  async (mode) => {
    if (mode === 'production')
      providers.mockResolvedValue(
        {} as Awaited<ReturnType<typeof getProviders>>,
      );
    if (mode === 'null') providers.mockResolvedValue(null);
    if (mode === 'discovery-failure')
      providers.mockRejectedValue(new Error('offline'));
    render(<SignIn />);
    await act(async () => {});
    expect(
      screen.queryByLabelText('Correo electrónico'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Demo')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

it('disables the shortcut, fields and both login buttons while submitting and displays credential errors', async () => {
  let resolve!: (value: {
    error: string;
    status: number;
    ok: boolean;
    url: null;
  }) => void;
  login.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  render(<SignIn />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Usar usuario de prueba' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
  expect(
    screen.getByRole('button', { name: 'Usar usuario de prueba' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Continuar con GitHub' }),
  ).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeDisabled();
  expect(screen.getByLabelText('Contraseña')).toBeDisabled();
  expect(login).toHaveBeenCalledWith('credentials', {
    redirect: false,
    ...publicDemo,
    callbackUrl: '/records',
  });
  await act(async () =>
    resolve({ error: 'CredentialsSignin', status: 401, ok: false, url: null }),
  );
  expect(screen.getByRole('alert')).toHaveTextContent('Credenciales inválidas');
  expect(push).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Correo electrónico')).toHaveValue(
    publicDemo.email,
  );
  expect(screen.getByLabelText('Contraseña')).toHaveValue(publicDemo.password);
  expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled();
  expect(screen.getByLabelText('Contraseña')).toBeEnabled();
  fireEvent.click(
    screen.getByRole('button', { name: 'Usar usuario de prueba' }),
  );
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('shows network login errors and allows retry', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  login.mockRejectedValue(new Error('offline'));
  render(<SignIn />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Usar usuario de prueba' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Error al iniciar sesión',
  );
  expect(
    screen.getByRole('button', { name: 'Usar usuario de prueba' }),
  ).toBeEnabled();
  expect(push).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Contraseña')).toHaveValue(publicDemo.password);
  log.mockRestore();
});

it('does not navigate on an unsuccessful response without an error code', async () => {
  login.mockResolvedValue({
    error: null,
    status: 500,
    ok: false,
    url: null,
  });
  render(<SignIn />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Usar usuario de prueba' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Credenciales inválidas',
  );
  expect(push).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled();
});

it('keeps the authenticated session callback redirect', async () => {
  session.mockReturnValue({
    data: { user: { id: 'demo', email: publicDemo.email }, expires: '' },
    status: 'authenticated',
    update: jest.fn(),
  });
  render(<SignIn />);
  await waitFor(() => expect(push).toHaveBeenCalledWith('/records'));
});

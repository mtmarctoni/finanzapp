import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getProviders, signIn, useSession } from 'next-auth/react';

import SignIn from '../../app/auth/signin/page';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock('next-auth/react', () => ({
  getProviders: jest.fn(),
  signIn: jest.fn(),
  useSession: jest.fn(),
}));

describe('sign-in demo', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.replaceProperty(process, 'env', {
      ...process.env,
      VERCEL_ENV: 'preview',
    });
    (useRouter as jest.Mock).mockReturnValue({ push: jest.fn() });
    (useSearchParams as jest.Mock).mockReturnValue(
      new URLSearchParams('callbackUrl=/records'),
    );
    (useSession as jest.Mock).mockReturnValue({ data: null });
    (getProviders as jest.Mock).mockResolvedValue({ credentials: {} });
  });

  afterEach(() => jest.restoreAllMocks());

  it('prefills the preview credentials and submits through the existing sign-in flow', async () => {
    (signIn as jest.Mock).mockResolvedValue(undefined);
    render(SignIn());

    expect(await screen.findByRole('region', { name: 'Demo' })).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'Usar usuario de prueba' }),
    );
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue(
      'test@example.com',
    );
    expect(screen.getByLabelText('Contraseña')).toHaveValue('password123');
    expect(signIn).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith('credentials', {
        redirect: true,
        email: 'test@example.com',
        password: 'password123',
        callbackUrl: '/records',
      }),
    );
  });

  it('hides the demo and credentials form in production', async () => {
    process.env.VERCEL_ENV = 'production';
    (getProviders as jest.Mock).mockResolvedValue({ github: {} });
    render(SignIn());
    await waitFor(() => expect(getProviders).toHaveBeenCalled());

    expect(
      screen.queryByRole('region', { name: 'Demo' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Correo electrónico'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/test@example.com/)).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Continuar con GitHub' }),
    ).toBeVisible();
  });

  it.each(['development', undefined])(
    'preserves local credentials without the demo (%s)',
    async (environment) => {
      if (environment) process.env.VERCEL_ENV = environment;
      else delete process.env.VERCEL_ENV;
      render(SignIn());

      expect(await screen.findByLabelText('Correo electrónico')).toBeVisible();
      expect(screen.getByText('Acceso de desarrollo')).toBeVisible();
      expect(
        screen.queryByRole('region', { name: 'Demo' }),
      ).not.toBeInTheDocument();
    },
  );

  it('does not advertise demo login when the preview provider is unavailable', async () => {
    (getProviders as jest.Mock).mockResolvedValue({ github: {} });
    render(SignIn());
    await waitFor(() => expect(getProviders).toHaveBeenCalled());

    expect(
      screen.queryByRole('region', { name: 'Demo' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Correo electrónico'),
    ).not.toBeInTheDocument();
  });

  it('keeps demo controls disabled while sign-in is pending', async () => {
    let finishSignIn!: () => void;
    (signIn as jest.Mock).mockReturnValue(
      new Promise<void>((resolve) => {
        finishSignIn = resolve;
      }),
    );
    render(SignIn());
    const demoButton = await screen.findByRole('button', {
      name: 'Usar usuario de prueba',
    });
    fireEvent.click(demoButton);
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(demoButton).toBeDisabled();
    finishSignIn();
    await waitFor(() => expect(demoButton).toBeEnabled());
  });
});

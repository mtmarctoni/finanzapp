import { act, render, screen } from '@testing-library/react';

import { ChatWidget } from '@/components/ai/ChatWidget';
import { openChat } from '@/components/ai/chat-events';

let mockChatError: Error | undefined;

jest.mock('@ai-sdk/react', () => ({
  useChat: () => ({
    messages: [],
    status: 'ready',
    error: mockChatError,
    sendMessage: jest.fn(),
    setMessages: jest.fn(),
    clearError: jest.fn(),
  }),
}));

jest.mock('ai', () => ({
  DefaultChatTransport: jest.fn(),
}));

jest.mock('next-auth/react', () => ({
  useSession: () => ({ status: 'authenticated', data: null }),
}));

jest.mock('@/components/ai/PaidFallbackDialog', () => ({
  PaidFallbackDialog: () => null,
}));

describe('ChatWidget', () => {
  beforeEach(() => {
    mockChatError = undefined;
  });
  beforeAll(() => {
    Element.prototype.scrollIntoView = jest.fn();
  });

  it('gives the message input an accessible name', () => {
    render(<ChatWidget />);
    act(() => openChat());

    expect(
      screen.getByRole('textbox', { name: 'Mensaje para el asistente' }),
    ).toBeInTheDocument();
  });

  it('displays the disabled message without raw JSON and offers manual entry', () => {
    const message = 'La IA está deshabilitada en esta demo.';
    mockChatError = new Error(
      JSON.stringify({
        code: 'PREVIEW_AI_DISABLED',
        error: message,
      }),
    );
    render(<ChatWidget />);
    act(() => openChat());

    expect(screen.getByText(`Error: ${message}`)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Añadir entrada manualmente' }),
    ).toHaveAttribute('href', '/new');
    expect(screen.queryByText(/PREVIEW_AI_DISABLED/)).not.toBeInTheDocument();
  });
});

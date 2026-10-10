import { act, render, screen } from '@testing-library/react';

import { ChatWidget } from '@/components/ai/ChatWidget';
import { openChat } from '@/components/ai/chat-events';

jest.mock('@ai-sdk/react', () => ({
  useChat: () => ({
    messages: [],
    status: 'ready',
    error: undefined,
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
});

/** Lets any control open the chat widget without sharing React state. */
export const OPEN_CHAT_EVENT = 'finanzapp:open-chat';

export function openChat() {
  window.dispatchEvent(new Event(OPEN_CHAT_EVENT));
}

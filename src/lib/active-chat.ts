/**
 * Tracks the conversation the user is currently viewing.
 *
 * Used by the foreground "ping" pipeline (haptic + local notification on
 * incoming message): we want to alert when a message arrives in any chat
 * EXCEPT the one already on screen — playing a sound while the user is
 * actively reading the chat would be obnoxious.
 *
 * Held in module scope (not zustand) so the realtime listener in the tab
 * layout can read it synchronously without subscribing — we only need a
 * point-in-time check, never a re-render trigger.
 */

let activeConversationId: string | null = null;

export function setActiveConversation(id: string | null): void {
  activeConversationId = id;
}

export function getActiveConversation(): string | null {
  return activeConversationId;
}

export function isViewingConversation(id: string | null | undefined): boolean {
  if (!id || !activeConversationId) return false;
  return activeConversationId === id;
}

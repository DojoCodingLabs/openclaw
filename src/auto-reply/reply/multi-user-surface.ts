import { normalizeChatType } from "../../channels/chat-type.js";

/**
 * Signals that identify whether a reply is being rendered onto a surface that
 * more than one participant can read (DOJ-5368).
 *
 * `groupId` is set by {@link resolveGroupSessionKey} for both `group` and
 * `channel` chat types and left undefined for direct messages, so either signal
 * on its own is sufficient. Callers pass whichever they have in scope. `chatType`
 * accepts a raw string (e.g. `ctx.ChatType`) and is normalized here.
 */
export interface MultiUserSurfaceSignals {
  groupId?: string | null;
  chatType?: string | null;
}

/**
 * True when the reply egress is a shared (group/channel) surface.
 *
 * Diagnostic directives (`/verbose`, `/trace`, `/reasoning`) are keyed on the
 * per-channel group session, not per participant, so their output must never be
 * broadcast to a shared surface — one member enabling them would otherwise
 * expose raw exec commands and internal reasoning to everyone in the channel.
 * Direct messages (`chatType === "direct"`, no `groupId`) return false and keep
 * their existing behaviour unchanged.
 */
export function isMultiUserSurface(signals: MultiUserSurfaceSignals): boolean {
  if (typeof signals.groupId === "string" && signals.groupId.length > 0) {
    return true;
  }
  const chatType = signals.chatType == null ? undefined : normalizeChatType(signals.chatType);
  return chatType === "group" || chatType === "channel";
}

import { describe, expect, it } from "vitest";
import { isMultiUserSurface } from "./multi-user-surface.js";

describe("isMultiUserSurface (DOJ-5368)", () => {
  it("treats direct messages as single-user", () => {
    expect(isMultiUserSurface({ chatType: "direct" })).toBe(false);
    expect(isMultiUserSurface({ chatType: "direct", groupId: undefined })).toBe(false);
    expect(isMultiUserSurface({})).toBe(false);
    expect(isMultiUserSurface({ groupId: "" })).toBe(false);
    expect(isMultiUserSurface({ groupId: null, chatType: null })).toBe(false);
  });

  it("treats group and channel chat types as multi-user", () => {
    expect(isMultiUserSurface({ chatType: "group" })).toBe(true);
    expect(isMultiUserSurface({ chatType: "channel" })).toBe(true);
  });

  it("normalizes raw chat-type aliases", () => {
    expect(isMultiUserSurface({ chatType: "GROUP" })).toBe(true);
    expect(isMultiUserSurface({ chatType: "dm" })).toBe(false);
  });

  it("treats a populated groupId as multi-user regardless of chat type", () => {
    expect(isMultiUserSurface({ groupId: "whatsapp:group:g1" })).toBe(true);
    // A group session key present but chatType still reported as direct must
    // still gate — groupId is set only for shared surfaces.
    expect(isMultiUserSurface({ groupId: "g1", chatType: "direct" })).toBe(true);
  });
});

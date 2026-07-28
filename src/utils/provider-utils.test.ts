import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveProviderReasoningOutputModeWithPluginMock } = vi.hoisted(() => ({
  resolveProviderReasoningOutputModeWithPluginMock: vi.fn(),
}));

vi.mock("../plugins/provider-runtime.js", async () => {
  const actual = await vi.importActual<typeof import("../plugins/provider-runtime.js")>(
    "../plugins/provider-runtime.js",
  );
  return {
    ...actual,
    resolveProviderReasoningOutputModeWithPlugin: resolveProviderReasoningOutputModeWithPluginMock,
  };
});

import { isReasoningTagProvider, resolveReasoningOutputMode } from "./provider-utils.js";

describe("resolveReasoningOutputMode", () => {
  beforeEach(() => {
    resolveProviderReasoningOutputModeWithPluginMock.mockReset();
    resolveProviderReasoningOutputModeWithPluginMock.mockReturnValue(undefined);
  });

  it.each([["google-generative-ai", "tagged"]] as const)(
    "falls back to the built-in map for %s",
    (provider, expected) => {
      expect(resolveReasoningOutputMode({ provider, workspaceDir: process.cwd() })).toBe(expected);
      expect(resolveProviderReasoningOutputModeWithPluginMock).toHaveBeenCalledTimes(1);
    },
  );

  // Gemini 3.x streams native `thought` parts. Asking it for <think> tags on top
  // made it narrate the tag instruction as prose, leaking the chain-of-thought
  // (and internal tool names) into the answer.
  it.each([
    ["gemini-3.6-flash", "native"],
    ["gemini-3-flash", "native"],
    ["gemini-3.1-pro-preview", "native"],
    ["gemini-2.5-flash", "tagged"],
    ["gemini-2.5-flash-lite", "tagged"],
  ] as const)("built-in map resolves %s to %s", (modelId, expected) => {
    expect(
      resolveReasoningOutputMode({
        provider: "google-generative-ai",
        modelId,
        workspaceDir: process.cwd(),
      }),
    ).toBe(expected);
  });

  it("keeps the built-in tagged mode when no model is known", () => {
    expect(
      resolveReasoningOutputMode({ provider: "google-generative-ai", workspaceDir: process.cwd() }),
    ).toBe("tagged");
  });

  it.each([
    ["google", "tagged"],
    ["Google", "tagged"],
    ["google-gemini-cli", "tagged"],
    ["anthropic", "native"],
    ["openai", "native"],
    ["openrouter", "native"],
    ["ollama", "native"],
    ["minimax", "native"],
    ["minimax-cn", "native"],
  ] as const)("prefers provider hooks for %s", (provider, expected) => {
    resolveProviderReasoningOutputModeWithPluginMock.mockReturnValueOnce(expected);

    expect(resolveReasoningOutputMode({ provider, workspaceDir: process.cwd() })).toBe(expected);
    expect(resolveProviderReasoningOutputModeWithPluginMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to provider hooks for unknown providers", () => {
    resolveProviderReasoningOutputModeWithPluginMock.mockReturnValue("tagged");

    expect(
      resolveReasoningOutputMode({
        provider: "custom-provider",
        workspaceDir: process.cwd(),
        modelId: "custom/model",
      }),
    ).toBe("tagged");
    expect(resolveProviderReasoningOutputModeWithPluginMock).toHaveBeenCalledTimes(1);
  });

  it("returns native when hooks do not provide an override", () => {
    expect(resolveReasoningOutputMode({ provider: "custom-provider" })).toBe("native");
    expect(resolveProviderReasoningOutputModeWithPluginMock).toHaveBeenCalledTimes(1);
  });
});

describe("isReasoningTagProvider", () => {
  beforeEach(() => {
    resolveProviderReasoningOutputModeWithPluginMock.mockReset();
    resolveProviderReasoningOutputModeWithPluginMock.mockReturnValue(undefined);
  });

  it.each([
    ["google-generative-ai", true],
    [null, false],
    [undefined, false],
    ["", false],
  ] as const)("returns %s for %s", (value, expected) => {
    expect(isReasoningTagProvider(value, { workspaceDir: process.cwd() })).toBe(expected);
  });

  it.each([
    ["google", true],
    ["Google", true],
    ["google-gemini-cli", true],
    ["anthropic", false],
    ["openai", false],
    ["openrouter", false],
    ["ollama", false],
    ["minimax", false],
    ["minimax-cn", false],
  ] as const)("uses provider hooks when available for %s", (value, expected) => {
    resolveProviderReasoningOutputModeWithPluginMock.mockReturnValueOnce(
      expected ? "tagged" : "native",
    );

    expect(isReasoningTagProvider(value, { workspaceDir: process.cwd() })).toBe(expected);
    expect(resolveProviderReasoningOutputModeWithPluginMock).toHaveBeenCalledTimes(1);
  });
});

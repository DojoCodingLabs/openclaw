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

describe("resolveReasoningOutputMode — Gemini-3 native thought routing (P1 leak/loop fix)", () => {
  beforeEach(() => {
    resolveProviderReasoningOutputModeWithPluginMock.mockReset();
    resolveProviderReasoningOutputModeWithPluginMock.mockReturnValue(undefined);
  });

  it.each(["gemini-3.5-flash", "gemini-3.1-pro-preview", "google/gemini-3.5-flash"] as const)(
    "returns native for Gemini-3 thinking-level model %s instead of the manual tag protocol",
    (modelId) => {
      expect(
        resolveReasoningOutputMode({
          provider: "google-generative-ai",
          modelId,
          workspaceDir: process.cwd(),
        }),
      ).toBe("native");
    },
  );

  it("keeps tagged for non-Gemini-3 google-generative-ai models", () => {
    expect(
      resolveReasoningOutputMode({
        provider: "google-generative-ai",
        modelId: "gemini-2.5-flash",
        workspaceDir: process.cwd(),
      }),
    ).toBe("tagged");
  });

  it("isReasoningTagProvider is false for Gemini-3 flash (native, not tagged)", () => {
    expect(
      isReasoningTagProvider("google-generative-ai", {
        modelId: "gemini-3.5-flash",
        workspaceDir: process.cwd(),
      }),
    ).toBe(false);
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

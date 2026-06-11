import type { OpenClawConfig } from "../config/types.openclaw.js";
import type { ProviderRuntimeModel } from "../plugins/provider-runtime-model.types.js";
import { resolveProviderReasoningOutputModeWithPlugin } from "../plugins/provider-runtime.js";
import {
  normalizeOptionalLowercaseString,
  normalizeOptionalString,
} from "../shared/string-coerce.js";

const BUILTIN_REASONING_OUTPUT_MODES = {
  "google-generative-ai": "tagged",
} as const;

// Gemini-3 thinking-level model ids (flash + pro). Kept in sync with
// isGoogleGemini3ThinkingLevelModel in ../plugin-sdk/provider-stream-shared.ts;
// inlined here to keep this low-level util free of the heavier plugin-sdk import graph.
const GEMINI_3_THINKING_LEVEL_MODEL_ID =
  /(?:^|\/)gemini-(?:3(?:\.\d+)?-flash|3(?:\.\d+)?-pro|flash(?:-lite)?-latest|pro-latest)(?:-|$)/;

function isGemini3ThinkingLevelModelId(modelId?: string): boolean {
  const normalized = normalizeOptionalLowercaseString(modelId);
  return Boolean(normalized) && GEMINI_3_THINKING_LEVEL_MODEL_ID.test(normalized as string);
}

/**
 * Utility functions for provider-specific logic and capabilities.
 */

export function resolveReasoningOutputMode(params: {
  provider: string | undefined | null;
  config?: OpenClawConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  modelId?: string;
  modelApi?: string | null;
  model?: ProviderRuntimeModel;
}): "native" | "tagged" {
  const provider = normalizeOptionalString(params.provider);
  if (!provider) {
    return "native";
  }

  // Gemini-3 thinking-level models (gemini-3.x-flash / -pro) expose reasoning via
  // native thought parts (thinkingConfig.includeThoughts) that pi-ai routes to the
  // reasoning channel — NOT the manual <think>/<final> tag protocol. Forcing "tagged"
  // makes gemini-3.5-flash dump chain-of-thought as prose (P1 reasoning leak) and never
  // emit <final>, so the turn reads as reasoning-only/incomplete and the loop retries to
  // max-iter, never sending [DONE] ("failed to send"). Return "native" to skip the tag
  // protocol; includeThoughts (provider-stream-shared.ts) feeds the reasoning channel.
  if (isGemini3ThinkingLevelModelId(params.modelId)) {
    return "native";
  }

  const normalized = normalizeOptionalLowercaseString(provider) ?? "";
  const pluginMode = resolveProviderReasoningOutputModeWithPlugin({
    provider,
    config: params.config,
    workspaceDir: params.workspaceDir,
    env: params.env,
    context: {
      config: params.config,
      workspaceDir: params.workspaceDir,
      env: params.env,
      provider,
      modelId: params.modelId,
      modelApi: params.modelApi,
      model: params.model,
    },
  });
  if (pluginMode) {
    return pluginMode;
  }

  const builtInMode =
    BUILTIN_REASONING_OUTPUT_MODES[normalized as keyof typeof BUILTIN_REASONING_OUTPUT_MODES];
  if (builtInMode) {
    return builtInMode;
  }

  // Keep a tiny built-in fallback for non-plugin Google surfaces.
  return "native";
}

/**
 * Returns true if the provider requires reasoning to be wrapped in tags
 * (e.g. <think> and <final>) in the text stream, rather than using native
 * API fields for reasoning/thinking.
 */
export function isReasoningTagProvider(
  provider: string | undefined | null,
  options?: {
    config?: OpenClawConfig;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
    modelId?: string;
    modelApi?: string | null;
    model?: ProviderRuntimeModel;
  },
): boolean {
  return (
    resolveReasoningOutputMode({
      provider,
      config: options?.config,
      workspaceDir: options?.workspaceDir,
      env: options?.env,
      modelId: options?.modelId,
      modelApi: options?.modelApi,
      model: options?.model,
    }) === "tagged"
  );
}

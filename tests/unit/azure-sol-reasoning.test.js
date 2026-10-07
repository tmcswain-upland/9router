import { describe, expect, it } from "vitest";
import "../translator/registerAll.js";
import { applyThinking } from "../../open-sse/translator/concerns/thinkingUnified.js";
import { FORMATS } from "../../open-sse/translator/formats.js";

describe("Azure Sol explicit reasoning effort", () => {
  it("preserves high effort for Azure Sol Chat Completions", () => {
    const responseFormat = { type: "json_schema", json_schema: { name: "plan_delta", strict: true, schema: { type: "object" } } };
    const body = { reasoning_effort: "high", response_format: responseFormat, stream: false };
    const result = applyThinking(FORMATS.OPENAI, "gpt-6.1-sol", body, "azure");
    expect(result.reasoning_effort).toBe("high");
    expect(result.response_format).toEqual(responseFormat);
    expect(result.stream).toBe(false);
  });

  it("keeps the conservative reasoning floor for unknown Azure models", () => {
    const result = applyThinking(FORMATS.OPENAI, "unknown-azure-model", { reasoning_effort: "high" }, "azure");
    expect(result.reasoning_effort).toBeUndefined();
  });
});

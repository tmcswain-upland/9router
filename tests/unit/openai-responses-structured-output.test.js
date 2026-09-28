import { describe, expect, it } from "vitest";
import { openaiToOpenAIResponsesRequest } from "../../open-sse/translator/request/openai-responses.js";

describe("OpenAI Chat structured output to Responses translation", () => {
  it("preserves a json_schema response format as native Responses text.format", () => {
    const schema = {
      type: "object",
      additionalProperties: false,
      required: ["result"],
      properties: { result: { type: "string", enum: ["ok"] } }
    };
    const body = {
      messages: [{ role: "user", content: "Return the result." }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "result_contract",
          strict: true,
          schema
        }
      }
    };

    const translated = openaiToOpenAIResponsesRequest("cx/gpt-6-luna", body, false, null);

    expect(translated.text).toEqual({
      format: {
        type: "json_schema",
        name: "result_contract",
        strict: true,
        schema
      }
    });
    expect(translated.text.format.schema).toBe(schema);
  });

  it("does not invent a structured-output field when response_format is absent", () => {
    const translated = openaiToOpenAIResponsesRequest(
      "cx/gpt-6-luna",
      { messages: [{ role: "user", content: "Hello." }] },
      false,
      null
    );

    expect(translated).not.toHaveProperty("text");
  });

  it("leaves an ordinary native Responses request on the existing passthrough path", () => {
    const body = {
      model: "cx/gpt-6-luna",
      input: "Hello.",
      text: { verbosity: "low" },
      store: false
    };

    const translated = openaiToOpenAIResponsesRequest("cx/gpt-6-luna", body, false, null);

    expect(translated).toEqual({ ...body, model: "cx/gpt-6-luna", stream: true });
  });
});

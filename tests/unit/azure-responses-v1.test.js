import { beforeEach, describe, expect, it, vi } from "vitest";

const { proxyAwareFetchMock } = vi.hoisted(() => ({
  proxyAwareFetchMock: vi.fn(),
}));

vi.mock("../../open-sse/utils/proxyFetch.js", () => ({
  proxyAwareFetch: proxyAwareFetchMock,
}));

vi.mock("@/lib/usageDb.js", () => ({
  trackPendingRequest: vi.fn(),
  appendRequestLog: vi.fn(async () => {}),
  saveRequestDetail: vi.fn(async () => {}),
}));

const { handleChatCore } = await import("../../open-sse/handlers/chatCore.js");
const { AzureExecutor } = await import("../../open-sse/executors/azure.js");
const { maskSensitiveHeaders } = await import("../../open-sse/utils/requestLogger.js");

const endpoint = "https://resource.example.openai.azure.com";
const connectionSecret = "azure-connection-secret-for-test";
const personalToken = "personal-openai-token-for-test";
const deployment = "gpt-6-luna-production";

function makeCredentials(apiVersion = "v1") {
  return {
    apiKey: connectionSecret,
    // If native routing accidentally falls back to personal/OAuth auth, this
    // sentinel makes the mistake visible without using a real credential.
    accessToken: personalToken,
    providerSpecificData: {
      azureEndpoint: endpoint,
      deployment,
      apiVersion,
    },
  };
}

function makeLog() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

async function runAzureResponses(body) {
  const response = await handleChatCore({
    body,
    modelInfo: { provider: "azure", model: "gpt-6-luna" },
    credentials: makeCredentials(),
    log: makeLog(),
    connectionId: "azure-test-connection",
    sourceFormatOverride: "openai-responses",
    clientRawRequest: {
      endpoint: "/v1/responses",
      body,
      headers: { "user-agent": "codex-cli/0.155.0-alpha.16.4" },
    },
    rtkEnabled: false,
    headroomEnabled: false,
    cavemanEnabled: false,
    ponytailEnabled: false,
    pxpipeEnabled: false,
  });
  return response;
}

describe("Azure native Responses API v1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends text.verbosity and other Responses fields natively to /openai/v1/responses", async () => {
    proxyAwareFetchMock.mockResolvedValue(new Response(JSON.stringify({
      id: "resp_json",
      object: "response",
      status: "completed",
      output: [],
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const body = {
      model: "gpt-6-luna",
      input: [{ role: "user", content: [{ type: "input_text", text: "Say hello" }] }],
      instructions: "Be concise.",
      text: { verbosity: "high" },
      reasoning: { effort: "low", summary: "auto" },
      tools: [{ type: "function", name: "lookup", parameters: { type: "object" } }],
      store: true,
      stream: false,
    };

    const result = await runAzureResponses(body);
    const [url, init] = proxyAwareFetchMock.mock.calls[0];
    const sentBody = JSON.parse(init.body);
    const returnedBody = await result.response.json();

    expect(result.success).toBe(true);
    expect(url).toBe(`${endpoint}/openai/v1/responses`);
    expect(new URL(url).search).toBe("");
    expect(sentBody).toMatchObject({
      input: body.input,
      instructions: body.instructions,
      text: body.text,
      reasoning: body.reasoning,
      tools: body.tools,
      store: true,
      stream: false,
      model: deployment,
    });
    expect(sentBody.messages).toBeUndefined();
    expect(init.headers["api-key"]).toBe(connectionSecret);
    expect(init.headers.Authorization).toBeUndefined();
    expect(JSON.stringify(returnedBody)).not.toContain(connectionSecret);
    expect(JSON.stringify(returnedBody)).not.toContain(personalToken);
  });

  it("forwards native Azure Responses streaming through response.completed", async () => {
    const nativeEvents = [
      "event: response.created\ndata: {\"type\":\"response.created\",\"response\":{\"id\":\"resp_stream\",\"status\":\"in_progress\"}}\n\n",
      "event: response.completed\ndata: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp_stream\",\"status\":\"completed\",\"output\":[]}}\n\n",
    ].join("");
    proxyAwareFetchMock.mockResolvedValue(new Response(nativeEvents, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    }));

    const result = await runAzureResponses({
      model: "gpt-6-luna",
      input: "Say hello",
      text: { verbosity: "high" },
      stream: true,
    });
    const streamed = await result.response.text();

    expect(result.success).toBe(true);
    expect(streamed).toContain("event: response.completed");
    expect(streamed).toContain('"type":"response.completed"');
    expect(proxyAwareFetchMock.mock.calls[0][0]).toBe(`${endpoint}/openai/v1/responses`);
  });

  it("keeps v1 Azure Chat Completions on the existing deployment route", () => {
    const executor = new AzureExecutor();

    expect(executor.buildUrl("gpt-6-luna", false, 0, makeCredentials(), "openai")).toBe(
      `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=v1`,
    );
  });

  it("adds the v1 path to project endpoints and avoids duplicating it when configured", () => {
    const executor = new AzureExecutor();
    const projectCredentials = makeCredentials();
    projectCredentials.providerSpecificData.azureEndpoint = "https://project.example.services.ai.azure.com/api/projects/ai-pan";
    const v1Credentials = makeCredentials();
    v1Credentials.providerSpecificData.azureEndpoint = `${endpoint}/openai/v1`;

    expect(executor.buildUrl("gpt-6-sol", false, 0, projectCredentials, "openai-responses")).toBe(
      "https://project.example.services.ai.azure.com/api/projects/ai-pan/openai/v1/responses",
    );
    expect(executor.buildUrl("gpt-6-luna", false, 0, v1Credentials, "openai-responses")).toBe(
      `${endpoint}/openai/v1/responses`,
    );
  });

  it("redacts Azure api-key and authorization headers before request logging", () => {
    const loggedHeaders = maskSensitiveHeaders({
      "api-key": connectionSecret,
      Authorization: `Bearer ${personalToken}`,
      "Content-Type": "application/json",
    });

    expect(loggedHeaders).toEqual({
      "api-key": "[REDACTED]",
      Authorization: "[REDACTED]",
      "Content-Type": "application/json",
    });
    expect(JSON.stringify(loggedHeaders)).not.toContain(connectionSecret);
    expect(JSON.stringify(loggedHeaders)).not.toContain(personalToken);
  });
});

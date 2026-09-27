import { DefaultExecutor } from "./default.js";
import { supportsAzureResponsesV1 } from "../services/azureResponses.js";
import { FORMATS } from "../translator/formats.js";

export class AzureExecutor extends DefaultExecutor {
  constructor() {
    super("azure");
  }

  buildUrl(model, stream, urlIndex = 0, credentials = null, requestFormat = null) {
    const azureEndpoint = credentials?.providerSpecificData?.azureEndpoint
      || process.env.AZURE_ENDPOINT
      || "https://api.openai.com";

    const deployment = credentials?.providerSpecificData?.deployment
      || model
      || process.env.AZURE_DEPLOYMENT
      || "gpt-4";

    const endpoint = azureEndpoint.replace(/\/$/, "");

    if (requestFormat === FORMATS.OPENAI_RESPONSES && supportsAzureResponsesV1(credentials)) {
      return endpoint.toLowerCase().endsWith("/openai/v1")
        ? `${endpoint}/responses`
        : `${endpoint}/openai/v1/responses`;
    }

    // Azure AI Foundry /openai/v1 endpoint (standard OpenAI compatibility route, no api-version query param)
    if (endpoint.includes("/openai/v1")) {
      return `${endpoint}/chat/completions`;
    }

    // Azure AI Foundry / Serverless Model Inference (e.g. services.ai.azure.com/models or models.ai.azure.com)
    if (endpoint.includes("/models") || endpoint.includes("services.ai.azure.com") || endpoint.includes("models.ai.azure.com")) {
      const apiVersion = credentials?.providerSpecificData?.apiVersion
        || process.env.AZURE_API_VERSION
        || "2024-05-01-preview";
      return `${endpoint}/chat/completions?api-version=${apiVersion}`;
    }

    // Azure OpenAI standard endpoint (e.g. *.openai.azure.com)
    const apiVersion = credentials?.providerSpecificData?.apiVersion
      || process.env.AZURE_API_VERSION
      || "2024-10-01-preview";
    return `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  }

  buildHeaders(credentials, stream = true, url, model, requestFormat = null) {
    const headers = {
      "Content-Type": "application/json",
      ...this.config.headers
    };

    const nativeResponsesV1 = requestFormat === FORMATS.OPENAI_RESPONSES && supportsAzureResponsesV1(credentials);
    if (nativeResponsesV1) {
      // Azure v1 uses the connection's api-key header. Never fall back to a
      // personal OpenAI key or an access token for this native request.
      for (const key of Object.keys(headers)) {
        if (["authorization", "api-key"].includes(key.toLowerCase())) delete headers[key];
      }
      if (credentials?.apiKey) headers["api-key"] = credentials.apiKey;
    } else {
      const apiKey = credentials?.apiKey
        || credentials?.accessToken
        || process.env.OPENAI_API_KEY;
      if (apiKey) {
        headers["api-key"] = apiKey;
        headers["Authorization"] = `Bearer ${apiKey}`;
      }
    }

    const deployment = credentials?.providerSpecificData?.deployment;
    if (deployment && !nativeResponsesV1) {
      headers["azureml-model-deployment"] = deployment;
    }

    const organization = credentials?.providerSpecificData?.organization
      || process.env.AZURE_ORGANIZATION;

    if (organization) {
      headers["OpenAI-Organization"] = organization;
    }

    if (stream) {
      headers["Accept"] = "text/event-stream";
    }

    return headers;
  }

  transformRequest(model, body, stream, credentials, requestFormat = null) {
    const transformed = { ...body };

    const deployment = credentials?.providerSpecificData?.deployment
      || (typeof model === "string" ? model.replace(/^azure\//, "") : model)
      || "gpt-4";

    transformed.model = deployment;

    // The native Responses endpoint accepts the Responses request shape as-is.
    // Keep response-only fields intact and only replace the client model alias
    // with the configured Azure deployment name.
    if (requestFormat === FORMATS.OPENAI_RESPONSES && supportsAzureResponsesV1(credentials)) {
      return transformed;
    }

    // Azure OpenAI strictly rejects vendor/Anthropic thinking parameters
    delete transformed.thinking;
    delete transformed.thinking_budget;
    delete transformed.output_config;
    delete transformed.enable_thinking;

    // Convert max_tokens -> max_completion_tokens for Azure endpoints
    if (transformed.max_tokens !== undefined) {
      transformed.max_completion_tokens = transformed.max_tokens;
      delete transformed.max_tokens;
    }
    if (transformed.tools && Array.isArray(transformed.tools) && transformed.tools.length > 128) {
      transformed.tools = transformed.tools.slice(0, 128);
    }
    // In Azure /chat/completions, function tools with reasoning_effort are rejected
    if (transformed.tools && Array.isArray(transformed.tools) && transformed.tools.length > 0) {
      delete transformed.reasoning_effort;
    }
    return transformed;
  }
}

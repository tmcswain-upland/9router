/** True when an Azure connection opts into the native Azure OpenAI v1 API. */
export function supportsAzureResponsesV1(credentials) {
  return String(credentials?.providerSpecificData?.apiVersion || "").trim().toLowerCase() === "v1";
}

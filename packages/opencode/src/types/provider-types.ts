// Type definitions for provider/provider.ts

export interface ProviderModule {
  [key: string]: (options?: unknown) => unknown;
}

export interface ProviderError extends Error {
  providerID: string;
}
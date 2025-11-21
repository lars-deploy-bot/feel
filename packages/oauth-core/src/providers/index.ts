/**
 * OAuth Provider Registry
 *
 * Central registry for all supported OAuth providers
 */

import type { OAuthProvider } from './base.js';
import { GitHubProvider } from './github.js';

// Provider instances
const providers = new Map<string, OAuthProvider>();

// Register built-in providers
providers.set('github', new GitHubProvider());

/**
 * Gets a registered OAuth provider by name
 *
 * @param name - Provider name (case-insensitive)
 * @returns OAuth provider instance
 * @throws Error if provider not found
 */
export function getProvider(name: string): OAuthProvider {
  const provider = providers.get(name.toLowerCase());

  if (!provider) {
    const available = Array.from(providers.keys()).join(', ');
    throw new Error(
      `OAuth provider '${name}' not supported. Available providers: ${available}`
    );
  }

  return provider;
}

/**
 * Registers a custom OAuth provider
 *
 * @param name - Provider name (will be lowercased)
 * @param provider - Provider implementation
 */
export function registerProvider(name: string, provider: OAuthProvider): void {
  providers.set(name.toLowerCase(), provider);
}

/**
 * Lists all registered provider names
 *
 * @returns Array of provider names
 */
export function listProviders(): string[] {
  return Array.from(providers.keys());
}

/**
 * Checks if a provider is registered
 *
 * @param name - Provider name
 * @returns true if provider exists
 */
export function hasProvider(name: string): boolean {
  return providers.has(name.toLowerCase());
}

// Re-export types and implementations
export { GitHubProvider };
export type { OAuthProvider };

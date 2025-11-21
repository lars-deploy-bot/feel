/**
 * Configuration and Environment Validation
 */

import { z } from 'zod';

const configSchema = z.object({
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_KEY: z.string().min(1, 'SUPABASE_SERVICE_KEY is required'),
  LOCKBOX_MASTER_KEY: z
    .string()
    .length(64, 'LOCKBOX_MASTER_KEY must be 64 hex characters (32 bytes)'),
});

export type Config = z.infer<typeof configSchema>;

let cachedConfig: Config | null = null;

export function getConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const result = configSchema.safeParse({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
    LOCKBOX_MASTER_KEY: process.env.LOCKBOX_MASTER_KEY,
  });

  if (!result.success) {
    const errors = result.error.format();
    throw new Error(
      `[OAuth Core] Invalid configuration:\n${JSON.stringify(errors, null, 2)}`
    );
  }

  cachedConfig = result.data;
  return cachedConfig;
}

/**
 * Lazily initialized master key for encryption
 */
let masterKeyBuffer: Buffer | null = null;

export function getMasterKey(): Buffer {
  if (masterKeyBuffer) {
    return masterKeyBuffer;
  }

  const config = getConfig();
  const key = Buffer.from(config.LOCKBOX_MASTER_KEY, 'hex');

  if (key.length !== 32) {
    throw new Error(
      '[OAuth Core] LOCKBOX_MASTER_KEY must decode to exactly 32 bytes'
    );
  }

  masterKeyBuffer = key;
  return masterKeyBuffer;
}

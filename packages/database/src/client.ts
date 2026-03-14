/**
 * Database Client Factory
 *
 * Schema-specific helpers keep the Supabase schema key concrete so queries stay typed.
 */

import { createClient } from "@supabase/supabase-js"
import type {
  AppDatabase,
  DeployDatabase,
  IamDatabase,
  IntegrationsDatabase,
  LockboxDatabase,
  PublicDatabase,
} from "./index.js"

export function createPublicClient(url: string, key: string) {
  return createClient<PublicDatabase, "public">(url, key, {
    db: { schema: "public" },
  })
}

export function createIamClient(url: string, key: string) {
  return createClient<IamDatabase, "iam">(url, key, {
    db: { schema: "iam" },
  })
}

export function createAppClient(url: string, key: string) {
  return createClient<AppDatabase, "app">(url, key, {
    db: { schema: "app" },
  })
}

export function createDeployClient(url: string, key: string) {
  return createClient<DeployDatabase, "deploy">(url, key, {
    db: { schema: "deploy" },
  })
}

export function createIntegrationsClient(url: string, key: string) {
  return createClient<IntegrationsDatabase, "integrations">(url, key, {
    db: { schema: "integrations" },
  })
}

export function createLockboxClient(url: string, key: string) {
  return createClient<LockboxDatabase, "lockbox">(url, key, {
    db: { schema: "lockbox" },
  })
}

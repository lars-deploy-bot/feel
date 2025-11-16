/// <reference types="bun-types" />

// Declare Bun global for runtime detection
declare const Bun: any | undefined

declare module "bun:sqlite" {
  export class Database {
    constructor(filename: string, options?: { readonly?: boolean; create?: boolean })
    query<T = any>(
      sql: string,
    ): {
      all(...params: any[]): T[]
      get(...params: any[]): T | null
      run(...params: any[]): void
    }
    exec(sql: string): void
    close(): void
  }
}

// The Worker bindings this app uses, kept minimal on purpose: the full workers-types package
// shadows the DOM lib, and the app needs both.
interface D1Result<T = Record<string, unknown>> { results: T[]; success: boolean; meta: { duration: number } }
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}
interface D1Database { prepare(query: string): D1PreparedStatement; batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> }
declare module "cloudflare:workers" {
  export const env: { DB?: D1Database; ASSETS?: { fetch: typeof fetch } };
}

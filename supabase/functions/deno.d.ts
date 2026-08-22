// Ambient type definitions for Supabase Edge Functions (Deno runtime)
// This enables VS Code and TypeScript Language Server to recognize Deno globals without errors.

declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    has(key: string): boolean;
    delete(key: string): void;
    toObject(): Record<string, string>;
  }

  export const env: Env;

  export function serve(
    handler: (request: Request) => Response | Promise<Response>
  ): void;
  export function serve(
    options: { port?: number; onListen?: (localAddr: { hostname: string; port: number }) => void },
    handler: (request: Request) => Response | Promise<Response>
  ): void;
}

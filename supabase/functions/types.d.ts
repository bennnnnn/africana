// Ambient declarations so editor TS servers understand Deno-style HTTPS imports
// and the global `Deno` namespace used in Supabase Edge Functions. Actual runtime
// resolution happens in Deno (locally + on Supabase Edge Runtime) at deploy time.

declare module 'https://*';

declare namespace Deno {
  export const env: {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    toObject(): Record<string, string>;
  };
  export function serve(
    handler: (req: Request) => Response | Promise<Response>,
  ): void;
}

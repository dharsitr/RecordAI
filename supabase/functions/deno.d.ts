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

declare module 'https://esm.sh/docx@9.0.3' {
  export class Document { constructor(...args: any[]); [key: string]: any; }
  export class Packer { static toBuffer(...args: any[]): Promise<any>; [key: string]: any; }
  export class Paragraph { constructor(...args: any[]); [key: string]: any; }
  export class TextRun { constructor(...args: any[]); [key: string]: any; }
  export class Table { constructor(...args: any[]); [key: string]: any; }
  export class TableRow { constructor(...args: any[]); [key: string]: any; }
  export class TableCell { constructor(...args: any[]); [key: string]: any; }
  export const HeadingLevel: any;
  export const WidthType: any;
  export const BorderStyle: any;
  export const AlignmentType: any;
  export const ShadingType: any;
}

declare module 'https://esm.sh/pdf-lib@1.17.1' {
  export class PDFDocument {
    static create(...args: any[]): Promise<any>;
    [key: string]: any;
  }
  export const rgb: any;
  export const StandardFonts: any;
}


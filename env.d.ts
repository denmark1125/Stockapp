
// Removed problematic reference to vite/client to resolve build errors
// Manual definitions below provide the necessary typing for environment variables

interface ImportMetaEnv {
  readonly NEXT_PUBLIC_SUPABASE_URL: string;
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  readonly NEXT_PUBLIC_GEMINI_API: string;
  readonly VITE_GEMINI_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace NodeJS {
  interface ProcessEnv {
    readonly NEXT_PUBLIC_SUPABASE_URL: string;
    readonly NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
    readonly NEXT_PUBLIC_GEMINI_API: string;
    readonly API_KEY: string;
  }
}

// Augmenting the global Process interface ensures that the global 'process' variable, 
// which is typically defined in environment types, includes our typed environment variables.
interface Process {
  env: NodeJS.ProcessEnv;
}

// We do not redeclare the 'process' variable here because it is already declared in the 
// global scope by the environment (e.g., Node types or Vite's environment). 
// Removing this redeclaration avoids "Cannot redeclare block-scoped variable" 
// and "Subsequent variable declarations must have the same type" errors.

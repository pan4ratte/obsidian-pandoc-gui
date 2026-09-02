/// <reference types="vite/client" />

// Inlined as a string literal by the text loader in <root>/vite.config.ts.
declare module '*.md' {
  const content: string;
  export default content;
}

declare module '*.lua' {
  const content: string;
  export default content;
}

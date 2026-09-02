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

// Inlined as base64 by the binary loader in <root>/tools/binary-loader.ts.
declare module '*.docx' {
  const base64: string;
  export default base64;
}

declare module '*.odt' {
  const base64: string;
  export default base64;
}

declare module '*.pptx' {
  const base64: string;
  export default base64;
}

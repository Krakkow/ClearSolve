/// <reference types="vite/client" />

// Vite's `?init` helper for WebAssembly: returns a function that instantiates the
// module and resolves to the instance.
declare module '*.wasm?init' {
  const init: (imports?: WebAssembly.Imports) => Promise<WebAssembly.Instance>;
  export default init;
}

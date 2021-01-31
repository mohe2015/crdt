
// https://github.com/microsoft/TypeScript/issues/33079

// @ts-expect-error this is only available in nodejs
export const crypto: Crypto = (typeof global !== 'undefined') ? (await import("crypto")).webcrypto : crypto;
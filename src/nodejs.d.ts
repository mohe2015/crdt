declare module "crypto" {
    export let webcrypto: { subtle: SubtleCrypto }
}
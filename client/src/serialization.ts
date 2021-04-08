
export interface Serializable<T> {
    serialize(t: T): object
    deserialize(object: any): T
}
  
export class SetOfArrayBuffers implements Serializable<Set<ArrayBuffer>> {
    serialize(t: Set<ArrayBuffer>) {
      return [...t.values()].map(v => Array.from(new Uint8Array(v)))
    }
  
    deserialize(object: any) {
      return new Set<ArrayBufferLike>(object.map((r: any) => new Uint8Array(r).buffer))
    }
}

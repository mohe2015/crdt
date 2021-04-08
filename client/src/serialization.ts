
export interface Serializable<T> {
    get(): T
    set(t: T): void
    serialize(): object
    deserialize(object: object): void
}
  
export class SetOfArrayBuffers implements Serializable<Set<ArrayBuffer>> {
  value!: Set<ArrayBuffer>

  get() {
    return this.value
  }

  set(t: Set<ArrayBuffer>) {
    this.value = t;
  }

  serialize() {
    return [...this.value.values()].map(v => Array.from(new Uint8Array(v)))
  }

  deserialize(object: object) {
    this.value = new Set<ArrayBufferLike>((object as any).map((r: any) => new Uint8Array(r).buffer))
  }
}

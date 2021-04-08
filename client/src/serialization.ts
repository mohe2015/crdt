
export interface Serializable<T> {
    get(): T
    set(t: T): void
    serialize(): any // any could be replace by blob or so and we could make this work then quite easily
    deserialize(o: any): void
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

  deserialize(object: any) {
    this.value = new Set<ArrayBufferLike>((object as any).map((r: any) => new Uint8Array(r).buffer))
  }
}

export class Void implements Serializable<void> {
  get() {

  }

  set() {

  }

  serialize() {
    return null
  }

  deserialize() {

  }  
}

export class StringSerializer implements Serializable<string> {
  value!: string

  get() {
    return this.value
  }

  set(t: string) {
    this.value = t
  }

  serialize() {
    return this.value
  }

  deserialize(object: any) {
    this.value = object as string
  }
}
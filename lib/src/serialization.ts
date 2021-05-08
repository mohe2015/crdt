/*
 * crdt - Conflict-free Replicated Data Types in Typescript
 *
 * Copyright (C) 2020 Moritz Hedtke <Moritz.Hedtke@t-online.de>
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 *
 * SPDX-FileCopyrightText: 2020 Moritz Hedtke <Moritz.Hedtke@t-online.de>
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
export interface Serializable<T> {
    get(): T
    set(t: T): void
    serialize(): any // any could be replace by blob or so and we could make this work then quite easily
    deserialize(o: any): T
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
    return this.value
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
    return this.value
  }
}

export class StringToErrorSerializer implements Serializable<Error> {
  value!: Error

  get() {
    return this.value
  }

  set(t: Error) {
    this.value = t
  }

  serialize() {
    return this.value
  }

  deserialize(object: any) {
    this.value = new Error(object)
    return this.value
  }
}
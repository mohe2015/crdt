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
import { GrowOnlyCounter,  mergeGrowOnlyCounter,  Node, valueOfGrowOnlyCounter } from "./index.js"
import { incrementGrowOnlyCounter, LastWriterWins, mergeLastWriterWins, updateLastWriterWins } from "./index.js"
import stringify from 'fast-json-stable-stringify';

async function assertEqual<T>(actual: T, expected: T) {
    if (actual !== expected) {
        throw new Error(actual + " !== " + expected);
    }
}

const node1: Node = "node1"
const counter1: GrowOnlyCounter = { [node1]: 2 }
await assertEqual(valueOfGrowOnlyCounter(counter1), 2);

const node2: Node = "node2"
const counter2: GrowOnlyCounter = incrementGrowOnlyCounter(counter1, node2, 10)
await assertEqual(valueOfGrowOnlyCounter(counter2), 12)

const counter12 = mergeGrowOnlyCounter(counter1, counter2)
await assertEqual(valueOfGrowOnlyCounter(counter12), 12)

const lww1: LastWriterWins<string> = ["Technik", node1, { [node1]: 1 }]
console.log("lww1", lww1)

const lww2 = updateLastWriterWins(lww1, node2, "Technik-AG")
console.log("lww2", lww2)

const lww12 = mergeLastWriterWins(lww1, lww2)
console.log("lww12", lww12)

const lww21 = mergeLastWriterWins(lww2, lww1)
console.log("lww21", lww21)

await assertEqual(lww12, lww21)

const lww211 = updateLastWriterWins(lww21, node1, "Technik")
console.log("lww211", lww211)

const lww212 = updateLastWriterWins(lww21, node2, "Technik AG")
console.log("lww212", lww212)

const lww21x = mergeLastWriterWins(lww211, lww212)
console.log("lww21x", lww21x)
/*
const gos: GrowOnlySet<string> = [0, {}]

const gos1 = addToGrowOnlySet(gos, node1, "node1eeee")
console.log(gos1)

const gos2 = addToGrowOnlySet(gos, node2, "node2eeeee")
console.log(gos2)

const gosx = mergeGrowOnlySet(gos1, gos2)
console.log(gosx)
*/


await assertEqual(stringify({x:1,y:2}), `{"x":1,"y":2}`)
await assertEqual(stringify({y:2,x:1}), `{"x":1,"y":2}`)
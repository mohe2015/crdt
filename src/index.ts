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
export {}

// design:

// nodes: (a few servers, several hundred clients)

// use a public key so the change is also signed (allows decentralized replication in the future)
// sign it by the server

// currently just use a counter per node for its latest state
// this simple implementation probably uses too much storage


// https://github.com/yjs/yjs
// https://www.youtube.com/watch?v=0l5XgnQ6rB4&feature=youtu.be

type Node = string



type ReplicatedCounter = { [id: string]: number | undefined }

function valueOfReplicatedCounter(replicatedCounter: ReplicatedCounter) {
  let value = 0
  for (var nodeId in replicatedCounter) {
    value += replicatedCounter[nodeId]!
  }
  return value
}

function mergeReplicatedCounter(a: ReplicatedCounter, b: ReplicatedCounter): ReplicatedCounter {
  let object: ReplicatedCounter = {}
  for (var nodeId in a) {
    object[nodeId] = a[nodeId]
  }
  for (var nodeId in b) {
    if (b[nodeId]! > (object[nodeId] || 0)) {
      object[nodeId] = b[nodeId]
    }
  }
  return object
}



type FalseWins = boolean

function mergeFalseWins(a: FalseWins, b: FalseWins) {
  return a && b
}



type TrueWins = boolean

function mergeTrueWins(a: TrueWins, b: TrueWins) {
  return a || b
}





type LastWriterWins = [object: any, id: string, vectors: { [id: string]: number | undefined }]

function valueOfLastWriterWins(lastWriterWins: LastWriterWins) {
  return lastWriterWins[0];
}

function mergeLastWriterWins(a: LastWriterWins, b: LastWriterWins): LastWriterWins {
  let aStrictlyGreaterThanB = true
  let aGreaterThanB = true
  let bStrictlyGreaterThanA = true
  let bGreaterThanA = true

  for (var nodeId in a[2]) {
    if (a[2][nodeId]! > (b[2][nodeId] || 0)) {
      aStrictlyGreaterThanB = true
    }
    if (a[2][nodeId]! < (b[2][nodeId] || 0)) {
      aGreaterThanB = false
    }
  }

  for (var nodeId in b[2]) {
    if (b[2][nodeId]! > (a[2][nodeId] || 0)) {
      bStrictlyGreaterThanA = true
    }
    if (b[2][nodeId]! < (a[2][nodeId] || 0)) {
      bGreaterThanA = false
    }
  }

  if (aGreaterThanB && aStrictlyGreaterThanB) {
    return a[0]
  } else if (bGreaterThanA && bStrictlyGreaterThanA) {
    return b[0]
  } else if (a[1] > b[1]) {
    return a[0]
  } else {
    return b[0]
  }
}

// warning: this modified the object, so snapshots don't work
function updateLastWriterWins(lastWriterWins: LastWriterWins, id: string, value: any) {
  lastWriterWins[0] = value
  lastWriterWins[1] = id
  lastWriterWins[2][id] = (lastWriterWins[2][id] || 0) + 1
}







let node1: Node = "node1"
let counter1: ReplicatedCounter = { [node1]: 2 }
console.log(counter1)
console.log(valueOfReplicatedCounter(counter1))

let node2: Node = "node2"
let counter2: ReplicatedCounter = { [node2]: 1 }
console.log(counter2)
console.log(valueOfReplicatedCounter(counter2))

let counter12 = mergeReplicatedCounter(counter1, counter2)
console.log(counter12)
console.log(valueOfReplicatedCounter(counter12))

// TODO FIXME crdt resolve partial order
/*
Note: totally-ordered timestamps are not trivial to implement. Vector clocks, for instance, only provide a partial order, as differing values can be equivalent. (Consider, for instance, <1,2> vs <2,1>, which signify concurrent events on two nodes.) A weak but simple solution is to use the addresses of the nodes in the ordering (node at "A" precedes the node at "B"). This provides a deterministic answer, and thus a total ordering, but it is not semantically meaningful to the application.
*/




// user count (just for fun)

// https://github.com/pfrazee/crdt_notes

// https://github.com/alangibson/awesome-crdt
// SUPER GOOD RESOURCE

// https://queue.acm.org/detail.cfm?id=2917756

// pretty good https://www.cs.rutgers.edu/~pxk/417/notes/clocks/index.html
/*
 To determine if two events are concurrent, do an element-by-element comparison of the corresponding timestamps. If each element of timestamp V is less than or equal to the corresponding element of timestamp W then V causally precedes W and the events are not concurrent. If each element of timestamp V is greater than or equal to the corresponding element of timestamp W then W causally precedes V and the events are not concurrent. If, on the other hand, neither of those conditions apply and some elements in V are greater than while others are less than the corresponding element in W then the events are concurrent. We can summarize it with the pseudocode:
*/

// https://haslab.wordpress.com/2011/07/08/version-vectors-are-not-vector-clocks/

// https://blog.separateconcerns.com/2017-05-07-itc.html

// https://scattered-thoughts.net/writing/causal-ordering/

// http://jtfmumm.com/blog/2015/11/17/crdt-primer-1-defanging-order-theory/
// TODO http://jtfmumm.com/blog/2015/11/24/crdt-primer-2-convergent-crdts/

// TODO https://github.com/ricardobcl/Dotted-Version-Vectors

// https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type
// state based

// vector clocks, dotted vector clocks

/*
biggest problem: HOW TO STORE IN DATABASE? / USE A DECENTRALIZED DATABASE?
project:
title (string)                      - plaintext
info (string)                       - plaintext
place (string)                      - plaintext
costs (decimal)                     - last writer wins
min_age (int)                       - last writer wins
max_age (int)                       - last writer wins
min_participants (int)              - last writer wins
max_participants (int)              - lww
presentation_type (string)          - plaintext
requirements (string)               - plaintext
random_assignments (bool)           - false wins
all of these first just setting values - show conflicts to user
user (TODO split up in types):
name (string)                       - lww? / plaintext
password [CRDT PROBLEM]             - lww?
type (enum)                         - nonchangable
project_leader project              - lastwriterwins / conflict? / log conflict
class string                        - lww?
age int                             - lww
away bool                           - false wins
password_changed (bool -> converges to true) - true wins
in_project project                  - last writer wins / log conflict
mostly just setting values - show conflicts to user / last writer wins - text could be merged
choice: (this has to be done properly)
rank int                            - last writer wins (time based as it is per user?)
project project                     - unchanable
user user                           - unchangeable
delete: conflict 

problem: constraints in a distributed system don't work
show the errors to users / admin
store locally in indexeddb
*/
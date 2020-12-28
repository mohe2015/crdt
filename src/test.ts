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
import type { GrowOnlyCounter, GrowOnlySet,  Node } from "./index.js"
import { addToGrowOnlySet, incrementGrowOnlyCounter, LastWriterWins, mergeGrowOnlySet, mergeLastWriterWins, mergeReplicatedCounter, updateLastWriterWins, valueOfReplicatedCounter } from "./index.js"
import fs from 'fs/promises';
import { findSourceMap } from 'module';
import type { SourceMapping } from 'module'

class MyError extends Error {
    constructor(...args: any) {
        super(...args)
        Error.captureStackTrace(this, MyError)
    }
}

function getStackInfo(stackElement: any): SourceMapping {
    let sourceMap = findSourceMap(stackElement.getFileName())

    if (sourceMap) {
        return sourceMap.findEntry(stackElement.getLineNumber(), stackElement.getColumnNumber())
    } else {
        return {
            generatedColumn: stackElement.getColumnNumber(),
            generatedLine: stackElement.getLineNumber(),
            originalColumn: stackElement.getColumnNumber(),
            originalLine: stackElement.getLineNumber(),
            originalSource: stackElement.getFileName()
        }
    }
}

function stackInfoToString(stackInfo: SourceMapping): string {
    return getRelativeFileName(stackInfo.originalSource) + ":" + stackInfo.originalLine + ":" + stackInfo.originalColumn
}

function getRelativeFileName(absoluteFileName: string): string {
    let index = absoluteFileName.indexOf("crdt/")
    if (index !== -1) {
        return absoluteFileName.substring(index+5)
    } else {
        return absoluteFileName
    }
}

async function assertEqual(actual: any, expected: any) {
    if (actual !== expected) {
        // https://v8.dev/docs/stack-trace-api

        const _prepareStackTrace = Error.prepareStackTrace;
        Error.prepareStackTrace = (_, stack) => stack;
        const stack = new Error().stack!.slice(1) as unknown as any[];
        Error.prepareStackTrace = _prepareStackTrace;

        let stackInfo = getStackInfo(stack[0])
        let value = JSON.stringify([
            {
                path: getRelativeFileName(stackInfo.originalSource),
                start_line: stackInfo.originalLine,
                end_line: stackInfo.originalLine,
                start_column: stackInfo.originalColumn,
                end_column: stackInfo.originalColumn,
                annotation_level: "failure",
                message: stack.map(getStackInfo).map(stackInfoToString).join("\n"),
                title: actual + " !== " + expected,
            }
        ])
        console.log(value)
        await fs.appendFile("./annotations.json", value)

        // https://docs.github.com/en/free-pro-team@latest/rest/reference/checks#annotations-items
        throw new MyError(actual + " !== " + expected);
    } else {
        // https://v8.dev/docs/stack-trace-api

        const _prepareStackTrace = Error.prepareStackTrace;
        Error.prepareStackTrace = (_, stack) => stack;
        const stack = new Error().stack!.slice(1) as unknown as any[];
        Error.prepareStackTrace = _prepareStackTrace;

        let stackInfo = getStackInfo(stack[0])
        let value = JSON.stringify([
            {
                path: getRelativeFileName(stackInfo.originalSource),
                start_line: stackInfo.originalLine,
                end_line: stackInfo.originalLine,
                start_column: stackInfo.originalColumn,
                end_column: stackInfo.originalColumn,
                annotation_level: "notice",
                message: stack.map(getStackInfo).map(stackInfoToString).join("\n"),
                title: actual + " === " + expected,
            }
        ])
        await fs.appendFile("./annotations.json", value)
    }
}

try {
    let node1: Node = "node1"
    let counter1: GrowOnlyCounter = { [node1]: 2 }
    await assertEqual(valueOfReplicatedCounter(counter1), 2);

    let node2: Node = "node2"
    let counter2: GrowOnlyCounter = incrementGrowOnlyCounter(counter1, node2, 10)
    await assertEqual(valueOfReplicatedCounter(counter2), 12)

    let counter12 = mergeReplicatedCounter(counter1, counter2)
    await assertEqual(valueOfReplicatedCounter(counter12), 12)

    let lww1: LastWriterWins = ["Technik", node1, { [node1]: 1 }]
    console.log("lww1", lww1)

    let lww2 = updateLastWriterWins(lww1, node2, "Technik-AG")
    console.log("lww2", lww2)

    let lww12 = mergeLastWriterWins(lww1, lww2)
    console.log("lww12", lww12)

    let lww21 = mergeLastWriterWins(lww2, lww1)
    console.log("lww21", lww21)

    await assertEqual(lww12, lww21)

    let lww211 = updateLastWriterWins(lww21, node1, "Technik")
    console.log("lww211", lww211)

    let lww212 = updateLastWriterWins(lww21, node2, "Technik AG")
    console.log("lww212", lww212)

    let lww21x = mergeLastWriterWins(lww211, lww212)
    console.log("lww21x", lww21x)




    let gos: GrowOnlySet = [0, {}]

    let gos1 = addToGrowOnlySet(gos, node1, "node1eeee")
    console.log(gos1)

    let gos2 = addToGrowOnlySet(gos, node2, "node2eeeee")
    console.log(gos2)

    let gosx = mergeGrowOnlySet(gos1, gos2)
    console.log(gosx)
} catch (error) {
    console.log(error)
    // TODO fixme allow this to fail and still upload the annotations
}
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

// https://www.jsonrpc.org/specification
// not completely standards compliant, more minimal

export type JSONRPCRequests = Array<JSONRPCRequest>

export type JSONRPCRequest = {
    id: string
    method: string,
    params: object,
}

export interface JSONRPCSuccessfulResponse {
    id: string,
    result: object,
} 

export interface JSONRPCFailedResponse {
    id: string,
    error: object,
}

export interface JSONRPCError {
    code: number,
    message: string,
    data: object
}

// dont use directly if possible
export type JSONRPCResponse = JSONRPCSuccessfulResponse | JSONRPCFailedResponse;

export type JSONRPCResponses = Array<JSONRPCResponse>

export type JSONRPCRequestWithResponse = {
    request: JSONRPCRequest,
    response: JSONRPCResponse
}

export type JSONRPCHandler<I, O> = {
    request: (i: I) => Promise<O>,
    respond: (i: object) => Promise<object>,
}

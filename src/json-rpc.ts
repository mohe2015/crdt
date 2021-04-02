export {}

// https://www.jsonrpc.org/specification
// not completely standards compliant, more minimal

export type JSONRPCRequests<P> = Array<JSONRPCRequest<P>>

export type JSONRPCRequest<P> = {
    method: string,
    params: P,
    id: string
}

export interface JSONRPCSuccessfulResponse<R> {
    id: string,
    result: R,
} 

export interface JSONRPCFailedResponse<E> {
    id: string,
    error: E,
}

export interface JSONRPCError<D> {
    code: number,
    message: string,
    data: D
}

// dont use directly if possible
export type JSONRPCResponse<R, E> = JSONRPCSuccessfulResponse<R> | JSONRPCFailedResponse<E>;

export type JSONRPCResponses<R, E> = Array<JSONRPCResponses<R, E>>

export async function transmit<P, R, E>(requests: JSONRPCRequests<P>): Promise<JSONRPCResponses<R, E>> {
    // TODO FIXME
    return null as any
}

export type JSONRPCRequestWithResponse<P, R, E> = {
    request: JSONRPCRequest<P>,
    response: JSONRPCResponse<R, E>
}
export {}

// https://www.jsonrpc.org/specification
// not completely standards compliant, more minimal

type JSONRPCRequests<P> = Array<JSONRPCRequest<P>>

type JSONRPCRequest<P> = {
    method: string,
    params: P,
    id: string
}

interface JSONRPCSuccessfulResponse<R> {
    id: string,
    result: R,
} 

interface JSONRPCFailedResponse<E> {
    id: string,
    error: E,
}

interface JSONRPCError<D> {
    code: number,
    message: string,
    data: D
}

// dont use directly if possible
type JSONRPCResponse<R, E> = JSONRPCSuccessfulResponse<R> | JSONRPCFailedResponse<E>;

type JSONRPCResponses<R, E> = Array<JSONRPCResponses<R, E>>

async function transmit<P, R, E>(requests: JSONRPCRequests<P>): Promise<JSONRPCResponses<R, E>> {
    // TODO FIXME
    return null as any
}
import type { CmRDTLogEntry } from "./index"
import type { JSONRPCHandler, JSONRPCRequest, JSONRPCResponse } from "./json-rpc"

export abstract class Remote<T> {
    abstract connect(): Promise<void>
  
    abstract flushRequests(): Promise<void>
  
    abstract sendHashes(heads: Array<ArrayBuffer>): Promise<void>
  
    abstract requestHeadHashes(): Promise<Set<ArrayBuffer>>
  
    abstract sendEntries(entries: Array<CmRDTLogEntry<any>>): Promise<void>
  
    abstract requestPredecessors(hashes: Array<ArrayBuffer>, depth: number): Promise<Set<ArrayBuffer>>
  
    /**
     * This also validates that the remote sent a valid object.
     * @param keys the key to request from the remote
     */
    // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API#concepts_and_usage
    // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Concepts
    // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams
    abstract requestEntries(keys: Array<ArrayBuffer>): Promise<Array<CmRDTLogEntry<T>>>; // TODO FIXME maybe streaming
  
    abstract requestMissingEntryHashesForRemote(): Promise<Set<ArrayBuffer>>
  }
  // https://developer.mozilla.org/en-US/docs/Web/API
  // https://developer.mozilla.org/en-US/docs/Web/API/Barcode_Detection_API
  // https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API
  // https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API
  
  class WebSocketRemote<T> extends Remote<T> {
    socket!: WebSocket
    methods: Map<string, () => Promise<void>>
  
    constructor() {
      super()
      this.methods = new Map()
    }
  
    connect(): Promise<void> {
      return new Promise((resolve, reject) => {
        this.socket = new WebSocket("wss://localhost:8888")
        //socket.binaryType = "blob" // vs arraybuffer
    
        this.socket.addEventListener("error", (event) => {
          console.error(event)
          reject()
        })
    
        this.socket.addEventListener("open", (event) => {
          console.log(event)
          resolve()
        })
      })
    }
  
    // this is running in the background
    handleRequests(): void {
      this.socket.addEventListener("message", (event) => {
        // TODO FIXME put casting into conditional check, CHECK all parameters as this is remotely controlled data
        let response = JSON.parse(event.data) as JSONRPCRequest<any>
  
        if (response.method) {
          console.log("got method ")
        }
      })
    }
  
    async flushRequests(): Promise<void> {
    }
  
    async sendHashes(heads: Array<ArrayBuffer>): Promise<void> {
  
    }
  
    headHashes: JSONRPCHandler<void, Promise<Set<ArrayBuffer>>> = {
      request: async (params) => {
        // TODO FIXME clean all of this up and just provide some T -> object and object -> T mapping functions for json usage - this could probably be replaced by something binary later
  
        let response = await this.genericRequestHandler<void, number[][], string>("headHashes", params)
        if ('result' in response) {
          return 
        } else {
          throw new Error(response.error)
        }
      },
      respond: () => {
        let arrayBuffer = new ArrayBuffer(0)
        return
      }
    }
  
    genericRequestHandler<P, R, E>(name: string, params: P): Promise<JSONRPCResponse<R, E>> {
      return new Promise((resolve, reject) => {
        let id = crypto.getRandomValues(new Uint8Array(64)).reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
        let request: JSONRPCRequest<P> = {
          id,
          method: name,
          params
        }
        this.socket.send(JSON.stringify(request));
  
        let onclose = (event: CloseEvent) => {
          console.log(event)
  
          this.socket.removeEventListener("message", onmessage)
          this.socket.addEventListener("close", onclose)
  
          reject()
        }
  
        let onmessage = (event: MessageEvent<string>) => {
          console.log(event)
  
          // TODO FIXME put parsing into conditional check
          let response = JSON.parse(event.data) as JSONRPCResponse<R, E>
          if (id === response.id) {
            this.socket.removeEventListener("message", onmessage) // TODO test if this works
            this.socket.addEventListener("close", onclose)
  
            console.log(response)
            resolve(response)
          }
        }
  
        this.socket.addEventListener("message", onmessage)
        this.socket.addEventListener("close", onclose)
      })
    }
  
    async sendEntries(entries: Array<CmRDTLogEntry<any>>): Promise<void> {
  
    }
  
    async requestPredecessors(hashes: Array<ArrayBuffer>, depth: number): Promise<Set<ArrayBuffer>> {
  
    }
  
    /**
     * This also validates that the remote sent a valid object.
     * @param keys the key to request from the remote
     */
    // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API#concepts_and_usage
    // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Concepts
    // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams
    async requestEntries(keys: Array<ArrayBuffer>): Promise<Array<CmRDTLogEntry<T>>> {
      
    }
  
    async requestMissingEntryHashesForRemote(): Promise<Set<ArrayBuffer>> {
  
    }
  }
  
  class WebRTCRemote<T> extends Remote<T> {
    // TODO https://www.w3.org/TR/webrtc/#perfect-negotiation-example
    // initial bootstrap needs to be manual so we don't depend on a server (for now at least)
    // as webrtc is quite complicated maybe provide alternative bootstrap using websockets (preferably with your own server)
  
    async connect(): Promise<void> {
      // https://www.w3.org/TR/webrtc/#simple-peer-to-peer-example
      let certificate = await RTCPeerConnection.generateCertificate({
        name: "RSASSA-PKCS1-v1_5",
        // @ts-expect-error
        modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256"
      })
  
      // certificate.getFingerprints().map(f => f.value)
  
      let connection: RTCPeerConnection = new RTCPeerConnection({
        certificates: [certificate]
        // TODO ice servers
      })
  
      connection.addEventListener("icecandidate", (event) => console.log(JSON.stringify({candidate: event.candidate}))); // you need to send this to remote - maybe generate qr code?
  
      connection.addEventListener("icecandidateerror", console.error)
  
      document.querySelector<HTMLButtonElement>("#button")!.addEventListener("click", async (event) => {
        console.log("click")
        let value = JSON.parse(document.querySelector<HTMLInputElement>("#input")!.value);
        console.log(value)
        
        try {
          if (value.description) {
            await connection.setRemoteDescription(value.description);
            // if we got an offer, we need to reply with an answer
            if (value.description.type == 'offer') {
              // @ts-expect-error
              await connection.setLocalDescription();
              console.log(JSON.stringify({description: connection.localDescription}));
            }
          } else if (value.candidate) {
            await connection.addIceCandidate(value.candidate);
          }
        } catch (err) {
          console.error(err);
        }
      })
  
      let response: RTCSessionDescriptionInit = await connection.createOffer({})
      connection.setLocalDescription(response)
      console.log(JSON.stringify({description: response}));
    }
  
    flushRequests(): Promise<void> {
  
    }
  
    async sendHashes(heads: Array<ArrayBuffer>): Promise<void> {
  
    }
  
    async requestHeadHashes(): Promise<Set<ArrayBuffer>> {
  
    }
  
    async sendEntries(entries: Array<CmRDTLogEntry<any>>): Promise<void> {
  
    }
  
    async requestPredecessors(hashes: Array<ArrayBuffer>, depth: number): Promise<Set<ArrayBuffer>> {
      
    }
  
    /**
     * This also validates that the remote sent a valid object.
     * @param keys the key to request from the remote
     */
    // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API#concepts_and_usage
    // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Concepts
    // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams
    async requestEntries(keys: Array<ArrayBuffer>): Promise<Array<CmRDTLogEntry<T>>> {
  
    }
  
    async requestMissingEntryHashesForRemote(): Promise<Set<ArrayBuffer>> {
  
    }
  }
  
import fs from 'fs';
import https from 'https';
import WebSocket from 'ws';

// TODO check origin - return 403 if forbidden or not existent

const server = https.createServer({
  cert: fs.readFileSync('/path/to/cert.pem'),
  key: fs.readFileSync('/path/to/key.pem')
});
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    ws.on('message', (message) => {
        console.log('received: %s', message);
    });
    ws.send('something');
});

server.listen(8080);
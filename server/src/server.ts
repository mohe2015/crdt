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

import { readFileSync } from 'fs';
import { createServer } from 'https';
import { Server } from 'ws';

// TODO check origin - return 403 if forbidden or not existent

async function main() {
    

    const server = createServer({
        cert: readFileSync('/path/to/cert.pem'),
        key: readFileSync('/path/to/key.pem')
    });
    const wss = new Server({ server });

    wss.on('connection', (ws, req) => {
        const ip = req.socket.remoteAddress;
        ws.on('message', (message) => {
            console.log('received: %s', message);
        });
        ws.send('something');
    });

    server.listen(8080);
}
"use strict";

import { Socket } from 'net';
import { Logger } from './logging.js'

export class Client {

    constructor() {
        this.socket = new Socket();
    }

    connect(port, host) {
        this.socket.connect(port, host);
    }

    onReceive(callback) {
        this.socket.on('data', async function (data, callback) {
            Logger.log("RCV: " + data.toString('hex').toUpperCase());
            await callback;
        });
    }

    write(data) {
        Logger.log("SND: " + data.toString('hex').toUpperCase());
        return new Promise((resolve, reject) => {
            this.socket.write(data, resolve);
        });
    }

}
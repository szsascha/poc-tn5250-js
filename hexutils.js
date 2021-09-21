"use strict";

import { Buffer } from 'buffer';

export function x(data) {
    return new Bytes(data);
}

class Bytes {

    constructor(data) {
        this.bytes = null;

        if (typeof data === 'string') {
            this.bytes = this.constructor.fromHexString(data);
        } else if (typeof data === 'array') {
            this.bytes = data;
        } else if (typeof data === 'number') {
            this.bytes = [ data ];
        } else if (typeof data === 'object') {
            this.bytes = Array.from(data);
        } else {
            console.log(typeof data);
            this.bytes = [];
        }
    }

    static fromHexString(string) {
        let array = [];
        for (let i = 0, len = string.length; i < len; i+=2) {
            array.push(parseInt(string.substr(i,2),16));
        }
        
        return array;
    }

    get array() {
        return this.bytes;
    }

    get buffer() {
        return Buffer.from(this.bytes);
    }

    get string() {
        return this.buffer.toString('hex').toUpperCase();
    }

    get convertedString() {
        let bytes = '';
        this.bytes.forEach(bytes => {
            bytes += String.fromCharCode(bytes);
        });
        return bytes;
    }

}

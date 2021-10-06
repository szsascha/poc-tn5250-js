"use strict";

import { Buffer } from 'buffer';

export function x(data) {
    return new Bytes(data);
}

export function bytesFromString(string, encoding = 'utf8') {
    let bytebuffer = [];
    const buffer = Buffer.from(string, encoding);
    for (let i = 0; i < buffer.length; i++) {
        bytebuffer.push(buffer[i]);
    }
    
    const bytes = new Bytes([...bytebuffer]);

    return bytes;
}

class Bytes {

    constructor(data) {
        this.bytes = null;

        if (typeof data === 'string') {
            this.bytes = this.constructor.fromHexString(data.toUpperCase());
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

    getArraySplittedBy(splitter) {
        let splitted = [[]];
        let i = 0;
        this.array.forEach(byte => {
            if (splitted[i].length >= 1 && byte == splitter) {
                i++;
                splitted[i] = [];
            }
            splitted[i].push(byte)
        });
        return splitted;
    }

    get number() {
        let value = 0;
        for (let i = 0; i < this.bytes.length; i++) {
            value *= 256;
            if (this.bytes[i] < 0) {
                value += 256 + this.bytes[i];
            } else {
                value += this.bytes[i];
            }
        }
        return value;
    }

    get array() {
        return this.bytes;
    }

    get bitArray() {
        let bits = [];
        this.bytes.forEach(byte => {
            for (let i = 7; i >= 0; i--) {
                let bit = byte & (1 << i) ? 1 : 0;
                bits.push(bit);
             }
        });
        return bits;
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

"use strict";

import { x, bytesFromString } from "./hexutils.js";
import { Logger } from './logging.js'

class Protocol {

    constructor() {
        if (new.target === Protocol) {
          throw new TypeError("Cannot construct Protocol instances directly");
        }
    }

    serialize() {
        Logger.log("serialize() not implemented");
    }

    deserialize(data) {
        Logger.log("deserialize() not implemented");
    }

}

// https://datatracker.ietf.org/doc/html/rfc854
// https://www.ibm.com/docs/en/zos/2.3.0?topic=problems-telnet-commands-options
// https://datatracker.ietf.org/doc/html/rfc1060
// https://datatracker.ietf.org/doc/html/rfc1572
// https://datatracker.ietf.org/doc/html/rfc1408
// https://datatracker.ietf.org/doc/html/rfc2877#page-3
// https://datatracker.ietf.org/doc/html/rfc4777
export class TelnetMessage extends Protocol {

    constructor(command = null, option = null, data = null) {
        super();
        this.commands = [];
        this.chunks = [];

        if (command == null || option == null) return;

        this.commands[0] = [
            TelnetMessage.COMMAND.IAC_INTERPRET_AS_COMMAND,
            command,
            option
        ]

        if (data == null) return;
        if (!Array.isArray(data)) {
            this.commands[0] = this.commands[0].concat(data.array);
        } else {
            this.commands[0] = this.commands[0].concat(data);
        }
    }

    serialize() {
        let serialized = [];
        this.commands.forEach(bytes => {
            serialized = serialized.concat(bytes);
        });
        return x(serialized);
    }

    deserialize(data) {
        let bytes = x(data);
        this.commands = bytes.getArraySplittedBy(TelnetMessage.COMMAND.IAC_INTERPRET_AS_COMMAND);

        this.commands.forEach(bytes => {
            if (bytes[0] == TelnetMessage.COMMAND.IAC_INTERPRET_AS_COMMAND) {
                this.chunks.push(new TelnetMessageChunk(bytes[1], bytes[2], bytes.slice(3)));
            }
        });    
    }

    static create(command = null, option = null, data = null) {
        return new TelnetMessage(command, option, data);
    }

    static fromSerialized(data) {
        let telnetMessage = TelnetMessage.create();
        telnetMessage.deserialize(data);
        return telnetMessage;
    }

    /**
     * Return Telnet commands from RFC 854
     */
    static get COMMAND() { 
        return {

            // End of subnegotiation parameters.
            SE_END_OF_SUBNEGOTIATION_PARAMETERS: 0xf0,

            // No operation.
            NOP_NO_OPERATION: 0xf1,

            // The data stream portion of a Synch. This should always be accompanied by a TCP Urgent notification.
            DATA_MARK: 0xf2,

            // NVT character BRK.
            BRK_BREAK: 0xf3,

            // The function IP.
            IP_INTERRUPT_PROCESS: 0xf4,

            // The function AO.
            AO_ABORT_OUTPUT: 0xf5,

            // The function AYT.
            AYT_ARE_YOU_THERE: 0xf6,

            // The function EC.
            EC_ERASE_CHARACTER: 0xf7,

            // The function EL.
            EL_ERASE_LINE: 0xf8,

            // The GA signal.
            GA_GO_AHEAD: 0xf9,

            // Indicates that what follows is subnegotiation of the indicated option.
            SB_SUBNEGOTIATION: 0xfa,

            // Indicates the want to begin performing, or confirmation that you are now performing, the indicated option.
            WILL: 0xfb,

            // Indicates the refusal to perform, or continue performing, the indicated option.
            WONT: 0xfc,

            // Indicates the request that the other party perform, or confirmation that you are expecting the other party to perform, the indicated option.
            DO: 0xfd,

            // Indicates the demand that the other party stop performing, or confirmation that you are no longer expecting the other party to perform, the indicated option.
            DONT: 0xfe,

            // Data byte 255.
            IAC_INTERPRET_AS_COMMAND: 0xff
        }
    }

    /**
     * Return Telnet subcommands from RFC 1060
     */
    static get COMMAND_OPTION() {
        return {
            BINARY_TRANSMISSION: 0x00,
            ECHO: 0x01,
            RECONNECTION: 0x02,
            SUPPRESS_GO_AHEAD: 0x03,
            APPROX_MESSAGE_SIZE_NEGOTIATION: 0x04,
            STATUS: 0x05,
            TIMING_MARK: 0x06,
            REMOTE_CONTROLLED_TRANS_AND_ECHO: 0x07,
            OUTPUT_LINE_WIDTH: 0x08,
            OUTPUT_PAGE_SIZE: 0x09,
            OUTPUT_CARRIAGE_RETURN_DISPOSITION: 0x0a,
            OUTPUT_HORIZONTAL_TAB_STOPS: 0x0b,
            OUTPUT_HORIZONTAL_TAB_DISPOSITION: 0x0c,
            OUTPUT_FORMFEED_DISPOSITION: 0x0d,
            OUTPUT_VERTICAL_TABSTOPS: 0x0e,
            OUTPUT_VERTICAL_TAB_DISPOSITION: 0x0f,
            OUTPUT_LINEFEED_DISPOSITION: 0x10,
            OUTPUT_EXTENDED_ASCII: 0x11,
            LOGOUT: 0x12,
            BYTE_MACRO: 0x13,
            DATA_ENTRY_TERMINAL: 0x14,
            SUPDUP: 0x15,
            SUPDUP_OUTPUT: 0x16,
            SEND_LOCATION: 0x17,
            TERMINAL_TYPE: 0x18,
            END_OF_RECORD: 0x19,
            TACACS_USER_IDENTIFICATION: 0x1a,
            OUTPUT_MARKING: 0x1b,
            TERMINAL_LOCATION_NUMBER: 0x1c,
            TELNET_3270_REGIME: 0x1d,
            X3_PAD: 0x1e,
            NEGOTIATE_ABOUT_WINDOW_SIZE: 0x1f,
            TERMINAL_SPEED: 0x20,
            REMOTE_FLOW_CONTROL: 0x21,
            LINEMODE: 0x22,
            X_DISPLAY_LOCATION: 0x23,
            NEW_ENVIRONMENT: 0x27,
            EXTENDED_OPTIONS_LIST: 0xff
        }
    }
}

class TelnetMessageChunk {

    constructor(command, option, data = null) {
        this.command = command;
        this.option = option;
        this.data = data;
        this.object = createTelnetMessageChunkObject(command, option, data);
    }

}

export function createTelnetMessageChunkObject(command, option, data) {
    if (command == TelnetMessage.COMMAND.SB_SUBNEGOTIATION
        && option == TelnetMessage.COMMAND_OPTION.NEW_ENVIRONMENT) {
        return new TelnetMessageChunkObjectNewEnvironment(data);
    }
    if (command == TelnetMessage.COMMAND.SB_SUBNEGOTIATION
        && option == TelnetMessage.COMMAND_OPTION.TERMINAL_TYPE) {
        return new TelnetMessageChunkObjectTerminalType(data);
    }
    return null;
}

export class TelnetMessageChunkObject {

    constructor(data) {
        this.data = data;
        if (data == null) this.data = [];
        if (new.target === TelnetMessageChunkObject) {
          throw new TypeError("Cannot construct TelnetMessageChunkObject instances directly");
        }
    }

    static get COMMAND() {
        return {
            IS: 0x00,
            SEND: 0x01,
            INFO: 0x02
        }
    }
}

export class TelnetMessageChunkObjectNewEnvironment extends TelnetMessageChunkObject {
    
    constructor(data = null) {
        super(data);
        this.openSendSection = false;
    }

    pushIs(code, key, value = null) {
        // Close send section if open
        if (this.openSendSection) this.openSendSection = false;

        let keyvalue = bytesFromString(key, 'ascii').array;
        if (value != null) {
            if (key != TelnetMessageChunkObjectNewEnvironment.USERVAR.IBMRSEED) keyvalue += TelnetMessageChunkObjectNewEnvironment.CODE.VALUE;
            if (typeof value === 'string') {
                keyvalue = keyvalue.concat(bytesFromString(value, 'ascii').array);
            } else {
                keyvalue = keyvalue.concat(value);
            }
        }
        this.data.push(
            TelnetMessageChunkObject.COMMAND.IS,
            code
        );

        if (Array.isArray(keyvalue)) {
            this.data = this.data.concat(keyvalue);
        } else {
            if (keyvalue != null) this.data.push(keyvalue);
        }
    }

    pushSend(code, key, value) {
        if(!this.openSendSection) {
            this.openSendSection = true;
            this.data.push(TelnetMessageChunkObject.COMMAND.SEND);
        }

        if (typeof value === 'string') {
            value = bytesFromString(value, 'ascii').array;
        }

        this.data = this.data.concat(code);

        this.data = this.data.concat(bytesFromString(key, 'ascii').array);

        this.data = this.data.concat(TelnetMessageChunkObjectNewEnvironment.CODE.VALUE);

        if (Array.isArray(value)) {
            this.data = this.data.concat(value);
        } else {
            if (value != null) this.data.push(value);
        }
    }

    getSend(code, key) {
        // Currently only IBMRSEED is needed
        if (code != TelnetMessageChunkObjectNewEnvironment.CODE.USERVAR) return null;

        if (this.data[0] == TelnetMessageChunkObject.COMMAND.SEND
            && this.data[1] == TelnetMessageChunkObjectNewEnvironment.CODE.USERVAR) {
                const uservarValue = this.data.slice(10);
                return uservarValue.slice(0, 8);
        }
    }

    static get CODE() {
        return {
            VAR: 0x00,
            VALUE: 0x01,
            ESC: 0x02,
            USERVAR: 0x03
        };
    }

    static get USERVAR() {
        return {
            USER: "USER",
            IBMRSEED: "IBMRSEED",
            IBMSUBSPW: "IBMSUBSPW",
            IBMCURLIB: "IBMCURLIB",
            IBMIMENU: "IBMIMENU",
            IBMPROGRAM: "IBMPROGAM",
            DEVNAME: "DEVNAME",
            KBDTYPE: "KBDTYPE",
            CODEPAGE: "CODEPAGE",
            CHARSET: "CHARSET",
            IBMSENDCONFREC: "IBMSENDCONFREC",
            IBMASSOCPRT: "IBMASSOCPRT"
        };
    }
}

export class TelnetMessageChunkObjectTerminalType extends TelnetMessageChunkObject {

    constructor(data = null) {
        super(data);
        this.command = null;
        this.terminalType = null;
        if (data != null && data.length > 0) { 
            this.command = data[0];
        }
    }

    get data() {
        this._data = [];
        if (this.command != null) this._data[0] = this.command;
        if (this.terminalType != null) this._data = this._data.concat(bytesFromString(this.terminalType, 'ascii').array);
        return this._data;
    }

    set data(data) {
        this._data = data;
    }

}

// https://datatracker.ietf.org/doc/html/rfc1205
export class Tn5250Message extends TelnetMessage {
    static get TERMINAL() {
        return {
            IBM5555C01: "IBM-5555-C01", // 24 x 80 Double-Byte Character Set color display
            IBM5555B01: "IBM-5555-B01", // 24 x 80 Double-Byte Character Set (DBCS)
            IBM3477FC:  "IBM-3477-FC",  // 27 x 132 color display
            IBM3477FG:  "IBM-3477-FG",  // 27 x 132 monochrome display
            IBM31802:   "IBM-3180-2",   // 27 x 132 monochrome display
            IBM31792:   "IBM-3179-2",   // 24 x 80 color display
            IBM3196A1:  "IBM-3196-A1",  // 24 x 80 monochrome display
            IBM52922:   "IBM-5292-2",   // 24 x 80 color display
            IBM52911:   "IBM-5291-1",   // 24 x 80 monochrome display
            IBM525111:  "IBM-5251-11"   // 24 x 80 monochrome display
        } 
    }
}
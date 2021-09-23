"use strict";

import { x } from "./hexutils.js";
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
        
        this.commands[0] = this.commands[0].concat(data.array);
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

    constructor(command, option, data = []) {
        this.command = command;
        this.option = option;
        this.data = data;
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

class ProtocolProcessor {

    constructor() {
        if (new.target === ProtocolProcessor) {
          throw new TypeError("Cannot construct Protocol instances directly");
        }
    }

    process(message) {
        Logger.log("process() not implemented");
    }

}

export class TelnetMessageProcessor extends ProtocolProcessor {

    process(message) {
        let result = [];

        message.chunks.forEach(async chunk => {
            if (chunk.command == TelnetMessage.COMMAND.DO)
                result.push(
                    this.processResultArrayToTelnetMessage(this.processDo(chunk))
                );
    
            if (chunk.command == TelnetMessage.COMMAND.WILL) 
                result.push(
                    this.processResultArrayToTelnetMessage(this.processWill(chunk))
                );
    
            if (chunk.command == TelnetMessage.COMMAND.SB_SUBNEGOTIATION) 
                result.push(
                    this.processResultArrayToTelnetMessage(this.processSB(chunk))
                );
        });

        return result;
    }

    processResultArrayToTelnetMessage(array) {
        return TelnetMessage.create(
            array[0], 
            array.length > 1 ? array[1] : null, 
            array.length > 2 ? array[2] : null
        );
    }

    processDo(chunk) {
        if (chunk.option == TelnetMessage.COMMAND_OPTION.NEW_ENVIRONMENT) {
            Logger.log('[ RCV ] CMD: DO NEW ENVIRONMENT');
            Logger.log('[ SND ] CMD: WILL NEW ENVIRONMENT');
            return [ 
                TelnetMessage.COMMAND.WILL,
                TelnetMessage.COMMAND_OPTION.NEW_ENVIRONMENT
            ];
        }
        if (chunk.option == TelnetMessage.COMMAND_OPTION.TERMINAL_TYPE) {
            Logger.log('[ RCV ] CMD: DO TERMINAL TYPE');
            Logger.log('[ SND ] CMD: WILL TERMINAL TYPE');
            return [
                TelnetMessage.COMMAND.WILL,
                TelnetMessage.COMMAND_OPTION.TERMINAL_TYPE
            ];
        }
        if (chunk.option == TelnetMessage.COMMAND_OPTION.END_OF_RECORD) {
            Logger.log('[ RCV ] CMD: DO END OF RECORD');
            Logger.log('[ SND ] CMD: WILL END OF RECORD');
            return [
                TelnetMessage.COMMAND.WILL,
                TelnetMessage.COMMAND_OPTION.END_OF_RECORD
            ];
        }
        if (chunk.option == TelnetMessage.COMMAND_OPTION.BINARY_TRANSMISSION) {
            Logger.log('[ RCV ] CMD: DO BINARY TRANSMISSION');
            Logger.log('[ SND ] CMD: WILL BINARY TRANSMISSION');
            return [
                TelnetMessage.COMMAND.WILL,
                TelnetMessage.COMMAND_OPTION.BINARY_TRANSMISSION
            ];
        }
    }

    processWill(chunk) {
        if (chunk.option == TelnetMessage.COMMAND_OPTION.END_OF_RECORD) {
            Logger.log('[ RCV ] CMD: WILL END OF RECORD');
            Logger.log('[ SND ] CMD: DO END OF RECORD');
            return [
                TelnetMessage.COMMAND.DO,
                TelnetMessage.COMMAND_OPTION.END_OF_RECORD
            ];
        }
        if (chunk.option == TelnetMessage.COMMAND_OPTION.BINARY_TRANSMISSION) {
            Logger.log('[ RCV ] CMD: WILL BINARY TRANSMISSION');
            Logger.log('[ SND ] CMD: DO BINARY TRANSMISSION');
            return [
                TelnetMessage.COMMAND.DO,
                TelnetMessage.COMMAND_OPTION.BINARY_TRANSMISSION
            ];
        }   
    }

    processSB(chunk) {
        if (chunk.option == TelnetMessage.COMMAND_OPTION.TERMINAL_TYPE) {
            let data = '';
            if (chunk.data == 0x01) data = ' - SEND YOUR TERMINAL TYPE'
            Logger.log('[ RCV ] CMD: SB SUBNEGOTIATION TERMINAL TYPE' + data);
            Logger.log('[ SND ] CMD: SB SUBNEGOTIATION TERMINAL TYPE - HERE IS MY TERMINAL TYPE ' + '49424D2D333137392D32');
            return [
                TelnetMessage.COMMAND.SB_SUBNEGOTIATION,
                TelnetMessage.COMMAND_OPTION.TERMINAL_TYPE,
                x('0049424D2D333137392D32FFF0')
            ];
            // TODO SUBOPTION END in same request but not in same string as it is now
            // TODO TERMINAL have to be sent ALWAYS before ENVIRONMENT OPTIONS
        }
        if (chunk.option == TelnetMessage.COMMAND_OPTION.NEW_ENVIRONMENT) {
            Logger.log('[ RCV ] CMD: SB SUBNEGOTIATION NEW ENVIRONMENT ' + x(chunk.data).string);
            Logger.log('[ SND ] CMD: SB SUBNEGOTIATION NEW ENVIRONMENT ' + '000349424D52534545440D2DC3EDB3F2E93C00034445564E414D4501034B4244545950450141474503434F44455041474501313134310343484152534554013639350349424D53454E44434F4E4652454301594553');
            return [
                TelnetMessage.COMMAND.SB_SUBNEGOTIATION,
                TelnetMessage.COMMAND_OPTION.NEW_ENVIRONMENT,
                x('000349424D52534545440D2DC3EDB3F2E93C00034445564E414D4501034B4244545950450141474503434F44455041474501313134310343484152534554013639350349424D53454E44434F4E4652454301594553FFF0')
            ];
            // TODO SUBOPTION END in same request but not in same string as it is now
        }
    }

}
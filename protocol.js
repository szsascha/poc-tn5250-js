"use strict";

import { x, bytesFromString, bytesFromNumber } from "./hexutils.js";
import { Logger } from './logging.js';
import { Codepage } from './codepage.js';

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

    constructor(commands = []) {
        super();
        this.commands = [];
        this.chunks = [];

        commands.forEach(command => {
            const slicedCommand = command.slice(0, 2);
            const slicedCommandArg = command.slice(2);
            let commandArray = [ TelnetMessage.COMMAND.IAC_INTERPRET_AS_COMMAND ].concat(slicedCommand);

            if (command.length > 2) {
                if (!Array.isArray(slicedCommandArg)) {
                    commandArray = commandArray.concat(slicedCommandArg[0].array);
                } else {
                    commandArray = commandArray.concat(slicedCommandArg);
                }
            }

            this.commands.push(commandArray);
        });
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

    static create(commands = []) {
        return new TelnetMessage(commands);
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
// http://bitsavers.informatik.uni-stuttgart.de/pdf/ibm/5250_5251/GA21-9247-2_5250_Information_Display_System_Functions_Reference_Manual_May80.pdf
// https://www.ibm.com/docs/en/i/7.2?topic=ssw_ibm_i_72/apis/dsm1f.htm
export class Tn5250Message extends Protocol {

    constructor() {
        super();
        this.data = [];
        this.logicalRecordLength = 0;
        this.recordType = null;
        this.variableHeaderLength = 0;
        this.flags = {
            ERR_DATA_STREAM_OUTPUT_ERROR: false,
            ATN_ATTENTION_KEY_PRESSED: false,
            SRQ_SYSTEM_REQUEST_KEY_PRESSED: false,
            TRQ_TEST_REQUEST_KEY_PRESSED: false,
            HLP_HELP_IN_ERROR_STATE: false
        };
        this.opcode = 0x00;
        this.rowAddress = 0;
        this.columnAddress = 0;
        this.attentionIdentification = null;
        this.escapeCommands = [];
        this.orderCodes = []; // Client sends ordercodes on top layer

        // Printer startup response record
        // https://datatracker.ietf.org/doc/html/rfc2877#section-9
        this.isPrinterStartupResponseRecord = false;
        this.printerStartupResponseCode = null;
        this.printerStartupSystemName = null;
        this.printerStartupObjectName = null;

    }

    serialize() {
        this.data = [];

        // Set logical record length
        this.data = this.data.concat([0x00, 0x00]);

        // Set SNA record type
        this.data = this.data.concat([0x12, 0xa0]);

        // Set reserved flags
        this.data = this.data.concat([0x00, 0x00]);

        // Set variable record length
        this.data = this.data.concat([0x04]);

        // Set SNA flags (not implemented in PoC)
        this.data = this.data.concat([0x00]);

        // Set reserved flags
        this.data = this.data.concat([0x80]);

        // Set operation code
        this.data = this.data.concat(this.opcode);

        // Set row address
        this.data = this.data.concat(bytesFromNumber(this.rowAddress));

        // Set column address
        this.data = this.data.concat(bytesFromNumber(this.columnAddress));

        // Set attention identification
        this.data = this.data.concat(this.attentionIdentification);

        // Add escape commands
        this.orderCodes.forEach(escapeCommand => {
            const serializedEscapeCommand = escapeCommand.serialize();
            this.data = this.data.concat(serializedEscapeCommand.array);
        });

        if (this.attentionIdentification == Tn5250Message.AIDCODE.AID_INBOUND_WRITE_STRUCTURED_FIELD) {
            // Fix in PoC
            this.data = this.data.concat([
                // Structured field length
                0x00, 0x44,

                // Structured field class
                0xd9,

                // Structured field type
                0x70,

                // Flag
                0x80,

                // Controller hardware class
                0x06, 0x00,

                // Controller code level
                0x03, 0x02, 0x00,

                // Reserved flags
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 

                // Device type
                0x01,

                // Device type
                0xf3, 0xf1, 0xf7, 0xf9,

                // Device model
                0xf0, 0xf0, 0xf2,

                // Keyboard id
                0x01,

                // Extended keyboard id
                0x01,

                // Flags reserved
                0x00,

                // Display serial number
                0x00, 0x00, 0x70, 0x12,

                // Maximum number of input fields
                0x01, 0xf4,

                // Reserved
                0x00, 0x00, 0x00,

                // Flags
                0x7b,

                // Flags
                0x31,

                // No DBCS
                0x00,

                // Flags no graphics
                0x00,

                // Reserved
                0x0f, 0xc8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,

                // Field data
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
            ]);
        }

        // Always end with 'FFEF'X
        this.data = this.data.concat([0xff, 0xef]);

        // Add record length
        this.logicalRecordLength = this.data.length-2;
        const lengthBytes = bytesFromNumber(this.logicalRecordLength, 2).concat(this.data);
        this.data[1] = lengthBytes[0];
        this.data[0] = lengthBytes[1];

        return x(this.data);
    }

    deserialize(data) {
        const logicalRecordLengthBytes = x(data).array.slice(0, 2);
        this.logicalRecordLength = x(logicalRecordLengthBytes).number;

        const recordTypeBytes = x(data).array.slice(2, 4);
        this.recordType = x(recordTypeBytes);

        // Check if printer startup response record https://datatracker.ietf.org/doc/html/rfc2877#section-9
        const printerStartupBytes = x(data).array.slice(4, 16);
        const printerStartupBytesString = x(printerStartupBytes).string;
        if (printerStartupBytesString == '90000560060020C0003D0000') {
            let codepage = new Codepage('1141'); // TODO: Load from config
            this.isPrinterStartupResponseRecord = true;

            const responseCodeBytes = x(data).array.slice(16, 20);
            const responseCode = codepage.decode(x(responseCodeBytes).array);
            this.printerStartupResponseCode = responseCode;

            const responseSystemNameBytes = x(data).array.slice(20, 28);
            const responseSystemName = codepage.decode(x(responseSystemNameBytes).array);
            this.printerStartupSystemName = responseSystemName;

            const responseObjectNameBytes = x(data).array.slice(28, 38);
            const responseObjectName = codepage.decode(x(responseObjectNameBytes).array);
            this.printerStartupObjectName = responseObjectName;

            return;
        }

        const variableRecordLengthBytes = x(data).array.slice(5, 7);
        this.variableRecordLength = x(variableRecordLengthBytes).number;

        const snaFlagsBits = x(data).array.slice(7, 8);
        const snaFlags = x(snaFlagsBits).bitArray;

        if(snaFlags[0] == 1) {
            this.flags.ERR_DATA_STREAM_OUTPUT_ERROR = true;
        } else {
            this.flags.ERR_DATA_STREAM_OUTPUT_ERROR = false;
        }

        if(snaFlags[1] == 1) {
            this.flags.ATN_ATTENTION_KEY_PRESSED = true;
        } else {
            this.flags.ATN_ATTENTION_KEY_PRESSED = false;
        }

        if(snaFlags[5] == 1) {
            this.flags.SRQ_SYSTEM_REQUEST_KEY_PRESSED = true;
        } else {
            this.flags.SRQ_SYSTEM_REQUEST_KEY_PRESSED = false;
        }

        if(snaFlags[6] == 1) {
            this.flags.TRQ_TEST_REQUEST_KEY_PRESSED = true;
        } else {
            this.flags.TRQ_TEST_REQUEST_KEY_PRESSED = false;
        }

        if(snaFlags[7] == 1) {
            this.flags.HLP_HELP_IN_ERROR_STATE = true;
        } else {
            this.flags.HLP_HELP_IN_ERROR_STATE = false;
        }

        const opCodeBytes = x(data).array.slice(9, 10);
        this.opcode = opCodeBytes[0];

        // Create escape commands
        let escapeCommandArray = x(data).array.slice(10); 
        // Remove last 2 elements ('FFEF'x)
        escapeCommandArray.pop();
        escapeCommandArray.pop();

        if (escapeCommandArray.length <= 0) return;

        let tn5250MessageEscapeCommand = createTn5250MessageEscapeCommand(escapeCommandArray);
        this.escapeCommands.push(tn5250MessageEscapeCommand);
        let length = tn5250MessageEscapeCommand.length;
        if (length <= 0 || escapeCommandArray.length - length <= 0) return;

        do {
            escapeCommandArray = x(escapeCommandArray).array.slice(length);
            tn5250MessageEscapeCommand = createTn5250MessageEscapeCommand(escapeCommandArray);
            this.escapeCommands.push(tn5250MessageEscapeCommand);
            length = tn5250MessageEscapeCommand.length;
        } while(length <= 0);
    }

    static fromSerialized(data) {
        let tn5250Message = Tn5250Message.create();
        tn5250Message.deserialize(data);
        return tn5250Message;
    }

    static create() {
        return new Tn5250Message();
    }

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

    static get AIDCODE() {
        return {
            PF1: 0x31,
            PF2: 0x32,
            PF3: 0x33,
            PF4: 0x34,
            PF5: 0x35,
            PF6: 0x36,
            PF7: 0x37,
            PF8: 0x38,
            PF9: 0x39,
            PF10: 0x3a,
            PF11: 0x3b,
            PF12: 0x3c,
            PF13: 0xb1,
            PF14: 0xb2,
            PF15: 0xb3,
            PF16: 0xb4,
            PF17: 0xb5,
            PF18: 0xb6,
            PF19: 0xb7,
            PF20: 0xb8,
            PF21: 0xb9,
            PF22: 0xba,
            PF23: 0xbb,
            PF24: 0xbc,
            CLEAR: 0xbd,
            ENTER_REC_ADV: 0xf1,
            HELP: 0xf3,
            ROLL_DOWN: 0xf4,
            ROLL_UP: 0xf5,
            PRINT: 0xf6,
            RECORD_BACKSPACE: 0xf8,
            AUTO_ENTER: 0x3f,
            AID_INBOUND_WRITE_STRUCTURED_FIELD: 0x88
        };
    }

    static get OPCODE() {
        return {
            NO_OPERATION: 0x00,
            INVITE_OPERATION: 0x01,
            OUTPUT_ONLY: 0x02,
            PUT_GET_OPERATION: 0x03,
            SAVE_SCREEN_OPERATION: 0x04,
            RESTORE_SCREEN_OPERATION: 0x05,
            READ_IMMEDIATE_OPERATION: 0x06,
            READ_SCREEN_OPERATION: 0x08,
            CANCEL_INVITE_OPERATION: 0x0a,
            TURN_ON_MESSAGE_LIGHT: 0x0b,
            TURN_OFF_MESSAGE_LIGHT: 0x0c
        }
    }

    static get PRINTER_STARTUP_RESPONSE_CODE() {
        return {
            VIRTUAL_DEVICE_HAS_LESS_FUNCTION_THAN_SOURCE_DEVICE:    'I901', // Virtual device has less function than source device
            SESSION_SUCCESSFULLY_STARTED:                           'I902', // Session successfully started
            AUTOMATIC_SIGNON_REQUESTED_BUT_NOT_ALLOWED:             'I906', //Automatic sign-on requested, but not allowed. Session still allowed; a sign-on screen will becoming.
            DEVICE_DESCRIPTION_NOT_FOUND:                           '2702', // Device description not found.
            CONTROLLER_DESCRIPTION_NOT_FOUND:                       '2703', // Controller description not found.
            DAMAGED_DEVICE_DESCRIPTION:                             '2777', // Damaged device description.
            DEVICE_NOT_VARIED_ON:                                   '8901', // Device not varied on.
            DEVICE_NOT_AVAILABLE:                                   '8902', // Device not available.
            DEVICE_NOT_VALID_FOR_SESSION:                           '8903', // Device not valid for session.
            SESSION_INITIATION_FAILED:                              '8906', // Session initiation failed.
            SESSION_FAILURE:                                        '8907', // Session failure.
            CONTROLLER_NOT_VALID_FOR_SESSION:                       '8910', // Controller not valid for session.
            NO_MATCHING_DEVICE_FOUND:                               '8916', // No matching device found.
            NOT_AUTHORIZED_TO_OBJECT:                               '8917', // Not authorized to object.
            JOB_CANCELED:                                           '8918', // Job canceled.
            OBJECT_PARTIALLY_DAMAGED:                               '8920', // Object partially damaged.
            COMMUNICATIONS_ERROR:                                   '8921', // Communications error.
            NEGATIVE_RESPONSE_RECEIVED:                             '8922', // Negative response received.
            STARTUP_RECORD_BUILT_INCORRECTLY:                       '8923', // Start-up record built incorrectly.
            CREATION_OF_DEVICE_FAILED:                              '8925', // Creation of device failed.
            CHANGE_OF_DEVICE_FAILED:                                '8928', // Change of device failed.
            VARY_ON_OR_VARY_OFF_FAILED:                             '8929', // Vary on or vary off failed.
            MESSAGE_QUEUE_DOES_NOT_EXIST:                           '8930', // Message queue does not exist.
            STARTUP_FOR_S36_WSF_RECEIVED:                           '8934', // Start-up for S/36 WSF received.
            SESSION_REJECTED:                                       '8935', // Session rejected.
            SECURITY_FAILURE_ON_SESSION_ATTEMPT:                    '8936', // Security failure on session attempt.
            AUTOMATIC_SIGNON_REJECTED:                              '8937', // Automatic sign-on rejected.
            AUTOMATIC_CONFIGURATION_FAILED_OR_NOT_ALLOWED:          '8940', // Automatic configuration failed or not allowed.
            SOURCE_SYSTEM_AT_INCOMPATIBLE_RELEASE:                  'I904' // Source system at incompatible release.
        }
    }
}

function createTn5250MessageEscapeCommand(data) {
    return new Tn5250MessageEscapeCommand(data);
}

export class Tn5250MessageEscapeCommand {

    constructor(data) {
        this.data = data;
        if (data == null) this.data = [];
        this.commandCode = null;
        this.object = null;
        this.length = 0;
        this.deserialize(data);
    }

    serialize() {
        Logger.log("serialize() not implemented");
    }

    deserialize(data) {
        this.commandCode = data[1];
        this.length = 2; // Length alway min. 2 because escape code and command code

        // Don't read more if clear unit
        if (this.commandCode == Tn5250MessageEscapeCommand.COMMAND_CODE.CU_CLEAR_UNIT) {
            return;
        }

        // Remove first two bytes from array
        const dataWithoutCommandCode = data.slice(2);

        this.object = createTn5250MessageEscapeCommandObject(this.commandCode, dataWithoutCommandCode);
        this.length += this.object.length
    }

    static get COMMAND_CODE() {
        return {
            CU_CLEAR_UNIT: 0x40,
            WTD_WRITE_TO_DISPLAY: 0x11,
            READ_MDT_FIELDS: 0x52,
            WRITE_STRUCTURED_FIELD: 0xf3
        }
    }

}

function createTn5250MessageEscapeCommandObject(commandCode, data) {
    if (commandCode == Tn5250MessageEscapeCommand.COMMAND_CODE.WTD_WRITE_TO_DISPLAY
        || commandCode == Tn5250MessageEscapeCommand.COMMAND_CODE.READ_MDT_FIELDS) {
        // Create write to display also for read mdt fields because they share the same structure
        const escapeCommand = new Tn5250MessageEscapeCommandObjectWriteToDisplay(data);
        escapeCommand.deserialize(data);
        return escapeCommand;
    }
    if (commandCode == Tn5250MessageEscapeCommand.COMMAND_CODE.WRITE_STRUCTURED_FIELD) {
        const escapeCommand = new Tn5250MessageEscapeCommandObjectWriteStructuredField(data);
        escapeCommand.deserialize(data);
        return escapeCommand;
    }
    return null;
}

class Tn5250MessageEscapeCommandObject {

    constructor(data) {
        this.length = 0;
        this.data = data;
        if (data == null) this.data = [];
        if (new.target === Tn5250MessageEscapeCommandObject) {
          throw new TypeError("Cannot construct Tn5250MessageEscapeCommandObject instances directly");
        }
    }

    serialize() {
        Logger.log("serialize() not implemented");
    }

    deserialize(data) {
        Logger.log("deserialize() not implemented");
    }

}

class Tn5250MessageEscapeCommandObjectWriteToDisplay extends Tn5250MessageEscapeCommandObject {

    constructor(data = null) {
        super(data);

        this.writeToDisplayControlCharacterByte1 = {
            RESET_PENDING_AID_LOCK_KEYBOARD: false,
            CLEAR_MASTER_MDT_RESET_MDT_FLAGS_IN_NONBYPASS_FIELDS: false,
            CLEAR_MASTER_MDT_RESET_MDT_FLAGS_IN_ALL_FIELDS: false,
            NULL_NONBYPASS_FIELDS_WITH_MDT_ON: false,
            NULL_ALL_NONBYPASS_FIELDS: false
        }

        this.writeToDisplayControlCharacterByte2 = {
            CURSOR_DOES_NOT_MOVE_WHEN_KEYBOARD_UNLOCKS: false,
            RESET_BLINKING_CURSOR: false,
            SET_BLINKING_CURSOR: false,
            UNLOCK_THE_KEYBOARD_AND_RESET_ANY_PENDING_AID_BYTES: false,
            SOUND_ALARM: false,
            SET_MESSAGE_WAITING_INDICATOR_OFF: false,
            SET_MESSAGE_WAITING_INDICATOR_ON: false
        }

        this.orderCommands = [];
    }

    deserialize(data) {
        const controlCharacterByte1Bits = x(data[0]).bitArray;

        if (controlCharacterByte1Bits[1] == 1) {
            this.writeToDisplayControlCharacterByte1.RESET_PENDING_AID_LOCK_KEYBOARD = true;
        } else {
            this.writeToDisplayControlCharacterByte1.RESET_PENDING_AID_LOCK_KEYBOARD = false;
        }
        if (controlCharacterByte1Bits[2] == 1) {
            this.writeToDisplayControlCharacterByte1.CLEAR_MASTER_MDT_RESET_MDT_FLAGS_IN_NONBYPASS_FIELDS = true;
        } else {
            this.writeToDisplayControlCharacterByte1.CLEAR_MASTER_MDT_RESET_MDT_FLAGS_IN_NONBYPASS_FIELDS = false;
        }
        if (controlCharacterByte1Bits[3] == 1) {
            this.writeToDisplayControlCharacterByte1.CLEAR_MASTER_MDT_RESET_MDT_FLAGS_IN_ALL_FIELDS = true;
        } else {
            this.writeToDisplayControlCharacterByte1.CLEAR_MASTER_MDT_RESET_MDT_FLAGS_IN_ALL_FIELDS = false;
        }
        if (controlCharacterByte1Bits[4] == 1) {
            this.writeToDisplayControlCharacterByte1.NULL_NONBYPASS_FIELDS_WITH_MDT_ON = true;
        } else {
            this.writeToDisplayControlCharacterByte1.NULL_NONBYPASS_FIELDS_WITH_MDT_ON = false;
        }
        if (controlCharacterByte1Bits[5] == 1) {
            this.writeToDisplayControlCharacterByte1.NULL_ALL_NONBYPASS_FIELDS = true;
        } else {
            this.writeToDisplayControlCharacterByte1.NULL_ALL_NONBYPASS_FIELDS = false;
        }


        const controlCharacterByte2Bits = x(data[1]).bitArray;

        if (controlCharacterByte2Bits[1] == 1) {
            this.writeToDisplayControlCharacterByte2.CURSOR_DOES_NOT_MOVE_WHEN_KEYBOARD_UNLOCKS = true;
        } else {
            this.writeToDisplayControlCharacterByte2.CURSOR_DOES_NOT_MOVE_WHEN_KEYBOARD_UNLOCKS = false;
        }
        if (controlCharacterByte2Bits[2] == 1) {
            this.writeToDisplayControlCharacterByte2.RESET_BLINKING_CURSOR = true;
        } else {
            this.writeToDisplayControlCharacterByte2.RESET_BLINKING_CURSOR = false;
        }
        if (controlCharacterByte2Bits[3] == 1) {
            this.writeToDisplayControlCharacterByte2.SET_BLINKING_CURSOR = true;
        } else {
            this.writeToDisplayControlCharacterByte2.SET_BLINKING_CURSOR = false;
        }
        if (controlCharacterByte2Bits[4] == 1) {
            this.writeToDisplayControlCharacterByte2.UNLOCK_THE_KEYBOARD_AND_RESET_ANY_PENDING_AID_BYTES = true;
        } else {
            this.writeToDisplayControlCharacterByte2.UNLOCK_THE_KEYBOARD_AND_RESET_ANY_PENDING_AID_BYTES = false;
        }
        if (controlCharacterByte2Bits[5] == 1) {
            this.writeToDisplayControlCharacterByte2.SOUND_ALARM = true;
        } else {
            this.writeToDisplayControlCharacterByte2.SOUND_ALARM = false;
        }
        if (controlCharacterByte2Bits[6] == 1) {
            this.writeToDisplayControlCharacterByte2.SET_MESSAGE_WAITING_INDICATOR_OFF = true;
        } else {
            this.writeToDisplayControlCharacterByte2.SET_MESSAGE_WAITING_INDICATOR_OFF = false;
        }
        if (controlCharacterByte2Bits[7] == 1) {
            this.writeToDisplayControlCharacterByte2.SET_MESSAGE_WAITING_INDICATOR_ON = true;
        } else {
            this.writeToDisplayControlCharacterByte2.SET_MESSAGE_WAITING_INDICATOR_ON = false;
        }

        this.length += 2; // Add first 2 bytes to length;

        // Return if no more data exists or next is escape code (0x04)
        if (data.length <= 2 || data[2] == 0x04) {
            return;
        }

        let preparedData = data.slice(2);
        let endLoop = false;

        do {
            if (preparedData <= 2 || preparedData[0] == 0x04) {
                endLoop = true;
                break;
            }
            // Resolve order codes until next byte is escape code or end
            const orderCode = preparedData[0];
            preparedData = preparedData.slice(1);
            const wtdOrderCommand = createTn5250MessageEscapeCommandObjectWriteToDisplayOrderCommand(orderCode, preparedData);
            wtdOrderCommand.data = wtdOrderCommand.data.slice(1, wtdOrderCommand.length + 1);
            this.orderCommands.push(wtdOrderCommand);
            this.length += wtdOrderCommand.length + 1; // +1 because of order code
            preparedData = preparedData.slice(wtdOrderCommand.length + 1);
            
        } while(!endLoop);

    }

}

class Tn5250MessageEscapeCommandObjectWriteStructuredField extends Tn5250MessageEscapeCommandObject {

    constructor(data = null) {
        super(data);

        this.structuredFieldLength = 0;
        this.structuredFieldClass = null;
        this.structuredFieldType = null;
    }

    deserialize(data) {
        this.structuredFieldLength = x(data[1]).number;
        this.length = this.structuredFieldLength;
        this.structuredFieldClass = data[2];
        this.structuredFieldType = data[3];
    }

    static get STRUCTURED_FIELD_CLASS() {
        return {
            TN5250_CLASS_OF_STRUCTURED_FIELD: 0xd9
        };
    }

    static get STRUCTURED_FIELD_TYPE() {
        return {
            TN5250_QUERY: 0x70
        };
    }
}

function createTn5250MessageEscapeCommandObjectWriteToDisplayOrderCommand(orderCode, data) {
    if (orderCode == Tn5250MessageEscapeCommandObjectWriteToDisplayOrderCommand.ORDER_CODE.SOH_START_OF_HEADER) {
        const orderCommand = new Tn5250MessageEscapeCommandObjectWriteToDisplayOrderCommandStartOfHeader(data);
        orderCommand.deserialize(data);
        return orderCommand;
    }
    if (orderCode == Tn5250MessageEscapeCommandObjectWriteToDisplayOrderCommand.ORDER_CODE.SBA_SET_BUFFER_ADDRESS) {
        const orderCommand = new Tn5250MessageEscapeCommandObjectWriteToDisplayOrderCommandSetBufferAddress(data);
        orderCommand.deserialize(data);
        return orderCommand;
    }
    if (orderCode == Tn5250MessageEscapeCommandObjectWriteToDisplayOrderCommand.ORDER_CODE.SF_START_OF_FIELD) {
        const orderCommand = new Tn5250MessageEscapeCommandObjectWriteToDisplayOrderCommandStartOfField(data);
        orderCommand.deserialize(data);
        return orderCommand;
    }
    if (orderCode == Tn5250MessageEscapeCommandObjectWriteToDisplayOrderCommand.ORDER_CODE.RA_REPEAT_TO_ADDRESS) {
        const orderCommand = new Tn5250MessageEscapeCommandObjectWriteToDisplayOrderCommandRepeatToAddress(data);
        orderCommand.deserialize(data);
        return orderCommand;
    }
    if (orderCode == Tn5250MessageEscapeCommandObjectWriteToDisplayOrderCommand.ORDER_CODE.IC_INSERT_CURSOR) {
        const orderCommand = new Tn5250MessageEscapeCommandObjectWriteToDisplayOrderCommandInsertCursor(data);
        orderCommand.deserialize(data);
        return orderCommand;
    }
    return null;
}

export class Tn5250MessageEscapeCommandObjectWriteToDisplayOrderCommand {
    
    constructor(data = null) {
        this.length = 0;
        this.data = data;
        if (data == null) this.data = [];
        this.orderCode = null;
    }

    serialize() {
        Logger.log("serialize() not implemented");
    }

    deserialize(data) {
        Logger.log("deserialize() not implemented");
    }

    static get ORDER_CODE() {
        return {
            IC_INSERT_CURSOR: 0x13,
            RA_REPEAT_TO_ADDRESS: 0x02,
            SBA_SET_BUFFER_ADDRESS: 0x11,
            SF_START_OF_FIELD: 0x1d,
            SOH_START_OF_HEADER: 0x01
        }
    }

}

class Tn5250MessageEscapeCommandObjectWriteToDisplayOrderCommandStartOfHeader extends Tn5250MessageEscapeCommandObjectWriteToDisplayOrderCommand {
    
    constructor(data = null) {
        super(data);

        this.orderCode = Tn5250MessageEscapeCommandObjectWriteToDisplayOrderCommand.ORDER_CODE.SOH_START_OF_HEADER;
        this.length = null;
        this.startOfHeaderFlags = {
            RIGHT_TO_LEFT_SCREEN_LEVEL_CURSOR_DIRECTION: false,
            AUTOMATIC_LOCAL_SCREEN_REVERSE: false,
            THE_CURSOR_IS_ALLOWED_TO_MOVE_ONLY_TO_INPUT_CAPABLE_POSITIONS: false
        }
        this.resequenceToField = null;
        this.errorRow = null;

        this.commandKey = {
            PF1: false,
            PF2: false,
            PF3: false,
            PF4: false,
            PF5: false,
            PF6: false,
            PF7: false,
            PF8: false,
            PF9: false,
            PF10: false,
            PF11: false,
            PF12: false,
            PF13: false,
            PF14: false,
            PF15: false,
            PF16: false,
            PF17: false,
            PF18: false,
            PF19: false,
            PF20: false,
            PF21: false,
            PF22: false,
            PF23: false,
            PF24: false
        }
    }

    deserialize(data) {
        const orderCodeLength = x(data[0]).number;
        this.length = orderCodeLength;
        const headerFlagsBitArray = x(data[1]).bitArray;

        if (headerFlagsBitArray[0] == 1) {
            this.startOfHeaderFlags.RIGHT_TO_LEFT_SCREEN_LEVEL_CURSOR_DIRECTION = true;
        } else {
            this.startOfHeaderFlags.RIGHT_TO_LEFT_SCREEN_LEVEL_CURSOR_DIRECTION = false;
        }
        if (headerFlagsBitArray[1] == 1) {
            this.startOfHeaderFlags.AUTOMATIC_LOCAL_SCREEN_REVERSE = true;
        } else {
            this.startOfHeaderFlags.AUTOMATIC_LOCAL_SCREEN_REVERSE = false;
        }
        if (headerFlagsBitArray[2] == 1) {
            this.startOfHeaderFlags.THE_CURSOR_IS_ALLOWED_TO_MOVE_ONLY_TO_INPUT_CAPABLE_POSITIONS = true;
        } else {
            this.startOfHeaderFlags.THE_CURSOR_IS_ALLOWED_TO_MOVE_ONLY_TO_INPUT_CAPABLE_POSITIONS = false;
        }

        this.resequenceToField = x(data[3]).number;
        this.errorRow = x(data[4]).number;

        const commandKeySwitch1BitArray = x(data[5]).bitArray;
        const commandKeySwitch2BitArray = x(data[6]).bitArray;
        const commandKeySwitch3BitArray = x(data[7]).bitArray;

        if (commandKeySwitch1BitArray[0] == 1) {
            this.commandKey.PF24 = true;
        } else {
            this.commandKey.PF24 = false;
        }
        if (commandKeySwitch1BitArray[1] == 1) {
            this.commandKey.PF23 = true;
        } else {
            this.commandKey.PF23 = false;
        }
        if (commandKeySwitch1BitArray[2] == 1) {
            this.commandKey.PF22 = true;
        } else {
            this.commandKey.PF22 = false;
        }
        if (commandKeySwitch1BitArray[3] == 1) {
            this.commandKey.PF21 = true;
        } else {
            this.commandKey.PF21 = false;
        }
        if (commandKeySwitch1BitArray[4] == 1) {
            this.commandKey.PF20 = true;
        } else {
            this.commandKey.PF20 = false;
        }
        if (commandKeySwitch1BitArray[5] == 1) {
            this.commandKey.PF19 = true;
        } else {
            this.commandKey.PF19 = false;
        }
        if (commandKeySwitch1BitArray[6] == 1) {
            this.commandKey.PF18 = true;
        } else {
            this.commandKey.PF18 = false;
        }
        if (commandKeySwitch1BitArray[7] == 1) {
            this.commandKey.PF17 = true;
        } else {
            this.commandKey.PF17 = false;
        }
        if (commandKeySwitch2BitArray[0] == 1) {
            this.commandKey.PF16 = true;
        } else {
            this.commandKey.PF16 = false;
        }
        if (commandKeySwitch2BitArray[1] == 1) {
            this.commandKey.PF15 = true;
        } else {
            this.commandKey.PF15 = false;
        }
        if (commandKeySwitch2BitArray[2] == 1) {
            this.commandKey.PF14 = true;
        } else {
            this.commandKey.PF14 = false;
        }
        if (commandKeySwitch2BitArray[3] == 1) {
            this.commandKey.PF13 = true;
        } else {
            this.commandKey.PF13 = false;
        }
        if (commandKeySwitch2BitArray[4] == 1) {
            this.commandKey.PF12 = true;
        } else {
            this.commandKey.PF12 = false;
        }
        if (commandKeySwitch2BitArray[5] == 1) {
            this.commandKey.PF11 = true;
        } else {
            this.commandKey.PF11 = false;
        }
        if (commandKeySwitch2BitArray[6] == 1) {
            this.commandKey.PF10 = true;
        } else {
            this.commandKey.PF10 = false;
        }
        if (commandKeySwitch2BitArray[7] == 1) {
            this.commandKey.PF9 = true;
        } else {
            this.commandKey.PF9 = false;
        }
        if (commandKeySwitch3BitArray[0] == 1) {
            this.commandKey.PF8 = true;
        } else {
            this.commandKey.PF8 = false;
        }
        if (commandKeySwitch3BitArray[1] == 1) {
            this.commandKey.PF7 = true;
        } else {
            this.commandKey.PF7 = false;
        }
        if (commandKeySwitch3BitArray[2] == 1) {
            this.commandKey.PF6 = true;
        } else {
            this.commandKey.PF6 = false;
        }
        if (commandKeySwitch3BitArray[3] == 1) {
            this.commandKey.PF5 = true;
        } else {
            this.commandKey.PF5 = false;
        }
        if (commandKeySwitch3BitArray[4] == 1) {
            this.commandKey.PF4 = true;
        } else {
            this.commandKey.PF4 = false;
        }
        if (commandKeySwitch3BitArray[5] == 1) {
            this.commandKey.PF3 = true;
        } else {
            this.commandKey.PF3 = false;
        }
        if (commandKeySwitch3BitArray[6] == 1) {
            this.commandKey.PF2 = true;
        } else {
            this.commandKey.PF2 = false;
        }
        if (commandKeySwitch3BitArray[7] == 1) {
            this.commandKey.PF1 = true;
        } else {
            this.commandKey.PF1 = false;
        }
    }

}

export class Tn5250MessageEscapeCommandObjectWriteToDisplayOrderCommandSetBufferAddress extends Tn5250MessageEscapeCommandObjectWriteToDisplayOrderCommand {
    
    constructor(data = null) {
        super(data);

        this.orderCode = Tn5250MessageEscapeCommandObjectWriteToDisplayOrderCommand.ORDER_CODE.SBA_SET_BUFFER_ADDRESS;
        this.rowAddress = 0;
        this.columnAddress = 0;
        this.repeatedCharacterOriginal = '';
        this.repeatedCharacterPlain = '';
        this.repeatedCharacterHtml = '';
    }

    serialize() {
        this.data = [];
        const codepage = new Codepage('1141'); // TODO load by config
        
        this.data.push(this.orderCode);
        this.data = this.data.concat(bytesFromNumber(this.rowAddress));
        this.data = this.data.concat(bytesFromNumber(this.columnAddress));
        this.data = this.data.concat([...codepage.encode(this.repeatedCharacterOriginal)]);

        return x(this.data);
    }

    deserialize(data) {
        this.rowAddress = x(data[0]).number;
        this.columnAddress = x(data[1]).number;
        this.length += 2;
        const codepage = new Codepage('1141'); // TODO load by config
        const dataSliced = data.slice(2);

        // Check if more is coming. SBA can be only positioning. e.g. before input field
        if (dataSliced.length > 0 && (dataSliced[0] > 0x00 && dataSliced[0] < 0x20)) {
            this.length--;
            return;
        }

        let isBlinkOpen = false;
        let isUnderscoreOpen = false;
        let isIntensityOpen = false;
        let isReverseOpen = false;
        let isNonDisplayOpen = false;
        let endByChar = false;
        let i = 0;
        dataSliced.every(element => {
            // Check if ending by ordercode
            if (element > 0x00 && element < 0x20) {
                return false;
            }
            if (element == 0x20 && dataSliced[i+1] != 0x00) {
                endByChar = true;
                return false;
            }
            
            const elementByte = x(element);

            // Parse screen attribute if in range
            if (element >= 0x20 && element < 0x40) {
                this.repeatedCharacterOriginal += elementByte.convertedString;
                const parsedScreenAttribute = this.parseScreenAttribute(element);

                if (parsedScreenAttribute.BLINK) {
                    if (!isBlinkOpen) {
                        this.repeatedCharacterHtml += '<blink>';
                        isBlinkOpen = true;
                    } else {
                        this.repeatedCharacterHtml += '</blink>';
                        isBlinkOpen = false;
                    }
                }
                if (parsedScreenAttribute.UNDERSCORE) {
                    if (!isUnderscoreOpen) {
                        this.repeatedCharacterHtml += '<u>';
                        isUnderscoreOpen = true;
                    } else {
                        this.repeatedCharacterHtml += '</u>';
                        isUnderscoreOpen = false;
                    }
                }
                if (parsedScreenAttribute.INTENSITY) {
                    if (!isIntensityOpen) {
                        this.repeatedCharacterHtml += '<b>';
                        isIntensityOpen = true;
                    } else {
                        this.repeatedCharacterHtml += '</b>';
                        isIntensityOpen = false;
                    }
                }
                if (parsedScreenAttribute.REVERSE) {
                    if (!isReverseOpen) {
                        this.repeatedCharacterHtml += '<span style="background-color: #000000; color: #ffffff;">';
                        isReverseOpen = true;
                    } else {
                        this.repeatedCharacterHtml += '</span>';
                        isReverseOpen = false;
                    }
                }
                if (parsedScreenAttribute.NONDISPLAY) {
                    if (!isNonDisplayOpen) {
                        this.repeatedCharacterHtml += '<span style="display: hidden;">';
                        isNonDisplayOpen = true;
                    } else {
                        this.repeatedCharacterHtml += '</span>';
                        isNonDisplayOpen = false;
                    }
                }
            } else {
                const convertedString = codepage.decode(elementByte.array);
                this.repeatedCharacterOriginal += convertedString;
                this.repeatedCharacterPlain += convertedString;
                this.repeatedCharacterHtml  += convertedString;
            }
            
            this.length++;
            i++;

            return true;
        });

        if (isBlinkOpen) {
            this.repeatedCharacterHtml += '</blink>';
            isBlinkOpen = false;
        }
        if (isUnderscoreOpen) {
            this.repeatedCharacterHtml += '</u>';
            isUnderscoreOpen = false;
        }
        if (isIntensityOpen) {
            this.repeatedCharacterHtml += '</b>';
            isIntensityOpen = false;
        }
        if (isReverseOpen) {
            this.repeatedCharacterHtml += '</span>';
            isReverseOpen = false;
        }
        if (isNonDisplayOpen) {
            this.repeatedCharacterHtml += '</span>';
            isNonDisplayOpen = false;
        }
        if (!endByChar) {
            this.length--;
        }
    }

    // http://bitsavers.informatik.uni-stuttgart.de/pdf/ibm/5250_5251/GA21-9247-2_5250_Information_Display_System_Functions_Reference_Manual_May80.pdf ; PAGE: 148
    parseScreenAttribute(attribute) {
        const attributeBits = x(attribute).bitArray;

        const identifier = 
                    attributeBits[0] 
            + '' +  attributeBits[1]
            + '' +  attributeBits[2];

        let blink = false;
        if (attributeBits[3] == 1) blink = true;

        let underscore = false;
        if (attributeBits[4] == 1) underscore = true;

        let intensity = false;
        if (attributeBits[5] == 1) intensity = true;

        let reverse = false;
        if (attributeBits[6] == 1) reverse = true;

        let nondisplay = false;
        if (underscore && intensity && reverse) {
            nondisplay = true;
            underscore = false;
            intensity = false;
            reverse = false;
        }

        return {
            IDENTIFIER: identifier,
            BLINK: blink,
            UNDERSCORE: underscore,
            INTENSITY: intensity,
            REVERSE: reverse,
            NONDISPLAY: nondisplay
        }

    }
}

class Tn5250MessageEscapeCommandObjectWriteToDisplayOrderCommandStartOfField extends Tn5250MessageEscapeCommandObjectWriteToDisplayOrderCommand {
    
    constructor(data = null) {
        super(data);

        this.orderCode = Tn5250MessageEscapeCommandObjectWriteToDisplayOrderCommand.ORDER_CODE.SF_START_OF_FIELD;
        this.fieldFormatWordId = null;
        this.bypassField = false;
        this.dupeOrFieldMarkEnable = false;
        this.modified = false;
        this.fieldShiftEditSpecification = null;
        this.autoEnter = false;
        this.fieldExitRequired = false;
        this.monocase = false;
        this.mandatoryEnter = false;
        this.rightAdjustMandatoryFill = false;
        this.attributeId = null;
        this.columnSeparator = false;
        this.underscore = false;
        this.intensity = false;
        this.reverse = false;
        this.nondisplay = false;
        this.fieldLength = 0;
        this.repeatedCharacter = null;
    }

    deserialize(data) {
        this.length += 5;

        const fieldFormatWord1BitArray = x(data[0]).bitArray;
        this.fieldFormatWordId = fieldFormatWord1BitArray[0] + '' + fieldFormatWord1BitArray[1];
        if (fieldFormatWord1BitArray[2] == 1) {
            this.bypassField = true;
        } else {
            this.bypassField = false;
        }
        if (fieldFormatWord1BitArray[3] == 1) {
            this.dupeOrFieldMarkEnable = true;
        } else {
            this.dupeOrFieldMarkEnable = false;
        }
        if (fieldFormatWord1BitArray[4] == 1) {
            this.modified = true;
        } else {
            this.modified = false;
        }
        this.fieldShiftEditSpecification = fieldFormatWord1BitArray[5] + '' + fieldFormatWord1BitArray[6] + '' + fieldFormatWord1BitArray[7];

        const fieldFormatWord2BitArray = x(data[1]).bitArray;
        if (fieldFormatWord2BitArray[0] == 1) {
            this.autoEnter = true;
        } else {
            this.autoEnter = false;
        }
        if (fieldFormatWord2BitArray[1] == 1) {
            this.fieldExitRequired = true;
        } else {
            this.fieldExitRequired = false;
        }
        if (fieldFormatWord2BitArray[2] == 1) {
            this.monocase = true;
        } else {
            this.monocase = false;
        }
        if (fieldFormatWord2BitArray[4] == 1) {
            this.mandatoryEnter = true;
        } else {
            this.mandatoryEnter = false;
        }
        this.rightAdjustMandatoryFill = fieldFormatWord2BitArray[5] + '' + fieldFormatWord2BitArray[6] + '' + fieldFormatWord2BitArray[7];

        const fieldAttribute2BitArray = x(data[2]).bitArray;
        this.attributeId = fieldAttribute2BitArray[0] + '' + fieldAttribute2BitArray[1] + '' + fieldAttribute2BitArray[2];
        if (fieldAttribute2BitArray[3] == 1) {
            this.columnSeparator = true;
        } else {
            this.columnSeparator = false;
        }
        if (fieldAttribute2BitArray[3] == 1) {
            this.blink = true;
        } else {
            this.blink = false;
        }
        if (fieldAttribute2BitArray[4] == 1) {
            this.underscore = true;
        } else {
            this.underscore = false;
        }
        if (fieldAttribute2BitArray[5] == 1) {
            this.intensity = true;
        } else {
            this.intensity = false;
        }
        if (fieldAttribute2BitArray[6] == 1) {
            this.reverse = true;
        } else {
            this.reverse = false;
        }
        if (this.underscore && this.intensity && this.reverse) {
            this.nondisplay = true;
            this.underscore = false;
            this.intensity = false;
            this.reverse = false;
        }

        this.fieldLength = x(data.slice(4, 5)).number;

        // Check if repeatedCharacter exists
        if (data.length < 5 || (data[6] > 0x00 && data[6] < 0x20)) {
            this.length--;
            return;
        }

        const dataSliced = data.slice(5, 5 + this.fieldLength);
        this.repeatedCharacter = x(dataSliced).convertedString;

        this.length += this.fieldLength-1;
    }
}

class Tn5250MessageEscapeCommandObjectWriteToDisplayOrderCommandRepeatToAddress extends Tn5250MessageEscapeCommandObjectWriteToDisplayOrderCommandSetBufferAddress {
    
    constructor(data = null) {
        super(data);
        this.orderCode = Tn5250MessageEscapeCommandObjectWriteToDisplayOrderCommand.ORDER_CODE.RA_REPEAT_TO_ADDRESS;
    }
}

class Tn5250MessageEscapeCommandObjectWriteToDisplayOrderCommandInsertCursor extends Tn5250MessageEscapeCommandObjectWriteToDisplayOrderCommand {
    
    constructor(data = null) {
        super(data);

        this.rowAddress = 0;
        this.columnAddress = 0;

        this.orderCode = Tn5250MessageEscapeCommandObjectWriteToDisplayOrderCommand.ORDER_CODE.IC_INSERT_CURSOR;
    }

    deserialize(data) {
        this.length += 2;
        this.rowAddress = x(data[0]).number;
        this.columnAddress = x(data[1]).number;
    }
}
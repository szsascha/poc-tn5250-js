"use strict";

import { x, bytesFromString } from "./hexutils.js";
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
        this.escapeCommands = [];

        // Printer startup response record
        // https://datatracker.ietf.org/doc/html/rfc2877#section-9
        this.isPrinterStartupResponseRecord = false;
        this.printerStartupResponseCode = null;
        this.printerStartupSystemName = null;
        this.printerStartupObjectName = null;

    }

    serialize() {
        // Alsways end with 'FFEF'X
        let serialized = [];
        this.commands.forEach(bytes => {
            serialized = serialized.concat(bytes);
        });
        return x(serialized);
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

class Tn5250MessageEscapeCommand {

    constructor(data) {
        this.data = data;
        this.commandCode = null;
    }

    serialize() {
        Logger.log("serialize() not implemented");
    }

    deserialize(data) {
        Logger.log("deserialize() not implemented");
    }

    static get COMMAND_CODE() {
        return {
            CU_CLEAR_UNIT: 0x40,
            WTD_WRITE_TO_DISPLAY: 0x11,
            READ_MDT_FIELDS: 0x52
        }
    }

}

class Tn5250MessageEscapeCommandWriteToDisplay extends Tn5250MessageEscapeCommand {

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
            RESET_BLINKING_CURSOR: false,
            SET_BLINKING_CURSOR: false,
            UNLOCK_THE_KEYBOARD_AND_RESET_ANY_PENDING_AID_BYTES: false,
            SOUND_ALARM: false,
            SET_MESSAGE_WAITING_INDICATOR_OFF: false,
            SET_MESSAGE_WAITING_INDICATOR_ON: false
        }

        this.orderCommands = [];
    }

}

class Tn5250MessageEscapeCommandWriteToDisplayOrderCommand {
    
    constructor(data = null) {
        this.data = data;
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

class Tn5250MessageEscapeCommandWriteToDisplayOrderCommandStartOfHeader extends Tn5250MessageEscapeCommandWriteToDisplayOrderCommand {
    
    constructor(data = null) {
        super(data);

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

}

class Tn5250MessageEscapeCommandWriteToDisplayOrderCommandSetBufferAddress extends Tn5250MessageEscapeCommandWriteToDisplayOrderCommand {
    
    constructor(data = null) {
        super(data);

        this.rowAddress = 0;
        this.columnAddress = 0;
        this.repeatedCharacter = '';
    }
}

class Tn5250MessageEscapeCommandWriteToDisplayOrderCommandStartOfField extends Tn5250MessageEscapeCommandWriteToDisplayOrderCommand {
    
    constructor(data = null) {
        super(data);

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
        this.reverseImage = false;
        this.length = 0;
        this.repeatedCharacter = null;
    }
}

class Tn5250MessageEscapeCommandWriteToDisplayOrderCommandRepeatToAddress extends Tn5250MessageEscapeCommandWriteToDisplayOrderCommand {
    
    constructor(data = null) {
        super(data);

        this.rowAddress = 0;
        this.columnAddress = 0;
        this.repeatCharacter = '';
    }
}

class Tn5250MessageEscapeCommandReadMdtFields extends Tn5250MessageEscapeCommandWriteToDisplay {

    constructor(data = null) {
        super(data);
    }

}
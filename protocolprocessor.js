"use strict";

import { TelnetMessage, TelnetMessageChunkObjectNewEnvironment, TelnetMessageChunkObject, createTelnetMessageChunkObject, Tn5250Message } from "./protocol.js";
import { Logger } from './logging.js'
import { x } from "./hexutils.js";
import { Session, SessionState } from './session.js'

class ProtocolProcessor {

    constructor() {
        if (new.target === ProtocolProcessor) {
          throw new TypeError("Cannot construct ProtocolProcessor instances directly");
        }
    }

    process(data) {
        Logger.log("process() not implemented");
    }

}

export class TelnetMessageProcessor extends ProtocolProcessor {

    process(data) {
        const message = TelnetMessage.fromSerialized(data);
        Logger.log('[ RCV ] JSN: ' + JSON.stringify(message));

        let result = [];

        message.chunks.forEach(chunk => {
            if (chunk.command == TelnetMessage.COMMAND.DO) {
                result = result.concat(
                    this.processResultArrayToTelnetMessage(this.processDo(chunk))
                );
            }
    
            if (chunk.command == TelnetMessage.COMMAND.WILL) {
                result = result.concat(
                    this.processResultArrayToTelnetMessage(this.processWill(chunk))
                );
            }
    
            if (chunk.command == TelnetMessage.COMMAND.SB_SUBNEGOTIATION) {
                result = result.concat(
                    this.processResultArrayToTelnetMessage(this.processSB(chunk))
                );
            }
        });

        return result;
    }

    processResultArrayToTelnetMessage(array) {
        const telnetMessageArgArray = [];
        
        array.forEach(messageArray => {
            let telnetMessageArg = [ messageArray[0] ];
            if (messageArray.length > 1) telnetMessageArg = telnetMessageArg.concat(messageArray[1]);
            if (messageArray.length > 2) telnetMessageArg = telnetMessageArg.concat(messageArray[2]);

            telnetMessageArgArray.push(telnetMessageArg);
        });

        return [ TelnetMessage.create(telnetMessageArgArray) ];        
    }

    processDo(chunk) {
        if (chunk.option == TelnetMessage.COMMAND_OPTION.NEW_ENVIRONMENT) {
            Logger.log('[ RCV ] CMD: DO NEW ENVIRONMENT');
            Logger.log('[ SND ] CMD: WILL NEW ENVIRONMENT');
            return [[ 
                TelnetMessage.COMMAND.WILL,
                TelnetMessage.COMMAND_OPTION.NEW_ENVIRONMENT
            ]];
        }
        if (chunk.option == TelnetMessage.COMMAND_OPTION.TERMINAL_TYPE) {
            Logger.log('[ RCV ] CMD: DO TERMINAL TYPE');
            Logger.log('[ SND ] CMD: WILL TERMINAL TYPE');
            return [[
                TelnetMessage.COMMAND.WILL,
                TelnetMessage.COMMAND_OPTION.TERMINAL_TYPE
            ]];
        }
        if (chunk.option == TelnetMessage.COMMAND_OPTION.END_OF_RECORD) {
            Logger.log('[ RCV ] CMD: DO END OF RECORD');
            Logger.log('[ SND ] CMD: WILL END OF RECORD');
            return [[
                TelnetMessage.COMMAND.WILL,
                TelnetMessage.COMMAND_OPTION.END_OF_RECORD
            ]];
        }
        if (chunk.option == TelnetMessage.COMMAND_OPTION.BINARY_TRANSMISSION) {
            Logger.log('[ RCV ] CMD: DO BINARY TRANSMISSION');
            Logger.log('[ SND ] CMD: WILL BINARY TRANSMISSION');
            return [[
                TelnetMessage.COMMAND.WILL,
                TelnetMessage.COMMAND_OPTION.BINARY_TRANSMISSION
            ]];
        }
    }

    processWill(chunk) {
        if (chunk.option == TelnetMessage.COMMAND_OPTION.END_OF_RECORD) {
            Logger.log('[ RCV ] CMD: WILL END OF RECORD');
            Logger.log('[ SND ] CMD: DO END OF RECORD');
            return [[
                TelnetMessage.COMMAND.DO,
                TelnetMessage.COMMAND_OPTION.END_OF_RECORD
            ]];
        }
        if (chunk.option == TelnetMessage.COMMAND_OPTION.BINARY_TRANSMISSION) {
            Logger.log('[ RCV ] CMD: WILL BINARY TRANSMISSION');

            // Switch to 5250 mode
            Session.messageProcessor = new Tn5250Processor();
            Session.state = SessionState.ACTIVE;

            Logger.log('[ SND ] CMD: DO BINARY TRANSMISSION');
            return [[
                TelnetMessage.COMMAND.DO,
                TelnetMessage.COMMAND_OPTION.BINARY_TRANSMISSION
            ]];
        }   
    }

    processSB(chunk) {
        if (chunk.option == TelnetMessage.COMMAND_OPTION.TERMINAL_TYPE) {
            let data = '';
            if (chunk.object.command == TelnetMessageChunkObject.COMMAND.SEND) data = ' - SEND YOUR TERMINAL TYPE'
            Logger.log('[ RCV ] CMD: SB SUBNEGOTIATION TERMINAL TYPE' + data);

            const outputChunkObject = createTelnetMessageChunkObject(TelnetMessage.COMMAND.SB_SUBNEGOTIATION, TelnetMessage.COMMAND_OPTION.TERMINAL_TYPE);
            outputChunkObject.command = TelnetMessageChunkObject.COMMAND.IS;
            outputChunkObject.terminalType = Tn5250Message.TERMINAL.IBM31792;;

            Logger.log('[ SND ] CMD: SB SUBNEGOTIATION TERMINAL TYPE - HERE IS MY TERMINAL TYPE ' + x(outputChunkObject.data).string);
            return [[
                TelnetMessage.COMMAND.SB_SUBNEGOTIATION,
                TelnetMessage.COMMAND_OPTION.TERMINAL_TYPE,
                outputChunkObject.data
            ], [
                TelnetMessage.COMMAND.SE_END_OF_SUBNEGOTIATION_PARAMETERS
            ]];
            // TODO TERMINAL have to be sent ALWAYS before ENVIRONMENT OPTIONS
        }
        if (chunk.option == TelnetMessage.COMMAND_OPTION.NEW_ENVIRONMENT) {
            Logger.log('[ RCV ] CMD: SB SUBNEGOTIATION NEW ENVIRONMENT ' + x(chunk.data).string);

            const inputChunkObject = chunk.object.getSend(
                TelnetMessageChunkObjectNewEnvironment.CODE.USERVAR, 
                TelnetMessageChunkObjectNewEnvironment.USERVAR.IBMRSEED
            );

            const outputChunkObject = createTelnetMessageChunkObject(TelnetMessage.COMMAND.SB_SUBNEGOTIATION, TelnetMessage.COMMAND_OPTION.NEW_ENVIRONMENT);
            outputChunkObject.pushIs(
                TelnetMessageChunkObjectNewEnvironment.CODE.USERVAR,
                TelnetMessageChunkObjectNewEnvironment.USERVAR.IBMRSEED,
                TelnetMessageProcessor.generateRandomSeed()
            );
            outputChunkObject.pushIs(
                TelnetMessageChunkObjectNewEnvironment.CODE.USERVAR,
                TelnetMessageChunkObjectNewEnvironment.USERVAR.DEVNAME
            );
            outputChunkObject.pushSend(
                TelnetMessageChunkObjectNewEnvironment.CODE.USERVAR,
                TelnetMessageChunkObjectNewEnvironment.USERVAR.KBDTYPE,
                'AGE'
            );
            outputChunkObject.pushSend(
                TelnetMessageChunkObjectNewEnvironment.CODE.USERVAR,
                TelnetMessageChunkObjectNewEnvironment.USERVAR.CODEPAGE,
                '1141'
            );
            outputChunkObject.pushSend(
                TelnetMessageChunkObjectNewEnvironment.CODE.USERVAR,
                TelnetMessageChunkObjectNewEnvironment.USERVAR.CHARSET,
                '695'
            );
            outputChunkObject.pushSend(
                TelnetMessageChunkObjectNewEnvironment.CODE.USERVAR,
                TelnetMessageChunkObjectNewEnvironment.USERVAR.IBMSENDCONFREC,
                'YES'
            );

            Logger.log('[ SND ] CMD: SB SUBNEGOTIATION NEW ENVIRONMENT ' + x(outputChunkObject.data).string);
            return [[
                TelnetMessage.COMMAND.SB_SUBNEGOTIATION,
                TelnetMessage.COMMAND_OPTION.NEW_ENVIRONMENT,
                outputChunkObject.data
            ], [
                TelnetMessage.COMMAND.SE_END_OF_SUBNEGOTIATION_PARAMETERS
            ]];
        }

    }

    static generateRandomSeed() {
        return x([...Array(16)].map(() => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()).array;
    }

}

export class Tn5250Processor extends ProtocolProcessor {

    constructor() {
        super();
    }

    process(data) {
        const message = Tn5250Message.fromSerialized(data);
        Logger.log('[ RCV ] JSN: ' + JSON.stringify(message));
        
        // Handle packet fragmentation (only for 2 packets. More aren't to be expected atm)
        let message2 = null;
        let packetSize = x(data).array.length - 2; // -2 because of 2 bytes for record length
        if (message.logicalRecordLength < packetSize) {
            const nextData = x(data).array.slice(message.logicalRecordLength + 2);
            message2 = Tn5250Message.fromSerialized(nextData);
            Logger.log('[ RCV ] JSN: ' + JSON.stringify(message2));
        }

        return [];
    }

}
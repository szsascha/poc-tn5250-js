import { TelnetMessage } from "./protocol.js";
import { TelnetMessageProcessor } from "./protocolprocessor.js";
import { Client } from "./networking.js";
import { Logger } from './logging.js'

let client = new Client();
client.connect(23, "pub400.com");

let messageProcessor = new TelnetMessageProcessor();

client.onReceive(function (data) {
    const message = TelnetMessage.fromSerialized(data);
    Logger.log('[ RCV ] JSN: ' + JSON.stringify(message));

    let result = messageProcessor.process(message);
    
    result.forEach(element => client.write(element.serialize().buffer));
});
import { TelnetMessage, Tn5250Message } from "./protocol.js";
import { x } from "./hexutils.js";
import { Client } from "./networking.js";


/*console.log(TelnetMessage.TYPE);
console.log(Tn5250Message.TERMINAL.IBM31792);
console.log(Tn5250Message.COMMAND.TEST == 0xff); */

/*console.log(
    x([0xff, 0xfa]).string
);

new TelnetMessage();*/

let client = new Client();
client.connect(23, "pub400.com");

client.onReceive(function (data) {
    console.log(data);
});
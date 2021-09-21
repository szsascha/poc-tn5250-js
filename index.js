import { TelnetMessage, Tn5250Message } from "./protocol.js";

console.log(TelnetMessage.TYPE);
console.log(Tn5250Message.TERMINAL.IBM31792);
console.log(Tn5250Message.COMMAND.TEST == 0xff);
new TelnetMessage();
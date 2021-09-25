"use strict";

import { Client } from "./networking.js";
import { TelnetMessageProcessor } from "./protocolprocessor.js";

class SessionSingleton {
    
    constructor() {
        this.state = SessionSingleton.STATE.INIT;
        this.config = new SessionConfiguration();
        this.messageProcessor = new TelnetMessageProcessor();
        this.client = new Client();
    }

    start() {
        this.client.connect(this.config.port, this.config.host);

        this.client.onReceive(data => {      
            const result = this.messageProcessor.process(data);
            result.forEach(element => this.client.write(element.serialize().buffer));
        });
    }

    static get STATE() {
        return {
            INIT: 'init',
            NEGOTIATION: 'negotiation',
            ACTIVE: 'active'
        };
    }

}

class SessionConfiguration {

    constructor() {
        this.port = 23;
        this.host = null;
    }

}

export const Session = new SessionSingleton();
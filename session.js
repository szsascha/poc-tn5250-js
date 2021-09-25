"use strict";

import { Client } from "./networking.js";
import { TelnetMessageProcessor } from "./protocolprocessor.js";

export const SessionState = {
    INIT: 'init',
    NEGOTIATION: 'negotiation',
    ACTIVE: 'active'
};

class SessionSingleton {
    
    constructor() {
        this.state = SessionState.INIT;
        this.config = new SessionConfiguration();
        this.messageProcessor = new TelnetMessageProcessor();
        this.client = new Client();
    }

    start() {
        this.client.connect(this.config.port, this.config.host);

        this.state = SessionState.NEGOTIATION;
        this.client.onReceive(data => {      
            const result = this.messageProcessor.process(data);
            result.forEach(element => this.client.write(element.serialize().buffer));
        });
    }

}

class SessionConfiguration {

    constructor() {
        this.port = 23;
        this.host = null;
    }

}

export const Session = new SessionSingleton();
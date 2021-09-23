"use strict";

import cptable from "codepage";

export class Codepage {

    constructor(codepage) {
        this.codepage = codepage;
    }

    encode(string) {
        return cptable.utils.encode(this.codepage, string);
    }

    decode(bytearray) {
        return cptable.utils.decode(this.codepage, bytearray);
    }

}
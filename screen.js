"use strict";

export class Screen {
    
    constructor() {
        this.width = 80;
        this.height = 24;
        this.buffer = [];

    }

    init() {
        for (var y = 0; y < this.height; y++) {
            this.buffer.push([]);
            for (var x = 0; x < this.width; x++) {
                this.buffer[y] += ' ';
            }
        }
    }

    push(y, x, text) {
        // Arrays starts at 0
        x--;
        y--;

        if (x+1 >= this.width) {
            y++;
            x = x - (this.width-1);
        }

        const currentLine = this.buffer[y];
        const newLine = [currentLine.slice(0, x), text, currentLine.slice(x + text.length)].join('');
        this.buffer[y] = newLine;
    }

    render() {
        let i = 1;
        this.buffer.forEach(line => {
            let prefix = i;
            if (prefix < 10) prefix = '0'+i;
            prefix += '  ';
            console.log(prefix + line);
            i++;
        });
    }

    clear() {
        console.clear();
    }

}
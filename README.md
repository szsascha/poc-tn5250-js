# Proof of concept tn5250 client in javascript

Simple proof of concept for a 5250 telnet client in javascript.
Started as a little weekend project just to learn more about the tn5250 protocol. 

This project isn't really runnable at the moment. It just receives, display and sent data to an IBM i via tn5250.

There are many known bugs and errors in this project. Furthermore many things are not really implemented.

## Requirements
1. Node.js installed on your pc
2. Access to an IBM i (like pub400.com)

## Setup
1. Clone this repository
2. Run `npm install`
3. Copy `credentials.example.js` to `credentials.js`
4. Insert your credentials to `credentials.js`

## Run the script

1. `npm run start`
2. An output should be appear in your console. You should see a login screen and some hex outputs and maybe some exceptions. That's the sign that the connection is working. More than seeing the output and sending some inputs by code is this proof of concept currently not doing.
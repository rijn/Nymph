// Setup basic express server
var express = require('express');
var app = express();
var webSocketServer = require('http').createServer(app);
var webIO = require('socket.io')(webSocketServer);
var net = require('net');

var client = [];
var rawSocketList = [];

var broadcastService = {
    // webSocket:null,
    // rawSocket:[],
    broadcast: function(data, fromClient) {
        // console.log(data);
        console.log(((data.type === 'data') ? '{"rawData":"' + data.data.raw + '"}' : data));
        webIO.emit(
            'message',
            ((data.type === 'data') ? {
                type: 'data',
                data: {
                    source : fromClient.remoteAddress,
                    data : data.data.raw,
                },
            } : data)
        );
        var cleanup = [];
        // console.log(rawSocketList);
        for (var i = 0; i < rawSocketList.length; i += 1) {
            if (fromClient !== rawSocketList[i]) {

                if (rawSocketList[i].writable) {
                    if(typeof data === 'string')
                        rawSocketList[i].write(data);
                    else
                        rawSocketList[i].write(JSON.stringify(data));
                } else {
                    cleanup.push(rawSocketList[i]);
                    rawSocketList[i].destroy();
                }

            }
        }
        for (i = 0; i < cleanup.length; i += 1) {
            rawSocketList.splice(rawSocketList.indexOf(cleanup[i]), 1);
        }
    },
};

var webSocket = {};

var webSocket = {
    port: 27667,
    client: [],
    setHandler: function(io) {
        io.on('connection', function(socket) {

            var info = {
                type: 'terminal',
                address: socket.request.connection.remoteAddress,
                port: socket.id,
                // object: socket,
            };

            client.push(info);

            broadcastService.broadcast({
                type: 'connect',
                data: info,
            });

            broadcastService.broadcast({
                type: 'client',
                data: client,
            });

            // broadcastService.webSocket = socket;

            // client.push(client.count+1);

            socket.on('message', function(obj) {
                // console.log(obj.operand);
                switch (obj.type) {
                    case 'serverinfo':
                        socket.emit(
                            'message', {
                                type: 'serverinfo',
                                data: 'NYMPH SERVER 1',
                            }
                        );
                        break;
                    case 'data':
                        socket.broadcast.emit(
                            'message', {
                                type: 'data',
                                data: obj.data,
                            }
                        );
                }
            });

            socket.on('disconnect', function() {
                broadcastService.broadcast({
                    type: 'disconnect',
                    data: info,
                });
                for (var i = 0; i < client.length; i++) {
                    if (client[i].address == info.address && client[i].port == info.port) {
                        client.splice(i, 1);
                    }
                }
                broadcastService.broadcast({
                    type: 'client',
                    data: client,
                });
            });
        });
    },
    setListener: function(server, port) {
        server.listen(port, function() {
            console.log('webSocket listening at port %d', port);
        });
    },
    start: function() {
        webSocket.setListener(webSocketServer, webSocket.port);
        webSocket.setHandler(webIO);
    },
}

var rawSocket = {
    port: 27666,
    server: net.createServer(function(socket) {

        var info = {
            type: 'source',
            address: socket.remoteAddress,
            port: socket.remotePort,
            count: 0,
            // object: socket,
        };

        rawSocketList.push(socket);

        var body = '';

        socket.setEncoding('utf8');

        // console.log('CONNECTED ' + info.address + ' : ' + info.port);

        client.push(info);

        broadcastService.broadcast({
            type: 'connect',
            data: info,
        }, socket);

        broadcastService.broadcast({
            type: 'client',
            data: client,
        }, socket);

        socket.on('data', function(chunk) {
            // console.log('DATA ' + info.address + ' : ' + obj);
            // console.log(obj);
            var obj = null;

            try {
                obj = JSON.parse(chunk);
            } catch (e) {
                console.log(e);
            }

            // console.log(obj);
            // body += chunk;
            // console.log("buffer length:"+buffer.length); 
            broadcastService.broadcast({
                type: 'data',
                data: {
                    source: info.address,
                    data: obj,
                    raw: chunk,
                },
            }, socket);
            // socket.write('You said "' + obj + '"\r\n');
        });

        // socket.on('end', function () {
        //     try {
        //         var data = JSON.parse(body);
        //         console.log(data);
        //     } catch (er) {
        //         console.log(er);
        //     };
        // });


        socket.on('close', function(data) {
            broadcastService.broadcast({
                type: 'disconnect',
                data: info,
            }, socket);
            for (var i = 0; i < client.length; i++) {
                if (client[i].address == info.address && client[i].port == info.port) {
                    client.splice(i, 1);
                }
            }
            for (var i = 0; i < rawSocketList.length; i++) {
                if (rawSocketList[i] == socket) {
                    rawSocketList.splice(i, 1);
                }
            }
            
            broadcastService.broadcast({
                type: 'client',
                data: client,
            }, socket);
            // console.log('CLOSED ' + info.address + ' : ' + info.port);
        });

        socket.on('error', function(err) {
            for (var i = 0; i < client.length; i++) {
                if (client[i].address == info.address && client[i].port == info.port) {
                    client.splice(i, 1);
                }
            }
            for (var i = 0; i < rawSocketList.length; i++) {
                if (rawSocketList[i] == socket) {
                    rawSocketList.splice(i, 1);
                }
            }
            console.log('ERROR');
        });

        socket.pipe(socket);

        socket.write('{"connection":"success"}');

    }),
    start: function() {
        // rawSocket.server.maxConnections(10);
        rawSocket.server.listen(rawSocket.port, function() {
            console.log('rawSocket listening at port %d', rawSocket.port);
        });
    },
};

rawSocket.start();
webSocket.start();

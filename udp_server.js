var PORT = 33333;
var HOST = "127.0.0.1";

var dgram = require("dgram");
var msg = new Buffer("json goes here");

var server = dgram.createSocket("udp4");

server.on("listening", function() {
	var address = server.address();
	console.log("UDP Server listening on " + address.address + ":" + address.port);
});

server.on("message", function (msg, remote) {
	console.log(remote.address + ":" + remote.port + " - " + msg);
});

server.bind(PORT, HOST);

var PORT = 55056;
var HOST = "169.254.255.255";

var dgram = require("dgram");
var msg = new Buffer("json goes here");

var client = dgram.createSocket("udp4");
client.bind(PORT, function() {
	client.setBroadcast(true);

	client.send(msg, 0, msg.length, PORT, HOST, function(err, bytes) {
		if (err) throw err;
		console.log("UDP msg sent");
		client.close();
	});
});

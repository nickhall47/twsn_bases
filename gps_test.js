// Libraries
var gpsd = require("node-gpsd");

// Globals
var gpsdListener = new gpsd.Listener();

gpsdListener.on("TPV", function (data) {
	console.log(data);
	//console.log(data.lat + ", " + data.lon);
});

gpsdListener.connect(function() {
	gpsdListener.watch({ class: "WATCH", json: true, nmea: false });
});

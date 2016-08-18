// Libraries
var gpsd = require("node-gpsd");
var util = require("util");
var spawn = require("child_process").spawn;

// Globals
var gpsdListener = new gpsd.Listener();
var currLat;
var currLon;

gpsdListener.on("TPV", function (data) {
	//console.log(data);
	//console.log(data.lat + ", " + data.lon);
	currLat = data.lat;
	currLon = data.lon;
});

gpsdListener.connect(function() {
	gpsdListener.watch({ class: "WATCH", json: true, nmea: false });
});

module.exports = {
	gpsHandlerInit: function () {
		var enableGpsProcess = spawn("./enable_nodejs_gps_access.sh");
	},
	
	getGpsLatLon: function () {
		return {
			lat: currLat,
			lon: currLon
		};
	}
};

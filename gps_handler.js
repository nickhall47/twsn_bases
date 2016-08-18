// Libraries
var gpsd = require("node-gpsd");

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
	getGpsLatLon: function () {
		return {
			lat: currLat,
			lon: currLon
		};
	}
};

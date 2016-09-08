module.exports = EventDataPoint;

function EventDataPoint(timestamp, id, value, type, lat, lon) {
	this.timestamp = timestamp;
	this.id = id;
	this.value = value;
	this.type = type;
	this.lat = lat;
	this.lon = lon;
}

EventDataPoint.prototype.print = function() {
	console.log(this.timestamp + ", " + 
				this.id + ", " + 
				this.value + ", " + 
				this.type + ", " + 
				this.lat + ", " + 
				this.lon);
};

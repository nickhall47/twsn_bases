module.exports = AcceleDataPoint;

function AcceleDataPoint(timestamp, id, x, y, z, lat, lon) {
	this.timestamp = timestamp;
	this.id = id;
	this.x = x;
	this.y = y;
	this.z = z;
	this.lat = lat;
	this.lon = lon;
}

AcceleDataPoint.prototype.print = function() {
	console.log(this.timestamp + ", " + 
				this.id + ", " + 
				this.x + ", " + 
				this.y + ", " + 
				this.z + ", " + 
				this.lat + ", " + 
				this.lon);
};

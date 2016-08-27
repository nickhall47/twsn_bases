module.exports = StrainDataPoint;

function StrainDataPoint(timestamp, id, value, lat, lon) {
	this.timestamp = timestamp;
	this.id = id;
	this.value = value;
	this.lat = lat;
	this.lon = lon;
}

StrainDataPoint.prototype.print = function() {
	console.log(this.timestamp + ", " + 
				this.id + ", " + 
				this.value + ", " + 
				this.lat + ", " + 
				this.lon);
};

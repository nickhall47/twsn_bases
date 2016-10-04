module.exports = AcceleDataPoint;

function AcceleDataPoint(timestamp, id, x, y, z) {
	this.timestamp = timestamp;
	this.id = id;
	this.x = x;
	this.y = y;
	this.z = z;
}

AcceleDataPoint.prototype.print = function() {
	console.log(this.timestamp + ", " + 
				this.id + ", " + 
				this.x + ", " + 
				this.y + ", " + 
				this.z);
};

AcceleDataPoint.prototype.toJsonString = function() {
	return JSON.stringify({
		"type":2,
		"timestamp": this.timestamp,
		"id": this.id,
		"x": this.x,
		"y": this.y,
		"z": this.z});
};

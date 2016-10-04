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
		"timestamp": this.timestamp,
		"id": this.id,
		"x": convertValueToGs(this.x),
		"y": convertValueToGs(this.y),
		"z": convertValueToGs(this.z)});
};

function convertValueToGs(accelValue) {
	return accelValue * 0.004;
};


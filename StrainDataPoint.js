module.exports = StrainDataPoint;

function StrainDataPoint(timestamp, id, value) {
	this.timestamp = timestamp;
	this.id = id;
	this.value = value;
}

StrainDataPoint.prototype.print = function() {
	console.log(this.timestamp + ", " + 
				this.id + ", " + 
				this.value);
};

StrainDataPoint.prototype.toJsonString = function() {
	return JSON.stringify({
		"timestamp": this.timestamp,
		"id": this.id,
		"temperature": convertValueToDegC(this.value)});
};

function convertValueToDegC(analogValue) {
	return ((analogValue * 1.0 / 2047) * 3 - 0.6) / 0.01;
};

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
		"type":1,
		"timestamp": this.timestamp,
		"id": this.id,
		"value": this.value});
};

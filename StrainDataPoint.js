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

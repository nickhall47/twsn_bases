module.exports = EventDataPoint;

function EventDataPoint(timestamp, id, value, type) {
	this.timestamp = timestamp;
	this.id = id;
	this.value = value;
	this.type = type;
}

EventDataPoint.prototype.print = function() {
	console.log(this.timestamp + ", " + 
				this.id + ", " + 
				this.value + ", " + 
				this.type);
};

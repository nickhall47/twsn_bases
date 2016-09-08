
// Constants
const EVENT_THRESHOLD = 4096; // = 0.5g on when ADXL345 set to +/-4g scale
const PREV_VALUES_LENGTH = 3;

module.exports = {
	eventDetectorInit: function (peripheral) {
		peripheral.prevValues = new Array(PREV_VALUES_LENGTH);
		for (var i = 0; i < PREV_VALUES_LENGTH; i++) {
			peripheral.prevValues[i] = -1;
		}
		
		peripheral.prevValuesPointer = 0;
		peripheral.eventDirection = -1;
	},
	
	eventDetect: eventTypeDetected = function (peripheral, currentValue) {
		// Check for no initial values
		var initialValues = false;
		for (var i = 0; i < PREV_VALUES_LENGTH; i++) {
			if (peripheral.prevValues[i] == -1) {
				initialValues = true;
				break;
			}
		}
		
		if (!initialValues) {
			// Get avg
			var avg = 0;
			for (var i = 0; i < PREV_VALUES_LENGTH; i++) {
				avg += peripheral.prevValues[i];
			}
			avg /= PREV_VALUES_LENGTH;
			
			// Check for event
			if (avg + EVENT_THRESHOLD < currentValue) { // Rapid increase
				if (peripheral.eventDirection != 1) {
					console.log("Event type 2 @ " + peripheral.id + ": " + avg + " < " + currentValue);
					peripheral.eventDirection = 1;
					eventTypeDetected = 2;
				}
			}
			else if (avg - EVENT_THRESHOLD > currentValue) { // Rapid decrease
				if (peripheral.eventDirection != 0) {
					console.log("Event type 1 @ " + peripheral.id + ": " + avg + " > " + currentValue);
					peripheral.eventDirection = 0;
					eventTypeDetected = 1;
				}
			}
			else
			{
				eventTypeDetected = 0;
			}
		}
		
		// Update prev values
		peripheral.prevValues[peripheral.prevValuesPointer] = currentValue;
		peripheral.prevValuesPointer++;
		if (peripheral.prevValuesPointer >= PREV_VALUES_LENGTH) {
			peripheral.prevValuesPointer = 0;
		}
		
		return eventTypeDetected;
	}
};

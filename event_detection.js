
// Constants
const EVENT_THRESHOLD = 100;
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
	
	eventDetect: function (peripheral, currentValue) {
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
					console.log("Event type 1: " + avg + " < " + currentValue);
					peripheral.eventDirection = 1;
				}
			}
			else if (avg - EVENT_THRESHOLD > currentValue) { // Rapid decrease
				if (peripheral.eventDirection != 0) {
					console.log("Event type 0: " + avg + " > " + currentValue);
					peripheral.eventDirection = 0;
				}
			}
		}
		
		// Update prev values
		peripheral.prevValues[peripheral.prevValuesPointer] = currentValue;
		peripheral.prevValuesPointer++;
		if (peripheral.prevValuesPointer >= PREV_VALUES_LENGTH) {
			peripheral.prevValuesPointer = 0;
		}
	}
};

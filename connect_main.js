var noble = require("noble");

const PERIPHERAL_NAME = "Train";
const SENSOR_SERVICE_UUID = "0000000000001000800000805f9b34f0";
const ACCELE_CH_UUID = "0000000000001000800000805f9b34f1";
const STRAIN_CH_UUID = "0000000000001000800000805f9b34f2";

var peripherals = [];


noble.on("stateChange", function(state) {
    if (state === "poweredOn") {
        noble.startScanning();
    } else {
        noble.stopScanning();
    }
});

noble.on("discover", function(peripheral) {
	if ((peripheral.advertisement.localName == PERIPHERAL_NAME) && (peripheral.connectable == true)) {
		if (JSON.stringify(peripheral.advertisement.serviceUuids).includes(SENSOR_SERVICE_UUID)) {
			console.log("Found Train Node with id: " + peripheral.id);
			
			peripherals[peripherals.length] = peripheral;
		
			// Connect
			peripherals[peripherals.length-1].connect(function(error) {
				console.log("Connecting to: " + peripheral.id);
		
				peripheral.discoverAllServicesAndCharacteristics(function(error, services, characteristics) {
					console.log("Discovering services of " + peripheral.id);
					peripheral.strainCh = null;
					
					// Find ch's
					characteristics.forEach(function(ch, chId) {
						if (ch.uuid == STRAIN_CH_UUID) {
							console.log("Found strain characteristic");
							peripheral.strainCh = ch;
						}
					});
					
					// Notify ch
					if (peripheral.strainCh != null) {
						peripheral.strainCh.on("data", function(data, isNotification) {
							console.log(peripheral.id + ": " + data.readUInt16BE(0));
						});
						
						//peripheral.strainCh.notify(true);
					}
				});
			});
		}
	}

    console.log();
});

var exitHandler = function exitHandler() {
	console.log("\nPreparing to exit...");
	
    peripherals.forEach(function(peripheral) {
        console.log("Disconnecting from " + peripheral.uuid + "...");
        peripheral.disconnect( function(){
			console.log("Disconnected from " + peripheral.uuid);
        });
    });

    // End process after 1.5 more seconds
    setTimeout(function(){
        process.exit();
    }, 1500);
}

function main() {
	process.on("SIGINT", exitHandler);
	
	// Wait before turning on notifys
	setTimeout(function(){
        peripherals.forEach(function(peripheral) {
			if (peripheral.strainCh != null) {
				console.log("Enabling notify for " + peripheral.uuid + "...");
				peripheral.strainCh.notify(true);
			}
		});
    }, 2000);
}

main();

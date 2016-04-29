var noble = require("noble");

const PERIPHERAL_NAME = "Train";
const SENSOR_SERVICE_UUID = "0000000000001000800000805f9b34f0";
const ACCELE_CH_UUID = "0000000000001000800000805f9b34f1";
const STRAIN_CH_UUID = "0000000000001000800000805f9b34f2";


noble.on('stateChange', function(state) {
    if (state === 'poweredOn') {
        noble.startScanning();
    } else {
        noble.stopScanning();
    }
});

noble.on('discover', function(peripheral) {
	if ((peripheral.advertisement.localName == PERIPHERAL_NAME) && (peripheral.connectable == true)) {
		if (JSON.stringify(peripheral.advertisement.serviceUuids).includes(SENSOR_SERVICE_UUID)) {
			console.log("Found Train Node with id: " + peripheral.id);
		}
		
		// Connect
		peripheral.connect(function(error) {
			peripheral.discoverAllServicesAndCharacteristics(function(error, services, characteristics) {
				var acceleCh = null;
				var strainCh = null;
				
				// Find ch's
				characteristics.forEach(function(ch, chId) {
					if (ch.uuid == ACCELE_CH_UUID) {
						console.log("Found acceleration characteristic");
						acceleCh = ch;
					}
					else if (ch.uuid == STRAIN_CH_UUID) {
						console.log("Found strain characteristic");
						strainCh = ch;
					}
				});
				
				// Notify ch
				if (strainCh != null) {
					strainCh.on('data', function(data, isNotification) {
						console.log(data.readUInt16BE(0));
					});
					
					strainCh.notify(true);
				}
			});
		});
	}

    console.log();
});


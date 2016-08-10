// Libraries
var noble = require("noble");
var fs = require("fs");
var sqlite3 = require("sqlite3").verbose();
var event_detection = require("./event_detection.js");

// Constants
const PERIPHERAL_NAME = "Train";
const SENSOR_SERVICE_UUID = "0000000000001000800000805f9b34f0";
const ACCELE_CH_UUID = "0000000000001000800000805f9b34f1";
const STRAIN_CH_UUID = "0000000000001000800000805f9b34f2";

// Globals
var peripherals = [];
var dbNodes;
var numConnectedNodes = 0;


function initDb() {
	// Open file
	var dbFile = "nodes.db";
	var dbExists = fs.existsSync(dbFile);
	
	if (!dbExists) {
		fs.openSync(dbFile, "w");
	}
	
	// Create DB handler
	dbNodes = new sqlite3.Database(dbFile);
	
	dbNodes.serialize(function() {
		// Create table
		if (!dbExists) {
			console.log("Creating sqlite3 DB tables...");
			dbNodes.run("CREATE TABLE strains (timestamp TEXT, node_id TEXT, value TEXT)");
			dbNodes.run("CREATE TABLE acceles (timestamp INTEGER, node_id TEXT, x INTEGER, y INTEGER, z INTEGER)");
			console.log("Created sqlite3 DB tables");
		}
	});
}


noble.on("stateChange", function(state) {
    if (state === "poweredOn") {
        noble.startScanning();
    } else {
        noble.stopScanning();
    }
});

noble.on("discover", function(peripheral) {
	// Check name and connectable
	if ((peripheral.advertisement.localName == PERIPHERAL_NAME) && (peripheral.connectable == true)) {
		// Check service
		if (JSON.stringify(peripheral.advertisement.serviceUuids).includes(SENSOR_SERVICE_UUID)) {
			// Log
			console.log("Found Train Node with id: " + peripheral.id);
			console.log("Total Train nodes found: " + (peripherals.length+1));
			
			// Add to array
			peripherals[peripherals.length] = peripheral;
		}
	}

    console.log();
});

function connectPeripheral(peripheral) {
	peripheral.connect(function(error) {
		console.log("Connecting to: " + peripheral.id);
		numConnectedNodes++;
		console.log("Total Train nodes connected: " + numConnectedNodes);
			
		peripheral.discoverAllServicesAndCharacteristics(function(error, services, characteristics) {
			console.log("Discovering services of " + peripheral.id);
			peripheral.strainCh = null;
			peripheral.acceleCh = null;
			
			// Find ch's
			characteristics.forEach(function(ch, chId) {
				if (ch.uuid == STRAIN_CH_UUID) {
					console.log("Found strain characteristic");
					peripheral.strainCh = ch;
				}
				if (ch.uuid == ACCELE_CH_UUID) {
					console.log("Found accele characteristic");
					peripheral.acceleCh = ch;
				}
			});
			
			// Prepare SQL stmt
			peripheral.strainStmt = dbNodes.prepare("INSERT INTO strains VALUES (?, ?, ?)");
			peripheral.acceleStmt = dbNodes.prepare("INSERT INTO acceles VALUES (?, ?, ?, ?, ?)");
			
			// Prepare event detection code
			event_detection.eventDetectorInit(peripheral);
			
			// Notify ch
			if (peripheral.strainCh != null) {
				peripheral.strainCh.on("data", function(data, isNotification) {
					//console.log(peripheral.id + ": " + data.readUInt16BE(0));
					peripheral.strainStmt.run(Date.now(), peripheral.id, data.readUInt16BE(0));
					
					// Check for event
					event_detection.eventDetect(peripheral, data.readUInt16BE(0));
				});
			}
			if (peripheral.acceleCh != null) {
				peripheral.acceleCh.on("data", function(data, isNotification) {
					//console.log(data.readUInt16BE(0) + "," + data.readUInt16BE(1) + "," + data.readUInt16BE(2));
					peripheral.acceleStmt.run(Date.now(), peripheral.id, 
											  data.readUInt16BE(0), data.readUInt16BE(1), data.readUInt16BE(2));
				});
			}
		});
	});
};



function enableNotifyOnPeripherals() {
	// Enable notify's
	peripherals.forEach(function(peripheral) {
		if (peripheral.strainCh != null) {
			console.log("Enabling strain notify for " + peripheral.uuid);
			peripheral.strainCh.notify(true);
		} else {
			console.log("Strain Ch not found for " + peripheral.uuid);
		}
		
		if (peripheral.acceleCh != null) {
			console.log("Enabling accele notify for " + peripheral.uuid);
			peripheral.acceleCh.notify(true);
		} else {
			console.log("Accele Ch not found for " + peripheral.uuid);
		}
	});
};

var exitHandler = function exitHandler() {
	console.log("\nPREPARING TO EXIT...");
	
	// Close all peripheral connections
    peripherals.forEach(function(peripheral) {
        console.log("Disconnecting from " + peripheral.uuid + "...");
        
        // End BLE connection
        peripheral.disconnect(function() {
			console.log("Disconnected from " + peripheral.uuid);
			
			// Finalise SQL statements
			peripheral.strainStmt.finalize();
			peripheral.acceleStmt.finalize();
        });
    });
    
    // Close DB
    console.log("\nClosing sqlite3 DB...");
	dbNodes.close(function(error) {
		if (error == null) {
			console.log("Closed sqlite3 DB");
		}
		else {
			console.log("Unable to close sqlite3 DB. " + error);
		}
	});

    // End process after 1.5 more seconds
    setTimeout(function(){
        process.exit();
    }, 1500);
}

function main() {
	// Enable exit handler
	process.on("SIGINT", exitHandler);
	
	// Init DB
	initDb();
	
	// Wait before connecting
	console.log("\nPress any key to stop recv ad mode, and connect to peripherals");
	
	process.stdin.setRawMode(true);
	process.stdin.resume();
	
	process.stdin.on("data", function(){
		// Disable 'press any key' to enable Ctrl-C exit
		process.stdin.setRawMode(false);
		console.log("\nConnecting to peripherals...");		

		// Connect to peripherals
		peripherals.forEach(connectPeripheral);
		
		// Wait before turning on notify's
		setTimeout(enableNotifyOnPeripherals, 12000);
    });
}

main();

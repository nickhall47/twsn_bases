#!/usr/bin/env node

// Libraries
var noble = require("noble");
var fs = require("fs");
var sqlite3 = require("sqlite3").verbose();

var event_detection = require("./event_detection.js");
var gps_handler = require("./gps_handler.js");
var StrainDataPoint = require("./StrainDataPoint");
var AcceleDataPoint = require("./AcceleDataPoint");
var EventDataPoint = require("./EventDataPoint");


// Flags
const EVENT_DETECTION_ENABLED_FLAG = 0;
const AUTO_SHUTDOWN_TIMEOUT_FLAG = 0;
const MAX_NUM_NODES = 6; // Optional (Set to 0 to have no max)
const MAX_DATA_BEFORE_INSERT = MAX_NUM_NODES*600; // ~60 secs worth of data in standard config
const MAX_DATA_BEFORE_INSERT_EVENTS = MAX_NUM_NODES*60;

// Constants
const PERIPHERAL_NAME = "Train";
const SENSOR_SERVICE_UUID = "0000000000001000800000805f9b34f0";
const ACCELE_CH_UUID = "0000000000001000800000805f9b34f1";
const STRAIN_CH_UUID = "0000000000001000800000805f9b34f2";

// Globals
var peripherals = [];

var dbNodes;
var strainStmt;
var acceleStmt;
var eventStmt;

var numConnectedNodes = 0;
var numNotifiesEnabled = 0;
var calledConnectToPeripherals = 0;
var checkAllDisconnectedInterval;

var strainDataCache = [];
var acceleDataCache = [];
var eventDataCache = [];



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
			dbNodes.run("CREATE TABLE strains (timestamp INTEGER, node_id TEXT, value INTEGER, lat INTEGER, lon INTEGER)");
			dbNodes.run("CREATE TABLE acceles (timestamp INTEGER, node_id TEXT, x INTEGER, y INTEGER, z INTEGER, lat INTEGER, lon INTEGER)");
			dbNodes.run("CREATE TABLE events (timestamp INTEGER, node_id TEXT, value INTEGER, type INTEGER, lat INTEGER, lon INTEGER)");
			console.log("Created sqlite3 DB tables");
		}
	});
	
	// Prepare SQL stmt
	strainStmt = dbNodes.prepare("INSERT INTO strains VALUES (?, ?, ?, ?, ?)");
	acceleStmt = dbNodes.prepare("INSERT INTO acceles VALUES (?, ?, ?, ?, ?, ?, ?)");
	eventStmt = dbNodes.prepare("INSERT INTO events VALUES (?, ?, ?, ?, ?, ?)");
}

noble.on("warning", function(msg) {
    console.log("NOBLE WARNING: " + msg);
});


noble.on("stateChange", function(state) {
    if (state === "poweredOn") {
		console.log("Scanning...");
        noble.startScanning(SENSOR_SERVICE_UUID);
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
			
			// Check if reached max
			if ((MAX_NUM_NODES != 0) && (peripherals.length >= MAX_NUM_NODES)) {
				connectToPeripherals();
			}
		}
	}

    console.log();
    
    // Keep scanning
    noble.startScanning(SENSOR_SERVICE_UUID);
});

function connectPeripheral(peripheral) {
	peripheral.connect(function(error) {
		console.log(peripheral.id + ": Connecting...");
		numConnectedNodes++;
		console.log("Total Train nodes connected: " + numConnectedNodes);
			
		peripheral.discoverAllServicesAndCharacteristics(function(error, services, characteristics) {
			console.log(peripheral.id + ": Discovering services...");
			peripheral.strainCh = null;
			peripheral.acceleCh = null;
			
			// Find ch's
			characteristics.forEach(function(ch, chId) {
				if (ch.uuid == STRAIN_CH_UUID) {
					console.log(peripheral.id + ": Found strain characteristic");
					peripheral.strainCh = ch;
				}
				if (ch.uuid == ACCELE_CH_UUID) {
					console.log(peripheral.id + ": Found accele characteristic");
					peripheral.acceleCh = ch;
				}
			});
			
			// Prepare event detection code
			if (EVENT_DETECTION_ENABLED_FLAG == 1) {
				event_detection.eventDetectorInit(peripheral);
			}
			
			// Notify ch
			if (peripheral.strainCh != null) {
				peripheral.strainCh.on("data", function(data, isNotification) {
					//console.log(peripheral.id + ": " + data.readInt16BE(0));
					var gps = gps_handler.getGpsLatLon();
					
					// Save data to cache
					var now = Date.now();
					strainDataCache.push(new StrainDataPoint(now, peripheral.id,
														data.readInt16BE(0),
														gps.lat, gps.lon));
					
					// Bulk DB insert when cache is full
					if (strainDataCache.length >= MAX_DATA_BEFORE_INSERT) {
						writeToStrainDB();
					}
					
					// Check for event
					/*if (EVENT_DETECTION_ENABLED_FLAG == 1) {
						event_detection.eventDetect(peripheral, data.readInt16BE(0));
					}*/
				});
			}
			if (peripheral.acceleCh != null) {
				peripheral.acceleCh.on("data", function(data, isNotification) {
					//console.log(peripheral.id + ": " + data.readInt16LE(1) + "," + data.readInt16LE(3) + "," + data.readInt16LE(5));
					var gps = gps_handler.getGpsLatLon();
					
					// Save data to cache
					var now = Date.now();
					acceleDataCache.push(new AcceleDataPoint(now, peripheral.id, 
														data.readInt16LE(1), data.readInt16LE(3), data.readInt16LE(5),
														gps.lat, gps.lon));
					
					// Bulk DB insert when cache is full
					if (acceleDataCache.length >= MAX_DATA_BEFORE_INSERT) {
						writeToAcceleDB();
					}
					
					// Check for event
					if (EVENT_DETECTION_ENABLED_FLAG == 1) {
						var valueToCheck = data.readInt16LE(1);
						
						var eventTypeDetected = event_detection.eventDetect(peripheral, valueToCheck);
						
						if (eventTypeDetected != 0) {
							eventDataCache.push(new EventDataPoint(now, peripheral.id,
															valueToCheck, eventTypeDetected,
															gps.lat, gps.lon));
							if (eventDataCache.length > MAX_DATA_BEFORE_INSERT_EVENTS) {
								writeToEventDB();
							}
						}
					}
				});
			}
			
			// Wait before turning on notify's
			setTimeout(enableNotify.bind(null, peripheral), 2000);
		});
	});
};

function writeToStrainDB() {
	dbNodes.serialize(function() {
		dbNodes.run("begin transaction");
		
		// Add cache to DB until empty
		while (strainDataCache.length > 0) {
			var datapoint = strainDataCache.shift(); // dequeue
			strainStmt.run(datapoint.timestamp, datapoint.id,
						   datapoint.value, 
						   datapoint.lat, datapoint.lon);
		}
		
		dbNodes.run("commit");
	});
};
function writeToAcceleDB() {
	dbNodes.serialize(function() {
		dbNodes.run("begin transaction");
		
		// Add cache to DB until empty
		while (acceleDataCache.length > 0) {
			var datapoint = acceleDataCache.shift(); // dequeue
			acceleStmt.run(datapoint.timestamp, datapoint.id, 
						   datapoint.x, datapoint.y, datapoint.z, 
						   datapoint.lat, datapoint.lon);
		}
		
		dbNodes.run("commit");
	});
};
function writeToEventDB() {
	dbNodes.serialize(function() {
		dbNodes.run("begin transaction");
		
		// Add cache to DB until empty
		while (eventDataCache.length > 0) {
			var datapoint = eventDataCache.shift(); // dequeue
			eventStmt.run(datapoint.timestamp, datapoint.id,
						   datapoint.value, datapoint.type,
						   datapoint.lat, datapoint.lon);
		}
		
		dbNodes.run("commit");
	});
};

function enableNotify(peripheral) {
	if (peripheral.strainCh != null) {
		console.log(peripheral.id + ": Enabling strain notify");
		peripheral.strainCh.notify(true);
		numNotifiesEnabled++;
		console.log("Total notifies enabled: " + numNotifiesEnabled + "/" + 2*numConnectedNodes);
	} else {
		console.log(peripheral.id + ": Strain Ch not found");
	}
	
	if (peripheral.acceleCh != null) {
		console.log(peripheral.id + ": Enabling accele notify");
		peripheral.acceleCh.notify(true);
		numNotifiesEnabled++;
		console.log("Total notifies enabled: " + numNotifiesEnabled + "/" + 2*numConnectedNodes);
	} else {
		console.log(peripheral.id + ": Accele Ch not found");
	}
};

var exitHandler = function exitHandler() {
	console.log("\nPREPARING TO EXIT...");
	
	// Close all peripheral connections
    peripherals.forEach(function(peripheral) {
        console.log(peripheral.id + ": Disconnecting...");
        
        // End BLE connection
        peripheral.disconnect(function() {
			console.log(peripheral.id + ": Disconnected");
			numConnectedNodes--;
        });
    });
    
    // Continue exiting procedure if all disconnected, 
    // or in 5 seconds, whichever happens sooner
    var closeDbAndExitDelay = setTimeout(closeDbAndExit, 5000);
    
    checkAllDisconnectedInterval = setInterval(function(){
		if (numConnectedNodes <= 0) {
			clearTimeout(closeDbAndExitDelay);
			clearInterval(checkAllDisconnectedInterval);
			closeDbAndExit();
		}
	}, 300);
}

function closeDbAndExit() {
	clearInterval(checkAllDisconnectedInterval);
	
	// Write final datapoints
	console.log("\nWriting final datapoints...");
	writeToStrainDB();
	writeToAcceleDB();
	writeToEventDB();
	
	// Close DB
	strainStmt.finalize();
	acceleStmt.finalize();
	eventStmt.finalize();
	
	console.log("Closing sqlite3 DB...");
	dbNodes.close(function(error) {
		if (error == null) {
			console.log("Closed sqlite3 DB");
			
			// End process now
			process.exit();
		}
		else {
			console.log("Unable to close sqlite3 DB. " + error);
		}
	});
	
	// Shutdown if enabled
	if (AUTO_SHUTDOWN_TIMEOUT_FLAG == 1) {
		console.log("Shutting down in 15 seconds...");
		setTimeout(function(){
			var sys = require("sys")
			var exec = require("child_process").exec;
			function puts(error, stdout, stderr) { sys.puts(stdout) }
			exec("sudo shutdown now", puts);
		}, 15000);
	}
	else {
		// End process after 15 more seconds if db doesn't close in time
		setTimeout(function(){
			process.exit();
		}, 15000);
	}
};

function connectToPeripherals() {
	if (calledConnectToPeripherals == 0) { // So only called once (either any key or timeout)
		calledConnectToPeripherals = 1;
		
		if (peripherals.length == 0) { // No peripherals discovered
			calledConnectToPeripherals = 0;
			
			console.log("\nPress any key to stop recv ad mode, and connect to peripherals (will auto-connect in 60 seconds)");
			setTimeout(connectToPeripherals, 60000);
		}
		else {
			// Disable 'press any key', to enable Ctrl-C exit
			//process.stdin.setRawMode(false);
			console.log("\nConnecting to peripherals...");

			// Connect to peripherals
			peripherals.forEach(connectPeripheral);
		}
	}
}

function main() {
	// Enable exit handlers
	process.on("SIGINT", exitHandler);
	process.on("SIGTERM", exitHandler);
	
	// Enable auto-shutdown timeout if enabled
	if (AUTO_SHUTDOWN_TIMEOUT_FLAG == 1) {
		setTimeout(exitHandler, 2700000); // Car Test = 2700000 = 45 mins
	}
	
	// Init stuff
	initDb();
	
	// Wait before connecting
	console.log("\nPress any key to stop recv ad mode, and connect to peripherals (will auto-connect in 60 seconds)");
	
	// Detect any key
	// setRawMode will fail if not TTY but ReadStream instead
	// (i.e. will fail when running automatically through systemd, but will be fine when run manually through the terminal)
	/*process.stdin.setRawMode(true);
	process.stdin.resume();
	
	// Connect on any key
	process.stdin.on("data", function(){
		connectToPeripherals();
	});*/
    
    // Otherwise connect on timeout
    setTimeout(connectToPeripherals, 60000);
}

main();

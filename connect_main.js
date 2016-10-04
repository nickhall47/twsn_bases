#!/usr/bin/env node

// Libraries
var noble = require("noble");
var fs = require("fs");
var net = require("net");

var event_detection = require("./event_detection.js");
var StrainDataPoint = require("./StrainDataPoint");
var AcceleDataPoint = require("./AcceleDataPoint");
var EventDataPoint = require("./EventDataPoint");




// Flags
const EVENT_DETECTION_ENABLED_FLAG = 0;
const AUTO_SHUTDOWN_TIMEOUT_FLAG = 0;
const MAX_NUM_NODES = 1; // Optional (Set to 0 to have no max)
const MAX_DATA_BEFORE_INSERT = MAX_NUM_NODES*600; // ~60 secs worth of data in standard config
const MAX_DATA_BEFORE_INSERT_EVENTS = MAX_NUM_NODES*60;

// Constants
const PERIPHERAL_NAME = "Train";
const SENSOR_SERVICE_UUID = "0000000000001000800000805f9b34f0";
const ACCELE_CH_UUID = "0000000000001000800000805f9b34f1";
const STRAIN_CH_UUID = "0000000000001000800000805f9b34f2";

var SERVER_PORT = 55056;
var SERVER_ADDRESS = "192.168.10.10";


// Globals
var peripherals = [];

var numConnectedNodes = 0;
var numNotifiesEnabled = 0;
var calledConnectToPeripherals = 0;
var checkAllDisconnectedInterval;

var strainDataCache = [];
var acceleDataCache = [];
var eventDataCache = [];

var tcpClient;
var temperature;



function sendJsonOverTcp(jsonString) {
	tcpClient = new net.Socket();
	
	tcpClient.connect(SERVER_PORT, SERVER_ADDRESS);
	tcpClient.on("connect", function() {
		//console.log("Connected to TCP server, and sending json...");
		tcpClient.write(jsonString);
		tcpClient.destroy();
	});
}

function createJsonString(timestamp, id, x, y, z, temperature) {
	return JSON.stringify({
		"timestamp": timestamp,
		"id": id,
		"x": convertValueToGs(x),
		"y": convertValueToGs(y),
		"z": convertValueToGs(z),
		"temperature": convertValueToDegC(temperature)
	});
}

function convertValueToGs(accelValue) {
	return accelValue * 0.004;
};

function convertValueToDegC(analogValue) {
	return ((analogValue * 1.0 / 2047) * 3 - 0.6) / 0.01;
};

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
					
					// Save to global
					// (hack!!!: only works with 1 node, which is fine for demo)
					temperature = data.readInt16BE(0);
				});
			}
			if (peripheral.acceleCh != null) {
				peripheral.acceleCh.on("data", function(data, isNotification) {
					console.log(convertValueToGs(data.readInt16LE(1)) + "  " + 
								convertValueToGs(data.readInt16LE(3)) + "  " + 
								convertValueToGs(data.readInt16LE(5)));
					//console.log(data);
					
					// Create JSON from data
					var jsonString = createJsonString(Date.now(), peripheral.id, 
													  data.readInt16LE(1), data.readInt16LE(3), data.readInt16LE(5),
													  temperature);
					
					// Send TCP
					sendJsonOverTcp(jsonString);
				});
			}
			
			// Wait before turning on notify's
			setTimeout(enableNotify.bind(null, peripheral), 2000);
		});
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
    var exitAnywayDelay = setTimeout(function() {
		process.exit();
	}, 5000);
    
    checkAllDisconnectedInterval = setInterval(function() {
		if (numConnectedNodes <= 0) {
			clearTimeout(exitAnywayDelay);
			clearInterval(checkAllDisconnectedInterval);
			tcpClient.destroy();
			process.exit();
		}
	}, 300);
}

function connectToPeripherals() {
	if (calledConnectToPeripherals == 0) { // So only called once (either any key or timeout)
		calledConnectToPeripherals = 1;
		
		if (peripherals.length == 0) { // No peripherals discovered
			calledConnectToPeripherals = 0;
			
			console.log("\nPress any key to stop recv ad mode, and connect to peripherals (will auto-connect in 60 seconds)");
			setTimeout(connectToPeripherals, 60000);
		}
		else {
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
	
	
	// Wait before connecting
	console.log("\nPress any key to stop recv ad mode, and connect to peripherals (will auto-connect in 60 seconds)");
    
    // Otherwise connect on timeout
    setTimeout(connectToPeripherals, 60000);
}

main();

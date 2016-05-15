// Libraries
var noble = require("noble");
var fs = require("fs");
var sqlite3 = require("sqlite3").verbose();

// Constants
const PERIPHERAL_NAME = "Train";
const SENSOR_SERVICE_UUID = "0000000000001000800000805f9b34f0";
const ACCELE_CH_UUID = "0000000000001000800000805f9b34f1";
const STRAIN_CH_UUID = "0000000000001000800000805f9b34f2";

// Globals
var peripherals = [];
var dbNodes;


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
			console.log("Creating sqlite3 DB table...");
			dbNodes.run("CREATE TABLE strains (node_id TEXT, value TEXT)");
			console.log("Created sqlite3 DB table");
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
					
					// Create file for node
					//peripheral.logFile = fs.createWriteStream("node_" + peripheral.id + ".log", { flags: "a" });
					
					// Prepare SQL stmt
					peripheral.strainStmt = dbNodes.prepare("INSERT INTO strains VALUES (?, ?)");
					
					// Notify ch
					if (peripheral.strainCh != null) {
						peripheral.strainCh.on("data", function(data, isNotification) {
							//console.log(peripheral.id + ": " + data.readUInt16BE(0));
							//peripheral.logFile.write(data.readUInt16BE(0) + ",");
							peripheral.strainStmt.run(peripheral.id, data.readUInt16BE(0));
						});
					}
				});
			});
		}
	}

    console.log();
});

var exitHandler = function exitHandler() {
	console.log("\nPreparing to exit...");
	
	// Close all peripheral connections
    peripherals.forEach(function(peripheral) {
        console.log("Disconnecting from " + peripheral.uuid + "...");
        
        // End BLE connection
        peripheral.disconnect( function(){
			console.log("Disconnected from " + peripheral.uuid);
			
			// Finalise SQL statements
			peripheral.strainStmt.finalize();
        });
    });
    
    // Close DB
    console.log("\nClosing sqlite3 DB...");
	dbNodes.close();
	console.log("Closed sqlite3 DB");

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
	
	// Wait before turning on notifys
	setTimeout(function(){
        peripherals.forEach(function(peripheral) {
			if (peripheral.strainCh != null) {
				console.log("Enabling notify for " + peripheral.uuid + "...");
				peripheral.strainCh.notify(true);
			} else {
				console.log("Strain Ch not found for " + peripheral.uuid);
			}
		});
    }, 3000);
}

main();

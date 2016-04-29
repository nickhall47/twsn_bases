import logging
import time
import uuid
from time import strftime
from datetime import datetime

import Adafruit_BluefruitLE

# Debugging
#logging.basicConfig(level=logging.DEBUG)

# UUIDS
SENSOR_SERVICE_UUID = uuid.UUID('00000000-0000-1000-8000-00805F9B34F0')
ACCEL_CHAR_UUID     = uuid.UUID('00000000-0000-1000-8000-00805F9B34F1')
STRAIN_CHAR_UUID    = uuid.UUID('00000000-0000-1000-8000-00805F9B34F2')

# Get BLE provider for the current platform
ble = Adafruit_BluefruitLE.get_provider()

def time_header():
    milliseconds = "%03d" % (datetime.now().microsecond / 1000,)
    return strftime("%H:%M:%S:") + milliseconds + strftime(" %d/%m/%Y - ")


def main():
    # Clear cache
    ble.clear_cached_data()

    # Get BLE adapter
    adapter = ble.get_default_adapter()
    adapter.power_on()
    print('Using adapter: {0}'.format(adapter.name))

    # Disconnect any currently connected devices
    print('Disconnecting any connected Train WSN devices...')
    ble.disconnect_devices([SENSOR_SERVICE_UUID])

    # Scan for devices
    print('Searching for Train WSN device...')
    try:
        adapter.start_scan()
        
        #devices = ble.find_devices(service_uuids=[SENSOR_SERVICE_UUID])
        devices = ble.find_devices(name='Train')

        for i in range(10):
            #print(ble.list_devices())
            print(devices)
            time.sleep(3)
        
        if devices is []:
            raise RuntimeError('Failed to find Train WSN device!')
    finally:
        adapter.stop_scan()

    # Connect
    #print('Connecting to device...')
    #device.connect()

    try:

        # Wait for x seconds receive data
        print('Waiting 60 seconds to receive data from the device...')
        time.sleep(60)
        
    finally:
        # Disconnect on exit
        devices.disconnect()


# Init BLE sys
ble.initialize()

# Starts loop to process BLE events
ble.run_mainloop_with(main)

import logging
import time
import uuid

import Adafruit_BluefruitLE

# Debugging
#logging.basicConfig(level=logging.DEBUG)

# UUIDS
SENSOR_SERVICE_UUID = uuid.UUID('00000000-0000-1000-8000-00805F9B34F0')
ACCEL_CHAR_UUID     = uuid.UUID('00000000-0000-1000-8000-00805F9B34F1')
STRAIN_CHAR_UUID    = uuid.UUID('00000000-0000-1000-8000-00805F9B34F2')

# Get BLE provider for the current platform
ble = Adafruit_BluefruitLE.get_provider()


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
        
        #device = ble.find_device(service_uuids=[SENSOR_SERVICE_UUID])
        device = ble.find_device(name='Train')
        
        if device is None:
            raise RuntimeError('Failed to find Train WSN device!')
    finally:
        adapter.stop_scan()

    # Connect
    print('Connecting to device...')
    device.connect()

    try:
        # Service discovery
        print('Discovering services...')
        device.discover([SENSOR_SERVICE_UUID], [ACCEL_CHAR_UUID, STRAIN_CHAR_UUID], timeout_sec=10)

        # Find the service and its characteristics
        sensorService = device.find_service(SENSOR_SERVICE_UUID)
        accel = sensorService.find_characteristic(ACCEL_CHAR_UUID)
        strain = sensorService.find_characteristic(STRAIN_CHAR_UUID)

        # Functions for receiving notify's
        def received_accel(data):
            print('Received accel: {0}'.format(":".join(x.encode('hex') for x in data)))

        def received_strain(data):
            print('Received strain: {0}'.format(":".join(x.encode('hex') for x in data)))

        # Turn on notify's
        print('Subscribing to accel characteristic changes...')
        accel.start_notify(received_accel)

        print('Subscribing to strain characteristic changes...')
        strain.start_notify(received_strain)

        # Wait for x seconds receive data
        print('Waiting 60 seconds to receive data from the device...')
        time.sleep(60)
        
    finally:
        # Disconnect on exit
        device.disconnect()


# Init BLE sys
ble.initialize()

# Starts loop to process BLE events
ble.run_mainloop_with(main)

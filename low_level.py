import logging
import time
import uuid

import Adafruit_BluefruitLE


# Enable debug output.
#logging.basicConfig(level=logging.DEBUG)

# Define service and characteristic UUIDs used by the UART service.
SENSOR_SERVICE_UUID = uuid.UUID('00000000-0000-1000-8000-00805F9B34F0')
ACCEL_CHAR_UUID     = uuid.UUID('00000000-0000-1000-8000-00805F9B34F1')
STRAIN_CHAR_UUID    = uuid.UUID('00000000-0000-1000-8000-00805F9B34F2')

# Get the BLE provider for the current platform.
ble = Adafruit_BluefruitLE.get_provider()


# Main function implements the program logic so it can run in a background
# thread.  Most platforms require the main thread to handle GUI events and other
# asyncronous events like BLE actions.  All of the threading logic is taken care
# of automatically though and you just need to provide a main function that uses
# the BLE provider.
def main():
    # Clear any cached data because both bluez and CoreBluetooth have issues with
    # caching data and it going stale.
    ble.clear_cached_data()

    # Get the first available BLE network adapter and make sure it's powered on.
    adapter = ble.get_default_adapter()
    adapter.power_on()
    print('Using adapter: {0}'.format(adapter.name))

    # Disconnect any currently connected UART devices.  Good for cleaning up and
    # starting from a fresh state.
    print('Disconnecting any connected Train WSN devices...')
    ble.disconnect_devices([SENSOR_SERVICE_UUID])

    # Scan for UART devices.
    print('Searching for Train WSN device...')
    try:
        adapter.start_scan()
        # Search for the first UART device found (will time out after 60 seconds
        # but you can specify an optional timeout_sec parameter to change it).
        #device = ble.find_device(service_uuids=[SENSOR_SERVICE_UUID])
        device = ble.find_device(name='Train')
        if device is None:
            raise RuntimeError('Failed to find Train WSN device!')
    finally:
        # Make sure scanning is stopped before exiting.
        adapter.stop_scan()

    print('Connecting to device...')
    device.connect()  # Will time out after 60 seconds, specify timeout_sec parameter
                      # to change the timeout.

    # Once connected do everything else in a try/finally to make sure the device
    # is disconnected when done.
    try:
        # Wait for service discovery to complete for at least the specified
        # service and characteristic UUID lists.  Will time out after 60 seconds
        # (specify timeout_sec parameter to override).
        print('Discovering services...')
        device.discover([SENSOR_SERVICE_UUID], [ACCEL_CHAR_UUID, STRAIN_CHAR_UUID], timeout_sec=10)

        # Find the UART service and its characteristics.
        sensorService = device.find_service(SENSOR_SERVICE_UUID)
        accel = sensorService.find_characteristic(ACCEL_CHAR_UUID)
        strain = sensorService.find_characteristic(STRAIN_CHAR_UUID)

        # Write a string to the TX characteristic.
        #print('Sending message to device...')
        #tx.write_value('Hello world!\r\n')

        # Function to receive RX characteristic changes.  Note that this will
        # be called on a different thread so be careful to make sure state that
        # the function changes is thread safe.  Use Queue or other thread-safe
        # primitives to send data to other threads.
        def received_accel(data):
            print('Received accel: {0}'.format(":".join(x.encode('hex') for x in data)))

        def received_strain(data):
            print('Received strain: {0}'.format(":".join(x.encode('hex') for x in data)))

        # Turn on notification of RX characteristics using the callback above.
        print('Subscribing to accel characteristic changes...')
        accel.start_notify(received_accel)

        print('Subscribing to strain characteristic changes...')
        strain.start_notify(received_strain)

        # Now just wait for 60 seconds to receive data.
        print('Waiting 60 seconds to receive data from the device...')
        time.sleep(60)
    finally:
        # Make sure device is disconnected on exit.
        device.disconnect()


# Initialize the BLE system.  MUST be called before other BLE calls!
ble.initialize()

# Start the mainloop to process BLE events, and run the provided function in
# a background thread.  When the provided main function stops running, returns
# an integer status code, or throws an error the program will exit.
ble.run_mainloop_with(main)

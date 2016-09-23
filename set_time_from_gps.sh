#!/bin/bash

pkill ntpd
pkill gpsd
gpsd -b -n -D 2 /dev/ttyUSB0
sleep 5
GPSDATE=`gpspipe -w | head -10 | grep TPV | sed -r 's/.*"time":"([^"]*)".*/\1/' | head -1`
echo $GPSDATE
date -s "$GPSDATE"
/usr/sbin/ntpd

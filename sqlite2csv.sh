#!/bin/bash

sqlite3 -header -csv nodes.db "select * from acceles;" > nodes_db_out.csv
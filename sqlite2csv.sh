#!/bin/bash

sqlite3 -header -csv nodes.db "select * from strains;" > nodes_db_out.csv
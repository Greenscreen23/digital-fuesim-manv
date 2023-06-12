#!/bin/sh
NUM_CONFIGS=$1
DOCKER_COMPOSE_FILE='./docker-compose.generated.yml'
RAFT_CONFIG_FOLDER='./config'

if ! [[ $NUM_CONFIGS =~ ^[0-9]$|^[0-9][0-9]$ ]]
then
    printf >&2 "Error: First Argument is not a number in the range 0-99"
    exit 1
fi

rm -rf $RAFT_CONFIG_FOLDER
mkdir -p $RAFT_CONFIG_FOLDER

printf "version: '3'
networks:
    raft:
        ipam:
            driver: default
            config:
                - subnet: 172.16.238.0/24
services:
    dfm1:
        image: digital-fuesim-manv-dfm-raft
        build:
            context: .
            dockerfile: docker/Dockerfile.dev
        restart: unless-stopped
        container_name: digital-fuesim-manv-1
        environment:
            - DFM_USE_RAFT=true
            - DFM_RAFT_CONFIG_PATH=/usr/local/app/raft.json
        ports:
            - 127.0.0.1:4201:4200
            - 127.0.0.1:3301:3201
            - 127.0.0.1:3201:3200
            - 127.0.0.1:8501:8501
        env_file:
            - .env
        volumes:
            - $RAFT_CONFIG_FOLDER/raft-1.json:/usr/local/app/raft.json
        networks:
            raft:
                ipv4_address: 172.16.238.101" > $DOCKER_COMPOSE_FILE

for index in $(seq 2 $NUM_CONFIGS)
do
    padded_index=$(printf "%02d" $index)
    printf "
    dfm$index:
        image: digital-fuesim-manv-dfm-raft
        restart: unless-stopped
        container_name: digital-fuesim-manv-$index
        environment:
            - DFM_USE_RAFT=true
            - DFM_RAFT_CONFIG_PATH=/usr/local/app/raft.json
        ports:
            - 127.0.0.1:42$padded_index:4200
            - 127.0.0.1:33$padded_index:3201
            - 127.0.0.1:32$padded_index:3200
            - 127.0.0.1:85$padded_index:85$padded_index
        env_file:
            - .env
        volumes:
            - $RAFT_CONFIG_FOLDER/raft-$index.json:/usr/local/app/raft.json
        networks:
            raft:
                ipv4_address: 172.16.238.$index" >> $DOCKER_COMPOSE_FILE
done

PEERS="{ \"id\": \"raft1\", \"url\": \"ws://172.16.238.101:8047\" }"

for index in $(seq 2 $NUM_CONFIGS)
do
    PEERS="$PEERS,
        { \"id\": \"raft$index\", \"url\": \"ws://172.16.238.$index:8047\" }"
done

for index in $(seq 1 $NUM_CONFIGS)
do
    padded_index=$(printf "%02d" $index)
    printf "{
    \"id\": \"raft$index\",
    \"secret\": \"\",
    \"peers\": [
        $PEERS
    ],
    \"data\": {
        \"path\": \"raft\",
        \"raft\": \"raft.pers\",
        \"log\": \"log\",
        \"snapshot\": \"snap\",
        \"state\": \"state.pers\"
    },
    \"webmonitor\": {
        \"enable\": true,
        \"host\": \"localhost\",
        \"port\": 85$padded_index,
        \"proto\": null,
        \"bind\": {
            \"proto\": \"http\",
            \"host\": \"::\",
            \"port\": null
        }
    }
}
" > $RAFT_CONFIG_FOLDER/raft-$index.json
done

for index in $(seq 1 $NUM_CONFIGS)
do
    padded_index=$(printf "%02d" $index)
    printf "[uuid()]: { ws: 'ws://localhost:32$padded_index', http: 'http://localhost:33$padded_index' },\n"
done

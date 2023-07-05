#!/bin/bash
NUM_CONFIGS=$1
NUM_CPUS=$2
HOST=$3
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
            - DEBUG=zmq-raft:*
        ports:
            - 4201:4200
            - 3301:3201
            - 3201:3200
            - 8501:8501
        env_file:
            - .env
        volumes:
            - $RAFT_CONFIG_FOLDER/raft-1.json:/usr/local/app/raft.json
        networks:
            raft:
                ipv4_address: 172.16.238.101
        cpuset: \"0-$((NUM_CPUS - 1))\""> $DOCKER_COMPOSE_FILE

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
            - DEBUG=zmq-raft:*
        ports:
            - 42$padded_index:4200
            - 33$padded_index:3201
            - 32$padded_index:3200
            - 85$padded_index:85$padded_index
        env_file:
            - .env
        volumes:
            - $RAFT_CONFIG_FOLDER/raft-$index.json:/usr/local/app/raft.json
        networks:
            raft:
                ipv4_address: 172.16.238.$index
        cpuset: \"0-$((NUM_CPUS - 1))\"" >> $DOCKER_COMPOSE_FILE
done

PEERS="{ \"id\": \"raft1\", \"url\": \"tcp://172.16.238.101:8047\" }"
ORIGINS="{ \"ws\": \"ws://$HOST:3201\", \"http\": \"http://$HOST:3301\" }"

for index in $(seq 2 $NUM_CONFIGS)
do
    padded_index=$(printf "%02d" $index)
    PEERS="$PEERS,
        { \"id\": \"raft$index\", \"url\": \"tcp://172.16.238.$index:8047\" }"
    ORIGINS="$ORIGINS,
        { \"ws\": \"ws://$HOST:32$padded_index\", \"http\": \"http://$HOST:33$padded_index\" }"
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
    \"origins\": [
        $ORIGINS
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
        \"host\": \"$HOST\",
        \"port\": 85$padded_index,
        \"proto\": null,
        \"bind\": {
            \"proto\": \"http\",
            \"host\": \"::\",
            \"port\": null
        }
    },
    \"electionTimeoutMin\": 400,
    \"electionTimeoutMax\": 600,
    \"rpcTimeout\": 100,
    \"appendEntriesHeartbeatInterval\": 140,
    \"appendEntriesRpcTimeoutMin\": 140,
    \"appendEntriesRpcTimeoutMax\": 280,
    \"requestIdTtl\": 28800000,
    \"requestEntriesTtl\": 5000,
    \"serverResponseTimeout\": 1000,
    \"serverElectionGraceDelay\": 600,
    \"peerMsgDataSize\": 1048576
}
" > $RAFT_CONFIG_FOLDER/raft-$index.json
done

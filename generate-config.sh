#!/bin/bash
NUM_CONFIGS=$1
NUM_CPUS_SERVER=$2
NUM_CPUS_CLIENT=$3
HOST=$4
DELAY=$5
DOCKER_COMPOSE_FILE='./docker-compose.generated.yml'
RAFT_CONFIG_FOLDER='./config'

if ! [[ $NUM_CONFIGS =~ ^[0-9]$|^[0-9][0-9]$ ]]
then
    printf >&2 "Error: First Argument is not a number in the range 0-99"
    exit 1
fi

rm -rf $RAFT_CONFIG_FOLDER
mkdir -p $RAFT_CONFIG_FOLDER

IPS="172.16.238.101 172.16.238.111"
for index in $(seq 2 $NUM_CONFIGS)
do
    IPS="$IPS 172.16.238.$index 172.16.238.$((index + 10))"
done

printf "" > $DOCKER_COMPOSE_FILE

printf "version: '3'
networks:
    client:
    raft:
        ipam:
            driver: default
            config:
                - subnet: 172.16.238.0/24
services:
    client:
        image: digital-fuesim-manv-dfm-client
        build:
            context: .
            dockerfile: docker/Dockerfile.client
        restart: unless-stopped
        container_name: digital-fuesim-manv-client
        environment:
            - WORKERS=30
            - VEHICLES=900
            - PATIENTS=600
            - WS_ORIGIN=ws://dfm1:3200
            - HTTP_ORIGIN=http://dfm1:3201
            - DURATION=3600000
            - OUTDIR=/usr/local/app/data
        volumes:
            - ./data:/usr/local/app/data
        networks:
            client:
        cpuset: \"$NUM_CPUS_SERVER-$((NUM_CPUS_SERVER + NUM_CPUS_CLIENT - 1))\"
        cap_add:
            - NET_ADMIN

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
            - IPS=$IPS
            - OTHER_IP=172.16.238.101
            - DELAY=$DELAY
        ports:
            - 4201:4200
            - 3301:3201
            - 3201:3200
        env_file:
            - .env
        volumes:
            - $RAFT_CONFIG_FOLDER/raft-1.json:/usr/local/app/raft.json
        networks:
            client:
            raft:
                ipv4_address: 172.16.238.111
        cpuset: \"0-$((NUM_CPUS_SERVER - 1))\"
        cap_add:
            - NET_ADMIN
    raft1:
        image: digital-fuesim-manv-raft-backend
        build:
            context: .
            dockerfile: docker/Dockerfile.raft
        restart: unless-stopped
        container_name: digital-fuesim-manv-raft-backend-1
        environment:
            - RAFT_CONFIG_PATH=/usr/local/app/raft.json
            - DEBUG=zmq-raft:*
            - IPS=$IPS
            - OTHER_IP=172.16.238.111
            - DELAY=$DELAY
        ports:
            - 8501:8501
        volumes:
            - $RAFT_CONFIG_FOLDER/raft-1.json:/usr/local/app/raft.json
        networks:
            raft:
                ipv4_address: 172.16.238.101
        cpuset: \"0-$((NUM_CPUS_SERVER - 1))\"
        cap_add:
            - NET_ADMIN" >> $DOCKER_COMPOSE_FILE

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
            - IPS=$IPS
            - OTHER_IP=172.16.238.$index
            - DELAY=$DELAY
        ports:
            - 42$padded_index:4200
            - 33$padded_index:3201
            - 32$padded_index:3200
        env_file:
            - .env
        volumes:
            - $RAFT_CONFIG_FOLDER/raft-$index.json:/usr/local/app/raft.json
        networks:
            client:
            raft:
                ipv4_address: 172.16.238.$((index + 10))
        cpuset: \"0-$((NUM_CPUS_SERVER - 1))\"
        cap_add:
            - NET_ADMIN
    raft$index:
        image: digital-fuesim-manv-raft-backend
        restart: unless-stopped
        container_name: digital-fuesim-manv-raft-backend-$index
        environment:
            - RAFT_CONFIG_PATH=/usr/local/app/raft.json
            - DEBUG=zmq-raft:*
            - IPS=$IPS
            - OTHER_IP=172.16.238.$((index + 10))
            - DELAY=$DELAY
        ports:
            - 85$padded_index:85$padded_index
        volumes:
            - $RAFT_CONFIG_FOLDER/raft-$index.json:/usr/local/app/raft.json
        networks:
            raft:
                ipv4_address: 172.16.238.$index
        cap_add:
            - NET_ADMIN
        cpuset: \"0-$((NUM_CPUS_SERVER - 1))\"" >> $DOCKER_COMPOSE_FILE
done

PEERS="{ \"id\": \"raft1\", \"url\": \"tcp://172.16.238.101:8047\" }"
ORIGINS="{ \"ws\": \"ws://dfm1:3200\", \"http\": \"http://dfm1:3201\" }"

for index in $(seq 2 $NUM_CONFIGS)
do
    padded_index=$(printf "%02d" $index)
    PEERS="$PEERS,
        { \"id\": \"raft$index\", \"url\": \"tcp://172.16.238.$index:8047\" }"
    ORIGINS="$ORIGINS,
        { \"ws\": \"ws://dfm$index:3200\", \"http\": \"http://dfm$index:3201\" }"
done

for index in $(seq 1 $NUM_CONFIGS)
do
    padded_index=$(printf "%02d" $index)
    printf "{
    \"id\": \"raft$index\",
    \"dfmUrl\": \"ws://dfm$index:5431\",
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

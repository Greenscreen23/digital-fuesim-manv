#!/bin/sh
NUM_CONFIGS=$1
DOCKER_COMPOSE_FILE='./docker-compose.generated.yml'

if ! [[ $NUM_CONFIGS =~ ^[0-9]$|^[0-9][0-9]$ ]]
then
    printf >&2 "Error: First Argument is not a number in the range 0-99"
    exit 1
fi

printf "version: '3'
services:
    dfm1:
        image: digital-fuesim-manv-dfm-raft
        build:
            context: .
            dockerfile: docker/Dockerfile.dev
        restart: unless-stopped
        container_name: digital-fuesim-manv-1
        environment:
            - DFM_MONGO_URL=mongodb://mongo1:27017
        ports:
            - 127.0.0.1:4201:4200
            - 127.0.0.1:3301:3201
            - 127.0.0.1:3201:3200
        env_file:
            - .env
    mongo1:
        image: mongo
        restart: unless-stopped
        ports:
            - 27001:27017
        volumes:
            - mongo1:/data/db
        command: mongod --replSet rs0" > $DOCKER_COMPOSE_FILE

for index in $(seq 2 $NUM_CONFIGS)
do
    padded_index=$(printf "%02d" $index)
    printf "

    dfm$index:
        image: digital-fuesim-manv-dfm-raft
        restart: unless-stopped
        container_name: digital-fuesim-manv-$index
        environment:
            - DFM_MONGO_URL=mongodb://mongo$index:27017
        ports:
            - 127.0.0.1:42$padded_index:4200
            - 127.0.0.1:33$padded_index:3201
            - 127.0.0.1:32$padded_index:3200
        env_file:
            - .env
    mongo$index:
        image: mongo
        restart: unless-stopped
        ports:
            - 270$padded_index:27017
        volumes:
            - mongo$index:/data/db
        command: mongod --replSet rs0" >> $DOCKER_COMPOSE_FILE
done

printf "
volumes:" >> $DOCKER_COMPOSE_FILE
for index in $(seq 1 $NUM_CONFIGS)
do
    printf "
    mongo$index:" >> $DOCKER_COMPOSE_FILE
done

for index in $(seq 1 $NUM_CONFIGS)
do
    padded_index=$(printf "%02d" $index)
    printf "[uuid()]: { ws: 'ws://localhost:32$padded_index', http: 'http://localhost:33$padded_index' },\n"
done

printf "
rs.initiate({
  _id: \"rs0\",
  members: ["

for index in $(seq 1 $NUM_CONFIGS)
do
    printf "
    { _id: $index, host: \"mongo$index:27017\" },"
done
printf "
  ]
});
"

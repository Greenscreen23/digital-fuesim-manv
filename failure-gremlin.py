#!/usr/bin/python
from numpy.random import default_rng
from argparse import ArgumentParser
from datetime import datetime
import asyncio, subprocess

# Availability and unavailability follow a log-normal distribution with these parameters
AVAIL_MEAN=0.23
AVAIL_STDDEV=2.02
UNAVAIL_MEAN=-1.12
UNAVAIL_STDDEV=1.13

# Distribution is in hours, sleep requires seconds
DISTRIBUTION_TO_SLEEP_CONVERSION_RATE=3_600

parser = ArgumentParser(description='A script to start / stop containers to simulate real world failure rates')
parser.add_argument('nodes', metavar='node', type=str, nargs='+', help='The nodes to potentially take down')
parser.add_argument('-c', '--docker-compose-config', type=str, help='The docker compose config file')
args = parser.parse_args()

DOCKER_PREFIX=['/usr/bin/docker', 'compose', '-f', args.docker_compose_config]

generator = default_rng()

def printDuration(time):
    hours, remainder = divmod(time, 3600)
    minutes, seconds = divmod(remainder, 60)
    print(f'{hours}h {minutes}m {seconds}s')

async def playGremlin(node):
    start = datetime.now()
    print(f'playing failure gremlin for node {node} from {start}')

    while True:
        avail_interval = generator.lognormal(AVAIL_MEAN, AVAIL_STDDEV) * DISTRIBUTION_TO_SLEEP_CONVERSION_RATE
        print(f'killing node {node} in ', end='')
        printDuration(avail_interval)

        await asyncio.sleep(avail_interval)
        subprocess.run([*DOCKER_PREFIX, 'stop', '-t0', node])

        stop = datetime.now()
        drift = (stop - start).total_seconds() - avail_interval
        print(f'stopped node {node} with drift {drift}')

        unavail_interval = generator.lognormal(UNAVAIL_MEAN, UNAVAIL_STDDEV) * DISTRIBUTION_TO_SLEEP_CONVERSION_RATE
        print(f'resurrecting node {node} in ', end='')
        printDuration(unavail_interval)

        await asyncio.sleep(unavail_interval)
        subprocess.run([*DOCKER_PREFIX, 'start', node])

        start = datetime.now()
        drift = (start - stop).total_seconds() - unavail_interval
        print(f'started node {node} with drift {drift}')

async def main():
    await asyncio.gather(*[playGremlin(node) for node in args.nodes])

asyncio.run(main())

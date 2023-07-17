#!/usr/bin/python
from numpy.random import default_rng
from argparse import ArgumentParser, BooleanOptionalAction
from datetime import datetime
import asyncio, subprocess, json

# Availability and unavailability follow a log-normal distribution with these parameters
AVAIL_MEAN = 0.23
AVAIL_STDDEV = 2.02
UNAVAIL_MEAN = -1.12
UNAVAIL_STDDEV = 1.13

# Distribution is in hours, sleep requires seconds
DISTRIBUTION_TO_SLEEP_CONVERSION_RATE = 3_600

# Factor to apply to the availability and unavailability interval to simulate a stronger hazard rate
HAZARD_RATE_FACTOR = 1

NODES = [
    "dfm1",
    "dfm2"
]

parser = ArgumentParser(
    description="A script to start / stop containers to simulate real world failure rates"
)
parser.add_argument(
    "-d", "--delete-on-stop", action=BooleanOptionalAction, default=False
)
parser.add_argument(
    "-c", "--docker-compose-config", type=str, help="The docker compose config file"
)
args = parser.parse_args()

DOCKER_PREFIX = ["/usr/bin/docker", "compose", "-f", args.docker_compose_config]

generator = default_rng()

start = datetime.now()
log = dict((node, [{"started": 0, "startdrift": 0}]) for node in NODES)


def printDuration(time):
    hours, remainder = divmod(time, 3600)
    minutes, seconds = divmod(remainder, 60)
    print(f"{hours}h {minutes}m {seconds}s")


async def playGremlin(node):
    started = datetime.now()
    print(f"playing failure gremlin for nodes {node} from {started}")

    while True:
        avail_interval = (
            generator.lognormal(AVAIL_MEAN, AVAIL_STDDEV)
            * DISTRIBUTION_TO_SLEEP_CONVERSION_RATE
            * HAZARD_RATE_FACTOR
        )
        print(f"killing node {node} in ", end="")
        printDuration(avail_interval)

        await asyncio.sleep(avail_interval)
        subprocess.run([*DOCKER_PREFIX, "stop", "-t0", node])
        if args.delete_on_stop:
            subprocess.run([*DOCKER_PREFIX, "rm", "-f", node])

        stopped = datetime.now()
        drift = (stopped - started).total_seconds() - avail_interval
        log[node][-1]["stopped"] = (stopped - start).total_seconds()
        log[node][-1]["stopdrift"] = drift
        print(f"stopped nodes {node} with drift {drift}")

        unavail_interval = (
            generator.lognormal(UNAVAIL_MEAN, UNAVAIL_STDDEV)
            * DISTRIBUTION_TO_SLEEP_CONVERSION_RATE
            * HAZARD_RATE_FACTOR
        )

        print(f"resurrecting nodes {node} in ", end="")
        printDuration(unavail_interval)

        await asyncio.sleep(unavail_interval)
        if args.delete_on_stop:
            subprocess.run([*DOCKER_PREFIX, "up", "-d", node])
        else:
            subprocess.run([*DOCKER_PREFIX, "start", node])

        started = datetime.now()
        drift = (started - stopped).total_seconds() - unavail_interval
        log[node].append(
            {"started": (started - start).total_seconds(), "startdrift": drift}
        )
        print(f"started nodes {node} with drift {drift}")


async def main():
    await asyncio.gather(*[playGremlin(node) for node in NODES])


try:
    asyncio.run(main())
except KeyboardInterrupt:
    log["end"] = (datetime.now() - start).total_seconds()
    with open("benchmark.json", "w") as benchmark:
        benchmark.write(json.dumps(log))

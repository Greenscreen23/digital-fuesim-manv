tc qdisc add dev eth0 root netem delay 20ms loss 0%
node --experimental-specifier-resolution=node /usr/local/app/client/dist/src/index.js
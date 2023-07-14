IF=eth0
OWN_IP=$(ip address show dev $IF | head -n 4 | tail -n 1 | cut -d ' ' -f6 | cut -d '/' -f 1)

tc qdisc add dev $IF root handle 1: prio
tc qdisc add dev $IF parent 1:3 handle 30: netem delay $(echo $DELAY)ms

for ip in $(echo $IPS | tr ' ' '\n')
do
    if [ "$ip" != "$OWN_IP" ]
    then
        echo "Adding filter to interface $IF for ip $ip"
        tc filter add dev $IF parent 1:0 protocol ip prio 3 u32 match ip dst $ip flowid 1:3
    fi
done

sh -c 'cd /usr/local/app/frontend/dist/digital-fuesim-manv && python3 -m http.server 4200' &

cd /usr/local/app/backend
node --experimental-specifier-resolution=node dist/src/index.js

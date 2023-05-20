sed -i "s/httpPort:3201/httpPort:${DFM_HTTP_PORT}/" /usr/local/app/frontend/dist/digital-fuesim-manv/main*.js
sed -i "s/websocketPort:3200/websocketPort:${DFM_WEBSOCKET_PORT}/" /usr/local/app/frontend/dist/digital-fuesim-manv/main*.js

sh -c 'cd /usr/local/app/frontend/dist/digital-fuesim-manv && python3 -m http.server 4200' &

cd /usr/local/app/backend
node --experimental-specifier-resolution=node dist/src/index.js

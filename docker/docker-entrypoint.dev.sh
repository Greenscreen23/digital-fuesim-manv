sh -c 'cd /usr/local/app/frontend/dist/digital-fuesim-manv && python3 -m http.server 4200' &

cd /usr/local/app/backend
node --experimental-specifier-resolution=node dist/src/index.js

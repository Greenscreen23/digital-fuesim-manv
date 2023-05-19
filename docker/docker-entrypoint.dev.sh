sh -c 'cd frontend/dist/digital-fuesim-manv && python3 -m http.server 4200' &

cd backend
node --experimental-specifier-resolution=node dist/src/index.js

require('dotenv').config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const { Pool, Client } = require('pg')

const pool = new Pool({
  user: process.env.POSTGRES_USERNAME,
  host: process.env.POSTGRES_HOST,
  database: 'mac_users',
  password: process.env.POSTGRES_PASSWORD,
  port: 5432,
})

const port = process.env.PORT || 4001;
const app = express();
const server = http.createServer(app);

const io = socketIo(server, { cors: { orgin: "*" } });

const filter = async (mac_address_in) => {
    const result = await pool.query('SELECT * FROM users WHERE address = $1', [mac_address_in]);
    return result.rows.length > 0;
}

io.on("connect", async (socket) => {

    console.log(`Połączono: ${socket.id}`);

    socket.on("join", () => {
        socket.join("gate");
        socket.emit("joined");
    });

    if(!(await filter(socket.handshake.headers['x-address']))) socket.emit("failed");

    socket.on("open", (data) => {
        const dataJson = JSON.parse(data);
        socket.to("gate").emit("open", dataJson.gate)
        pool.query("SELECT * FROM users WHERE address = $1", [dataJson.user_mac], (error, result) => {
            if (error) throw error;
            pool.query("INSERT INTO logs (address, date, type, name) VALUES ($1, $2, $3, $4)", [dataJson.user_mac, new Date(), dataJson.gate, result.rows[0].name]);
        })
    });
    
    socket.on("disconnect", () => console.log(`Rozłączono: ${socket.id}`));

});

server.listen(port, () => console.log(`Nasłuchuję port: ${port}`));
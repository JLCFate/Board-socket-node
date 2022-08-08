require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const fetch = require("node-fetch");

const port = process.env.PORT || 4001;
const app = express();
const server = http.createServer(app);

const io = socketIo(server, { cors: { orgin: "*" } });

const filter = async (mac_address_in) => {
	const result = await fetch(`${process.env.API_URL}/users/get/${mac_address_in}`, { method: "GET", headers: { "Content-Type": "application/json" } });
	const data = await result.json();
	console.log(data);
	return data;
};

io.on("connect", async (socket) => {
	let result_row = await filter(socket.handshake.headers["x-address"]);
	console.log(`Połączono: ${socket.id}`);

	socket.on("join", () => {
		socket.join("gate");
		socket.emit("joined");
	});

	if (result_row.size === 0 || !result_row["authorized"]) {
		socket.emit("failed", { status: result_row.size === 0 || result_row["awaiting"] ? "newUser" : "unauthorized" });
		console.log(socket.handshake.headers["x-address"]);
		if (result_row.size === 0) {
			if (socket.handshake.headers["x-name"] !== undefined && socket.handshake.headers["x-address"] !== undefined) {
				console.log("Creating");
				await fetch(`${process.env.API_URL}/users/`, {
					method: "POST",
					body: JSON.stringify({ name: socket.handshake.headers["x-name"], address: socket.handshake.headers["x-address"] }),
					headers: { "Content-Type": "application/json" },
				});
			}
		}
	} else {
		socket.emit("authorized", result_row);
	}

	socket.on("open", async (data) => {
		const dataJson = JSON.parse(data);
		socket.to("gate").emit("open", dataJson.gate);
		const result = await fetch(`${process.env.API_URL}/users/get/${dataJson.user_mac}`, { method: "GET", headers: { "Content-Type": "application/json" } });
		await fetch(`${process.env.API_URL}/logs/`, {
			method: "POST",
			body: JSON.stringify({ name: result.name, address: dataJson.user_mac, type: dataJson.gate, date: new Date() }),
			headers: { "Content-Type": "application/json" },
		});
	});

	socket.on("disconnect", () => console.log(`Rozłączono: ${socket.id}`));
});

server.listen(port, () => console.log(`Nasłuchuję port: ${port}`));

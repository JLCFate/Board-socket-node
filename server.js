require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const fetch = require("node-fetch");

const port = process.env.PORT || 4001;
const app = express();
const server = http.createServer(app);
let lockStatus = { front: false, back: false };

const io = socketIo(server, { cors: { orgin: "*" } });

const filter = async (mac_address_in) => {
	const result = await fetch(`${process.env.API_URL}/users/get/${mac_address_in}`, { method: "GET", headers: { "Content-Type": "application/json" } });
	const data = await result.json();
	return data;
};

io.on("connect", async (socket) => {
	let result_row = await filter(socket.handshake.headers["x-address"]);
	console.log(`[${socket.id}] Połączono`);

	if (socket.handshake.headers["x-room"]) {
		socket.join(socket.handshake.headers["x-room"]);
		console.log(`[${socket.id}] Dołączył do pokoju '${socket.handshake.headers["x-room"]}'`);
		socket.emit("joined", socket.handshake.headers["x-room"]);
	}

	if (result_row.length === 0 || !result_row[0]["authorized"]) {
		socket.emit("failed", { status: result_row.length === 0 || result_row[0]["awaiting"] ? "newUser" : "unauthorized" });
		if (result_row.length === 0) {
			if (socket.handshake.headers["x-name"] !== undefined && socket.handshake.headers["x-address"] !== undefined) {
				await fetch(`${process.env.API_URL}/users/`, {
					method: "POST",
					body: JSON.stringify({ name: socket.handshake.headers["x-name"], address: socket.handshake.headers["x-address"] }),
					headers: { "Content-Type": "application/json" },
				});
			}
		}
	} else {
		socket.emit("authorized", result_row[0]);
	}

	socket.on("open", async (data) => {
		const dataJson = JSON.parse(data);
		if (!lockStatus[dataJson.gate]) {
			socket.to("gate").emit("open", dataJson.gate);
			lockStatus[dataJson.gate] = true;
			const result = await fetch(`${process.env.API_URL}/users/get/${dataJson.user_mac}`, {
				method: "GET",
				headers: { "Content-Type": "application/json" },
			});
			const resultJson = await result.json();
			await fetch(`${process.env.API_URL}/logs`, {
				method: "POST",
				body: JSON.stringify({ name: resultJson[0].name, address: dataJson.user_mac, type: dataJson.gate, date: new Date() }),
				headers: { "Content-Type": "application/json", "X-Address": dataJson.user_mac },
			});
			socket.emit("recieved");
			await setTimeout(() => (lockStatus[dataJson.gate] = false), 5000);
		} else {
			socket.emit("gateBusy", dataJson.gate);
		}
	});

	socket.on("disconnect", () => console.log(`[${socket.id}] Rozłączono`));
});

server.listen(port, () => console.log(`[SERVER] Nasłuchuję port: ${port}`));

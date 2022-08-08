require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const axios = require("axios");

const port = process.env.PORT || 4001;
const app = express();
const server = http.createServer(app);

const io = socketIo(server, { cors: { orgin: "*" } });

const filter = async (mac_address_in) => {
	const result = await axios({ method: "get", url: `${process.env.API_URL}/users/get/${mac_address_in}`, responseType: "application/json" });
	return result;
};

io.on("connect", async (socket) => {
	let result_row = await filter(socket.handshake.headers["x-address"]);
	console.log(`Połączono: ${socket.id}`);

	socket.on("join", () => {
		socket.join("gate");
		socket.emit("joined");
	});

	if (result_row.length === 0 || !result_row[0]["authorized"]) {
		socket.emit("failed", { status: result_row.length === 0 || result_row[0]["awaiting"] ? "newUser" : "unauthorized" });
		if (result_row.length === 0) {
			if (socket.handshake.headers["x-name"] !== undefined && socket.handshake.headers["x-address"] !== undefined)
				await axios({
					method: "post",
					url: `${process.env.API_URL}/users/`,
					data: { name: socket.handshake.headers["x-name"], address: socket.handshake.headers["x-address"] },
					responseType: "application/json",
				});
		}
	} else {
		socket.emit("authorized", result_row[0]);
	}

	socket.on("open", async (data) => {
		const dataJson = JSON.parse(data);
		socket.to("gate").emit("open", dataJson.gate);
		const result = await axios({ method: "get", url: `${process.env.API_URL}/users/get/${dataJson.user_mac}`, responseType: "application/json" });
		await axios({
			method: "post",
			url: `${process.env.API_URL}/logs/`,
			data: { name: result[0].name, address: dataJson.user_mac, type: dataJson.gate, date: new Date() },
			responseType: "application/json",
		});
	});

	socket.on("disconnect", () => console.log(`Rozłączono: ${socket.id}`));
});

server.listen(port, () => console.log(`Nasłuchuję port: ${port}`));

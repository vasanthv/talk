const express = require("express");
const path = require("path");
const http = require("http");
const app = express();
const server = http.createServer(app);
const io = require("socket.io")(server, {
	cors: { origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*" },
});

const signallingServer = require("./server/signalling-server.js");

// Get PORT from env variable else assign 3000 for development
const PORT = process.env.PORT || 3000;

// Server all the static files from www folder
app.use(express.static(path.join(__dirname, "www")));
app.use(express.static(path.join(__dirname, "icons")));
app.use(express.static(path.join(__dirname, "assets")));
app.use(express.static(path.join(__dirname, "node_modules/vue/dist/")));

server.listen(PORT, null, () => {
	console.log("Talk server started");
	console.log({ port: PORT, node_version: process.versions.node });
});

// serve the landing page
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "www/index.html")));

// serve the terms / legal page
app.get("/legal", (req, res) => res.sendFile(path.join(__dirname, "www/legal.html")));

// All other URL patterns will serve the app.
app.get("/:room", (req, res) => res.sendFile(path.join(__dirname, "www/app.html")));

io.sockets.on("connection", signallingServer);

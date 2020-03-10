const express = require('express');
const path = require('path');
const http = require('http');
const app = express();
const server = http.createServer(app);
const io = require('socket.io').listen(server);

// Server all the static files from www folder
app.use(express.static(path.join(__dirname, 'www')));

// Get PORT from env variable else assign 3000 for development
const PORT = process.env.PORT || 3000;
server.listen(PORT, null, function() {
	console.log("Listening on port " + PORT);
});

// All URL patterns should served with the same file.
app.get(['/', '/:room'], (req, res) => res.sendFile(path.join(__dirname, 'www/index.html')));

const channels = {};
const sockets = {};

io.sockets.on('connection', (socket) => {
	socket.channels = {};
	sockets[socket.id] = socket;

	console.log("[" + socket.id + "] connection accepted");
	socket.on('disconnect', () => {
		for (const channel in socket.channels) {
			part(channel);
		}
		console.log("[" + socket.id + "] disconnected");
		delete sockets[socket.id];
	});

	socket.on('join', (config) => {
		console.log("[" + socket.id + "] join ", config);
		const channel = config.channel;

		// Already Joined
		if (channel in socket.channels) return;

		if (!(channel in channels)) {
			channels[channel] = {};
		}

		for (id in channels[channel]) {
			channels[channel][id].emit('addPeer', { 'peer_id': socket.id, 'should_create_offer': false });
			socket.emit('addPeer', { 'peer_id': id, 'should_create_offer': true });
		}

		channels[channel][socket.id] = socket;
		socket.channels[channel] = channel;
	});

	const part = (channel) => {
		// Socket not in channel
		if (!(channel in socket.channels)) return;

		delete socket.channels[channel];
		delete channels[channel][socket.id];

		for (id in channels[channel]) {
			channels[channel][id].emit('removePeer', { 'peer_id': socket.id });
			socket.emit('removePeer', { 'peer_id': id });
		}
	}

	socket.on('relayICECandidate', (config) => {
		let peer_id = config.peer_id;
		let ice_candidate = config.ice_candidate;
		console.log("[" + socket.id + "] relay ICE-candidate to [" + peer_id + "] ", ice_candidate);

		if (peer_id in sockets) {
			sockets[peer_id].emit('iceCandidate', { 'peer_id': socket.id, 'ice_candidate': ice_candidate });
		}
	});

	socket.on('relaySessionDescription', (config) => {
		let peer_id = config.peer_id;
		let session_description = config.session_description;
		console.log("[" + socket.id + "] relay SessionDescription to [" + peer_id + "] ", session_description);

		if (peer_id in sockets) {
			sockets[peer_id].emit('sessionDescription', { 'peer_id': socket.id, 'session_description': session_description });
		}
	});
});
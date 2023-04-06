/*
Note: This socket connection is used a signalling server as WebRTC does not support discovery of other peers.
Your audio, video & chat messages does not use this socket.
*/
const util = require("util");
const { createHmac } = require("crypto");

const { SHARED_SECRET, CUSTOM_STUN_SERVER, CUSTOM_TURN_SERVER } = process.env
const CREDENTIAL_LIFETIME = parseInt(process.env.CREDENTIAL_LIFETIME, 10) || 3600;

function getTurnCredentials(name, secret = SHARED_SECRET, duration = CREDENTIAL_LIFETIME) {
	const timestamp = parseInt(Date.now() / 1000) + duration;
	const username = `${timestamp}:${name}`;
	const hmac = createHmac("sha1", secret);
	hmac.setEncoding('base64')
	hmac.write(username);
	hmac.end();

	const credential = hmac.read();
	return { username, credential };
}

const channels = {};
const sockets = {};
const peers = {};

const options = { depth: null, colors: true };

const signallingServer = (socket) => {
	const socketHostName = socket.handshake.headers.host.split(":")[0];

	socket.channels = {};
	sockets[socket.id] = socket;

	console.log("[" + socket.id + "] connection accepted");
	socket.on("disconnect", () => {
		for (const channel in socket.channels) {
			part(channel);
		}
		console.log("[" + socket.id + "] disconnected");
		delete sockets[socket.id];
	});

	socket.on("join", (config) => {
		console.log("[" + socket.id + "] join ", config);
		const channel = socketHostName + config.channel;

		if(SHARED_SECRET && CUSTOM_STUN_SERVER && CUSTOM_TURN_SERVER) {
			socket.emit('ice_servers', [
				{ urls: CUSTOM_STUN_SERVER },
				{ urls: CUSTOM_TURN_SERVER, ...getTurnCredentials(config.channel) }
			]);
		}

		// Already Joined
		if (channel in socket.channels) return;

		if (!(channel in channels)) {
			channels[channel] = {};
		}

		if (!(channel in peers)) {
			peers[channel] = {};
		}

		peers[channel][socket.id] = {
			userData: config.userData,
		};

		console.log("[" + socket.id + "] join - connected peers grouped by channel", util.inspect(peers, options));

		for (const id in channels[channel]) {
			channels[channel][id].emit("addPeer", {
				peer_id: socket.id,
				should_create_offer: false,
				channel: peers[channel],
			});
			socket.emit("addPeer", { peer_id: id, should_create_offer: true, channel: peers[channel] });
		}

		channels[channel][socket.id] = socket;
		socket.channels[channel] = channel;
	});

	socket.on("updateUserData", async (config) => {
		const channel = socketHostName + config.channel;
		const key = config.key;
		const value = config.value;
		for (let id in peers[channel]) {
			if (id == socket.id) {
				peers[channel][id]["userData"][key] = value;
			}
		}
		console.log("[" + socket.id + "] updateUserData", util.inspect(peers[channel][socket.id], options));
	});

	const part = (channel) => {
		// Socket not in channel
		if (!(channel in socket.channels)) return;

		delete socket.channels[channel];
		delete channels[channel][socket.id];

		delete peers[channel][socket.id];
		if (Object.keys(peers[channel]).length == 0) {
			// last peer disconnected from the channel
			delete peers[channel];
		}
		console.log("[" + socket.id + "] part - connected peers grouped by channel", util.inspect(peers, options));

		for (const id in channels[channel]) {
			channels[channel][id].emit("removePeer", { peer_id: socket.id });
			socket.emit("removePeer", { peer_id: id });
		}
	};

	socket.on("relayICECandidate", (config) => {
		let peer_id = config.peer_id;
		let ice_candidate = config.ice_candidate;
		console.log("[" + socket.id + "] relay ICE-candidate to [" + peer_id + "] ", ice_candidate);

		if (peer_id in sockets) {
			sockets[peer_id].emit("iceCandidate", { peer_id: socket.id, ice_candidate: ice_candidate });
		}
	});

	socket.on("relaySessionDescription", (config) => {
		let peer_id = config.peer_id;
		let session_description = config.session_description;
		console.log("[" + socket.id + "] relay SessionDescription to [" + peer_id + "] ", session_description);

		if (peer_id in sockets) {
			sockets[peer_id].emit("sessionDescription", {
				peer_id: socket.id,
				session_description: session_description,
			});
		}
	});
};

module.exports = signallingServer;

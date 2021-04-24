/* globals Vue, io*/
const ICE_SERVERS = [
	{ urls: "stun:stun.l.google.com:19302" },
	{ urls: "stun:stun.stunprotocol.org:3478" },
	{ urls: "stun:stun.sipnet.net:3478" },
	{ urls: "stun:stun.ideasip.com:3478" },
	{ urls: "stun:stun.iptel.org:3478" },
	{ urls: "turn:numb.viagenie.ca", username: "imvasanthv@gmail.com", credential: "d0ntuseme" },
	{
		urls: [
			"turn:173.194.72.127:19305?transport=udp",
			"turn:[2404:6800:4008:C01::7F]:19305?transport=udp",
			"turn:173.194.72.127:443?transport=tcp",
			"turn:[2404:6800:4008:C01::7F]:443?transport=tcp",
		],
		username: "CKjCuLwFEgahxNRjuTAYzc/s6OMT",
		credential: "u1SQDR/SQsPQIxXNWQT7czc/G4c=",
	},
];

const APP_URL = (() => {
	const protocol = "http" + (location.hostname == "localhost" ? "" : "s") + "://";
	return protocol + location.hostname + (location.hostname == "localhost" ? ":3000" : "");
})();

const ROOM_ID = (() => {
	let roomName = location.pathname.substring(1);
	if (!roomName) {
		roomName = Math.random()
			.toString(36)
			.substr(2, 6);
		window.history.pushState({ url: `${APP_URL}/${roomName}` }, roomName, `${APP_URL}/${roomName}`);
	}
	return roomName;
})();

const App = new Vue({
	el: "#app",
	data: {
		audioEnabled: true,
		videoEnabled: true,
		screenshareEnabled: false,
		showChat: false,
		selectedAudioDeviceId: "",
		selectedVideoDeviceId: "",
		name: window.localStorage.name || "",
	},
	computed: {},
	methods: {
		audioToggle: function() {
			local_media_stream.getAudioTracks()[0].enabled = !local_media_stream.getAudioTracks()[0].enabled;
			this.audioEnabled = !this.audioEnabled;
		},
		videoToggle: function() {
			local_media_stream.getVideoTracks()[0].enabled = !local_media_stream.getVideoTracks()[0].enabled;
			this.videoEnabled = !this.videoEnabled;
		},
		screenShareToggle: function() {
			let screenMediaPromise;
			if (!App.screenshareEnabled) {
				if (navigator.getDisplayMedia) {
					screenMediaPromise = navigator.getDisplayMedia({ video: true });
				} else if (navigator.mediaDevices.getDisplayMedia) {
					screenMediaPromise = navigator.mediaDevices.getDisplayMedia({ video: true });
				} else {
					screenMediaPromise = navigator.mediaDevices.getUserMedia({
						video: { mediaSource: "screen" },
					});
				}
			} else {
				screenMediaPromise = navigator.mediaDevices.getUserMedia({ video: true });
			}
			screenMediaPromise
				.then((screenStream) => {
					App.screenshareEnabled = !App.screenshareEnabled;

					for (let peer_id in peers) {
						const sender = peers[peer_id].getSenders().find((s) => (s.track ? s.track.kind === "video" : false));
						sender.replaceTrack(screenStream.getVideoTracks()[0]);
					}
					screenStream.getVideoTracks()[0].enabled = true;
					const newStream = new MediaStream([screenStream.getVideoTracks()[0], local_media_stream.getAudioTracks()[0]]);
					local_media_stream = newStream;
					attachMediaStream(document.getElementById("selfVideo"), newStream);
					document.querySelector("#videos .video #selfVideo").classList.toggle("mirror");

					screenStream.getVideoTracks()[0].onended = function() {
						if (App.screenshareEnabled) App.screenShareToggle();
					};
				})
				.catch((e) => {
					alert("Unable to share screen.");
					console.error(e);
				});
		},
	},
});

const USE_AUDIO = true;
const USE_VIDEO = true;

let signaling_socket = null; /* our socket.io connection to our webserver */
let local_media_stream = null; /* our own microphone / webcam */
let peers = {}; /* keep track of our peer connections, indexed by peer_id (aka socket.io id) */
let peer_media_elements = {}; /* keep track of our <video>/<audio> tags, indexed by peer_id */

function init() {
	// console.log("Connecting to signaling server");
	signaling_socket = io(APP_URL);
	signaling_socket = io();

	signaling_socket.on("connect", function() {
		// console.log("Connected to signaling server");
		if (local_media_stream) join_chat_channel(ROOM_ID, {});
		else
			setup_local_media(function() {
				/* once the user has given us access to their
				 * microphone/camcorder, join the channel and start peering up */
				join_chat_channel(ROOM_ID, {});
			});
	});
	signaling_socket.on("disconnect", function() {
		// console.log("Disconnected from signaling server");
		/* Tear down all of our peer connections and remove all the
		 * media divs when we disconnect */
		for (let peer_id in peer_media_elements) {
			document.getElementById("videos").removeChild(peer_media_elements[peer_id].parentNode);
			resizeVideos();
		}
		for (let peer_id in peers) {
			peers[peer_id].close();
		}

		peers = {};
		peer_media_elements = {};
	});

	function join_chat_channel(channel, userdata) {
		signaling_socket.emit("join", { channel: channel, userdata: userdata });
	}

	/**
	 * When we join a group, our signaling server will send out 'addPeer' events to each pair
	 * of users in the group (creating a fully-connected graph of users, ie if there are 6 people
	 * in the room you will connect directly to the other 5, so there will be a total of 15
	 * connections in the network).
	 */
	signaling_socket.on("addPeer", function(config) {
		// console.log('Signaling server said to add peer:', config);
		const peer_id = config.peer_id;
		if (peer_id in peers) {
			/* This could happen if the user joins multiple rooms where the other peer is also in. */
			// console.log("Already connected to peer ", peer_id);
			return;
		}
		const peer_connection = new RTCPeerConnection(
			{ iceServers: ICE_SERVERS },
			{ optional: [{ DtlsSrtpKeyAgreement: true }] } // this will no longer be needed by chrome eventually (supposedly), but is necessary for now to get firefox to talk to chrome
		);
		peers[peer_id] = peer_connection;

		peer_connection.onicecandidate = function(event) {
			if (event.candidate) {
				signaling_socket.emit("relayICECandidate", {
					peer_id: peer_id,
					ice_candidate: {
						sdpMLineIndex: event.candidate.sdpMLineIndex,
						candidate: event.candidate.candidate,
					},
				});
			}
		};
		peer_connection.onaddstream = function(event) {
			// console.log("onAddStream", event);
			// const videoWrap = document.createElement("div");
			// videoWrap.className = "video";
			const remote_media = getVideoElement();
			// videoWrap.appendChild(remote_media);
			// remote_media.setAttribute("playsinline", true);
			// remote_media.mediaGroup = "remotevideo";
			// remote_media.autoplay = true;
			// remote_media.controls = false;
			peer_media_elements[peer_id] = remote_media;
			// document.getElementById("videos").appendChild(videoWrap);

			// if (remote_media.requestFullscreen) {
			// 	const fullScreenBtn = document.createElement("button");
			// 	fullScreenBtn.className = "fullscreenbtn fas fa-expand";
			// 	fullScreenBtn.addEventListener("click", (e) => {
			// 		remote_media.requestFullscreen();
			// 	});
			// 	videoWrap.appendChild(fullScreenBtn);
			// }

			attachMediaStream(remote_media, event.stream);
			resizeVideos();
		};

		/* Add our local stream */
		peer_connection.addStream(local_media_stream);

		/* Only one side of the peer connection should create the
		 * offer, the signaling server picks one to be the offerer.
		 * The other user will get a 'sessionDescription' event and will
		 * create an offer, then send back an answer 'sessionDescription' to us
		 */
		if (config.should_create_offer) {
			// console.log("Creating RTC offer to ", peer_id);
			peer_connection.createOffer(
				function(local_description) {
					// console.log("Local offer description is: ", local_description);
					peer_connection.setLocalDescription(
						local_description,
						function() {
							signaling_socket.emit("relaySessionDescription", {
								peer_id: peer_id,
								session_description: local_description,
							});
							// console.log("Offer setLocalDescription succeeded");
						},
						function() {
							alert("Offer setLocalDescription failed!");
						}
					);
				},
				function(error) {
					console.log("Error sending offer: ", error);
				}
			);
		}
	});

	/**
	 * Peers exchange session descriptions which contains information
	 * about their audio / video settings and that sort of stuff. First
	 * the 'offerer' sends a description to the 'answerer' (with type
	 * "offer"), then the answerer sends one back (with type "answer").
	 */
	signaling_socket.on("sessionDescription", function(config) {
		// console.log('Remote description received: ', config);
		const peer_id = config.peer_id;
		const peer = peers[peer_id];
		const remote_description = config.session_description;
		// console.log(config.session_description);

		const desc = new RTCSessionDescription(remote_description);
		peer.setRemoteDescription(
			desc,
			function() {
				// console.log("setRemoteDescription succeeded");
				if (remote_description.type == "offer") {
					// console.log("Creating answer");
					peer.createAnswer(
						function(local_description) {
							// console.log("Answer description is: ", local_description);
							peer.setLocalDescription(
								local_description,
								function() {
									signaling_socket.emit("relaySessionDescription", {
										peer_id: peer_id,
										session_description: local_description,
									});
									// console.log("Answer setLocalDescription succeeded");
								},
								function() {
									alert("Answer setLocalDescription failed!");
								}
							);
						},
						function(error) {
							console.log("Error creating answer: ", error);
							// console.log(peer);
						}
					);
				}
			},
			function(error) {
				console.log("setRemoteDescription error: ", error);
			}
		);
		// console.log("Description Object: ", desc);
	});

	/**
	 * The offerer will send a number of ICE Candidate blobs to the answerer so they
	 * can begin trying to find the best path to one another on the net.
	 */
	signaling_socket.on("iceCandidate", function(config) {
		const peer = peers[config.peer_id];
		const ice_candidate = config.ice_candidate;
		peer.addIceCandidate(new RTCIceCandidate(ice_candidate));
	});

	/**
	 * When a user leaves a channel (or is disconnected from the
	 * signaling server) everyone will recieve a 'removePeer' message
	 * telling them to trash the media channels they have open for those
	 * that peer. If it was this client that left a channel, they'll also
	 * receive the removePeers. If this client was disconnected, they
	 * wont receive removePeers, but rather the
	 * signaling_socket.on('disconnect') code will kick in and tear down
	 * all the peer sessions.
	 */
	signaling_socket.on("removePeer", function(config) {
		// console.log('Signaling server said to remove peer:', config);
		const peer_id = config.peer_id;
		if (peer_id in peer_media_elements) {
			document.getElementById("videos").removeChild(peer_media_elements[peer_id].parentNode);
			resizeVideos();
		}
		if (peer_id in peers) {
			peers[peer_id].close();
		}

		delete peers[peer_id];
		delete peer_media_elements[config.peer_id];
	});
	// document.getElementById("roomurl").textContent = APP_URL + "/" + ROOM_ID;
	// document.getElementById("roomurl").addEventListener("click", (event) => {
	// 	let range, selection;
	// 	selection = window.getSelection();
	// 	range = document.createRange();
	// 	range.selectNodeContents(event.target);
	// 	selection.removeAllRanges();
	// 	selection.addRange(range);
	// });
	// document.getElementById("closebtn").addEventListener("click", () => {
	// 	document.getElementById("intro").style.display = "none";
	// });
}
const attachMediaStream = function(element, stream) {
	// console.log('DEPRECATED, attachMediaStream will soon be removed.');
	element.srcObject = stream;
};

function setup_local_media(callback, errorback) {
	if (local_media_stream != null) {
		/* ie, if we've already been initialized */
		if (callback) callback();
		return;
	}

	navigator.mediaDevices
		.getUserMedia({ audio: USE_AUDIO, video: USE_VIDEO })
		.then((stream) => {
			local_media_stream = stream;
			// const videoWrap = document.createElement("div");
			// videoWrap.className = "video";
			// videoWrap.setAttribute("id", "selfVideoWrap");

			// const btnWrap = document.createElement("div");
			// btnWrap.setAttribute("id", "btnWrap");
			// const muteBtn = document.createElement("button");
			// muteBtn.setAttribute("id", "mutebtn");
			// muteBtn.className = "fas fa-microphone";
			// muteBtn.addEventListener("click", (e) => {
			// 	local_media_stream.getAudioTracks()[0].enabled = !local_media_stream.getAudioTracks()[0].enabled;
			// 	e.target.className = "fas fa-microphone" + (local_media_stream.getAudioTracks()[0].enabled ? "" : "-slash");
			// });
			// btnWrap.appendChild(muteBtn);

			// const videoMuteBtn = document.createElement("button");
			// videoMuteBtn.setAttribute("id", "videomutebtn");
			// videoMuteBtn.className = "fas fa-video";
			// videoMuteBtn.addEventListener("click", (e) => {
			// 	local_media_stream.getVideoTracks()[0].enabled = !local_media_stream.getVideoTracks()[0].enabled;
			// 	e.target.className = "fas fa-video" + (local_media_stream.getVideoTracks()[0].enabled ? "" : "-slash");
			// });
			// btnWrap.appendChild(videoMuteBtn);

			// videoWrap.appendChild(btnWrap); // append all buttons to the local video wrap

			const local_media = getVideoElement(true);

			// local_media.setAttribute("id", "selfVideo");
			// local_media.setAttribute("playsinline", true);
			// local_media.className = "mirror";
			// local_media.autoplay = true;
			// local_media.muted = true;
			// local_media.volume = 0;
			// local_media.controls = false;
			// videoWrap.appendChild(local_media);
			// document.getElementById("videos").appendChild(videoWrap);
			attachMediaStream(local_media, stream);
			resizeVideos();
			if (callback) callback();
		})
		.catch(() => {
			/* user denied access to a/v */
			alert("This site will not work without camera/microphone access.");
			if (errorback) errorback();
		});
}

const getVideoElement = (isLocal) => {
	const videoWrap = document.createElement("div");
	videoWrap.className = "video";
	const media = document.createElement("video");
	media.setAttribute("playsinline", true);
	media.autoplay = true;
	media.controls = false;
	if (isLocal) {
		media.setAttribute("id", "selfVideo");
		media.className = "mirror";
		media.muted = true;
		media.volume = 0;
	} else {
		media.mediaGroup = "remotevideo";
	}
	videoWrap.appendChild(media);
	document.getElementById("videos").appendChild(videoWrap);
	return media;

	// const local_media = document.createElement("video");
	// local_media.setAttribute("id", "selfVideo");
	// local_media.setAttribute("playsinline", true);
	// local_media.className = "mirror";
	// local_media.autoplay = true;
	// local_media.muted = true;
	// local_media.volume = 0;
	// local_media.controls = false;

	// const remote_media = document.createElement("video");
	// videoWrap.appendChild(remote_media);
	// remote_media.setAttribute("playsinline", true);
	// remote_media.mediaGroup = "remotevideo";
	// remote_media.autoplay = true;
	// remote_media.controls = false;
};

const resizeVideos = () => {
	const numToString = ["", "one", "two", "three", "four", "five", "six"];
	const videos = document.querySelectorAll("#videos .video");
	document.querySelectorAll("#videos .video").forEach((v) => {
		v.className = "video " + numToString[videos.length];
	});
};

init();

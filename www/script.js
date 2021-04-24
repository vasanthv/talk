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
			localMediaStream.getAudioTracks()[0].enabled = !localMediaStream.getAudioTracks()[0].enabled;
			this.audioEnabled = !this.audioEnabled;
		},
		videoToggle: function() {
			localMediaStream.getVideoTracks()[0].enabled = !localMediaStream.getVideoTracks()[0].enabled;
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
					const newStream = new MediaStream([screenStream.getVideoTracks()[0], localMediaStream.getAudioTracks()[0]]);
					localMediaStream = newStream;
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

let signalingSocket = null; /* our socket.io connection to our webserver */
let localMediaStream = null; /* our own microphone / webcam */
let peers = {}; /* keep track of our peer connections, indexed by peer_id (aka socket.io id) */
let peerMediaElements = {}; /* keep track of our <video>/<audio> tags, indexed by peer_id */

function init() {
	signalingSocket = io(APP_URL);
	signalingSocket = io();

	signalingSocket.on("connect", function() {
		if (localMediaStream) join_chat_channel(ROOM_ID, {});
		else
			setupLocalMedia(function() {
				join_chat_channel(ROOM_ID, {});
			});
	});
	signalingSocket.on("disconnect", function() {
		for (let peer_id in peerMediaElements) {
			document.getElementById("videos").removeChild(peerMediaElements[peer_id].parentNode);
			resizeVideos();
		}
		for (let peer_id in peers) {
			peers[peer_id].close();
		}

		peers = {};
		peerMediaElements = {};
	});

	function join_chat_channel(channel, userdata) {
		signalingSocket.emit("join", { channel: channel, userdata: userdata });
	}

	signalingSocket.on("addPeer", function(config) {
		const peer_id = config.peer_id;
		if (peer_id in peers) return;

		const peerConnection = new RTCPeerConnection(
			{ iceServers: ICE_SERVERS },
			{ optional: [{ DtlsSrtpKeyAgreement: true }] }
		);
		peers[peer_id] = peerConnection;

		peerConnection.onicecandidate = function(event) {
			if (event.candidate) {
				signalingSocket.emit("relayICECandidate", {
					peer_id: peer_id,
					ice_candidate: {
						sdpMLineIndex: event.candidate.sdpMLineIndex,
						candidate: event.candidate.candidate,
					},
				});
			}
		};
		peerConnection.onaddstream = function(event) {
			const remoteMedia = getVideoElement();
			peerMediaElements[peer_id] = remoteMedia;
			attachMediaStream(remoteMedia, event.stream);
			resizeVideos();
		};

		/* Add our local stream */
		peerConnection.addStream(localMediaStream);

		if (config.should_create_offer) {
			peerConnection.createOffer(
				(localDescription) => {
					peerConnection.setLocalDescription(
						localDescription,
						() => {
							signalingSocket.emit("relaySessionDescription", {
								peer_id: peer_id,
								session_description: localDescription,
							});
						},
						() => alert("Offer setLocalDescription failed!")
					);
				},
				(error) => console.log("Error sending offer: ", error)
			);
		}
	});

	signalingSocket.on("sessionDescription", function(config) {
		const peer_id = config.peer_id;
		const peer = peers[peer_id];
		const remoteDescription = config.session_description;

		const desc = new RTCSessionDescription(remoteDescription);
		peer.setRemoteDescription(
			desc,
			() => {
				if (remoteDescription.type == "offer") {
					peer.createAnswer(
						(localDescription) => {
							peer.setLocalDescription(
								localDescription,
								() => {
									signalingSocket.emit("relaySessionDescription", {
										peer_id: peer_id,
										session_description: localDescription,
									});
								},
								() => alert("Answer setLocalDescription failed!")
							);
						},
						(error) => console.log("Error creating answer: ", error)
					);
				}
			},
			(error) => console.log("setRemoteDescription error: ", error)
		);
	});

	signalingSocket.on("iceCandidate", function(config) {
		const peer = peers[config.peer_id];
		const iceCandidate = config.ice_candidate;
		peer.addIceCandidate(new RTCIceCandidate(iceCandidate));
	});

	signalingSocket.on("removePeer", function(config) {
		const peer_id = config.peer_id;
		if (peer_id in peerMediaElements) {
			document.getElementById("videos").removeChild(peerMediaElements[peer_id].parentNode);
			resizeVideos();
		}
		if (peer_id in peers) {
			peers[peer_id].close();
		}
		delete peers[peer_id];
		delete peerMediaElements[config.peer_id];
	});
}
const attachMediaStream = (element, stream) => (element.srcObject = stream);
function setupLocalMedia(callback, errorback) {
	if (localMediaStream != null) {
		if (callback) callback();
		return;
	}

	navigator.mediaDevices
		.getUserMedia({ audio: USE_AUDIO, video: USE_VIDEO })
		.then((stream) => {
			localMediaStream = stream;
			const localMedia = getVideoElement(true);
			attachMediaStream(localMedia, stream);
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
};

const resizeVideos = () => {
	const numToString = ["", "one", "two", "three", "four", "five", "six"];
	const videos = document.querySelectorAll("#videos .video");
	document.querySelectorAll("#videos .video").forEach((v) => {
		v.className = "video " + numToString[videos.length];
	});
};

init();

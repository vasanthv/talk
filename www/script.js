/* globals App, io */

"use strict";

/**
 * TODO Recommended to using only one Stun/Turn
 * https://github.com/coturn/coturn
 */
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

const USE_AUDIO = true;
const USE_VIDEO = true;

let signalingSocket = null; /* our socket.io connection to our webserver */
let localMediaStream = null; /* our own microphone / webcam */
let peers = {}; /* keep track of our peer connections, indexed by peer_id (aka socket.io id) */
let channel = {} /* keep track of the peers Info in the channel, indexed by peer_id (aka socket.io id) */
let peerMediaElements = {}; /* keep track of our <video>/<audio> tags, indexed by peer_id */
let dataChannels = {};

function init() {
	App.toggleTheme();

	App.userAgent = navigator.userAgent;
	App.isMobileDevice = !!(/Android|webOS|iPhone|iPad|iPod|BB10|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(App.userAgent.toUpperCase() || ''));
	App.isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(App.userAgent.toLowerCase());
	App.isIpad = /macintosh/.test(App.userAgent.toLowerCase()) && 'ontouchend' in document;
	App.isDesktop = (!App.isMobileDevice && !App.isTablet && !App.isIpad);

	App.roomId = ROOM_ID;

	App.roomLink = `${APP_URL}/${ROOM_ID}`;

	signalingSocket = io(APP_URL);
	signalingSocket = io();

	signalingSocket.on("connect", function() {

		App.peerId = signalingSocket.id;

		console.log('peerId: ' + App.peerId);

		const userData = {
			peerName: App.name,
			videoEnabled: App.videoEnabled,
			audioEnabled: App.audioEnabled,
			userAgent: App.userAgent,
			isMobileDevice: App.isMobileDevice,
			isTablet: App.isTablet,
			isIpad: App.isIpad,
			isDesktop: App.isDesktop,
		};

		if (localMediaStream) joinChatChannel(ROOM_ID, userData);
		else
			setupLocalMedia(function() {
				joinChatChannel(ROOM_ID, userData);
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

	function joinChatChannel(channel, userData) {
		signalingSocket.emit("join", { channel: channel, userData: userData });
	}

	signalingSocket.on("addPeer", function(config) {
		//console.log("addPeer", config);

		const peer_id = config.peer_id;
		if (peer_id in peers) return;

		channel = config.channel;
		//console.log('[Join] - connected peers in the channel', JSON.stringify(channel, null, 2));

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
			const remoteMedia = getVideoElement(peer_id);
			peerMediaElements[peer_id] = remoteMedia;
			attachMediaStream(remoteMedia, event.stream);
			resizeVideos();
			App.showIntro = false;

			for (let peerId in channel) {
				const videoPeerName = document.getElementById(peerId + "_videoPeerName");
				const peerName = channel[peerId]["userData"]["peerName"];
				if (videoPeerName && peerName) {
					videoPeerName.innerHTML = peerName + (peerId == App.peerId ? " (you)" : "");
				}

				const videoAvatarImg = document.getElementById(peerId + "_videoEnabled");
				const videoEnabled = channel[peerId]["userData"]["videoEnabled"];
				if (videoAvatarImg && !videoEnabled) {
					videoAvatarImg.style.display = "block";
				}

				const audioEnabledEl = document.getElementById(peerId + "_audioEnabled");
				const audioEnabled = channel[peerId]["userData"]["audioEnabled"];
				if (audioEnabledEl) {
					audioEnabledEl.className = "audioEnabled icon-mic" + (audioEnabled ? "" : "-off");
				}
			}
		};

		peerConnection.ondatachannel = function(event) {
			console.log("Datachannel event" + peer_id, event);
			event.channel.onmessage = (msg) => {
				let dataMessage = {};
				try {
					dataMessage = JSON.parse(msg.data);
					App.handleIncomingDataChannelMessage(dataMessage);
				} catch (err) {
					console.log(err);
				}
			};
		};

		/* Add our local stream */
		peerConnection.addStream(localMediaStream);
		dataChannels[peer_id] = peerConnection.createDataChannel("talk__data_channel");

		if (config.should_create_offer) {
			peerConnection.onnegotiationneeded = () => {
				peerConnection
					.createOffer()
					.then((localDescription) => {
						peerConnection
							.setLocalDescription(localDescription)
							.then(() => {
								signalingSocket.emit("relaySessionDescription", {
									peer_id: peer_id,
									session_description: localDescription,
								});
							})
							.catch(() => {
								alert("Offer setLocalDescription failed!")
							});
					})
					.catch((error) => {
						console.log("Error sending offer: ", error)
					});
			}
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
		peer.addIceCandidate(new RTCIceCandidate(iceCandidate)).catch((error) => {
			console.log('Error addIceCandidate', error);
		});
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
		delete dataChannels[peer_id];
		delete peers[peer_id];
		delete peerMediaElements[config.peer_id];

		delete channel[config.peer_id];
		//console.log('removePeer', JSON.stringify(channel, null, 2));
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
			const localMedia = getVideoElement(App.peerId, true);
			attachMediaStream(localMedia, stream);
			resizeVideos();
			if (callback) callback();

			navigator.mediaDevices.enumerateDevices().then((devices) => {
				App.videoDevices = devices.filter((device) => device.kind === "videoinput" && device.deviceId !== "default");
				App.audioDevices = devices.filter((device) => device.kind === "audioinput" && device.deviceId !== "default");
			});
		})
		.catch(() => {
			/* user denied access to a/v */
			alert("This site will not work without camera/microphone access.");
			if (errorback) errorback();
		});
}

const getVideoElement = (peerId, isLocal) => {
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

	const audioEnabled = document.createElement("i");
	audioEnabled.setAttribute("id", peerId + "_audioEnabled");
	audioEnabled.className = "audioEnabled icon-mic";

	const peerName = document.createElement("p");
	peerName.setAttribute("id", peerId + "_videoPeerName");
	peerName.className = "videoPeerName";
	peerName.innerHTML = App.name + " (you)";

	const fullScreenBtn = document.createElement("button");
	fullScreenBtn.className = "icon-maximize";
	fullScreenBtn.addEventListener("click", () => {
		if (videoWrap.requestFullscreen) {
			videoWrap.requestFullscreen();
		} else if (videoWrap.webkitRequestFullscreen) {
			videoWrap.webkitRequestFullscreen();
		}
	});

	const videoAvatarImgSize = App.isMobileDevice ? "100px" : "200px";
	const videoAvatarImg = document.createElement('img');
	videoAvatarImg.setAttribute("id", peerId + "_videoEnabled");
	videoAvatarImg.setAttribute("src", "img/videoOff.png");
	videoAvatarImg.setAttribute("width", videoAvatarImgSize);
	videoAvatarImg.setAttribute("height", videoAvatarImgSize);
	videoAvatarImg.className = "videoAvatarImg";

	videoWrap.setAttribute("id", peerId);
	videoWrap.appendChild(media);
	videoWrap.appendChild(audioEnabled);
	videoWrap.appendChild(peerName);
	videoWrap.appendChild(fullScreenBtn);
	videoWrap.appendChild(videoAvatarImg);
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

document.body.addEventListener("click", () => {
	if (!App.showChat && !App.showSettings && !App.showIntro) {
		App.hideToolbar = !App.hideToolbar;
	}
	if(App.showSettings && App.showChat) {
		App.showChat = !App.showChat;
		App.showSettings = !App.showSettings;
	}
});

window.onload = init;

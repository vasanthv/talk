/* globals App, io */

"use strict";

const ICE_SERVERS = [
	{ urls: "stun:stun.l.google.com:19302" },
	{ urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
];

const APP_URL = (() => {
	const protocol = "http" + (location.hostname == "localhost" ? "" : "s") + "://";
	return protocol + location.hostname + (location.hostname == "localhost" ? ":3000" : "");
})();

const ROOM_ID = (() => {
	let roomName = location.pathname.substring(1);
	if (!roomName) {
		roomName = Math.random().toString(36).substr(2, 6);
		window.history.pushState({ url: `${APP_URL}/${roomName}` }, roomName, `${APP_URL}/${roomName}`);
	}
	return roomName;
})();

const USE_AUDIO = true;
const USE_VIDEO = true;

let signalingSocket = null; /* our socket.io connection to our webserver */
let localMediaStream = null; /* our own microphone / webcam */
let peers = {}; /* keep track of our peer connections, indexed by peer_id (aka socket.io id) */
let channel = {}; /* keep track of the peers Info in the channel, indexed by peer_id (aka socket.io id) */
let peerMediaElements = {}; /* keep track of our <video>/<audio> tags, indexed by peer_id */
let dataChannels = {};

function init() {
	App.userAgent = navigator.userAgent;
	App.isMobileDevice = !!/Android|webOS|iPhone|iPad|iPod|BB10|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(
		App.userAgent.toUpperCase() || ""
	);
	App.isTablet =
		/(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(
			App.userAgent.toLowerCase()
		);
	App.isIpad = /macintosh/.test(App.userAgent.toLowerCase()) && "ontouchend" in document;
	App.isDesktop = !App.isMobileDevice && !App.isTablet && !App.isIpad;

	App.roomId = ROOM_ID;

	App.roomLink = `${APP_URL}/${ROOM_ID}`;

	signalingSocket = io(APP_URL);
	signalingSocket = io();

	signalingSocket.on("connect", function () {
		App.peerId = signalingSocket.id;

		console.log("peerId: " + App.peerId);

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
			setupLocalMedia(function () {
				joinChatChannel(ROOM_ID, userData);
			});
	});

	signalingSocket.on("disconnect", function () {
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

	signalingSocket.on("addPeer", function (config) {
		//console.log("addPeer", config);

		const peer_id = config.peer_id;
		if (peer_id in peers) return;

		channel = config.channel;
		//console.log('[Join] - connected peers in the channel', JSON.stringify(channel, null, 2));

		const peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
		peers[peer_id] = peerConnection;

		peerConnection.onicecandidate = function (event) {
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

		peerConnection.onaddstream = function (event) {
			const remoteMedia = getVideoElement(peer_id);
			peerMediaElements[peer_id] = remoteMedia;
			attachMediaStream(remoteMedia, event.stream);
			resizeVideos();
			App.showIntro = false;

			for (let peerId in channel) {
				const videoPeerName = document.getElementById(peerId + "_videoPeerName");
				const peerName = channel[peerId]["userData"]["peerName"];
				if (videoPeerName && peerName) {
					videoPeerName.innerHTML = peerName;
				}

				const videoAvatarImg = document.getElementById(peerId + "_videoEnabled");
				const videoEnabled = channel[peerId]["userData"]["videoEnabled"];
				if (videoAvatarImg && !videoEnabled) {
					videoAvatarImg.style.visibility = "visible";
				}

				const audioEnabledEl = document.getElementById(peerId + "_audioEnabled");
				const audioEnabled = channel[peerId]["userData"]["audioEnabled"];
				if (audioEnabledEl) {
					audioEnabledEl.className = "audioEnabled icon-mic" + (audioEnabled ? "" : "-off");
				}
			}
		};

		peerConnection.ondatachannel = function (event) {
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
								alert("Offer setLocalDescription failed!");
							});
					})
					.catch((error) => {
						console.log("Error sending offer: ", error);
					});
			};
		}
	});

	signalingSocket.on("sessionDescription", function (config) {
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

	signalingSocket.on("iceCandidate", function (config) {
		const peer = peers[config.peer_id];
		const iceCandidate = config.ice_candidate;
		peer.addIceCandidate(new RTCIceCandidate(iceCandidate)).catch((error) => {
			console.log("Error addIceCandidate", error);
		});
	});

	signalingSocket.on("removePeer", function (config) {
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

	const peerNameEle = document.createElement("div");
	peerNameEle.setAttribute("id", peerId + "_videoPeerName");
	peerNameEle.className = "videoPeerName";
	if (isLocal) {
		peerNameEle.innerHTML = `${App.name ?? ""} (you)`;
	} else {
		peerNameEle.innerHTML = "Unnamed";
	}

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
	const videoAvatarImg = document.createElement("img");
	videoAvatarImg.setAttribute("id", peerId + "_videoEnabled");
	videoAvatarImg.setAttribute("src", "img/videoOff.png");
	videoAvatarImg.setAttribute("width", videoAvatarImgSize);
	videoAvatarImg.setAttribute("height", videoAvatarImgSize);
	videoAvatarImg.className = "videoAvatarImg";

	videoWrap.setAttribute("id", peerId);
	videoWrap.appendChild(media);
	videoWrap.appendChild(audioEnabled);
	videoWrap.appendChild(peerNameEle);
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

document.addEventListener("click", () => {
	if (!App.showChat && !App.showSettings && !App.showIntro) {
		App.hideToolbar = !App.hideToolbar;
	}
	if (App.showSettings && App.showChat) {
		App.showChat = !App.showChat;
		App.showSettings = !App.showSettings;
	}
});

window.onload = init;

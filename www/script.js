const appURL = () => {
	const protocol = 'http' + (location.hostname == 'localhost' ? '' : 's') + '://';
	return protocol + location.hostname + (location.hostname == 'localhost' ? ':3000' : '');
};
const getRoomName = () => {
	let roomName = location.pathname.substring(1);
	if (roomName == '') {
		const randomName = () =>
			Math.random()
				.toString(36)
				.substr(2, 6);
		roomName = randomName();
		const newurl = appURL() + '/' + roomName;
		window.history.pushState({ url: newurl }, roomName, newurl);
	}
	return roomName;
};
var SIGNALING_SERVER = appURL();
var USE_AUDIO = true;
var USE_VIDEO = true;
//var USE_VIDEO = { facingMode: "environment" }; // use this for back facing camera.
var IS_SCREEN_STREAMING = false;
var ROOM_ID = getRoomName();
var peerConnection = null;

var ICE_SERVERS = [
	{ urls: 'stun:stun.l.google.com:19302' },
	{ urls: 'stun:stun.stunprotocol.org:3478' },
	{ urls: 'stun:stun.sipnet.net:3478' },
	{ urls: 'stun:stun.ideasip.com:3478' },
	{ urls: 'stun:stun.iptel.org:3478' },
	{ urls: 'turn:numb.viagenie.ca', username: 'imvasanthv@gmail.com', credential: 'd0ntuseme' },
	{
		urls: [
			'turn:173.194.72.127:19305?transport=udp',
			'turn:[2404:6800:4008:C01::7F]:19305?transport=udp',
			'turn:173.194.72.127:443?transport=tcp',
			'turn:[2404:6800:4008:C01::7F]:443?transport=tcp'
		],
		username: 'CKjCuLwFEgahxNRjuTAYzc/s6OMT',
		credential: 'u1SQDR/SQsPQIxXNWQT7czc/G4c='
	}
];

var signalingSocket = null; /* socket.io connection to our webserver */
var localMediaStream = null; /* my own microphone / webcam */
var peers = {}; /* keep track of our peer connections, indexed by peer_id (aka socket.io id) */
var peerMediaElements = {}; /* keep track of our <video> tags, indexed by peer_id */

function init() {
	console.log('Connecting to signaling server');
	signalingSocket = io(SIGNALING_SERVER);
	signalingSocket = io();

	signalingSocket.on('connect', function() {
		console.log('Connected to signaling server');
		if (localMediaStream) joinChannel(ROOM_ID, {});
		else
			setup_local_media(function() {
				// Join the channel once user gives access to microphone & webcam
				joinChannel(ROOM_ID, {});
			});
	});
	signalingSocket.on('disconnect', function() {
		for (peer_id in peerMediaElements) {
			document.body.removeChild(peerMediaElements[peer_id].parentNode);
			resizeVideos();
		}
		for (peer_id in peers) {
			peers[peer_id].close();
		}

		peers = {};
		peerMediaElements = {};
	});

	function joinChannel(channel, userdata) {
		signalingSocket.emit('join', { channel: channel, userdata: userdata });
	}
	signalingSocket.on('addPeer', function(config) {
		var peer_id = config.peer_id;
		if (peer_id in peers) return;
		peerConnection = new RTCPeerConnection(
			{ iceServers: ICE_SERVERS },
			{ optional: [{ DtlsSrtpKeyAgreement: true }] } // this will no longer be needed by chrome eventually (supposedly), but is necessary for now to get firefox to talk to chrome
		);
		peers[peer_id] = peerConnection;

		peerConnection.onicecandidate = function(event) {
			if (event.candidate) {
				signalingSocket.emit('relayICECandidate', {
					peer_id: peer_id,
					ice_candidate: {
						sdpMLineIndex: event.candidate.sdpMLineIndex,
						candidate: event.candidate.candidate
					}
				});
			}
		};
		peerConnection.onaddstream = function(event) {
			const videoWrap = document.createElement('div');
			videoWrap.className = 'video';
			const remoteMedia = document.createElement('video');
			videoWrap.appendChild(remoteMedia);
			remoteMedia.setAttribute('playsinline', true);
			remoteMedia.mediaGroup = 'remotevideo';
			remoteMedia.autoplay = true;
			remoteMedia.controls = false;
			peerMediaElements[peer_id] = remoteMedia;
			document.body.appendChild(videoWrap);
			document.getElementById('message').style.display = 'none';

			attachMediaStream(remoteMedia, event.stream);
			resizeVideos();
		};

		/* Add our local stream */
		peerConnection.addStream(localMediaStream);

		if (config.should_create_offer) {
			peerConnection.createOffer(
				function(local_description) {
					peerConnection.setLocalDescription(
						local_description,
						function() {
							signalingSocket.emit('relaySessionDescription', {
								peer_id: peer_id,
								session_description: local_description
							});
						},
						function() {
							alert('Offer setLocalDescription failed!');
						}
					);
				},
				function(error) {
					console.log('Error sending offer: ', error);
				}
			);
		}
	});

	signalingSocket.on('sessionDescription', function(config) {
		var peer_id = config.peer_id;
		var peer = peers[peer_id];
		var remote_description = config.session_description;

		var desc = new RTCSessionDescription(remote_description);
		var stuff = peer.setRemoteDescription(
			desc,
			function() {
				if (remote_description.type == 'offer') {
					peer.createAnswer(
						function(local_description) {
							peer.setLocalDescription(
								local_description,
								function() {
									signalingSocket.emit('relaySessionDescription', {
										peer_id: peer_id,
										session_description: local_description
									});
								},
								function() {
									Alert('Answer setLocalDescription failed!');
								}
							);
						},
						function(error) {
							console.log('Error creating answer: ', error);
						}
					);
				}
			},
			function(error) {
				console.log('setRemoteDescription error: ', error);
			}
		);
	});

	signalingSocket.on('iceCandidate', function(config) {
		var peer = peers[config.peer_id];
		var ice_candidate = config.ice_candidate;
		peer.addIceCandidate(new RTCIceCandidate(ice_candidate));
	});
	signalingSocket.on('removePeer', function(config) {
		var peer_id = config.peer_id;
		if (peer_id in peerMediaElements) {
			document.body.removeChild(peerMediaElements[peer_id].parentNode);
			resizeVideos();
		}
		if (peer_id in peers) {
			peers[peer_id].close();
		}

		delete peers[peer_id];
		delete peerMediaElements[config.peer_id];
	});
	// document.getElementById('roomurl').value = appURL() + '/' + getRoomName();
}

function setup_local_media(callback, errorback) {
	if (localMediaStream != null) {
		if (callback) callback();
		return;
	}
	attachMediaStream = function(element, stream) {
		element.srcObject = stream;
	};
	navigator.mediaDevices
		.getUserMedia({ audio: USE_AUDIO, video: USE_VIDEO })
		.then(stream => {
			localMediaStream = stream;
			const videoWrap = document.createElement('div');
			videoWrap.className = 'video';
			videoWrap.setAttribute('id', 'myVideoWrap');

			document.getElementById('mutebtn').addEventListener('click', e => {
				localMediaStream.getAudioTracks()[0].enabled = !localMediaStream.getAudioTracks()[0]
					.enabled;
				e.target.className =
					'fas fa-microphone' + (localMediaStream.getAudioTracks()[0].enabled ? '' : '-slash');
			});

			document.getElementById('videomutebtn').addEventListener('click', e => {
				localMediaStream.getVideoTracks()[0].enabled = !localMediaStream.getVideoTracks()[0]
					.enabled;
				e.target.className =
					'fas fa-video' + (localMediaStream.getVideoTracks()[0].enabled ? '' : '-slash');
			});

			if (navigator.getDisplayMedia || navigator.mediaDevices.getDisplayMedia) {
				document.getElementById('screensharebtn').addEventListener('click', e => {
					toggleScreenSharing();
				});
			} else {
				document.getElementById('screensharebtn').style.display = 'none';
				document.getElementById('buttons').style.width = '12rem';
			}

			document.getElementById('buttons').style.opacity = '1';

			const localMedia = document.createElement('video');
			videoWrap.appendChild(localMedia);
			localMedia.setAttribute('id', 'myVideo');
			localMedia.setAttribute('playsinline', true);
			localMedia.className = 'mirror';
			localMedia.autoplay = true;
			localMedia.muted = true;
			localMedia.volume = 0;
			localMedia.controls = false;
			document.body.appendChild(videoWrap);
			attachMediaStream(localMedia, stream);
			resizeVideos();
			if (callback) callback();
		})
		.catch(() => {
			/* user denied access to a/v */
			alert('This app will not work without camera/microphone access.');
			if (errorback) errorback();
		});
}
const resizeVideos = () => {
	const numToString = ['', 'one', 'two', 'three', 'four', 'five', 'six'];
	const videos = document.querySelectorAll('.video');
	document.querySelectorAll('.video').forEach(v => {
		v.className = 'video ' + numToString[videos.length];
	});
};

function toggleScreenSharing() {
	const screenShareBtn = document.getElementById('screensharebtn');
	const videoMuteBtn = document.getElementById('videomutebtn');
	let screenMediaPromise;
	if (!IS_SCREEN_STREAMING) {
		if (navigator.getDisplayMedia) {
			screenMediaPromise = navigator.getDisplayMedia({ video: true });
		} else if (navigator.mediaDevices.getDisplayMedia) {
			screenMediaPromise = navigator.mediaDevices.getDisplayMedia({ video: true });
		} else {
			screenMediaPromise = navigator.mediaDevices.getUserMedia({
				video: { mediaSource: 'screen' }
			});
		}
	} else {
		screenMediaPromise = navigator.mediaDevices.getUserMedia({ video: true });
		videoMuteBtn.className = 'fas fa-video'; // make sure to enable video
	}
	screenMediaPromise
		.then(screenStream => {
			IS_SCREEN_STREAMING = !IS_SCREEN_STREAMING;

			var sender = peerConnection
				.getSenders()
				.find(s => (s.track ? s.track.kind === 'video' : false));
			sender.replaceTrack(screenStream.getVideoTracks()[0]);
			screenStream.getVideoTracks()[0].enabled = true;

			const newStream = new MediaStream([
				screenStream.getVideoTracks()[0],
				localMediaStream.getAudioTracks()[0]
			]);
			localMediaStream = newStream;
			attachMediaStream(document.getElementById('myVideo'), newStream);

			document.getElementById('myVideo').classList.toggle('mirror');
			screenShareBtn.classList.toggle('active');

			var videoBtnDState = document.getElementById('videomutebtn').getAttribute('disabled');
			videoBtnDState = videoBtnDState === null ? false : true;
			document.getElementById('videomutebtn').disabled = !videoBtnDState;
			screenStream.getVideoTracks()[0].onended = function() {
				if (IS_SCREEN_STREAMING) toggleScreenSharing();
			};
		})
		.catch(e => {
			alert('Unable to share screen.');
			console.error(e);
		});
}

const copyURL = () => {
	/* Get the text field */
	var copyText = document.getElementById('roomurl');
	/* Select the text field */
	copyText.select();
	copyText.setSelectionRange(0, 99999); /*For mobile devices*/
	/* Copy the text inside the text field */
	document.execCommand('copy');
	document.getElementById('copybtn').style.color = '#27ae60';
	setTimeout(() => {
		document.getElementById('copybtn').style.color = '#333';
	}, 3000);
};

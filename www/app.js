/* globals attachMediaStream, Vue,  peers, localMediaStream, dataChannels, signalingSocket */

"use strict";

const App = new Vue({
	el: "#app",
	data: {
		peerId: "",
		roomId: "",
		roomLink: "",
		copyText: "",
		userAgent: "",
		isMobileDevice: false,
		isTablet: false,
		isIpad: false,
		isDesktop: false,
		videoDevices: [],
		audioDevices: [],
		audioEnabled: true,
		videoEnabled: true,
		screenShareEnabled: false,
		showIntro: true,
		showChat: false,
		showSettings: false,
		hideToolbar: false,
		selectedAudioDeviceId: "",
		selectedVideoDeviceId: "",
		name: window.localStorage.name || "Unnamed",
		isDark: false,
		typing: "",
		chats: [],
	},
	computed: {},
	methods: {
		copyURL: function() {
			navigator.clipboard.writeText(this.roomLink).then(
				() => {
					this.copyText = "Copied 👍";
					setTimeout(() => (this.copyText = ""), 3000);
				},
				(err) => console.error(err)
			);
		},
		audioToggle: function(e) {
			e.stopPropagation();
			localMediaStream.getAudioTracks()[0].enabled = !localMediaStream.getAudioTracks()[0].enabled;
			this.audioEnabled = !this.audioEnabled;
			this.updateUserData("audioEnabled", this.audioEnabled);
		},
		videoToggle: function(e) {
			e.stopPropagation();
			localMediaStream.getVideoTracks()[0].enabled = !localMediaStream.getVideoTracks()[0].enabled;
			this.videoEnabled = !this.videoEnabled;
			this.updateUserData("videoEnabled", this.videoEnabled);
		},
		toggleSelfVideoMirror: function() {
			document.querySelector("#videos .video #selfVideo").classList.toggle("mirror");
		},
		toggleTheme: function() {
			if (this.isDark) {
				this.setStyle("--body-bg", "#000");
				this.setStyle("--intro-bg", "#000");
				this.setStyle("--intro-cl", "#fff"); 
				this.setStyle("--chat-wrap-bg", "#000");
				this.setStyle("--chat-wrap-ch-bg", "linear-gradient(black 30%, rgb(90 85 85 / 0%)), linear-gradient(rgb(5 5 5 / 0%), black 70%) 0 100%, radial-gradient(50% 0, farthest-side, rgb(246 243 243 / 20%), rgb(250 249 249 / 0%)), radial-gradient(50% 100%, farthest-side, rgb(250 246 246 / 20%), rgb(251 249 249 / 0%)) 0 100%");
				this.setStyle("--chat-wrap-ch-bg", "linear-gradient(black 30%, rgb(5 5 5 / 0%)), linear-gradient(rgb(2 2 2 / 0%), black 70%) 0 100%, radial-gradient(farthest-side at 50% 0, rgb(246 241 241 / 20%), rgb(244 240 240 / 0%)), radial-gradient(farthest-side at 50% 100%, rgb(250 249 249 / 20%), rgb(250 248 248 / 0%)) 0 100%");
				this.setStyle("--chat-wrap-ch-bgc", "black");
				this.setStyle("--chat-wrap-ch-cl", "#fff");
				this.setStyle("--chat-wrap-cb-bg", "#060606");
				this.setStyle("--chat-wrap-cb-cl", "#fff");
				this.setStyle("--settings-bg", "rgba(0, 0, 0, 0.9)");
				this.setStyle("--settings-cl", "#fff");
				this.setStyle("--settings-link-h-bg", "#000");
				this.setStyle("--settings-link-h-cl", "#fff");
				this.setStyle("--actions-bg", "rgba(0, 0, 0, 0.5)");
				this.setStyle("--actions-btn-cl", "#fff");
				this.setStyle("--actions-btn-h-bg", "rgba(0, 0, 0, 0.8)");
				this.setStyle("--actions-btn-h-cl", "#fff");
				this.setStyle("--actions-btn-a-bg", "#0a0a0a");
			} else {
				this.setStyle("--body-bg", "#fff");
				this.setStyle("--intro-bg", "#fff");
				this.setStyle("--intro-cl", "#000"); 
				this.setStyle("--chat-wrap-bg", "#fff");
				this.setStyle("--chat-wrap-ch-bg", "linear-gradient(white 30%, rgba(190, 179, 179, 0)), linear-gradient(rgba(255, 255, 255, 0), white 70%) 0 100%, radial-gradient(50% 0, farthest-side, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0)), radial-gradient(50% 100%, farthest-side, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0)) 0 100%");
				this.setStyle("--chat-wrap-ch-bg", "linear-gradient(white 30%, rgba(255, 255, 255, 0)), linear-gradient(rgba(255, 255, 255, 0), white 70%) 0 100%, radial-gradient(farthest-side at 50% 0, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0)), radial-gradient(farthest-side at 50% 100%, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0)) 0 100%");
				this.setStyle("--chat-wrap-ch-bgc", "white");
				this.setStyle("--chat-wrap-ch-cl", "#000");
				this.setStyle("--chat-wrap-cb-bg", "#f6f6f6");
				this.setStyle("--chat-wrap-cb-cl", "#000");
				this.setStyle("--settings-bg", "rgba(255, 255, 255, 0.9)");
				this.setStyle("--settings-cl", "#000");
				this.setStyle("--settings-link-h-bg", "#fff");
				this.setStyle("--settings-link-h-cl", "#000");
				this.setStyle("--actions-bg", "rgba(255, 255, 255, 0.5)");
				this.setStyle("--actions-btn-cl", "#000");
				this.setStyle("--actions-btn-h-bg", "rgba(255, 255, 255, 0.8)");
				this.setStyle("--actions-btn-h-cl", "#000");
				this.setStyle("--actions-btn-a-bg", "#fafafa");
			}
			this.isDark = !this.isDark;
		},
		nameToLocalStorage: function() {
			window.localStorage.name = this.name;
			this.updateUserData("peerName", this.name);
		},
		screenShareToggle: function(e) {
			e.stopPropagation();
			let screenMediaPromise;
			if (!App.screenShareEnabled) {
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
				document.getElementById(this.peerId + "_videoEnabled").style.display = "none";
			}
			screenMediaPromise
				.then((screenStream) => {
					App.screenShareEnabled = !App.screenShareEnabled;

					this.videoEnabled = true;
					this.updateUserData("videoEnabled", this.videoEnabled);

					for (let peer_id in peers) {
						const sender = peers[peer_id].getSenders().find((s) => (s.track ? s.track.kind === "video" : false));
						sender.replaceTrack(screenStream.getVideoTracks()[0]);
					}
					screenStream.getVideoTracks()[0].enabled = true;
					const newStream = new MediaStream([screenStream.getVideoTracks()[0], localMediaStream.getAudioTracks()[0]]);
					localMediaStream = newStream;
					attachMediaStream(document.getElementById("selfVideo"), newStream);
					this.toggleSelfVideoMirror();

					screenStream.getVideoTracks()[0].onended = function() {
						if (App.screenShareEnabled) 
							App.screenShareToggle();
					};
				})
				.catch((e) => {
					alert("Unable to share screen. Please use a supported browser.");
					console.error(e);
				});
		},
		updateUserData: function(key, value) {
			signalingSocket.emit("updateUserData", { channel: App.roomId, key: key, value: value });

			this.sendDataMessage(key, value);

			switch(key) {
				case "audioEnabled":
					document.getElementById(this.peerId + "_audioEnabled").className = "audioEnabled icon-mic" + (value ? "" : "-off");
					break;
				case "videoEnabled":
					document.getElementById(this.peerId + "_videoEnabled").style.display = value ? "none" : "block";
					break;
				case "peerName":
					document.getElementById(this.peerId + "_videoPeerName").innerHTML = value + " (you)";
					break
				// ...
				default:
					break;
			}
		},
		changeCamera: function(deviceId) {
			navigator.mediaDevices
				.getUserMedia({ video: { deviceId: deviceId } })
				.then((camStream) => {
					console.log(camStream);

					this.videoEnabled = true;
					this.updateUserData("videoEnabled", this.videoEnabled);

					for (let peer_id in peers) {
						const sender = peers[peer_id].getSenders().find((s) => (s.track ? s.track.kind === "video" : false));
						sender.replaceTrack(camStream.getVideoTracks()[0]);
					}
					camStream.getVideoTracks()[0].enabled = true;

					const newStream = new MediaStream([camStream.getVideoTracks()[0], localMediaStream.getAudioTracks()[0]]);
					localMediaStream = newStream;
					attachMediaStream(document.getElementById("selfVideo"), newStream);
					this.selectedVideoDeviceId = deviceId;
				})
				.catch((err) => {
					console.log(err);
					alert("Error while swaping camera");
				});
		},
		changeMicrophone: function(deviceId) {
			navigator.mediaDevices
				.getUserMedia({ audio: { deviceId: deviceId } })
				.then((micStream) => {

					this.audioEnabled = true;
					this.updateUserData("audioEnabled", this.audioEnabled);

					for (let peer_id in peers) {
						const sender = peers[peer_id].getSenders().find((s) => (s.track ? s.track.kind === "audio" : false));
						sender.replaceTrack(micStream.getAudioTracks()[0]);
					}
					micStream.getAudioTracks()[0].enabled = true;

					const newStream = new MediaStream([localMediaStream.getVideoTracks()[0], micStream.getAudioTracks()[0]]);
					localMediaStream = newStream;
					attachMediaStream(document.getElementById("selfVideo"), newStream);
					this.selectedAudioDeviceId = deviceId;
				})
				.catch((err) => {
					console.log(err);
					alert("Error while swaping microphone");
				});
		},
		sanitizeString: function(str) {
			const tagsToReplace = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
			const replaceTag = (tag) => tagsToReplace[tag] || tag;
			const safe_tags_replace = (str) => str.replace(/[&<>]/g, replaceTag);
			return safe_tags_replace(str);
		},
		linkify: function(str) {
			return this.sanitizeString(str).replace(/(?:(?:https?|ftp):\/\/)?[\w/\-?=%.]+\.[\w/\-?=%]+/gi, (match) => {
				let displayURL = match
					.trim()
					.replace("https://", "")
					.replace("https://", "");
				displayURL = displayURL.length > 25 ? displayURL.substr(0, 25) + "&hellip;" : displayURL;
				const url = !/^https?:\/\//i.test(match) ? "http://" + match : match;
				return `<a href="${url}" target="_blank" class="link" rel="noopener">${displayURL}</a>`;
			});
		},
		edit: function(e) {
			this.typing = e.srcElement.textContent;
		},
		paste: function(e) {
			e.preventDefault();
			const clipboardData = e.clipboardData || window.clipboardData;
			const pastedText = clipboardData.getData("Text");
			document.execCommand("inserttext", false, pastedText.replace(/(\r\n\t|\n|\r\t)/gm, " "));
		},
		sendChat: function(e) {
			e.stopPropagation();
			e.preventDefault();

			if (!this.typing.length) return;

			if (Object.keys(peers).length > 0) {
				const composeElement = document.getElementById("compose");
				this.sendDataMessage("chat", this.typing);
				this.typing = "";
				composeElement.textContent = "";
				composeElement.blur;
			} else {
				alert('No peers in the room');
			}
		},
		sendDataMessage: function(key, value) {
			const dataMessage = {
				type: key,
				name: this.name,
				id: this.peerId,
				message: value,
				date: new Date().toISOString(),
			}

			switch(key) {
				case "chat":
					this.chats.push(dataMessage);
					break;
				// ...
				default:
					break;
			}

			Object.keys(dataChannels).map((peer_id) => dataChannels[peer_id].send(JSON.stringify(dataMessage)));
		},
		handleIncomingDataChannelMessage: function(dataMessage) {
			// console.log(dataMessage);
			switch (dataMessage.type) {
				case "chat":
					this.showChat = true;
					this.hideToolbar = false;
					this.chats.push(dataMessage);
					break;
				case "audioEnabled":
					document.getElementById(dataMessage.id + "_audioEnabled").className = "audioEnabled icon-mic" + (dataMessage.message ? "" : "-off");
					break;
				case "videoEnabled":
					document.getElementById(dataMessage.id + "_videoEnabled").style.display = dataMessage.message ? "none" : "block";
					break;
				case "peerName":
					document.getElementById(dataMessage.id + "_videoPeerName").innerHTML = dataMessage.message;
					break;
				// ...
				default:
					break;
			}
		},
		formatDate: function(dateString) {
			const date = new Date(dateString);
			const hours = date.getHours() > 12 ? date.getHours() - 12 : date.getHours();
			return (
				(hours < 10 ? "0" + hours : hours) +
				":" +
				(date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes()) +
				" " +
				(date.getHours() >= 12 ? "PM" : "AM")
			);
		},
		setStyle: function (key, value) {
			document.documentElement.style.setProperty(key, value);
		},
		exit: function() {
			window.location.href = "/";
		}
	},
});

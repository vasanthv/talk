const appURL = () => {
	const protocol = "http" + (location.hostname == "localhost" ? "" : "s") + "://";
	return protocol + location.hostname + (location.hostname == "localhost" ? ":3000" : "");
};

const getRoomName = () => {
	let roomName = location.pathname.substring(1);
	if (roomName == "") {
		const randomName = () =>
			Math.random()
				.toString(36)
				.substr(2, 6);
		roomName = randomName();
		const newurl = appURL() + "/" + roomName;
		window.history.pushState({ url: newurl }, roomName, newurl);
	}
	return roomName;
};

const copyURL = () => {
	/* Get the text field */
	var copyText = document.getElementById("roomurl");
	/* Select the text field */
	copyText.select();
	copyText.setSelectionRange(0, 99999); /*For mobile devices*/
	/* Copy the text inside the text field */
	document.execCommand("copy");
	document.getElementById("copybtn").style.color = "#27ae60";
	setTimeout(() => {
		document.getElementById("copybtn").style.color = "#333";
	}, 3000);
};

const attachMediaStream = function(element, stream) {
	element.srcObject = stream;
};

const resizeVideos = () => {
	const numToString = ["", "one", "two", "three", "four", "five", "six"];
	const videos = document.querySelectorAll(".video");
	document.querySelectorAll(".video").forEach((v) => {
		v.className = "video " + numToString[videos.length];
	});
};

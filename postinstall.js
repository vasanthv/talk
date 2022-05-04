const fs = require("fs");
const path = require("path");
if (process.env.NODE_ENV === "production" && process.env.TALK_GA_SCRIPT) {
	const serviceWorkerContents = fs.readFileSync(path.join(__dirname, "www/index.html")).toString();

	const newServiceWorkerContents = serviceWorkerContents.replace(
		"<!-- GOOGLE_ANALYTICS_SCRIPT -->",
		process.env.TALK_GA_SCRIPT
	);

	fs.writeFileSync(path.join(__dirname, "www/index.html"), newServiceWorkerContents);
}

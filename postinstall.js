"use strict";

const fs = require("fs");
const path = require("path");
if (process.env.NODE_ENV === "production" && process.env.GA_TAG_ID) {
	console.log("Inserting GA script tag");
	const serviceWorkerContents = fs.readFileSync(path.join(__dirname, "www/index.html")).toString();

	const newServiceWorkerContents = serviceWorkerContents.replace(
		"<!-- GOOGLE_ANALYTICS_SCRIPT -->",
		`<script async src="https://www.googletagmanager.com/gtag/js?id=${process.env.GA_TAG_ID}"></script><script>window.dataLayer = window.dataLayer || [];function gtag() { dataLayer.push(arguments); } gtag("js", new Date()); gtag("config", "${process.env.GA_TAG_ID}");</script>`
	);

	fs.writeFileSync(path.join(__dirname, "www/index.html"), newServiceWorkerContents);
}

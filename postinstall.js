"use strict";

const fs = require("fs");
const path = require("path");
if (process.env.NODE_ENV === "production" && process.env.ANALYTICS_SCRIPT) {
	console.log("Inserting Analytics script tag");

	const scriptTag = `<script async defer src="${process.env.ANALYTICS_SCRIPT}"></script>`;

	const indexFileContents = fs.readFileSync(path.join(__dirname, "www/index.html")).toString();
	const newIndexFileContents = indexFileContents.replace("<!-- ANALYTICS_SCRIPT -->", scriptTag);
	fs.writeFileSync(path.join(__dirname, "www/index.html"), newIndexFileContents);

	const appFileContents = fs.readFileSync(path.join(__dirname, "www/app.html")).toString();
	const newAppFileContents = appFileContents.replace("<!-- ANALYTICS_SCRIPT -->", scriptTag);
	fs.writeFileSync(path.join(__dirname, "www/app.html"), newAppFileContents);

	const legalFileContents = fs.readFileSync(path.join(__dirname, "www/legal.html")).toString();
	const newLegalFileContents = legalFileContents.replace("<!-- ANALYTICS_SCRIPT -->", scriptTag);
	fs.writeFileSync(path.join(__dirname, "www/legal.html"), newLegalFileContents);
}

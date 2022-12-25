"use strict";

const fs = require("fs");
const path = require("path");
if (process.env.NODE_ENV === "production" && process.env.GA_TAG_ID) {
	console.log("Inserting GA script tag");
	const scriptTag = `<script async src="https://www.googletagmanager.com/gtag/js?id=${process.env.GA_TAG_ID}"></script><script>window.dataLayer = window.dataLayer || [];function gtag() { dataLayer.push(arguments); } gtag("js", new Date()); gtag("config", "${process.env.GA_TAG_ID}");</script>`;

	const indexFileContents = fs.readFileSync(path.join(__dirname, "www/index.html")).toString();
	const newIndexFileContents = indexFileContents.replace("<!-- GOOGLE_ANALYTICS_SCRIPT -->", scriptTag);
	fs.writeFileSync(path.join(__dirname, "www/index.html"), newIndexFileContents);

	const legalFileContents = fs.readFileSync(path.join(__dirname, "www/legal.html")).toString();
	const newLegalFileContents = legalFileContents.replace("<!-- GOOGLE_ANALYTICS_SCRIPT -->", scriptTag);
	fs.writeFileSync(path.join(__dirname, "www/legal.html"), newLegalFileContents);
}

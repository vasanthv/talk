"use strict";

const setDarkTheme = () => {
	setStyle("--body-bg", "#000");
	setStyle("--intro-bg", "#000");
	setStyle("--intro-cl", "#fff"); 
	setStyle("--chat-wrap-bg", "#000");
	setStyle("--chat-wrap-ch-bg", "linear-gradient(black 30%, rgb(90 85 85 / 0%)), linear-gradient(rgb(5 5 5 / 0%), black 70%) 0 100%, radial-gradient(50% 0, farthest-side, rgb(246 243 243 / 20%), rgb(250 249 249 / 0%)), radial-gradient(50% 100%, farthest-side, rgb(250 246 246 / 20%), rgb(251 249 249 / 0%)) 0 100%");
	setStyle("--chat-wrap-ch-bg", "linear-gradient(black 30%, rgb(5 5 5 / 0%)), linear-gradient(rgb(2 2 2 / 0%), black 70%) 0 100%, radial-gradient(farthest-side at 50% 0, rgb(246 241 241 / 20%), rgb(244 240 240 / 0%)), radial-gradient(farthest-side at 50% 100%, rgb(250 249 249 / 20%), rgb(250 248 248 / 0%)) 0 100%");
	setStyle("--chat-wrap-ch-bgc", "black");
	setStyle("--chat-wrap-ch-cl", "#fff");
	setStyle("--chat-wrap-cb-bg", "#060606");
	setStyle("--chat-wrap-cb-cl", "#fff");
	setStyle("--settings-bg", "rgba(0, 0, 0, 0.9)");
	setStyle("--settings-cl", "#fff");
	setStyle("--settings-link-h-bg", "#000");
	setStyle("--settings-link-h-cl", "#fff");
	setStyle("--actions-bg", "rgba(0, 0, 0, 0.5)");
	setStyle("--actions-btn-cl", "#fff");
	setStyle("--actions-btn-h-bg", "rgba(9, 9, 9, 0.8)");
	setStyle("--actions-btn-h-cl", "#fff");
	setStyle("--actions-btn-a-bg", "#0a0a0a");
}

const setDefaultTheme = () => {
	setStyle("--body-bg", "#fff");
	setStyle("--intro-bg", "#fff");
	setStyle("--intro-cl", "#000"); 
	setStyle("--chat-wrap-bg", "#fff");
	setStyle("--chat-wrap-ch-bg", "linear-gradient(white 30%, rgba(190, 179, 179, 0)), linear-gradient(rgba(255, 255, 255, 0), white 70%) 0 100%, radial-gradient(50% 0, farthest-side, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0)), radial-gradient(50% 100%, farthest-side, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0)) 0 100%");
	setStyle("--chat-wrap-ch-bg", "linear-gradient(white 30%, rgba(255, 255, 255, 0)), linear-gradient(rgba(255, 255, 255, 0), white 70%) 0 100%, radial-gradient(farthest-side at 50% 0, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0)), radial-gradient(farthest-side at 50% 100%, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0)) 0 100%");
	setStyle("--chat-wrap-ch-bgc", "white");
	setStyle("--chat-wrap-ch-cl", "#000");
	setStyle("--chat-wrap-cb-bg", "#f6f6f6");
	setStyle("--chat-wrap-cb-cl", "#000");
	setStyle("--settings-bg", "rgba(255, 255, 255, 0.9)");
	setStyle("--settings-cl", "#000");
	setStyle("--settings-link-h-bg", "#fff");
	setStyle("--settings-link-h-cl", "#000");
	setStyle("--actions-bg", "rgba(255, 255, 255, 0.5)");
	setStyle("--actions-btn-cl", "#000");
	setStyle("--actions-btn-h-bg", "rgba(255, 255, 255, 0.8)");
	setStyle("--actions-btn-h-cl", "#000");
	setStyle("--actions-btn-a-bg", "#fafafa");
}

const setStyle = (key, value) => {
	document.documentElement.style.setProperty(key, value);
}

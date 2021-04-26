# Talk

## A free group video call app with screen sharing.

It is built using WebRTC, so all your video, audio & text chat is peer-to-peer. Group video call is achieved using WebRTC mesh. So the quality of the call is inversely proportional to the number of people on the call. The sweet number is somewhere around 6 to 8 people in an average high-speed connection.

### Prerequisites:

- Node.js 8.x or above
- NPM

### How to Build this app locally

Clone the repo locally, or extract the contents of the source code.

```
git clone https://github.com/vasanthv/talk.git
```

`cd talk` and then install dependencies

```
npm install
```

Run the app

```
npm start
```

Open the following url in the browser

```
http://localhost:3000
```

### Docker compose

[NGINX proxy](https://hub.docker.com/r/jwilder/nginx-proxy) container with [its companion](https://github.com/nginx-proxy/docker-letsencrypt-nginx-proxy-companion) to proxy the access to the app and generate a SSL certificate with [Let's Encrypt](https://letsencrypt.org/).

**Note:** its recommended to launch without the companion in local environments.

### Deploy to DigitalOcean App Platform

[![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/toast38coza/talk/tree/master)

### LICENSE

<a href="https://github.com/vasanthv/talk/blob/master/LICENSE">MIT License</a>

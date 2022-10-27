# <p align="center">Talk</p>

<p align="center">A free group video call app with screen sharing.</p>

---

<p align="center">
    <img src="www/img/talk.png">
</p>

---

It is built using WebRTC, so all your video, audio & text chat is peer-to-peer. Group video call is achieved using WebRTC mesh. So the quality of the call is inversely proportional to the number of people on the call. The sweet number is somewhere around 6 to 8 people in an average high-speed connection.

---

### Prerequisites: 

- Node.js 8.x or above
- NPM

### How to Build this app locally

[Fork this repo](https://github.com/vasanthv/talk/fork) and then clone it:

```bash
git clone https://github.com/<your_name>/talk.git
```

`cd talk` and then install dependencies

```bash
npm install
```

Run the app

```bash
npm start
```

to start the talk server on port 3000. Your talk instance will be running on http://localhost:3000. Alternatively you can run the application using docker with `docker-compose up`.

### How to self host it

In order to self-host it on your dedicated server, Talk must be exposed on `https` following [this documentation](./docs/self-hosting.md).

You can also expose it quickly on `https` from your local PC or any host, thanks to [ngrok](https://ngrok.com/) following [this documentation](./docs/ngrok.md).

### LICENSE

<a href="https://github.com/vasanthv/talk/blob/master/LICENSE">MIT License</a>

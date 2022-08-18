# Ngrok

More info about what is `ngrok` you can check [here](https://ngrok.com/).

In order to use it on `Talk` app, you need to do 2 steps:

1. [Sign up for free](https://ngrok.com) and you will receive `YourNgrokAuthToken`.
2. `Set this token` in `env var` before to start the app like:

```bash
NGROK_AUTH_TOKEN="YourNgrokAuthToken" npm start
```

---

Or if you want to run it with `Docker`, set your token in `docker-compose.yml`

```yaml
    environment:
      NGROK_AUTH_TOKEN: "YourNgrokAuthToken"
```

then

```bash
docker-compose up
```

---

If set correctly, in the `Server log console` you should see something like:

```js
> talk@3.0.0 start
> node server.js

Server {
  listen_on: 'http://localhost:3000',
  tunnel_https: 'https://17e3-79-17-23-159.ngrok.io',
  node_version: '16.15.0'
}
```

The `tunnel_https` URL is generated every time you run the app, just open it in the browser and wherever you are from any host you will be reachable in `HTTPS` by anyone from anywhere!

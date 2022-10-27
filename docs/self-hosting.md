# Talk - Self Hosting

## Requirments

- Recommended: [Hetzner](https://www.hetzner.com/cloud) (`CPX11` it's enough, OS: `Ubuntu 20.04`) you can use [this link](https://hetzner.cloud/?ref=XdRifCzCK3bn) to receive `€⁠20 in cloud credits`.
- Mandatory: [Node.js](https://nodejs.org/en/) at least 12x, better `16.15.1 LTS` & npm
- Optional: Setup your own TURN server like [coturn](https://github.com/coturn/coturn) and change it on `ICE_SERVERS`
- Mandatory: Your domain name, example: `your.domain.name`
  - Set a DNS A record for that domain that point to Your Server public IPv4

---

Install the requirements (Note: Many of the installation steps require `root` or `sudo` access)

```bash
# Install NodeJS 16.X and npm
$ sudo apt update
$ sudo apt -y install curl dirmngr apt-transport-https lsb-release ca-certificates
$ curl -sL https://deb.nodesource.com/setup_16.x | sudo -E bash -
$ sudo apt-get install -y nodejs
$ npm install -g npm@latest
```

---

## Quick start

```bash
# Clone Talk repo
$ git clone https://github.com/vasanthv/talk.git
# Go to Talk dir
$ cd talk
# Install dependencies
$ npm install
# Start the server
$ npm start
```

Check if is correctly installed: https://your.domain.name:3000

---

## PM2

Using [PM2](https://pm2.keymetrics.io) to run it as daemon

```bash
# Install pm2
$ npm install -g pm2
# Start the server
$ pm2 start server.js
# Takes a snapshot 
$ pm2 save
# Add it on startup
$ pm2 startup
```

---

## Docker

If you want to use `Docker`

```bash
# Install docker and docker-compose
$ sudo apt install docker.io
$ sudo apt install docker-compose

# Build or rebuild services
$ docker-compose build
# Create and start containers
$ docker-compose up -d
```

Check if is correctly installed: https://your.domain.name:3000

---

## Nginx & Certbot

In order to use it without the port number at the end, and to have encrypted communications (`mandatory to make it work correctly`), we going to install [nginx](https://www.nginx.com) and [certbot](https://certbot.eff.org)

```bash
# Install Nginx
$ sudo apt-get install nginx

# Install Certbot (SSL certificates)
$ sudo apt install snapd
$ sudo snap install core; sudo snap refresh core
$ sudo snap install --classic certbot
$ sudo ln -s /snap/bin/certbot /usr/bin/certbot

# Setup Nginx sites
$ sudo vim /etc/nginx/sites-enabled/default
```

Paste this:

```bash
# HTTP — redirect all traffic to HTTPS
server {
    if ($host = your.domain.name) {
        return 301 https://$host$request_uri;
    }
        listen 80;
        listen [::]:80  ;
    server_name your.domain.name;
    return 404;
}
```

```bash
# Check if all configured correctly
$ sudo nginx -t

# Active https for your domain name (follow the instruction)
$ sudo certbot certonly --nginx

# Add let's encrypt part on nginx config
$ sudo vim /etc/nginx/sites-enabled/default
```

Paste this:

```bash
# Talk - HTTPS — proxy all requests to the Node app
server {
	# Enable HTTP/2
	listen 443 ssl http2;
	listen [::]:443 ssl http2;
	server_name your.domain.name;

	# Use the Let’s Encrypt certificates
	ssl_certificate /etc/letsencrypt/live/your.domain.name/fullchain.pem;
	ssl_certificate_key /etc/letsencrypt/live/your.domain.name/privkey.pem;

	location / {
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header Host $host;
		proxy_pass http://localhost:3000/;
		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection "upgrade";
	}
}
```

```bash
# Check if all configured correctly
$ sudo nginx -t

# Restart nginx
$ service nginx restart
$ service nginx status

# Auto renew SSL certificate
$ sudo certbot renew --dry-run

# Show certificates
$ sudo certbot certificates
```

Check Your Talk instance: https://your.domain.name

---

## Update script

In order to have Your Talk instance always updated to latest, we going to create a script

```bash
$ cd
# Create a file talkUpdate.sh
$ vim talkUpdate.sh
```

---

If you use `PM2`, paste this:

```bash
#!/bin/bash

cd talk
git pull
pm2 stop server.js
sudo npm install
pm2 start server.js
```

---

If you use `Docker`, paste this:

```bash
#!/bin/bash

cd talk
git pull
docker-compose down
docker-compose build
docker images |grep '<none>' |awk '{print $3}' |xargs docker rmi
docker-compose up -d
```

---

Make the script executable

```bash
$ chmod +x talkUpdate.sh
```

Follow the commits of the Talk project [here](https://github.com/vasanthv/talk/commits/master)

To update Your Talk instance at latest commit, execute:

```bash
./talkUpdate.sh
```

---

<br />

# Talk - Ngrok

If you want to self host it quickly, without all this settings, just follow [this documentation](./ngrok.md)

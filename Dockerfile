FROM node:latest
WORKDIR /usr/src/app
COPY package.json .
COPY postinstall.js .
RUN npm install
COPY . .
EXPOSE 3000
CMD [ "npm", "start" ]

#FROM node:latest
FROM node:lts-alpine

WORKDIR /usr/src/app

COPY . .

RUN npm install && \
    npm cache clean --force && \
    rm -rf /tmp/* /var/lib/apt/lists/* /var/tmp/* /usr/share/doc/*

EXPOSE 3000

CMD [ "npm", "start" ]

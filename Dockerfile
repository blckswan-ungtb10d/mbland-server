FROM node:8.8.1-alpine
MAINTAINER Mike Bland "mbland@acm.org"

RUN apk update && \
    apk upgrade && \
    apk add ruby ruby-bundler libffi && \
    apk add --no-cache --virtual .build-deps build-base ruby-dev libffi-dev && \
    echo "gem: --no-ri --no-rdoc" > /etc/gemrc && \
    gem install bundler colorator jekyll && \
    apk del .build-deps

WORKDIR /opt/pages-server
COPY package.json package-lock.json ./
RUN npm install --production
COPY . ./

EXPOSE 5000
CMD [ "/opt/pages-server/bin/pages-server", "/etc/pages-server.conf" ]

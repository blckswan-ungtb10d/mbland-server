FROM node:8.8.1-alpine
MAINTAINER Mike Bland "mbland@acm.org"

RUN apk update && \
    apk upgrade && \
    apk add \
      build-base \
      ca-certificates \
      git \
      libffi-dev \
      openssh \
      rsync \
      ruby \
      ruby-bundler \
      ruby-dev \
      ruby-json \
      && \
    echo "gem: --no-ri --no-rdoc"

WORKDIR /opt/pages-server
COPY package.json package-lock.json ./
RUN npm install --production
COPY . ./

EXPOSE 5000
ENV BUNDLE_SILENCE_ROOT_WARNING=true
CMD [ "/opt/pages-server/bin/pages-server", "/etc/pages-server.conf" ]

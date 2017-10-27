FROM node:8.8.1-slim
MAINTAINER Mike Bland "mbland@acm.org"

ENV RBENV_ROOT /opt/rbenv
RUN apt update && apt install -y \
    bash \
    build-essential \
    curl \
    git \
    jq \
    libreadline-dev \
    libssl-dev \
    libyaml-dev \
    python \
    python-dev \
    python-pip \
    rsync \
    wget \
    zlib1g-dev && \
  pip install awscli --upgrade && \
  git clone https://github.com/rbenv/rbenv.git "$RBENV_ROOT" && \
  echo 'export PATH="$RBENV_ROOT/bin:$PATH"' >>"/etc/profile.d/rbenv.sh" && \
  echo 'eval "$(rbenv init -)"' >>"/etc/profile.d/rbenv.sh" && \
  git clone https://github.com/rbenv/ruby-build.git \
    "$RBENV_ROOT/plugins/ruby-build" && \
  "$RBENV_ROOT/bin/rbenv" install 2.4.2 && \
  echo "gem: --no-ri --no-rdoc" > /etc/gemrc && \
  . "/etc/profile.d/rbenv.sh" && \
  rbenv global 2.4.2 && \
  gem install bundler colorator jekyll

WORKDIR /opt/pages-server
COPY package.json package-lock.json ./
RUN npm install --production
COPY . ./

EXPOSE 5000
ENV PATH "$RBENV_ROOT/shims:$RBENV_ROOT/bin:$PATH"
CMD [ "/opt/pages-server/bin/pages-server", "/etc/pages-server.conf" ]

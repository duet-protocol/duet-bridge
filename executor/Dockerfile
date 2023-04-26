FROM node:18-alpine3.16

RUN apk update
RUN apk add curl wget git openssh

RUN corepack enable
RUN corepack prepare pnpm@latest --activate
ENV PNPM_HOME=/usr/local/bin

RUN mkdir -p /opt/executor/
WORKDIR /opt/executor/

RUN wget https://github.com/celer-network/sgn-v2-networks/raw/main/binaries/executor-v1.1.6-linux-amd64.tar.gz
RUN tar -xvf executor-v1.1.6-linux-amd64.tar.gz
RUN rm executor-v1.1.6-linux-amd64.tar.gz

COPY ./ ./
RUN pnpm install --production

ENTRYPOINT ["node", "./entrypoint.js"]

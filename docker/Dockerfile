FROM alpine:3.15 AS downloader
ARG GITHUB_REPO
ARG RELEASE_TAG

# Install required tools
RUN apk add --no-cache curl unzip

# Download and extract
RUN --mount=type=secret,id=GITHUB_AUTH \
    set -eux; \
    auth="$(cat /run/secrets/GITHUB_AUTH)"; \
    curl -o src.zip -fL \
            -H "X-GitHub-Api-Version: 2022-11-28" \
            -H "Accept: application/vnd.github+json" \
            #-H "Authorization: Bearer $auth" \
            "${GITHUB_REPO}/zipball/${RELEASE_TAG}"; \
    \
    unzip src.zip -d /tmp && \
    mv /tmp/alexbanica-* /tmp/src && \
    rm src.zip

FROM node:BASE_BUILD_IMAGE_VERSION AS builder
WORKDIR /app
COPY --from=downloader /tmp/src ./

RUN npm ci --omit=dev
RUN npm run build

FROM node:BASE_IMAGE_VERSION AS runtime

WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/config/app.yml ./config/app.yml
COPY --from=builder /app/config/services.yml ./config/services.yml
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

ENV NODE_ENV=production

CMD ["npm", "start"]

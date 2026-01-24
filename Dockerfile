# Morning Dashboard
# Runs the productivity dashboard GUI on port 3141

FROM node:20-alpine

# Install dependencies
RUN apk add --no-cache curl bash git ca-certificates

# Install GitHub CLI
RUN apk add --no-cache github-cli

# Install gog CLI (for Gmail/Calendar)
ARG TARGETARCH
RUN GOG_VERSION="0.9.0" && \
    ARCH=$([ "$TARGETARCH" = "arm64" ] && echo "arm64" || echo "amd64") && \
    curl -fsSL "https://github.com/steipete/gogcli/releases/download/v${GOG_VERSION}/gogcli_${GOG_VERSION}_linux_${ARCH}.tar.gz" \
    | tar -xz -C /usr/local/bin gog && \
    chmod +x /usr/local/bin/gog

WORKDIR /app

# Copy application
COPY package.json ./
COPY dashboard.js ./

# No npm install needed (pure Node.js)

# Config directories will be mounted at runtime:
# - ~/.config/morning-dashboard -> /root/.config/morning-dashboard
# - ~/.config/gog -> /root/.config/gog
# - ~/.config/gh -> /root/.config/gh

# Expose GUI port
EXPOSE 3141

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3141/ || exit 1

# Run GUI mode
CMD ["node", "dashboard.js", "gui"]

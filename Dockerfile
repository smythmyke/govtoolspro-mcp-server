# Dockerfile for Glama (and any other MCP-server CI) automated checks.
#
# This is NOT how end users run the server — they install via
# `npx -y govtoolspro-mcp-server` in their MCP client config. This image
# exists solely so Glama / other validators can:
#   1. Verify the binary builds and starts
#   2. Exercise the MCP `initialize` and `tools/list` handshake
#   3. Confirm there are no malicious behaviors
#
# The placeholder GOVTOOLSPRO_API_KEY below is enough for the server to
# start and respond to protocol-level requests. Any actual tool call requires
# a real key minted from the GovToolsPro Chrome extension's Admin tab.

FROM node:20-alpine

LABEL org.opencontainers.image.source="https://github.com/smythmyke/govtoolspro-mcp-server"
LABEL org.opencontainers.image.description="GovToolsPro MCP server — go/no-go scoring, incumbent intelligence, teaming-partner search, recompete prediction, Navy NECO lookup, and SAM.gov solicitation retrieval for federal contractors"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

# Install the published npm package globally so the `govtoolspro-mcp-server`
# binary is on PATH.
RUN npm install -g govtoolspro-mcp-server@latest

# Placeholder so the server starts. Real API keys come from users; this
# value never reaches the GovToolsPro backend (it'd fail auth there anyway).
ENV GOVTOOLSPRO_API_KEY=placeholder-for-ci-validation

# The MCP server speaks JSON-RPC over stdio.
ENTRYPOINT ["govtoolspro-mcp-server"]

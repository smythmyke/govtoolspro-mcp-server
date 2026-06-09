# Hardened, multi-stage build for the GovToolsPro MCP server.
#
# This image builds the server FROM SOURCE (not `npm i -g <published pkg>`) so the
# contents are verifiable against this repo, and runs on a distroless, non-root
# runtime with no shell or package manager — minimizing attack surface for the
# ToolHive / federal-CUI audience. Base images are pinned by digest.
#
# End users normally install via `npx -y govtoolspro-mcp-server`; this image is
# for ToolHive (and other OCI-based MCP runtimes) and for CI validators (Glama),
# which build it and exercise the MCP `initialize` + `tools/list` handshake.
#
# Real tool calls require a GOVTOOLSPRO_API_KEY minted from the GovToolsPro
# Chrome extension → Profile → API Keys tab, supplied at runtime by the user.

# ---- Stage 1: build ----------------------------------------------------------
# node:22-alpine pinned by digest
FROM node:22-alpine@sha256:968df39aedcea65eeb078fb336ed7191baf48f972b4479711397108be0966920 AS builder

WORKDIR /app

# Install all deps (incl. devDeps for the TypeScript build) from the lockfile.
COPY package.json package-lock.json ./
RUN npm ci

# Compile dist/ from source.
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Reduce node_modules to production-only for the runtime stage.
RUN npm prune --omit=dev

# ---- Stage 2: runtime --------------------------------------------------------
# gcr.io/distroless/nodejs22-debian12:nonroot pinned by digest.
# Distroless ships node only — no shell, no package manager — and the :nonroot
# variant runs as an unprivileged user (uid 65532) by default.
FROM gcr.io/distroless/nodejs22-debian12@sha256:13593b7570658e8477de39e2f4a1dd25db2f836d68a0ba771251572d23bb4f8e

LABEL org.opencontainers.image.source="https://github.com/smythmyke/govtoolspro-mcp-server"
LABEL org.opencontainers.image.description="GovToolsPro MCP server — go/no-go scoring, incumbent intelligence, teaming-partner search, recompete prediction, market & award-pattern analytics, labor-rate lookup, Navy NECO lookup, and SAM.gov solicitation retrieval for federal contractors"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

# Copy only the build output and production dependencies.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Placeholder so build/CI validators can complete the protocol handshake. The
# server uses lazy config and starts without a real key; any actual tool call
# requires the user's GOVTOOLSPRO_API_KEY (supplied at runtime) and would fail
# auth at the backend otherwise. ToolHive injects the real value per the
# registry entry's env_vars.
ENV GOVTOOLSPRO_API_KEY=placeholder-for-ci-validation

# The distroless nodejs entrypoint is `node`; pass the server entry as its arg.
# The MCP server speaks JSON-RPC over stdio.
CMD ["dist/index.js"]

#!/usr/bin/env python3
"""Inject inputSchema into a packed .mcpb's manifest.json.

`mcpb pack` rejects `inputSchema` on tools, so manifest.json ships lean
(name + description only). Smithery, however, REQUIRES inputSchema on every
tool. This rewrites the bundle's manifest.json `tools` array with the rich
version from manifest-rich-tools.json (name + description + inputSchema).

Usage:
    python scripts/patch-mcpb.py [bundle.mcpb] [manifest-rich-tools.json]

Defaults: ./govtoolspro-mcp-server.mcpb  +  ./manifest-rich-tools.json
"""
import json
import os
import shutil
import sys
import zipfile

bundle = sys.argv[1] if len(sys.argv) > 1 else "govtoolspro-mcp-server.mcpb"
rich_path = sys.argv[2] if len(sys.argv) > 2 else "manifest-rich-tools.json"

if not os.path.exists(bundle):
    sys.exit(f"bundle not found: {bundle}")
if not os.path.exists(rich_path):
    sys.exit(f"rich tools file not found: {rich_path}")

with open(rich_path, encoding="utf-8") as f:
    rich = json.load(f)

patched = False
tmp = bundle + ".tmp"
with zipfile.ZipFile(bundle, "r") as zin:
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == "manifest.json":
                m = json.loads(data)
                m["tools"] = rich
                data = json.dumps(m, indent=2, ensure_ascii=False).encode("utf-8")
                patched = True
            zout.writestr(item, data)

if not patched:
    os.remove(tmp)
    sys.exit("manifest.json not found inside the bundle — nothing patched")

shutil.move(tmp, bundle)
print(f"[ok] Patched {bundle}: injected inputSchema for {len(rich)} tools")

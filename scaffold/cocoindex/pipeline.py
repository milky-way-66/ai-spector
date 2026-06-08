"""
ai-spector CocoIndex — CLI entry point.

  python pipeline.py mcp              Run as MCP server (stdio)
  python pipeline.py update           Build / refresh the semantic index
  python pipeline.py search --query X Semantic search (used by ai-spector Node CLI)
"""

import json
import os
import sys

import cocoindex

from flow import search


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""

    if cmd == "mcp":
        from server import mcp
        mcp.run(transport="stdio")

    elif cmd == "search":
        import argparse
        parser = argparse.ArgumentParser(prog="pipeline.py search")
        parser.add_argument("--query", required=True)
        parser.add_argument("--limit", type=int, default=5)
        parser.add_argument(
            "--threshold",
            type=float,
            default=float(os.getenv("COCOINDEX_SIMILARITY_THRESHOLD", "0.75")),
        )
        args = parser.parse_args(sys.argv[2:])
        print(json.dumps(search(args.query, args.limit, args.threshold)))

    elif cmd == "update":
        cocoindex.cli.cli(["update", "--app", "flow.py"], standalone_mode=True)

    else:
        cocoindex.cli.cli(standalone_mode=True)

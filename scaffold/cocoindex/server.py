"""MCP server for ai-spector CocoIndex — exposes docs_search and docs_update."""

import cocoindex
from mcp.server.fastmcp import FastMCP

from flow import search

mcp = FastMCP("ai-spector-cocoindex")


@mcp.tool()
def docs_search(query: str, limit: int = 5, threshold: float = 0.75) -> list[dict]:
    """
    Semantic search over project docs by meaning, not keywords.
    Use when the user asks about a concept, feature, or topic.
    Returns: [{docPath, heading, excerpt, score}]
    """
    return search(query, limit, threshold)


@mcp.tool()
def docs_update() -> str:
    """
    Rebuild the semantic index from project docs.
    Call after adding or changing doc files before searching.
    """
    cocoindex.cli.cli(["update", "--app", "flow.py"], standalone_mode=False)
    return "Index updated."


if __name__ == "__main__":
    mcp.run(transport="stdio")

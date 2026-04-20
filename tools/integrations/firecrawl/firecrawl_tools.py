import os
import httpx
from typing import Annotated, Any
from motus.tools import tool
from firecrawl import AsyncFirecrawlApp

from core.config.env import load_project_env


load_project_env()

FIRECRAWL_KEY = os.getenv("FIRECRAWL_KEY")
firecrawl_app = AsyncFirecrawlApp(api_key=FIRECRAWL_KEY) if FIRECRAWL_KEY else None
FIRECRAWL_INTERACT_TIMEOUT_SECONDS = 600.0


def _require_firecrawl() -> AsyncFirecrawlApp:
    if firecrawl_app is None or not FIRECRAWL_KEY:
        raise RuntimeError("FIRECRAWL_KEY 未配置，当前无法使用网页工具。")
    return firecrawl_app

@tool(name="web_search", description="Search the web using Firecrawl and return the results.")
async def web_search(
    query: Annotated[str, "The search query"],
) -> dict:
    return await _require_firecrawl().search(query=query)

@tool(name="web_scrape", description="Scrape a webpage. Allows 'actions' for interactions like click, wait, or scroll via params.")
async def web_scrape(
    url: Annotated[str, "The URL to scrape"],
    params: Annotated[dict[str, Any] | None, "Optional parameters. Can include 'actions': [{'type': 'click', 'selector': '#btn'}]"] = None,
) -> dict:
    if params is None:
        params = {}
    return await _require_firecrawl().scrape_url(url=url, params=params)

@tool(name="web_interact", description="Interact with a page after scraping it. Used heavily when scraping returns an interactive session.")
async def web_interact(
    scrape_id: Annotated[str, "The scrape_id of a previously scraped session."],
    prompt: Annotated[str | None, "Natural language prompt to interact (e.g., 'Click next')."] = None,
    code: Annotated[str | None, "Code snippet to run on the page"] = None,
    language: Annotated[str | None, "Language ('python', 'bash', 'node')"] = None,
) -> dict:
    if not FIRECRAWL_KEY:
        raise RuntimeError("FIRECRAWL_KEY 未配置，当前无法使用网页工具。")
    url = f"https://api.firecrawl.dev/v2/scrape/{scrape_id}/interact"
    headers = {
        "Authorization": f"Bearer {FIRECRAWL_KEY}",
        "Content-Type": "application/json"
    }
    payload = {}
    if prompt: payload["prompt"] = prompt
    if code: payload["code"] = code
    if language: payload["language"] = language

    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            headers=headers,
            json=payload,
            timeout=FIRECRAWL_INTERACT_TIMEOUT_SECONDS,
        )
        return response.json()

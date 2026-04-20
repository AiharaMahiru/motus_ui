# Firecrawl Tools

> Note:
> This file is an implementation/reference document for maintainers.
> Runtime skill loading should use `skills/web_research/` instead of this file.

This package provides web interaction capabilities powered by the Firecrawl API.

## Tools Available

1. `web_search(query: str) -> dict`: Use this to perform broad web searches. It leverages `firecrawl_app.search()`.
2. `web_scrape(url: str, params: dict) -> dict`: Use this to scrape a specific URL. To act on elements, you can provide `actions` inside the `params` dictionary.
3. `web_interact(scrape_id: str, prompt: str, code: str, language: str) -> dict`: Use this to interact with a page *after* a previous scrape session. Useful for stateful browser sessions.

## Code Patterns

* These tools are built using the async `motus.tools @tool` decorator approach.
* Inputs are strongly typed using `typing.Annotated`.

## Configuration

Requires the `FIRECRAWL_KEY` environment variable. The project reads this from the root `.env`.

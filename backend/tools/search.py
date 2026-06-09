from duckduckgo_search import DDGS

def web_search(query: str, max_results: int = 5) -> str:
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
        if not results:
            return "No search results found."
        
        formatted = []
        for i, r in enumerate(results, 1):
            formatted.append(
                f"[{i}] Title: {r.get('title', '')}\n"
                f"    URL: {r.get('href', '')}\n"
                f"    Snippet: {r.get('body', '')[:250]}..."
            )
        return "\n\n".join(formatted)
    except Exception as e:
        return f"Error during web search: {str(e)}"

import re
import requests
import html as html_lib
from html.parser import HTMLParser
from duckduckgo_search import DDGS

class StartpageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.results = []
        self.current_result = None
        self.in_title = False
        self.in_description = False
        self.in_style = False
        self.temp_title = []
        self.temp_description = []

    def handle_starttag(self, tag, attrs):
        if tag == "style":
            self.in_style = True
            return
            
        attrs_dict = dict(attrs)
        classes = attrs_dict.get("class", "").split()
        
        if tag == "div" and "result" in classes:
            self._save_current()
            self.current_result = {"url": "", "title": "", "snippet": ""}
            self.temp_title = []
            self.temp_description = []
            
        if self.current_result is not None:
            if tag == "a" and "result-link" in classes:
                self.in_title = True
                self.current_result["url"] = attrs_dict.get("href", "")
            elif tag == "p" and "description" in classes:
                self.in_description = True

    def handle_endtag(self, tag):
        if tag == "style":
            self.in_style = False
            return
            
        if self.current_result is not None:
            if tag == "a" and self.in_title:
                self.in_title = False
            elif tag == "p" and self.in_description:
                self.in_description = False

    def handle_data(self, data):
        if self.in_style:
            return
            
        if self.current_result is not None:
            if self.in_title:
                self.temp_title.append(data)
            elif self.in_description:
                self.temp_description.append(data)

    def _save_current(self):
        if self.current_result:
            self.current_result["title"] = "".join(self.temp_title).strip()
            self.current_result["snippet"] = "".join(self.temp_description).strip()
            if self.current_result["url"] and self.current_result["title"]:
                self.results.append(self.current_result)
            self.current_result = None

    def close(self):
        self._save_current()
        super().close()

def _format_results(results, is_ddg=True) -> str:
    formatted = []
    for i, r in enumerate(results, 1):
        if is_ddg:
            title = r.get('title', '')
            url = r.get('href', '')
            snippet = r.get('body', '')
        else:
            title = r.get('title', '')
            url = r.get('url', '')
            snippet = r.get('snippet', '')
        
        snippet_str = f"Snippet: {snippet[:250]}..." if snippet else "Snippet: N/A"
        formatted.append(
            f"[{i}] Title: {title}\n"
            f"    URL: {url}\n"
            f"    {snippet_str}"
        )
    return "\n\n".join(formatted)

def web_search(query: str, max_results: int = 5) -> str:
    # 1. Try DuckDuckGo first
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
        if results:
            return _format_results(results, is_ddg=True)
    except Exception as e:
        print(f"DuckDuckGo search error (falling back to Startpage): {e}")

    # 2. Fallback to Startpage (Google results proxy)
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        response = requests.get(
            "https://www.startpage.com/sp/search",
            params={"query": query},
            headers=headers,
            timeout=10
        )
        if response.status_code == 200:
            parser = StartpageParser()
            parser.feed(response.text)
            parser.close()
            if parser.results:
                results = parser.results[:max_results]
                return _format_results(results, is_ddg=False)
            print(f"Startpage parsed 0 results (html length: {len(response.text)})")
        else:
            print(f"Startpage search returned HTTP {response.status_code}")
    except Exception as se:
        print(f"Startpage search error (falling back to Wikipedia): {se}")

    # 3. Fallback to Wikipedia API
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        response = requests.get(
            "https://en.wikipedia.org/w/api.php",
            params={
                "action": "query",
                "list": "search",
                "srsearch": query,
                "format": "json",
                "utf8": ""
            },
            headers=headers,
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            wiki_results = data.get("query", {}).get("search", [])
            if wiki_results:
                results = []
                for r in wiki_results[:max_results]:
                    snippet_clean = re.sub(r'<[^>]+>', '', r.get("snippet", ""))
                    snippet_clean = html_lib.unescape(snippet_clean).strip()
                    results.append({
                        "title": r.get("title", ""),
                        "url": f"https://en.wikipedia.org/wiki/{r.get('title', '').replace(' ', '_')}",
                        "snippet": snippet_clean
                    })
                return _format_results(results, is_ddg=False)
        return f"No search results found. (DuckDuckGo, Startpage, and Wikipedia returned no results)"
    except Exception as we:
        return f"Error during web search (DuckDuckGo, Startpage, and Wikipedia fallbacks all failed): {str(we)}"


import sys
from playwright.sync_api import sync_playwright

def fetch(url):
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--disable-blink-features=AutomationControlled"]
            )
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 800}
            )
            page = context.new_page()
            response = page.goto(url, timeout=30000, wait_until="networkidle")
            
            status = response.status
            html = page.content()
            
            browser.close()
            
            # Output status code and HTML content separated by newline
            sys.stdout.buffer.write(f"{status}\n".encode('utf-8'))
            sys.stdout.buffer.write(html.encode('utf-8'))
    except Exception as e:
        sys.stderr.write(f"Fetch error: {str(e)}\n")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.stderr.write("Usage: python fetch_page.py <url>\n")
        sys.exit(1)
    fetch(sys.argv[1])

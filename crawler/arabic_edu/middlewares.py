import sys
import os
import subprocess
import scrapy
from scrapy.http import HtmlResponse

class PlaywrightMiddleware:
    def process_request(self, request, spider):
        if not request.meta.get('playwright'):
            return None # Pass to default Scrapy downloader (e.g. for PDFs)
            
        spider.logger.info(f"Subprocess Playwright fetching: {request.url}")
        try:
            # Use same Python interpreter as the virtualenv Scrapy is running in
            python_exe = sys.executable
            
            # Locate fetch_page.py in the same directory
            current_dir = os.path.dirname(os.path.abspath(__file__))
            script_path = os.path.join(current_dir, "fetch_page.py")
            
            # Execute the fetch script
            result = subprocess.run(
                [python_exe, script_path, request.url],
                capture_output=True,
                timeout=45
            )
            
            if result.returncode != 0:
                error_msg = result.stderr.decode('utf-8', errors='ignore')
                spider.logger.error(f"Playwright subprocess error: {error_msg}")
                return HtmlResponse(
                    url=request.url,
                    status=500,
                    body=f"Playwright subprocess error: {error_msg}".encode('utf-8'),
                    request=request
                )
                
            output = result.stdout
            newline_idx = output.find(b'\n')
            if newline_idx == -1:
                return HtmlResponse(
                    url=request.url,
                    status=500,
                    body=b"Invalid output from Playwright subprocess",
                    request=request
                )
                
            status_code = int(output[:newline_idx].strip())
            html_bytes = output[newline_idx+1:]
            
            return HtmlResponse(
                url=request.url,
                status=status_code,
                headers=request.headers,
                body=html_bytes,
                encoding='utf-8',
                request=request
            )
        except Exception as e:
            spider.logger.error(f"Playwright middleware error: {str(e)}")
            return HtmlResponse(
                url=request.url,
                status=500,
                body=f"Playwright middleware error: {str(e)}".encode('utf-8'),
                request=request
            )

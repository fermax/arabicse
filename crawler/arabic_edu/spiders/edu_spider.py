import scrapy
from datetime import datetime
from arabic_edu.items import DocumentItem
import re
import requests
from scrapy import signals
from scrapy.exceptions import DontCloseSpider
from arabic_edu.classifier import EducationalClassifier

class EduSpider(scrapy.Spider):
    name = "edu_spider"

    @classmethod
    def from_crawler(cls, crawler, *args, **kwargs):
        spider = super(EduSpider, cls).from_crawler(crawler, *args, **kwargs)
        crawler.signals.connect(spider.spider_idle, signal=signals.spider_idle)
        return spider

    def spider_idle(self):
        if hasattr(self, 'crawler') and self.crawler.engine.paused:
            self.logger.info("الزاحف في حالة توقف مؤقت، منع إغلاق العنكبوت...")
            raise DontCloseSpider("Spider is paused, preventing close.")

    def start_requests(self):
        urls = []
        try:
            # Request active sources from the backend API
            response = requests.get("http://localhost:8080/api/sources/active", timeout=10)
            if response.status_code == 200:
                sources = response.json()
                urls = [source['url'] for source in sources if source.get('url')]
                self.logger.info(f"Fetched start URLs from backend: {urls}")
        except Exception as e:
            self.logger.error(f"Error fetching seed URLs from API: {e}")
            
        # Fallback if no URLs fetched
        if not urls:
            self.logger.warning("No active seed URLs found from API. Using default fallbacks.")
            urls = [
                "https://eddirasa.com/"
            ]
            
        for url in urls:
            is_youtube = "youtube.com" in url or "youtu.be" in url
            if is_youtube:
                if "feeds/videos.xml" in url or "channel_id=" in url:
                    yield scrapy.Request(
                        url=url,
                        callback=self.parse_youtube_feed,
                        meta={'start_url': url, 'playwright': False}
                    )
                else:
                    yield scrapy.Request(
                        url=url,
                        callback=self.parse_youtube_channel,
                        meta={'start_url': url, 'playwright': False}
                    )
            else:
                yield scrapy.Request(
                    url=url, 
                    callback=self.parse, 
                    meta={
                        'start_url': url,
                        'playwright': True
                    }
                )

    def parse(self, response):
        start_url = response.meta.get('start_url', response.url)
        current_domain_match = re.search(r'https?://([^/]+)', start_url)
        current_domain = current_domain_match.group(1) if current_domain_match else ""
        
        # Extract links
        links = response.css('a::attr(href)').getall()
        
        for link in links:
            absolute_url = response.urljoin(link)
            domain_match = re.search(r'https?://([^/]+)', absolute_url)
            
            if domain_match:
                link_domain = domain_match.group(1)
                # Ensure we stay on the same domain as the start URL
                if current_domain and link_domain == current_domain:
                    # Filter relevant URLs
                    if any(x in absolute_url.lower() for x in ['lesson', 'exam', 'class', 'subject', 'arabic', 'ar', 'pdf', 'html', 'php', 'darasa', 'dirasa', 'education', '3as', '2as', '1as', 'bac']):
                        is_pdf = absolute_url.lower().endswith('.pdf')
                        yield response.follow(
                            absolute_url, 
                            self.parse_document, 
                            meta={
                                'start_url': start_url,
                                'playwright': not is_pdf
                            }
                        )

    crawled_count = 0
    pause_limit = 500
    pause_duration = 60 # Duration in seconds

    def resume_crawler(self):
        self.logger.info("جاري استئناف عمل الزاحف بعد انتهاء فترة التوقف المؤقت...")
        self.crawler.engine.unpause()

    def parse_document(self, response):
        item = DocumentItem()
        item['url'] = response.url
        
        # Extract title
        title = response.css('h1::text').get()
        if not title:
            title = response.css('title::text').get()
        item['title'] = title.strip() if title else 'بدون عنوان'
        
        # Extract content (paragraphs / PDF text)
        if response.url.lower().endswith('.pdf') or b'application/pdf' in response.headers.get('Content-Type', b''):
            import io
            import pypdf
            try:
                pdf_file = io.BytesIO(response.body)
                reader = pypdf.PdfReader(pdf_file)
                text_list = []
                for page_num in range(min(len(reader.pages), 15)):
                    page = reader.pages[page_num]
                    text = page.extract_text()
                    if text:
                        text_list.append(text)
                content = " ".join(text_list)
            except Exception as e:
                self.logger.error(f"Error parsing PDF content for {response.url}: {e}")
                content = ""
        else:
            paragraphs = response.css('p::text').getall()
            content = ' '.join([p.strip() for p in paragraphs if p.strip()])
        
        # Basic Arabic text cleaning
        content = re.sub(r'\s+', ' ', content)
        item['content'] = content
        
        # 1. AI Classification of Subject
        subject = EducationalClassifier.classify_subject(item['title'], content, response.url)
        item['subject'] = subject
        
        # 2. AI Classification of Level
        level = EducationalClassifier.classify_level(item['title'], content, response.url)
        
        item['metadata'] = {
            'level': level,
            'subject': subject
        }
        item['crawled_at'] = datetime.utcnow().isoformat()
        
        # Determine general type
        url_lower = response.url.lower()
        title_lower = item['title'].lower()
        
        doc_type = 'lesson'
        if any(x in url_lower or x in title_lower for x in ['exam', 'test', 'موضوع', 'امتحان', 'فرض', 'بكالوريا', 'bac']):
            doc_type = 'exam'
        elif any(x in url_lower or x in title_lower for x in ['book', 'كتاب']):
            doc_type = 'book'
        item['type'] = doc_type
        
        # 3. AI Classification of Branch
        branch = EducationalClassifier.classify_branch(item['title'], content, response.url, subject)
        item['branch'] = branch

        # 4. File Type Classification
        file_type = None
        if "youtube.com" in url_lower or "youtu.be" in url_lower:
            file_type = "شرح فيديو"
        elif any(x in url_lower or x in title_lower for x in ["ملخص", "دروس", "تلخيص"]):
            file_type = "ملخص"
        elif any(x in url_lower or x in title_lower for x in ["تمرين", "تمارين", "مسائل"]):
            file_type = "تمرين"
        elif any(x in url_lower or x in title_lower for x in ["بكالوريا", "موضوع", "امتحان", "فرض", "bac"]):
            file_type = "موضوع بكالوريا سابق"
        elif any(x in url_lower or x in title_lower for x in ["كتاب", "كتب", "تحميل"]):
            file_type = "كتاب"
        else:
            if doc_type == 'exam':
                file_type = "موضوع بكالوريا سابق"
            elif doc_type == 'book':
                file_type = "كتاب"
            else:
                file_type = "ملخص"
        item['file_type'] = file_type

        # 5. Extract Wilaya
        wilayas = ["الجزائر", "وهران", "قسنطينة", "تيزي وزو", "سطيف", "شلف", "بجاية", "عنابة"]
        wilaya = None
        for w in wilayas:
            if w in item['title'] or w in content or w in response.url:
                wilaya = w
                break
        if not wilaya:
            wilaya = "الجزائر"
        item['wilaya'] = wilaya

        # 6. Extract Teacher (using NLP NER from classifier)
        teacher_name = EducationalClassifier.extract_teacher(item['title'], content)
        item['teacher'] = teacher_name
        
        self.crawled_count += 1
        if self.crawled_count > 0 and self.crawled_count % self.pause_limit == 0:
            self.logger.info(f"تمت أرشفة {self.crawled_count} صفحة. جاري إيقاف الزاحف مؤقتاً لمدة {self.pause_duration} ثانية لتجنب الحظر...")
            self.crawler.engine.pause()
            from twisted.internet import reactor
            reactor.callLater(self.pause_duration, self.resume_crawler)
 
        yield item
 
    def parse_youtube_channel(self, response):
        html_content = response.text
        
        # Look for channel ID using regex
        channel_id_match = re.search(r'href="https://www.youtube.com/feeds/videos.xml\?channel_id=(UC[a-zA-Z0-9_-]{22})"', html_content)
        if not channel_id_match:
            channel_id_match = re.search(r'"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"', html_content)
        if not channel_id_match:
            channel_id_match = re.search(r'<meta itemprop="channelId" content="(UC[a-zA-Z0-9_-]{22})">', html_content)
            
        if channel_id_match:
            channel_id = channel_id_match.group(1)
            rss_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
            self.logger.info(f"Found YouTube channel ID: {channel_id} for URL {response.url}. Fetching RSS feed...")
            yield scrapy.Request(
                url=rss_url,
                callback=self.parse_youtube_feed,
                meta={'teacher_channel_url': response.url, 'playwright': False}
            )
        else:
            self.logger.error(f"Could not extract YouTube channel ID from {response.url}")
 
    def parse_youtube_feed(self, response):
        # Remove namespaces for easy XML parsing
        response.selector.remove_namespaces()
        
        entries = response.css("entry")
        self.logger.info(f"Found {len(entries)} videos in YouTube RSS feed: {response.url}")
        
        for entry in entries:
            item = DocumentItem()
            item['url'] = entry.css("link::attr(href)").get()
            item['title'] = entry.css("title::text").get() or "فيديو بدون عنوان"
            item['content'] = entry.css("description::text").get() or entry.css("group description::text").get() or ""
            item['type'] = "video"
            item['file_type'] = "شرح فيديو"
            item['crawled_at'] = datetime.utcnow().isoformat()
            
            author_name = entry.css("author name::text").get() or ""
            
            # 1. AI Classify Subject
            subject = EducationalClassifier.classify_subject(item['title'], item['content'], item['url'])
            item['subject'] = subject
            
            # 2. AI Classify Level
            level = EducationalClassifier.classify_level(item['title'], item['content'], item['url'])
            
            # 3. AI Classify Teacher
            teacher_name = EducationalClassifier.extract_teacher(item['title'], item['content'], author_name)
            item['teacher'] = teacher_name
            
            # 4. AI Classify Branch
            branch = EducationalClassifier.classify_branch(item['title'], item['content'], item['url'], subject)
            item['branch'] = branch
            
            # 5. Extract Wilaya
            wilayas = ["الجزائر", "وهران", "قسنطينة", "تيزي وزو", "سطيف", "شلف", "بجاية", "عنابة"]
            wilaya = None
            for w in wilayas:
                if w in item['title'] or w in item['content']:
                    wilaya = w
                    break
            if not wilaya:
                wilaya = "الجزائر"
            item['wilaya'] = wilaya
            
            item['metadata'] = {
                'level': level,
                'subject': subject,
                'author': teacher_name
            }
            
            yield item



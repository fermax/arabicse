BOT_NAME = 'arabic_edu'

SPIDER_MODULES = ['arabic_edu.spiders']
NEWSPIDER_MODULE = 'arabic_edu.spiders'

# Crawl responsibly by identifying yourself (and your website) on the user-agent
USER_AGENT = 'ArabicSecondaryEduBot (+http://www.yourdomain.dz)'

# Obey robots.txt rules
ROBOTSTXT_OBEY = False

# Configure maximum concurrent requests performed by Scrapy (default: 16)
CONCURRENT_REQUESTS = 16

# Configure a delay for requests for the same website (default: 0)
DOWNLOAD_DELAY = 1.5

# Disable cookies (enabled by default)
COOKIES_ENABLED = False

# Set settings whose default value is deprecated to a future-proof value
REQUEST_FINGERPRINTER_IMPLEMENTATION = '2.7'
TWISTED_REACTOR = 'twisted.internet.asyncioreactor.AsyncioSelectorReactor'

ITEM_PIPELINES = {
   'arabic_edu.pipelines.ElasticsearchPipeline': 300,
}

# Enable Custom Playwright Downloader Middleware for Windows compatibility
DOWNLOADER_MIDDLEWARES = {
    'arabic_edu.middlewares.PlaywrightMiddleware': 543,
}


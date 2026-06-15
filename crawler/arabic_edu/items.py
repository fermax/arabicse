import scrapy

class DocumentItem(scrapy.Item):
    url = scrapy.Field()
    title = scrapy.Field()
    content = scrapy.Field()
    type = scrapy.Field() # lesson, summary, exam
    metadata = scrapy.Field() # dict for author, level, tags
    crawled_at = scrapy.Field()
    branch = scrapy.Field()
    file_type = scrapy.Field()
    wilaya = scrapy.Field()
    teacher = scrapy.Field()
    subject = scrapy.Field()


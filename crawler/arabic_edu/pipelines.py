import hashlib
import requests
from elasticsearch import Elasticsearch
from itemadapter import ItemAdapter

class ElasticsearchPipeline:
    def __init__(self):
        # Synchronous ES client for Scrapy
        self.es = Elasticsearch(["http://localhost:9200"])
        
    def is_url_working(self, url):
        try:
            # Send a HEAD request with a standard browser User-Agent to check connectivity
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"}
            res = requests.head(url, timeout=5, allow_redirects=True, headers=headers)
            if res.status_code in [200, 301, 302, 307, 308]:
                return True
            # Fallback to GET for sites that block HEAD requests (e.g. 403, 405)
            if res.status_code in [403, 405]:
                res = requests.get(url, timeout=5, stream=True, headers=headers)
                return res.status_code in [200, 301, 302, 307, 308]
            return False
        except Exception:
            return False

    def process_item(self, item, spider):
        adapter = ItemAdapter(item)
        document = dict(adapter)
        
        try:
            url = document.get('url')
            if url:
                # Check if URL works before storing it
                if not self.is_url_working(url):
                    spider.logger.warning(f"Skipped indexing: URL is not working/reachable: {url}")
                    return item

                # Use deterministic MD5 hash of URL as document ID to prevent duplicates
                doc_id = hashlib.md5(url.encode('utf-8')).hexdigest()
                self.es.index(index="documents", id=doc_id, document=document)
                
                # Trigger notifications for subscribers
                try:
                    import sys
                    import os
                    backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../backend'))
                    if backend_path not in sys.path:
                        sys.path.append(backend_path)
                    
                    import database
                    import models
                    
                    db = database.SessionLocal()
                    from sqlalchemy import or_
                    subject = document.get("subject")
                    level = document.get("metadata", {}).get("level") if isinstance(document.get("metadata"), dict) else None
                    branch = document.get("branch")
                    teacher = document.get("teacher", "أستاذ المادة")
                    title = document.get("title")
                    
                    subs = db.query(models.Subscription).filter(
                        or_(models.Subscription.subject == subject, models.Subscription.subject.is_(None)),
                        or_(models.Subscription.level == level, models.Subscription.level.is_(None)),
                        or_(models.Subscription.branch == branch, models.Subscription.branch.is_(None)),
                        or_(models.Subscription.teacher == teacher, models.Subscription.teacher.is_(None))
                    ).all()
                    
                    notified_users = set()
                    for sub in subs:
                        if sub.user_id in notified_users:
                            continue
                        if not (sub.subject or sub.level or sub.branch or sub.teacher):
                            continue
                            
                        notif = models.Notification(
                            user_id=sub.user_id,
                            document_id=doc_id,
                            title="مستند تعليمي جديد يهمك",
                            message=f"تمت أرشفة ملف جديد: '{title}' في مادة {subject or 'المادة'} للأستاذ {teacher or 'المادة'}."
                        )
                        db.add(notif)
                        notified_users.add(sub.user_id)
                    db.commit()
                    db.close()
                except Exception as ex:
                    spider.logger.error(f"Error triggering notifications in crawler pipeline: {ex}")
            else:
                self.es.index(index="documents", document=document)
        except Exception as e:
            spider.logger.error(f"Error indexing document {document.get('url')}: {e}")
            
        return item


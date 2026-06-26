from fastapi import FastAPI, Query, Depends, HTTPException, status, BackgroundTasks, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
from elasticsearch import AsyncElasticsearch
from sqlalchemy.orm import Session
from sqlalchemy import func
import uvicorn
import subprocess
import os
import logging
from typing import List, Union, Optional

# تحميل ملف .env بشكل صريح لضمان قراءة جميع المتغيرات البيئية
from dotenv import load_dotenv
load_dotenv()

# إعداد نظام التسجيل الداخلي (Logging)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# إعداد Rate Limiter لحماية النقاط الحساسة
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)

import models
import schemas
import auth
import database
import ai_service


app = FastAPI(title="Arabic Secondary Edu Search API")
app.state.limiter = limiter

# معالج خطأ تجاوز حد الطلبات
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "لقد تجاوزت الحد المسموح من الطلبات. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى."}
    )

# تقييد CORS على النطاقات المعتمدة فقط
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:4000,http://localhost:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Connect to Elasticsearch
es = AsyncElasticsearch(["http://localhost:9200"])

@app.on_event("startup")
async def startup_event():
    # Create database tables
    models.Base.metadata.create_all(bind=database.engine)
    
    # Ping ES to check connection
    try:
        info = await es.info()
        print(f"Connected to Elasticsearch: {info['version']['number']}")
    except Exception as e:
        print(f"Could not connect to Elasticsearch: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    await es.close()

@app.get("/")
def read_root():
    return {"message": "Welcome to the Arabic Secondary Edu Search API"}

@app.get("/api/suggest")
async def get_suggestions(q: str = Query(..., min_length=2)):
    """
    Endpoint for autocomplete suggestions based on user input.
    """
    query = {
        "suggest": {
            "keyword-suggestion": {
                "prefix": q,
                "completion": {
                    "field": "keyword.suggest",
                    "size": 7,
                    "fuzzy": {
                        "fuzziness": "AUTO"
                    }
                }
            }
        }
    }
    
    try:
        response = await es.search(index="keywords", body=query)
        options = response['suggest']['keyword-suggestion'][0]['options']
        suggestions = [opt['text'] for opt in options]
        return {"suggestions": suggestions}
    except Exception as e:
        print(f"Suggestion error: {e}")
        return {"suggestions": []}

def log_search_query(q: str):
    db = database.SessionLocal()
    try:
        new_search = models.SearchHistory(query=q)
        db.add(new_search)
        db.commit()
    except Exception as e:
        print(f"Error logging search history in background task: {e}")
        db.rollback()
    finally:
        db.close()

@app.get("/api/search")
async def search_documents(
    q: str = Query(..., min_length=1),
    branch: str = None,
    subject: str = None,
    level: str = None,
    file_type: str = None,
    wilaya: str = None,
    teacher: str = None,
    limit: int = 10,
    skip: int = 0,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(database.get_db),
    current_user: Optional[models.User] = Depends(auth.get_current_user_optional)
):
    """
    Endpoint for searching documents (lessons, exams, etc.) with advanced filters.
    """
    # Log the search query in database asynchronously in the background
    background_tasks.add_task(log_search_query, q)

    must_queries = [
        {
            "multi_match": {
                "query": q,
                "fields": ["title^3", "content"],
                "analyzer": "arabic"
            }
        }
    ]
    
    filter_queries = []
    if branch:
        filter_queries.append({"term": {"branch.keyword": branch}})
    if subject:
        filter_queries.append({"term": {"subject.keyword": subject}})
    if level:
        filter_queries.append({"term": {"metadata.level": level}})
    if file_type:
        filter_queries.append({"term": {"file_type.keyword": file_type}})
    if wilaya:
        filter_queries.append({"term": {"wilaya.keyword": wilaya}})
    if teacher:
        filter_queries.append({"term": {"teacher.keyword": teacher}})
    functions = [
        {
            "filter": {"term": {"is_verified": True}},
            "weight": 2.0
        },
        {
            "field_value_factor": {
                "field": "rating_count",
                "factor": 0.5,
                "modifier": "ln1p",
                "missing": 0
            }
        }
    ]
    
    is_personalized = False
    if current_user and not (branch or level):
        if current_user.level:
            functions.append({
                "filter": {"term": {"metadata.level": current_user.level}},
                "weight": 1.5
            })
            is_personalized = True
        if current_user.branch:
            functions.append({
                "filter": {"term": {"branch.keyword": current_user.branch}},
                "weight": 1.5
            })
            is_personalized = True

    query = {
        "query": {
            "function_score": {
                "query": {
                    "bool": {
                        "must": must_queries
                    }
                },
                "functions": functions,
                "score_mode": "multiply",
                "boost_mode": "multiply"
            }
        },
        "highlight": {
            "fields": {
                "content": {}
            }
        },
        "aggs": {
            "teachers": {
                "terms": {"field": "teacher.keyword", "size": 100}
            },
            "branches": {
                "terms": {"field": "branch.keyword", "size": 100}
            },
            "wilayas": {
                "terms": {"field": "wilaya.keyword", "size": 100}
            },
            "file_types": {
                "terms": {"field": "file_type.keyword", "size": 100}
            },
            "subjects": {
                "terms": {"field": "subject.keyword", "size": 100}
            },
            "levels": {
                "terms": {"field": "metadata.level", "size": 100}
            }
        }
    }
    
    if filter_queries:
        query["post_filter"] = {
            "bool": {
                "filter": filter_queries
            }
        }
    
    try:
        response = await es.search(
            index="documents", 
            body=query,
            size=limit,
            from_=skip
        )
        is_fallback = False
        
        # If no results match exactly, run fallback similar results logic
        if response['hits']['total']['value'] == 0:
            is_fallback = True
            
            # Fallback Tier 1: Fuzzy query with same filters
            fallback_query = {
                "query": {
                    "function_score": {
                        "query": {
                            "bool": {
                                "must": [
                                    {
                                        "multi_match": {
                                            "query": q,
                                            "fields": ["title^3", "content"],
                                            "analyzer": "arabic",
                                            "fuzziness": "AUTO",
                                            "prefix_length": 1
                                        }
                                    }
                                ]
                            }
                        },
                        "functions": [
                            {
                                "filter": {"term": {"is_verified": True}},
                                "weight": 2.0
                            },
                            {
                                "field_value_factor": {
                                    "field": "rating_count",
                                    "factor": 0.5,
                                    "modifier": "ln1p",
                                    "missing": 0
                                }
                            }
                        ],
                        "score_mode": "multiply",
                        "boost_mode": "multiply"
                    }
                },
                "highlight": {
                    "fields": {
                        "content": {}
                    }
                },
                "aggs": query.get("aggs", {})
            }
            
            if filter_queries:
                fallback_query["post_filter"] = {
                    "bool": {
                        "filter": filter_queries
                    }
                }
                
            response = await es.search(
                index="documents", 
                body=fallback_query,
                size=limit,
                from_=skip
            )
            
            # Fallback Tier 2: Fuzzy query without filters (ignoring branch/subject limits)
            if response['hits']['total']['value'] == 0 and filter_queries:
                if "post_filter" in fallback_query:
                    del fallback_query["post_filter"]
                response = await es.search(
                    index="documents", 
                    body=fallback_query,
                    size=limit,
                    from_=skip
                )
                
            # Fallback Tier 3: Show general matching documents (Match All)
            if response['hits']['total']['value'] == 0:
                broad_query = {
                    "query": {
                        "function_score": {
                            "query": {
                                "match_all": {}
                            },
                            "functions": [
                                {
                                    "filter": {"term": {"is_verified": True}},
                                    "weight": 2.0
                                },
                                {
                                    "field_value_factor": {
                                        "field": "rating_count",
                                        "factor": 0.5,
                                        "modifier": "ln1p",
                                        "missing": 0
                                    }
                                }
                            ],
                            "score_mode": "multiply",
                            "boost_mode": "multiply"
                        }
                    },
                    "aggs": query.get("aggs", {})
                }
                response = await es.search(
                    index="documents", 
                    body=broad_query,
                    size=limit,
                    from_=skip
                )

        hits = response['hits']['hits']
        results = [
            {
                "id": hit["_id"],
                "title": hit["_source"].get("title", ""),
                "url": hit["_source"].get("url", ""),
                "type": hit["_source"].get("type", "lesson"),
                "highlight": hit.get("highlight", {}).get("content", [""])[0] if hit.get("highlight") else hit["_source"].get("content", "")[:160] + "...",
                "branch": hit["_source"].get("branch", "عام"),
                "subject": hit["_source"].get("subject", "اللغة العربية وآدابها"),
                "file_type": hit["_source"].get("file_type", "ملخص"),
                "wilaya": hit["_source"].get("wilaya", "الجزائر"),
                "teacher": hit["_source"].get("teacher", "أستاذ المادة"),
                "rating_count": hit["_source"].get("rating_count", 0),
                "is_verified": hit["_source"].get("is_verified", False),
                "user_liked": db.query(models.DocumentRating).filter(
                    models.DocumentRating.user_id == current_user.id,
                    models.DocumentRating.document_id == hit["_id"]
                ).first() is not None if current_user else False
            }
            for hit in hits
        ]
        
        # Extract aggregations
        aggs = response.get("aggregations", {})
        teachers = [bucket["key"] for bucket in aggs.get("teachers", {}).get("buckets", []) if bucket.get("key")]
        branches = [bucket["key"] for bucket in aggs.get("branches", {}).get("buckets", []) if bucket.get("key")]
        wilayas = [bucket["key"] for bucket in aggs.get("wilayas", {}).get("buckets", []) if bucket.get("key")]
        file_types = [bucket["key"] for bucket in aggs.get("file_types", {}).get("buckets", []) if bucket.get("key")]
        subjects = [bucket["key"] for bucket in aggs.get("subjects", {}).get("buckets", []) if bucket.get("key")]
        levels = [bucket["key"] for bucket in aggs.get("levels", {}).get("buckets", []) if bucket.get("key")]
        
        facets = {
            "teachers": teachers,
            "branches": branches,
            "wilayas": wilayas,
            "file_types": file_types,
            "subjects": subjects,
            "levels": levels
        }
        
        return {
            "results": results, 
            "total": response['hits']['total']['value'],
            "facets": facets,
            "is_fallback": is_fallback,
            "is_personalized": is_personalized
        }
    except Exception as e:
        print(f"Search error: {e}")
        return {"results": [], "total": 0, "facets": {"teachers": [], "branches": [], "wilayas": [], "file_types": [], "subjects": [], "levels": []}, "is_fallback": False, "is_personalized": False}


# --- Auth Routes ---
@app.post("/register", response_model=schemas.UserResponse)
@limiter.limit("3/minute")  # منع إنشاء حسابات وهمية بالجملة
def register(request: Request, user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="هذا البريد الإلكتروني مسجّل مسبقاً.")
    
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(
        full_name=user.full_name,
        email=user.email,
        password_hash=hashed_password
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/login", response_model=schemas.Token)
@limiter.limit("5/minute")  # منع هجمات Brute Force على كلمات المرور
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="بريد إلكتروني أو كلمة مرور غير صحيحة.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = auth.create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/auth/social", response_model=schemas.Token)
def social_auth(data: schemas.SocialAuthInput, db: Session = Depends(database.get_db)):
    """
    تسجيل الدخول الاجتماعي الداخلي المؤمَّن بتوقيع HMAC-SHA256.
    يرفض أي طلب لا يحمل توقيعاً صحيحاً أو منتهي الصلاحية (أقدم من 5 دقائق).
    """
    import hmac as _hmac
    import hashlib
    import time

    # 1. استرجاع المفتاح السري من متغيرات البيئة
    social_secret = os.getenv("SOCIAL_AUTH_SECRET", "")
    if not social_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="خدمة المصادقة الاجتماعية غير مُهيَّأة."
        )

    # 2. التحقق من صلاحية التوقيع (لم يمضِ عليه أكثر من 5 دقائق)
    timestamp_ms = data.timestamp  # timestamp بالميلي ثانية من الـ frontend
    now_ms = int(time.time() * 1000)
    age_seconds = (now_ms - timestamp_ms) / 1000
    if age_seconds > 300 or age_seconds < -30:  # 5 دقائق كحد أقصى
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="انتهت صلاحية طلب تسجيل الدخول. يرجى المحاولة مرة أخرى."
        )

    # 3. إعادة بناء الرسالة الأصلية والتحقق من التوقيع
    expected_message = f"{data.email}|{data.provider}|{timestamp_ms}"
    expected_sig = _hmac.new(
        social_secret.encode("utf-8"),
        expected_message.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    if not _hmac.compare_digest(expected_sig, data.signed_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="فشل التحقق من هوية الطلب. يُرجى استخدام زر تسجيل الدخول الرسمي."
        )

    # 4. بعد التحقق الناجح: إنشاء المستخدم أو تسجيل دخوله
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if not user:
        import secrets
        random_password = secrets.token_urlsafe(16)
        hashed_password = auth.get_password_hash(random_password)
        user = models.User(
            full_name=data.full_name,
            email=data.email,
            password_hash=hashed_password,
            role="student"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    access_token = auth.create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/users/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@app.get("/api/sources/active", response_model=List[schemas.CrawlSourceResponse])
def get_active_sources(db: Session = Depends(database.get_db)):
    return db.query(models.CrawlSource).filter(models.CrawlSource.status == "active").all()

# Global variable to track crawler subprocess
crawler_process = None

# --- Admin & Crawler Control Endpoints (Reloaded-v3) ---

def require_admin(current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="عذراً، هذه الصلاحية مخصصة لمدراء المنصة فقط."
        )
    return current_user

@app.get("/api/admin/stats", response_model=schemas.AdminStatsResponse)
async def get_admin_stats(db: Session = Depends(database.get_db), admin_user: models.User = Depends(require_admin)):
    # 1. Total searches from search_history table
    total_searches = db.query(models.SearchHistory).count()
    
    # 2. Total users from users table
    total_users = db.query(models.User).count()
    
    # 3. Total documents from Elasticsearch
    total_documents = 0
    try:
        count_res = await es.count(index="documents")
        total_documents = count_res.get("count", 0)
    except Exception as e:
        print(f"Error getting ES doc count: {e}")
        
    # 4. Crawler status
    global crawler_process
    crawler_status = "inactive"
    if crawler_process is not None:
        if crawler_process.poll() is None:
            crawler_status = "active"
        else:
            crawler_process = None
            
    return {
        "total_searches": total_searches,
        "total_documents": total_documents,
        "total_users": total_users,
        "crawler_status": crawler_status
    }

@app.get("/api/admin/search-stats", response_model=schemas.SearchStatsDetailResponse)
def get_admin_search_stats(db: Session = Depends(database.get_db), admin_user: models.User = Depends(require_admin)):
    # 1. Popular searches (grouped by query, sorted by frequency desc)
    popular_query = db.query(
        models.SearchHistory.query,
        func.count(models.SearchHistory.id).label("count")
    ).group_by(
        models.SearchHistory.query
    ).order_by(
        func.count(models.SearchHistory.id).desc()
    ).limit(30).all()
    
    popular = [
        schemas.PopularSearchItem(query=item[0], count=item[1])
        for item in popular_query
    ]
    
    # 2. Recent searches (ordered by searched_at desc)
    recent_query = db.query(
        models.SearchHistory
    ).order_by(
        models.SearchHistory.searched_at.desc()
    ).limit(50).all()
    
    recent = []
    for item in recent_query:
        user_email = None
        if item.user_id:
            user = db.query(models.User).filter(models.User.id == item.user_id).first()
            if user:
                user_email = user.email
        
        recent.append(
            schemas.RecentSearchItem(
                id=item.id,
                query=item.query,
                searched_at=item.searched_at,
                user_email=user_email
            )
        )
        
    return {
        "popular": popular,
        "recent": recent
    }

@app.delete("/api/admin/search-stats/clear")
def clear_search_stats(db: Session = Depends(database.get_db), admin_user: models.User = Depends(require_admin)):
    try:
        db.query(models.SearchHistory).delete()
        db.commit()
        return {"message": "تم مسح سجل عمليات البحث بنجاح."}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"فشل مسح سجل البحث: {str(e)}"
        )

@app.get("/api/admin/sources", response_model=Union[List[schemas.CrawlSourceResponse], schemas.CrawlSourcesPagedResponse])
def get_crawl_sources(
    status: str = None, 
    limit: int = None, 
    skip: int = None, 
    db: Session = Depends(database.get_db), 
    admin_user: models.User = Depends(require_admin)
):
    query = db.query(models.CrawlSource)
    if status:
        query = query.filter(models.CrawlSource.status == status)
    
    if limit is not None:
        total = query.count()
        sources = query.offset(skip).limit(limit).all()
        return {"sources": sources, "total": total}
        
    return query.all()

@app.post("/api/admin/sources", response_model=schemas.CrawlSourceResponse)
def create_crawl_source(source: schemas.CrawlSourceCreate, db: Session = Depends(database.get_db), admin_user: models.User = Depends(require_admin)):
    db_source = db.query(models.CrawlSource).filter(models.CrawlSource.url == source.url).first()
    if db_source:
        raise HTTPException(status_code=400, detail="Source URL already exists")
    
    new_source = models.CrawlSource(
        url=source.url,
        site_name=source.site_name,
        status=source.status
    )
    db.add(new_source)
    db.commit()
    db.refresh(new_source)
    return new_source

@app.put("/api/admin/sources/{source_id}", response_model=schemas.CrawlSourceResponse)
def update_crawl_source(source_id: int, source_data: schemas.CrawlSourceCreate, db: Session = Depends(database.get_db), admin_user: models.User = Depends(require_admin)):
    db_source = db.query(models.CrawlSource).filter(models.CrawlSource.id == source_id).first()
    if not db_source:
        raise HTTPException(status_code=404, detail="Source not found")
        
    db_source.url = source_data.url
    db_source.site_name = source_data.site_name
    if source_data.status:
        db_source.status = source_data.status
        
    db.commit()
    db.refresh(db_source)
    return db_source

@app.delete("/api/admin/sources/{source_id}")
def delete_crawl_source(source_id: int, db: Session = Depends(database.get_db), admin_user: models.User = Depends(require_admin)):
    db_source = db.query(models.CrawlSource).filter(models.CrawlSource.id == source_id).first()
    if not db_source:
        raise HTTPException(status_code=404, detail="Source not found")
        
    db.delete(db_source)
    db.commit()
    return {"message": "Source deleted successfully"}

@app.post("/api/admin/crawler/start")
def start_crawler(admin_user: models.User = Depends(require_admin)):
    global crawler_process
    
    if crawler_process is not None and crawler_process.poll() is None:
        return {"status": "active", "message": "الزاحف نشط بالفعل ويعمل حالياً."}
        
    try:
        import sys
        
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        crawler_dir = os.path.abspath(os.path.join(backend_dir, "..", "crawler"))
        
        if sys.platform == "win32":
            scrapy_exe = os.path.join(crawler_dir, "venv", "Scripts", "scrapy.exe")
        else:
            scrapy_exe = os.path.join(crawler_dir, "venv", "bin", "scrapy")
            
        if not os.path.exists(scrapy_exe):
            scrapy_exe = "scrapy"
            
        print(f"Starting crawler at {crawler_dir} using {scrapy_exe}")
        
        log_file_path = os.path.join(crawler_dir, "crawler.log")
        log_file = open(log_file_path, "w", encoding="utf-8")
        
        crawler_process = subprocess.Popen(
            [scrapy_exe, "crawl", "edu_spider"],
            cwd=crawler_dir,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            text=True
        )
        
        return {"status": "active", "message": "تم تشغيل الزاحف بنجاح في الخلفية."}
    except Exception as e:
        logger.error(f"Crawler start failed: {e}")
        raise HTTPException(
            status_code=500,
            detail="حدث خطأ داخلي عند محاولة تشغيل الزاحف. يرجى التحقق من سجلات الخادم."
        )

@app.post("/api/admin/crawler/stop")
def stop_crawler(admin_user: models.User = Depends(require_admin)):
    global crawler_process
    
    if crawler_process is None or crawler_process.poll() is not None:
        crawler_process = None
        return {"status": "inactive", "message": "الزاحف غير نشط بالفعل."}
        
    try:
        crawler_process.terminate()
        try:
            crawler_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            crawler_process.kill()
            
        crawler_process = None
        return {"status": "inactive", "message": "تم إيقاف الزاحف بنجاح."}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"حدث خطأ أثناء محاولة إيقاف الزاحف: {str(e)}"
        )

from uuid import UUID

@app.get("/api/admin/users", response_model=List[schemas.UserResponse])
def get_admin_users(db: Session = Depends(database.get_db), admin_user: models.User = Depends(require_admin)):
    return db.query(models.User).order_by(models.User.created_at.desc()).all()

@app.put("/api/admin/users/{user_id}", response_model=schemas.UserResponse)
def update_admin_user(user_id: UUID, data: schemas.UserUpdate, db: Session = Depends(database.get_db), admin_user: models.User = Depends(require_admin)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    db_user.full_name = data.full_name
    db_user.role = data.role
    db_user.is_verified_teacher = data.is_verified_teacher
    db.commit()
    db.refresh(db_user)
    return db_user

@app.delete("/api/admin/users/{user_id}")
def delete_admin_user(user_id: UUID, db: Session = Depends(database.get_db), admin_user: models.User = Depends(require_admin)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(db_user)
    db.commit()
    return {"message": "User deleted successfully"}

@app.get("/api/admin/documents")
async def get_admin_documents(q: str = None, limit: int = 100, skip: int = 0, admin_user: models.User = Depends(require_admin)):
    query = {"query": {"match_all": {}}}
    if q:
        query = {
            "query": {
                "multi_match": {
                    "query": q,
                    "fields": ["title", "content"],
                    "analyzer": "arabic"
                }
            }
        }
    try:
        response = await es.search(
            index="documents",
            body=query,
            size=limit,
            from_=skip
        )
        hits = response['hits']['hits']
        docs = [
            {
                "id": hit["_id"],
                "title": hit["_source"].get("title", ""),
                "url": hit["_source"].get("url", ""),
                "type": hit["_source"].get("type", "lesson"),
                "crawled_at": hit["_source"].get("crawled_at", "")
            }
            for hit in hits
        ]
        return {"documents": docs, "total": response['hits']['total']['value']}
    except Exception as e:
        print(f"Error fetching admin documents: {e}")
        return {"documents": [], "total": 0}

@app.delete("/api/admin/documents/{doc_id}")
async def delete_admin_document(doc_id: str, admin_user: models.User = Depends(require_admin)):
    try:
        await es.delete(index="documents", id=doc_id)
        return {"message": "تم حذف المستند بنجاح."}
    except Exception as e:
        logger.error(f"Document delete failed: {e}")
        raise HTTPException(status_code=500, detail="حدث خطأ أثناء حذف المستند. يرجى المحاولة لاحقاً.")

@app.post("/api/documents/upload", response_model=schemas.DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    subject: str = Form(...),
    level: str = Form(...),
    branch: str = Form(...),
    file_type: str = Form(...),
    wilaya: str = Form(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Enforce teacher or admin role
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="عذراً، هذه الصلاحية مخصصة للأساتذة والمدراء فقط."
        )

    # التحقق من حجم الملف (10MB حد أقصى)
    MAX_FILE_SIZE = 10 * 1024 * 1024
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="حجم الملف يتجاوز الحد المسموح وهو 10 ميغابايت."
        )

    content = ""
    filename_lower = file.filename.lower()
    
    if filename_lower.endswith(".pdf"):
        # التحقق من Magic Bytes للتأكد أنه PDF حقيقي (وليس ملف خبيث بامتداد .pdf)
        if not file_bytes.startswith(b'%PDF'):
            raise HTTPException(
                status_code=400,
                detail="الملف ليس PDF حقيقياً. يرجى رفع ملف PDF صحيح."
            )
        import io
        import pypdf
        try:
            pdf_file = io.BytesIO(file_bytes)
            reader = pypdf.PdfReader(pdf_file)
            text_list = []
            for page_num in range(min(len(reader.pages), 15)):
                page = reader.pages[page_num]
                text = page.extract_text()
                if text:
                    text_list.append(text)
            content = " ".join(text_list)
        except Exception as e:
            logger.error(f"Error parsing uploaded PDF: {e}")
            content = ""
    else:
        # فقط ملفات النص العادي مسموح بها (.txt)
        if not filename_lower.endswith(".txt"):
            raise HTTPException(
                status_code=400,
                detail="نوع الملف غير مدعوم. يرجى رفع ملفات PDF أو TXT فقط."
            )
        try:
            content = file_bytes.decode("utf-8", errors="ignore")
        except Exception:
            content = ""

    # Generate unique document ID
    import uuid
    import hashlib
    doc_uuid = str(uuid.uuid4())
    doc_id = hashlib.md5(f"uploaded://{doc_uuid}".encode("utf-8")).hexdigest()

    # Index in Elasticsearch
    from datetime import datetime
    document = {
        "title": title,
        "content": content,
        "url": f"http://uploaded/doc/{doc_uuid}",
        "type": "lesson" if file_type in ["ملخص", "كتاب"] else "exam",
        "branch": branch,
        "subject": subject,
        "file_type": file_type,
        "wilaya": wilaya,
        "teacher": current_user.full_name if current_user.role == "teacher" else "أستاذ المادة",
        "rating_count": 0,
        "is_verified": current_user.role == "admin" or (current_user.role == "teacher" and current_user.is_verified_teacher),
        "crawled_at": datetime.utcnow().isoformat(),
        "metadata": {
            "level": level,
            "subject": subject
        }
    }

    try:
        await es.index(index="documents", id=doc_id, body=document)
        # Trigger notifications in the background
        teacher_name = current_user.full_name if current_user.role == "teacher" else "أستاذ المادة"
        background_tasks.add_task(
            trigger_notifications,
            doc_id,
            title,
            subject,
            level,
            branch,
            teacher_name
        )
        return {"message": "تم رفع وتصنيف المستند بنجاح.", "document_id": doc_id}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"فشل أرشفة الملف في محرك البحث: {str(e)}"
        )

@app.post("/api/documents/{doc_id}/rate", response_model=schemas.DocumentRatingResponse)
async def rate_document(
    doc_id: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    existing_rating = db.query(models.DocumentRating).filter(
        models.DocumentRating.user_id == current_user.id,
        models.DocumentRating.document_id == doc_id
    ).first()

    liked = False
    if existing_rating:
        db.delete(existing_rating)
        db.commit()
    else:
        new_rating = models.DocumentRating(user_id=current_user.id, document_id=doc_id)
        db.add(new_rating)
        db.commit()
        liked = True

    total_ratings = db.query(models.DocumentRating).filter(
        models.DocumentRating.document_id == doc_id
    ).count()

    try:
        await es.update(
            index="documents",
            id=doc_id,
            body={
                "doc": {
                    "rating_count": total_ratings
                }
            }
        )
    except Exception as e:
        print(f"Error updating ES rating count: {e}")

    return {"liked": liked, "total_ratings": total_ratings}

@app.post("/api/documents/{doc_id}/verify", response_model=schemas.DocumentVerificationResponse)
async def verify_document(
    doc_id: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Enforce admin or verified teacher role
    if current_user.role != "admin" and not (current_user.role == "teacher" and current_user.is_verified_teacher):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="عذراً، هذه الصلاحية مخصصة للمشرفين والأساتذة الموثقين فقط."
        )

    existing_verification = db.query(models.DocumentVerification).filter(
        models.DocumentVerification.document_id == doc_id
    ).first()

    is_verified = False
    if existing_verification:
        db.delete(existing_verification)
        db.commit()
    else:
        new_verification = models.DocumentVerification(
            verified_by=current_user.id,
            document_id=doc_id
        )
        db.add(new_verification)
        db.commit()
        is_verified = True

    try:
        await es.update(
            index="documents",
            id=doc_id,
            body={
                "doc": {
                    "is_verified": is_verified
                }
            }
        )
    except Exception as e:
        print(f"Error updating ES verification status: {e}")

    return {"is_verified": is_verified}

# --- User Profile & Preferences ---
@app.put("/api/users/profile", response_model=schemas.UserResponse)
def update_user_profile(
    data: schemas.UserProfileUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    current_user.full_name = data.full_name
    current_user.level = data.level
    current_user.branch = data.branch
    db.commit()
    db.refresh(current_user)
    return current_user

# --- Subscriptions API ---
@app.get("/api/subscriptions", response_model=List[schemas.SubscriptionResponse])
def get_subscriptions(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return db.query(models.Subscription).filter(models.Subscription.user_id == current_user.id).all()

@app.post("/api/subscriptions", response_model=schemas.SubscriptionResponse)
def create_subscription(
    data: schemas.SubscriptionCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Check if subscription already exists
    exists = db.query(models.Subscription).filter(
        models.Subscription.user_id == current_user.id,
        models.Subscription.subject == data.subject,
        models.Subscription.branch == data.branch,
        models.Subscription.level == data.level,
        models.Subscription.teacher == data.teacher
    ).first()
    if exists:
        return exists
        
    sub = models.Subscription(
        user_id=current_user.id,
        subject=data.subject,
        branch=data.branch,
        level=data.level,
        teacher=data.teacher
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub

@app.delete("/api/subscriptions/{sub_id}")
def delete_subscription(
    sub_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    sub = db.query(models.Subscription).filter(
        models.Subscription.id == sub_id,
        models.Subscription.user_id == current_user.id
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    db.delete(sub)
    db.commit()
    return {"message": "Subscription deleted successfully"}

# --- Notifications API ---
@app.get("/api/notifications", response_model=List[schemas.NotificationResponse])
def get_notifications(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id
    ).order_by(models.Notification.created_at.desc()).all()

@app.post("/api/notifications/{notif_id}/read", response_model=schemas.NotificationResponse)
def mark_notification_as_read(
    notif_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    notif = db.query(models.Notification).filter(
        models.Notification.id == notif_id,
        models.Notification.user_id == current_user.id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return notif

# --- Notification Trigger Helper ---
def trigger_notifications(
    doc_id: str,
    title: str,
    subject: str,
    level: str,
    branch: str,
    teacher: str
):
    db = database.SessionLocal()
    try:
        from sqlalchemy import or_
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
            
            # Skip if all fields are null (empty sub)
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
    except Exception as e:
        print(f"Error triggering notifications: {e}")
        db.rollback()
    finally:
        db.close()

# --- Phase 3 Generative AI & Interactive Quizzes ---

@app.get("/api/admin/ai-settings", response_model=schemas.AISettingsGet)
def get_ai_settings_endpoint(db: Session = Depends(database.get_db), admin_user: models.User = Depends(require_admin)):
    settings = ai_service.get_active_settings(db)
    has_key = len(settings["api_key"]) > 0 if settings["api_key"] else False
    return {
        "provider": settings["provider"],
        "model_name": settings["model_name"],
        "has_api_key": has_key
    }

@app.put("/api/admin/ai-settings")
def update_ai_settings_endpoint(
    data: schemas.AISettingsUpdate,
    db: Session = Depends(database.get_db),
    admin_user: models.User = Depends(require_admin)
):
    provider_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "ai_provider").first()
    if not provider_setting:
        provider_setting = models.SystemSetting(key="ai_provider")
        db.add(provider_setting)
    provider_setting.value = data.provider
    
    model_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "ai_model").first()
    if not model_setting:
        model_setting = models.SystemSetting(key="ai_model")
        db.add(model_setting)
        
    if data.model_name:
        model_setting.value = data.model_name
    else:
        model_setting.value = ai_service.DEFAULT_MODELS.get(data.provider, "mock-model")
        
    if data.api_key is not None:
        key_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "ai_api_key").first()
        if not key_setting:
            key_setting = models.SystemSetting(key="ai_api_key")
            db.add(key_setting)
        # تشفير المفتاح قبل الحفظ في قاعدة البيانات
        key_setting.value = ai_service.encrypt_api_key(data.api_key)
        
    db.commit()
    return {"message": "تم تحديث إعدادات الذكاء الاصطناعي بنجاح."}

@app.post("/api/ai/ask", response_model=schemas.AIAskResponse)
@limiter.limit("15/minute")  # حماية رصيد AI API من الاستنزاف
async def ask_ai_assistant_endpoint(
    request: Request,
    payload: schemas.AIAskRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    docs = []
    try:
        query = {
            "query": {
                "multi_match": {
                    "query": payload.question,
                    "fields": ["title^3", "content"],
                    "analyzer": "arabic"
                }
            }
        }
        
        filter_queries = []
        if payload.level:
            filter_queries.append({"term": {"metadata.level": payload.level}})
        if payload.branch:
            filter_queries.append({"term": {"branch.keyword": payload.branch}})
            
        if filter_queries:
            query["post_filter"] = {
                "bool": {
                    "filter": filter_queries
                }
            }
            
        response = await es.search(
            index="documents",
            body=query,
            size=3
        )
        hits = response['hits']['hits']
        docs = [
            {
                "id": hit["_id"],
                "title": hit["_source"].get("title", ""),
                "url": hit["_source"].get("url", ""),
                "content": hit["_source"].get("content", ""),
                "highlight": hit.get("highlight", {}).get("content", [""])[0] if hit.get("highlight") else ""
            }
            for hit in hits
        ]
    except Exception as e:
        print(f"Error searching ES for RAG context: {e}")
        
    ai_config = ai_service.get_active_settings(db)
    
    answer = await ai_service.generate_rag_answer(
        question=payload.question,
        docs=docs,
        provider=ai_config["provider"],
        api_key=ai_config["api_key"],
        model_name=ai_config["model_name"]
    )
    
    references = [
        {
            "id": doc["id"],
            "title": doc["title"],
            "url": doc["url"]
        }
        for doc in docs
    ]
    
    return {"answer": answer, "references": references}

@app.post("/api/ai/quiz/generate", response_model=schemas.QuizGenerateResponse)
@limiter.limit("10/minute")  # توليد الاختبارات يستهلك الكثير من رصيد API
async def generate_quiz_endpoint(
    request: Request,
    payload: schemas.QuizGenerateRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    docs = []
    topic = payload.topic or "عام"
    
    if payload.document_id:
        try:
            doc_res = await es.get(index="documents", id=payload.document_id)
            if doc_res and doc_res.get("found"):
                source = doc_res["_source"]
                docs.append({
                    "id": payload.document_id,
                    "title": source.get("title", "مستند"),
                    "content": source.get("content", "")
                })
                topic = source.get("title", topic)
        except Exception as e:
            print(f"Error fetching document for quiz: {e}")
            
    if not docs and payload.topic:
        try:
            query = {
                "query": {
                    "multi_match": {
                        "query": payload.topic,
                        "fields": ["title^3", "content"],
                        "analyzer": "arabic"
                    }
                }
            }
            response = await es.search(index="documents", body=query, size=3)
            hits = response['hits']['hits']
            docs = [
                {
                    "id": hit["_id"],
                    "title": hit["_source"].get("title", ""),
                    "content": hit["_source"].get("content", "")
                }
                for hit in hits
            ]
        except Exception as e:
            print(f"Error searching ES for quiz topic: {e}")
            
    ai_config = ai_service.get_active_settings(db)
    
    questions = await ai_service.generate_quiz_questions(
        topic=topic,
        docs=docs,
        provider=ai_config["provider"],
        api_key=ai_config["api_key"],
        model_name=ai_config["model_name"]
    )
    
    return {"questions": questions}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)






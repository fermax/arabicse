from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from uuid import UUID

class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str

class SocialAuthInput(BaseModel):
    full_name: str
    email: EmailStr
    provider: str


class UserResponse(BaseModel):
    id: UUID
    full_name: str
    email: EmailStr
    role: str
    is_verified_teacher: bool
    level: Optional[str] = None
    branch: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    full_name: str
    role: str
    is_verified_teacher: Optional[bool] = False
    level: Optional[str] = None
    branch: Optional[str] = None

class UserProfileUpdate(BaseModel):
    full_name: str
    level: Optional[str] = None
    branch: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class CrawlSourceCreate(BaseModel):
    url: str
    site_name: Optional[str] = None
    status: Optional[str] = "active"

class CrawlSourceResponse(BaseModel):
    id: int
    url: str
    site_name: Optional[str] = None
    status: str
    last_crawled_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class CrawlSourcesPagedResponse(BaseModel):
    sources: list[CrawlSourceResponse]
    total: int

class AdminStatsResponse(BaseModel):
    total_searches: int
    total_documents: int
    total_users: int
    crawler_status: str


class PopularSearchItem(BaseModel):
    query: str
    count: int

class RecentSearchItem(BaseModel):
    id: int
    query: str
    searched_at: datetime
    user_email: Optional[str] = None

    class Config:
        from_attributes = True

class SearchStatsDetailResponse(BaseModel):
    popular: list[PopularSearchItem]
    recent: list[RecentSearchItem]

class DocumentRatingResponse(BaseModel):
    liked: bool
    total_ratings: int

class DocumentVerificationResponse(BaseModel):
    is_verified: bool

class DocumentUploadResponse(BaseModel):
    message: str
    document_id: str

class SubscriptionCreate(BaseModel):
    subject: Optional[str] = None
    branch: Optional[str] = None
    level: Optional[str] = None
    teacher: Optional[str] = None

class SubscriptionResponse(BaseModel):
    id: int
    user_id: UUID
    subject: Optional[str] = None
    branch: Optional[str] = None
    level: Optional[str] = None
    teacher: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class NotificationResponse(BaseModel):
    id: int
    user_id: UUID
    document_id: Optional[str] = None
    title: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

from typing import List

class AISettingsGet(BaseModel):
    provider: str
    model_name: str
    has_api_key: bool

class AISettingsUpdate(BaseModel):
    provider: str
    api_key: Optional[str] = None
    model_name: Optional[str] = None

class AIAskRequest(BaseModel):
    question: str
    level: Optional[str] = None
    branch: Optional[str] = None

class AIReferenceItem(BaseModel):
    id: str
    title: str
    url: str

class AIAskResponse(BaseModel):
    answer: str
    references: List[AIReferenceItem]

class QuizGenerateRequest(BaseModel):
    topic: Optional[str] = None
    document_id: Optional[str] = None

class QuizQuestionItem(BaseModel):
    question: str
    options: List[str]
    correct_option: int
    explanation: str

class QuizGenerateResponse(BaseModel):
    questions: List[QuizQuestionItem]



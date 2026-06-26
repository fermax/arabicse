'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Header from '@/components/Header';
import SearchFilters from '@/components/SearchFilters';
import Link from 'next/link';
import styles from './SearchPage.module.css';

const API_BASE = "http://localhost:8080";

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { token, user } = useAuth();

  const q = searchParams.get('q') || '';
  const branch = searchParams.get('branch') || '';
  const subject = searchParams.get('subject') || '';
  const level = searchParams.get('level') || '';
  const file_type = searchParams.get('file_type') || '';
  const wilaya = searchParams.get('wilaya') || '';
  const teacher = searchParams.get('teacher') || '';
  const skip = Number(searchParams.get('skip')) || 0;
  const limit = 10;

  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState({ teachers: [], branches: [], wilayas: [], file_types: [], subjects: [], levels: [] });
  const [loading, setLoading] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [isPersonalized, setIsPersonalized] = useState(false);
  const [searchTime, setSearchTime] = useState('0.00');

  // AI Assistant states
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiReferences, setAiReferences] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiShow, setAiShow] = useState(false);
  const [aiError, setAiError] = useState('');
  const [customQuestion, setCustomQuestion] = useState('');
  const [lastAskedQuestion, setLastAskedQuestion] = useState('');
  const [initialCustomQuestion, setInitialCustomQuestion] = useState('');

  useEffect(() => {
    if (!q) {
      setResults([]);
      setTotal(0);
      return;
    }
    
    // Reset AI Assistant state on new search query
    setAiAnswer('');
    setAiReferences([]);
    setAiShow(false);
    setAiError('');
    setCustomQuestion('');
    setLastAskedQuestion('');
    setInitialCustomQuestion('');
    
    const fetchResults = async () => {
      setLoading(true);
      const startTime = performance.now();
      try {
        let url = `${API_BASE}/api/search?q=${encodeURIComponent(q)}&skip=${skip}&limit=${limit}`;
        if (branch) url += `&branch=${encodeURIComponent(branch)}`;
        if (subject) url += `&subject=${encodeURIComponent(subject)}`;
        if (level) url += `&level=${encodeURIComponent(level)}`;
        if (file_type) url += `&file_type=${encodeURIComponent(file_type)}`;
        if (wilaya) url += `&wilaya=${encodeURIComponent(wilaya)}`;
        if (teacher) url += `&teacher=${encodeURIComponent(teacher)}`;

        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(url, { headers, cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
          setTotal(data.total || 0);
          setFacets(data.facets || { teachers: [], branches: [], wilayas: [], file_types: [], subjects: [], levels: [] });
          setIsFallback(data.is_fallback || false);
          setIsPersonalized(data.is_personalized || false);
        }
      } catch (err) {
        console.error("Error fetching search results:", err);
      } finally {
        const endTime = performance.now();
        setSearchTime(((endTime - startTime) / 1000).toFixed(2));
        setLoading(false);
      }
    };

    fetchResults();
  }, [q, branch, subject, level, file_type, wilaya, teacher, skip, token]);

  const handleAskAI = async (overrideQuestion = null) => {
    const questionToAsk = overrideQuestion || initialCustomQuestion || q;
    if (!questionToAsk) return;
    setAiLoading(true);
    setAiError('');
    setAiAnswer('');
    setAiReferences([]);
    setAiShow(true);
    setLastAskedQuestion(questionToAsk);

    try {
      const res = await fetch(`${API_BASE}/api/ai/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          question: questionToAsk,
          level: level || user?.level || null,
          branch: branch || user?.branch || null
        })
      });

      if (res.ok) {
        const data = await res.json();
        setAiAnswer(data.answer);
        setAiReferences(data.references || []);
        setInitialCustomQuestion('');
      } else {
        const errData = await res.json();
        setAiError(errData.detail || "عذراً، فشل مساعد بيان AI في توليد الإجابة.");
      }
    } catch (err) {
      console.error(err);
      setAiError("فشل الاتصال بالخادم الذكي. يرجى التحقق من اتصالك بالإنترنت.");
    } finally {
      setAiLoading(false);
    }
  };

  const parseInlineMarkdown = (text) => {
    let formatted = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return formatted;
  };

  const renderMarkdown = (text) => {
    if (!text) return '';
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      let trimmed = line.trim();
      if (trimmed.startsWith('### ')) {
        return <h4 key={idx} style={{ margin: '12px 0 8px 0', fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--primary)' }}>{trimmed.substring(4)}</h4>;
      }
      if (trimmed.startsWith('## ')) {
        return <h3 key={idx} style={{ margin: '16px 0 10px 0', fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary)' }}>{trimmed.substring(3)}</h3>;
      }
      if (trimmed.startsWith('# ')) {
        return <h2 key={idx} style={{ margin: '20px 0 12px 0', fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--primary)' }}>{trimmed.substring(2)}</h2>;
      }
      if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        const cleanText = trimmed.substring(2);
        return <li key={idx} style={{ marginRight: '20px', listStyleType: 'disc', margin: '4px 20px 4px 0' }} dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(cleanText) }} />;
      }
      const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
      if (numMatch) {
        return <div key={idx} style={{ marginRight: '10px', margin: '6px 10px 6px 0' }}><span style={{ fontWeight: 'bold', marginLeft: '6px' }}>{numMatch[1]}.</span><span dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(numMatch[2]) }} /></div>;
      }
      if (trimmed === '') return <div key={idx} style={{ height: '8px' }} />;
      return <p key={idx} style={{ margin: '6px 0', lineHeight: '1.6' }} dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(trimmed) }} />;
    });
  };

  const handleRate = async (docId) => {
    if (!token) {
      alert("الرجاء تسجيل الدخول أولاً للإعجاب بالمستند.");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/documents/${docId}/rate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setResults(prev => prev.map(item => {
          if (item.id === docId) {
            return { ...item, user_liked: data.liked, rating_count: data.total_ratings };
          }
          return item;
        }));
      }
    } catch (err) {
      console.error("Error rating document:", err);
    }
  };

  const handleVerify = async (docId) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/documents/${docId}/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setResults(prev => prev.map(item => {
          if (item.id === docId) {
            return { ...item, is_verified: data.is_verified };
          }
          return item;
        }));
      }
    } catch (err) {
      console.error("Error verifying document:", err);
    }
  };

  const handleDelete = async (docId) => {
    if (!token) return;
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذا المستند نهائياً من محرك البحث؟")) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/documents/${docId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setResults(prev => prev.filter(item => item.id !== docId));
        alert("تم حذف المستند بنجاح.");
      } else {
        const errData = await res.json();
        alert(`فشل حذف المستند: ${errData.detail || 'خطأ غير معروف'}`);
      }
    } catch (err) {
      console.error("Error deleting document:", err);
      alert("حدث خطأ أثناء الاتصال بالخادم لحذف المستند.");
    }
  };

  const formatDocType = (type) => {
    switch (type) {
      case 'lesson': return 'درس / ملخص';
      case 'exam': return 'موضوع اختبار';
      case 'book': return 'كتاب مدرسي';
      case 'summary': return 'ملخص';
      case 'exercise': return 'تمرين';
      case 'شرح فيديو': return 'شرح فيديو';
      default: return type;
    }
  };

  // Pagination calculation
  const currentPage = Math.floor(skip / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const startPage = Math.max(1, currentPage - 3);
  const endPage = Math.min(totalPages, currentPage + 3);
  
  const pages = [];
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  const getPageLink = (s) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (branch) params.set('branch', branch);
    if (subject) params.set('subject', subject);
    if (level) params.set('level', level);
    if (file_type) params.set('file_type', file_type);
    if (wilaya) params.set('wilaya', wilaya);
    if (teacher) params.set('teacher', teacher);
    params.set('skip', s);
    return `/search?${params.toString()}`;
  };

  return (
    <div className={styles.pageContainer}>
      <Header query={q} />

      <div className={styles.searchLayout} dir="rtl">
        <main className={styles.mainContent}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: '15px' }}>
            <div className={styles.stats} style={{ marginBottom: 0 }}>
              {loading ? 'جاري تحميل النتائج...' : `حوالي ${total} نتيجة (${searchTime} ثانية)`}
            </div>
            {!loading && isPersonalized && (
              <div className={styles.personalizedBadge} title="تم ترتيب وتخصيص هذه النتائج تلقائياً بناءً على طورك وشعبتك لتقديم المساعدة القصوى لك.">
                ✨ نتائج مخصصة لطورك وشعبتك
              </div>
            )}
          </div>

          {/* AI Assistant RAG Box */}
          {q && (
            <div className={styles.aiBox}>
              {!aiShow ? (
                <div className={styles.aiPromptCard}>
                  <div className={styles.aiPromptHeaderRow} onClick={() => handleAskAI(q)}>
                    <div className={styles.aiPromptIcon}>✨</div>
                    <div className={styles.aiPromptText}>
                      <h4>اسأل مساعد بيان AI حول "{q}"</h4>
                      <p>احصل على تلخيص ذكي وإجابة فورية مبنية على الدروس والمناهج المعتمدة بالمنصة.</p>
                    </div>
                    <button className={styles.aiPromptBtn}>اسأل المساعد 🤖</button>
                  </div>
                  
                  <div className={styles.aiPromptInputWrapper}>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      if (initialCustomQuestion.trim()) {
                        handleAskAI(initialCustomQuestion.trim());
                      }
                    }} className={styles.aiPromptForm}>
                      <input
                        type="text"
                        value={initialCustomQuestion}
                        onChange={(e) => setInitialCustomQuestion(e.target.value)}
                        placeholder="أو اكتب سؤالاً مخصصاً هنا للذكاء الاصطناعي..."
                        className={styles.aiPromptInput}
                      />
                      <button type="submit" className={styles.aiPromptSubmitBtn} disabled={!initialCustomQuestion.trim()}>
                        إرسال سؤال
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <div className={styles.aiCard}>
                  <div className={styles.aiCardHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={styles.aiCardIcon}>✨</span>
                      <span className={styles.aiCardTitle}>
                        {lastAskedQuestion ? `مساعد بيان AI: "${lastAskedQuestion}"` : 'مساعد الدراسة الذكي (بيان AI)'}
                      </span>
                    </div>
                    <button className={styles.aiCloseBtn} onClick={() => setAiShow(false)}>&times;</button>
                  </div>
                  
                  <div className={styles.aiCardBody}>
                    {aiLoading ? (
                      <div className={styles.aiLoadingContainer}>
                        <div className={styles.aiSpinner} />
                        <p>جاري البحث في الدروس والمستندات وتلخيص المحتوى بالذكاء الاصطناعي...</p>
                      </div>
                    ) : aiError ? (
                      <div className={styles.aiErrorText}>❌ {aiError}</div>
                    ) : (
                      <>
                        <div className={styles.aiAnswerContent}>
                          {renderMarkdown(aiAnswer)}
                        </div>
                        
                        {aiReferences.length > 0 && (
                          <div className={styles.aiReferencesContainer}>
                            <h5 className={styles.aiReferencesTitle}>📚 المستندات المرجعية المستخدمة:</h5>
                            <div className={styles.aiReferencesList}>
                              {aiReferences.map((ref, i) => (
                                <a 
                                  key={ref.id} 
                                  href={ref.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className={styles.aiReferenceLink}
                                >
                                  {i + 1}. {ref.title}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {!aiLoading && !aiError && (
                    <div className={styles.aiFollowUpContainer}>
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        if (customQuestion.trim()) {
                          handleAskAI(customQuestion.trim());
                          setCustomQuestion('');
                        }
                      }} className={styles.aiFollowUpForm}>
                        <input
                          type="text"
                          value={customQuestion}
                          onChange={(e) => setCustomQuestion(e.target.value)}
                          placeholder="اسأل سؤالاً آخر أو تابع الحوار..."
                          className={styles.aiFollowUpInput}
                          disabled={aiLoading}
                        />
                        <button type="submit" className={styles.aiFollowUpSubmitBtn} disabled={aiLoading || !customQuestion.trim()}>
                          إرسال ⚡
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Google AdSense - Top Leaderboard Ad */}
          <div className={styles.adContainerTop}>
            <ins className="adsbygoogle"
                 style={{ display: 'block', height: '90px' }}
                 data-ad-client="ca-pub-mock"
                 data-ad-slot="1111111111"
                 data-ad-format="horizontal"
                 data-full-width-responsive="true"></ins>
            <div className={styles.adPlaceholder}>
              <span className={styles.adLabel}>إعلان ممول</span>
              <p className={styles.adPlaceholderText}>مساحة إعلانية متجاوبة (Google AdSense - Leaderboard 728x90)</p>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '50px 0', fontSize: '1.2rem', color: 'var(--secondary-text)' }}>
              جاري البحث وفهرسة النتائج...
            </div>
          ) : results.length === 0 ? (
            <div className={styles.noResults}>
              <p>لم ينجح بحثك عن <strong>{q}</strong> في إظهار أي نتائج.</p>
              <ul>
                <li>تأكد من كتابة الكلمات بشكل صحيح.</li>
                <li>حاول كلمات مفتاحية مختلفة.</li>
                <li>حاول كلمات مفتاحية أكثر عمومية.</li>
              </ul>
            </div>
          ) : (
            <>
              {isFallback && (
                <div className={styles.fallbackWarning}>
                  ⚠️ لا توجد نتائج تطابق بحثك تماماً عن <strong>{q}</strong>، ولكن قد تجد هذه النتائج المشابهة مفيدة:
                </div>
              )}
              <div className={styles.resultsList}>
                {results.map((item, index) => {
                  const isVideo = item.file_type === 'شرح فيديو' || item.url.includes('youtube.com') || item.url.includes('youtu.be');
                  return (
                    <div key={index} className={styles.resultItemWrapper}>
                      <div className={styles.resultItem}>
                        <div className={styles.resultUrl}>
                          {isVideo && <span style={{ marginLeft: '6px', color: '#ff0000' }}>🎬</span>}
                          {item.url}
                        </div>
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className={styles.resultTitle}>
                          <h3>
                            {isVideo && <span style={{ marginLeft: '8px', color: '#ff0000' }}>▶</span>}
                            {item.title}
                          </h3>
                        </a>
                        <p className={styles.resultSnippet} 
                           dangerouslySetInnerHTML={{ __html: item.highlight || item.content?.substring(0, 160) + '...' }} />
                        <div className={styles.tags}>
                          <span className={styles.tag}>{formatDocType(item.file_type)}</span>
                          <span className={styles.tag}>{item.branch}</span>
                          <span className={styles.tag}>{item.teacher}</span>
                          <span className={styles.tag}>{item.wilaya}</span>
                          
                          {/* Rating button */}
                          <button 
                            onClick={() => handleRate(item.id)} 
                            className={`${styles.rateBtn} ${item.user_liked ? styles.rateBtnLiked : ''}`}
                            title="إعجاب بالمستند"
                          >
                            👍 {item.rating_count}
                          </button>

                          {/* Verification Badge */}
                          {item.is_verified ? (
                            <span className={styles.verifiedBadge} title="مستند معتمد وموثق">
                              ✅ معتمد
                            </span>
                          ) : (
                            (user?.role === 'admin' || (user?.role === 'teacher' && user?.is_verified_teacher)) && (
                              <button 
                                onClick={() => handleVerify(item.id)} 
                                className={styles.verifyBtn}
                                title="اعتماد هذا المستند"
                              >
                                🛡️ اعتماد
                              </button>
                            )
                          )}

                          {/* Delete Button for Admin */}
                          {user?.role === 'admin' && (
                            <button 
                              onClick={() => handleDelete(item.id)} 
                              className={styles.deleteBtn}
                              title="حذف هذا المستند نهائياً"
                            >
                              🗑️ حذف
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Google AdSense - In-feed Ad after the 3rd result */}
                      {index === 2 && (
                        <div className={styles.adContainerInFeed}>
                          <ins className="adsbygoogle"
                               style={{ display: 'block' }}
                               data-ad-format="fluid"
                               data-ad-layout-key="-gw-3+1f-3d+2z"
                               data-ad-client="ca-pub-mock"
                               data-ad-slot="2222222222"></ins>
                          <div className={styles.adPlaceholder}>
                            <span className={styles.adLabel}>إعلان</span>
                            <div className={styles.adInFeedContent}>
                              <div className={styles.adInFeedImage}></div>
                              <div className={styles.adInFeedText}>
                                <h4>المحرك الأول للتعليم الثانوي في الجزائر - بيان</h4>
                                <p>احصل على أحدث الدروس والملخصات المعتمدة وتابع قنوات أفضل الأساتذة في كافة التخصصات مجاناً.</p>
                                <span className={styles.adUrl}>bayan.dz</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pagination Bar */}
              {totalPages > 1 && (
                <div className={styles.pagination} dir="rtl">
                  {currentPage > 1 && (
                    <Link href={getPageLink((currentPage - 2) * limit)} className={styles.pageBtn}>
                      السابق
                    </Link>
                  )}
                  
                  {startPage > 1 && (
                    <>
                      <Link href={getPageLink(0)} className={styles.pageBtn}>
                        1
                      </Link>
                      {startPage > 2 && <span className={styles.pageEllipsis}>...</span>}
                    </>
                  )}
                  
                  {pages.map((p) => (
                    <Link 
                      key={p} 
                      href={getPageLink((p - 1) * limit)} 
                      className={currentPage === p ? styles.activePage : styles.pageBtn}
                    >
                      {p}
                    </Link>
                  ))}
                  
                  {endPage < totalPages && (
                    <>
                      {endPage < totalPages - 1 && <span className={styles.pageEllipsis}>...</span>}
                      <Link href={getPageLink((totalPages - 1) * limit)} className={styles.pageBtn}>
                        {totalPages}
                      </Link>
                    </>
                  )}

                  {currentPage < totalPages && (
                    <Link href={getPageLink(currentPage * limit)} className={styles.pageBtn}>
                      التالي
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </main>

        <div className={styles.sidebarWrapper}>
          <SearchFilters facets={facets} />

          {/* Google AdSense - Sidebar Ad */}
          <div className={styles.adContainerSidebar}>
            <ins className="adsbygoogle"
                 style={{ display: 'block' }}
                 data-ad-client="ca-pub-mock"
                 data-ad-slot="3333333333"
                 data-ad-format="auto"
                 data-full-width-responsive="true"></ins>
            <div className={styles.adPlaceholder}>
              <span className={styles.adLabel}>إعلان</span>
              <p className={styles.adPlaceholderText}>مساحة إعلانية جانبية (Google AdSense - 300x250)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontSize: '1.2rem', color: 'var(--secondary-text)' }}>
        جاري تحميل نتائج البحث...
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}

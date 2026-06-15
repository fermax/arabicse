'use client';

import { useState, useEffect } from 'react';
import styles from './Admin.module.css';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

const API_BASE = "http://localhost:8080";

export default function AdminDashboard() {
  const { token, user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('stats'); // 'stats', 'users', 'documents', 'searches'
  
  // Dashboard stats and sources
  const [stats, setStats] = useState({
    total_searches: 0,
    total_documents: 0,
    total_users: 0,
    crawler_status: 'inactive'
  });
  const [searchStats, setSearchStats] = useState({ popular: [], recent: [] });
  const [searchStatsLoading, setSearchStatsLoading] = useState(false);
  const [sources, setSources] = useState([]);
  const [totalSources, setTotalSources] = useState(0);
  const [loading, setLoading] = useState(true);

  // Sources pagination states
  const [sourcesPage, setSourcesPage] = useState(1);
  const sourcesPerPage = 5;
  const [error, setError] = useState(null);
  
  // Modal states for crawler sources
  const [showModal, setShowModal] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  const [formData, setFormData] = useState({
    site_name: '',
    url: '',
    status: 'active'
  });
  
  // Crawler toggling state
  const [crawlerActionLoading, setCrawlerActionLoading] = useState(false);

  // User Management states
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormData, setUserFormData] = useState({
    full_name: '',
    role: 'student',
    is_verified_teacher: false
  });

  // Archived Documents states
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docTotal, setDocTotal] = useState(0);
  const [docSearch, setDocSearch] = useState('');
  const [docSkip, setDocSkip] = useState(0);
  const docLimit = 15;

  // AI Settings states
  const [aiProvider, setAiProvider] = useState('mock');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (!token || !user || user.role !== 'admin') return;

    // Initial fetch
    fetchStats();
    if (activeTab === 'stats') {
      fetchSources(sourcesPage);
    } else if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'documents') {
      fetchDocuments(docSearch, docSkip);
    } else if (activeTab === 'searches') {
      fetchSearchStats();
    } else if (activeTab === 'ai_settings') {
      fetchAiSettings();
    }
  }, [activeTab, token, user, sourcesPage]);

  // Polling stats in background
  useEffect(() => {
    if (!token || !user || user.role !== 'admin') return;
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [token, user]);

  // Adjust page number if it exceeds total pages after a change in sources
  useEffect(() => {
    const totalPages = Math.ceil(totalSources / sourcesPerPage);
    if (sourcesPage > totalPages && totalPages > 0) {
      setSourcesPage(totalPages);
      fetchSources(totalPages);
    }
  }, [totalSources, sourcesPage]);

  const fetchStats = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        setError(null);
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
      setError("فشل الاتصال بالواجهة الخلفية (FastAPI). تأكد من تشغيل الخادم.");
    }
  };

  const fetchSources = async (pageVal = sourcesPage) => {
    if (!token) return;
    setLoading(true);
    try {
      const skipVal = (pageVal - 1) * sourcesPerPage;
      const res = await fetch(`${API_BASE}/api/admin/sources?limit=${sourcesPerPage}&skip=${skipVal}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSources(data.sources || []);
        setTotalSources(data.total || 0);
      }
    } catch (err) {
      console.error("Error fetching sources:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!token) return;
    setUsersLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchSearchStats = async () => {
    if (!token) return;
    setSearchStatsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/search-stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSearchStats(data);
      }
    } catch (err) {
      console.error("Error fetching search stats:", err);
    } finally {
      setSearchStatsLoading(false);
    }
  };

  const handleClearSearchStats = async () => {
    if (!token) return;
    if (!confirm("هل أنت متأكد من رغبتك في مسح سجل البحث بالكامل؟ لا يمكن التراجع عن هذا الإجراء.")) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/search-stats/clear`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        alert("تم مسح سجل البحث بنجاح.");
        await fetchSearchStats();
        await fetchStats();
      } else {
        alert("فشل مسح سجل البحث.");
      }
    } catch (err) {
      console.error(err);
      alert("فشل الاتصال بالخادم لمسح سجل البحث.");
    }
  };

  const fetchDocuments = async (searchVal = '', skipVal = 0) => {
    if (!token) return;
    setDocsLoading(true);
    try {
      const queryParam = searchVal ? `&q=${encodeURIComponent(searchVal)}` : '';
      const res = await fetch(`${API_BASE}/api/admin/documents?limit=${docLimit}&skip=${skipVal}${queryParam}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
        setDocTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Error fetching documents:", err);
    } finally {
      setDocsLoading(false);
    }
  };

  const fetchAiSettings = async () => {
    if (!token) return;
    setAiLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/ai-settings`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setAiProvider(data.provider);
        setAiModel(data.model_name);
        setHasApiKey(data.has_api_key);
        setAiApiKey(''); // clear dirty key
      }
    } catch (err) {
      console.error("Error fetching AI settings:", err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveAiSettings = async (e) => {
    e.preventDefault();
    if (!token) return;
    setAiLoading(true);
    setAiMessage({ type: '', text: '' });
    try {
      const payload = {
        provider: aiProvider,
        model_name: aiModel || null
      };
      if (aiApiKey) {
        payload.api_key = aiApiKey;
      }
      
      const res = await fetch(`${API_BASE}/api/admin/ai-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        setAiMessage({ type: 'success', text: 'تم تحديث إعدادات الذكاء الاصطناعي بنجاح!' });
        setAiApiKey('');
        fetchAiSettings();
        setTimeout(() => setAiMessage({ type: '', text: '' }), 4000);
      } else {
        const errData = await res.json();
        setAiMessage({ type: 'error', text: errData.detail || 'فشل تحديث إعدادات الذكاء الاصطناعي.' });
      }
    } catch (err) {
      console.error("Error saving AI settings:", err);
      setAiMessage({ type: 'error', text: 'فشل الاتصال بالخادم لحفظ الإعدادات.' });
    } finally {
      setAiLoading(false);
    }
  };

  // --- Source CRUD Handlers ---
  const handleOpenAddModal = () => {
    setEditingSource(null);
    setFormData({ site_name: '', url: '', status: 'active' });
    setShowModal(true);
  };

  const handleOpenEditModal = (source) => {
    setEditingSource(source);
    setFormData({
      site_name: source.site_name || '',
      url: source.url,
      status: source.status
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingSource(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.url || !token) return;

    try {
      let url = `${API_BASE}/api/admin/sources`;
      let method = 'POST';
      
      if (editingSource) {
        url = `${API_BASE}/api/admin/sources/${editingSource.id}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        await fetchSources();
        handleCloseModal();
      } else {
        const errData = await res.json();
        alert(errData.detail || "حدث خطأ أثناء حفظ المصدر.");
      }
    } catch (err) {
      console.error(err);
      alert("فشل حفظ المصدر بسبب مشكلة في الشبكة.");
    }
  };

  const handleDeleteSource = async (id) => {
    if (!token) return;
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذا المصدر؟")) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/sources/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        await fetchSources();
      } else {
        alert("فشل حذف المصدر.");
      }
    } catch (err) {
      console.error(err);
      alert("فشل الاتصال بالخادم لحذف المصدر.");
    }
  };

  // --- Crawler Control ---
  const handleToggleCrawler = async () => {
    if (!token) return;
    setCrawlerActionLoading(true);
    const action = stats.crawler_status === 'active' ? 'stop' : 'start';
    try {
      const res = await fetch(`${API_BASE}/api/admin/crawler/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        await fetchStats();
      } else {
        alert("فشلت عملية التحكم بالزاحف.");
      }
    } catch (err) {
      console.error(err);
      alert("فشل الاتصال بالخادم للتحكم بالزاحف.");
    } finally {
      setCrawlerActionLoading(false);
    }
  };

  // --- Users CRUD Handlers ---
  const handleOpenEditUserModal = (user) => {
    setEditingUser(user);
    setUserFormData({
      full_name: user.full_name || '',
      role: user.role,
      is_verified_teacher: user.is_verified_teacher || false
    });
  };

  const handleUserInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setUserFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleUpdateUserSubmit = async (e) => {
    e.preventDefault();
    if (!editingUser || !token) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(userFormData)
      });

      if (res.ok) {
        await fetchUsers();
        setEditingUser(null);
      } else {
        alert("فشل تعديل المستخدم.");
      }
    } catch (err) {
      console.error(err);
      alert("فشل الاتصال بالخادم لتعديل بيانات العضو.");
    }
  };

  const handleDeleteUser = async (id) => {
    if (!token) return;
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذا العضو؟")) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        await fetchUsers();
        await fetchStats(); // Update user count stat
      } else {
        alert("فشل حذف المستخدم.");
      }
    } catch (err) {
      console.error(err);
      alert("فشل الاتصال بالخادم لحذف العضو.");
    }
  };

  // --- Document CRUD Handlers ---
  const handleDocSearchSubmit = (e) => {
    e.preventDefault();
    setDocSkip(0);
    fetchDocuments(docSearch, 0);
  };

  const handleDocPageChange = (direction) => {
    let newSkip = docSkip;
    if (direction === 'next' && docSkip + docLimit < docTotal) {
      newSkip = docSkip + docLimit;
    } else if (direction === 'prev' && docSkip - docLimit >= 0) {
      newSkip = docSkip - docLimit;
    }
    setDocSkip(newSkip);
    fetchDocuments(docSearch, newSkip);
  };

  const handleDeleteDocument = async (id) => {
    if (!token) return;
    if (!confirm("هل أنت متأكد من رغبتك في إزالة هذا المستند من الأرشيف نهائياً؟")) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/documents/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        await fetchDocuments(docSearch, docSkip);
        await fetchStats(); // Update document count stat
      } else {
        alert("فشل إزالة المستند.");
      }
    } catch (err) {
      console.error(err);
      alert("فشل الاتصال بالخادم لحذف المستند.");
    }
  };

  const formatDocType = (type) => {
    switch (type) {
      case 'lesson': return 'درس / ملخص';
      case 'exam': return 'موضوع اختبار';
      case 'book': return 'كتاب مدرسي';
      default: return type;
    }
  };

  const totalSourcesPages = Math.ceil(totalSources / sourcesPerPage);
  const paginatedSources = sources;

  // Enforce access control guard
  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontSize: '1.2rem', color: 'var(--secondary-text)' }}>
        جاري تحميل بيانات المصادقة...
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', textAlign: 'center', padding: '20px' }} dir="rtl">
        <div style={{ fontSize: '3.5rem', marginBottom: '20px' }}>🔒</div>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '10px', color: 'var(--foreground)' }}>وصول غير مصرح به</h2>
        <p style={{ color: 'var(--secondary-text)', maxWidth: '500px', marginBottom: '25px', lineHeight: '1.6' }}>
          عذراً، لوحة تحكم الإدارة مخصصة فقط لمدراء محرك بيان التعليمي. يرجى تسجيل الدخول بحساب مشرف مفعّل للوصول للميزات والخيارات المتقدمة.
        </p>
        <Link href="/" style={{ padding: '10px 24px', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '24px', fontWeight: 'bold', textDecoration: 'none', transition: 'background-color 0.2s' }}>
          العودة للمحرك الرئيسي
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.adminContainer} dir="rtl">
      <aside className={styles.sidebar}>
        <div className={styles.brand}>بيان - لوحة التحكم</div>
        <nav className={styles.nav}>
          <button 
            onClick={() => setActiveTab('stats')} 
            className={`${styles.navLink} ${activeTab === 'stats' ? styles.active : ''}`}
            style={{background: 'none', border: 'none', cursor: 'pointer', textAlign: 'right', width: '100%', fontFamily: 'inherit'}}
          >
            نظرة عامة والزاحف
          </button>
          <button 
            onClick={() => setActiveTab('users')} 
            className={`${styles.navLink} ${activeTab === 'users' ? styles.active : ''}`}
            style={{background: 'none', border: 'none', cursor: 'pointer', textAlign: 'right', width: '100%', fontFamily: 'inherit'}}
          >
            إدارة الأعضاء
          </button>
          <button 
            onClick={() => setActiveTab('documents')} 
            className={`${styles.navLink} ${activeTab === 'documents' ? styles.active : ''}`}
            style={{background: 'none', border: 'none', cursor: 'pointer', textAlign: 'right', width: '100%', fontFamily: 'inherit'}}
          >
            المحتوى المؤرشف
          </button>
          <button 
            onClick={() => setActiveTab('searches')} 
            className={`${styles.navLink} ${activeTab === 'searches' ? styles.active : ''}`}
            style={{background: 'none', border: 'none', cursor: 'pointer', textAlign: 'right', width: '100%', fontFamily: 'inherit'}}
          >
            إحصائيات البحث الكلية
          </button>
          <button 
            onClick={() => setActiveTab('ai_settings')} 
            className={`${styles.navLink} ${activeTab === 'ai_settings' ? styles.active : ''}`}
            style={{background: 'none', border: 'none', cursor: 'pointer', textAlign: 'right', width: '100%', fontFamily: 'inherit'}}
          >
            إعدادات الذكاء الاصطناعي 🤖
          </button>
          <Link href="/" className={styles.navLink} style={{marginTop: 'auto'}}>العودة للمحرك</Link>
        </nav>
      </aside>

      <main className={styles.mainContent}>
        <header className={styles.header}>
          <h2>
            {activeTab === 'stats' ? 'نظرة عامة على النظام' : 
             activeTab === 'users' ? 'إدارة أعضاء المنصة' : 
             activeTab === 'ai_settings' ? 'إعدادات الذكاء الاصطناعي ومزودي الخدمة' :
             activeTab === 'searches' ? 'سجل وإحصائيات البحث الكلية' :
             'سجل المحتوى المؤرشف'}
          </h2>
          <div className={styles.userProfile}>المدير: Admin</div>
        </header>

        {error && (
          <div style={{ padding: '15px', backgroundColor: '#fce8e6', color: '#c5221f', borderRadius: '8px', marginBottom: '20px', fontWeight: '500' }}>
            {error}
          </div>
        )}

        {/* Stats Grid - Shared */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <h3>عمليات البحث الكلية</h3>
            <p className={styles.statValue}>{stats.total_searches}</p>
          </div>
          <div className={styles.statCard}>
            <h3>المستندات المؤرشفة</h3>
            <p className={styles.statValue}>{stats.total_documents}</p>
          </div>
          <div className={styles.statCard}>
            <h3>الأعضاء المسجلين</h3>
            <p className={styles.statValue}>{stats.total_users}</p>
          </div>
          <div className={styles.statCard}>
            <h3>حالة الزاحف</h3>
            <p className={styles.statValue} style={{color: stats.crawler_status === 'active' ? '#34a853' : '#ea4335'}}>
              {stats.crawler_status === 'active' ? 'نشط' : 'متوقف'}
            </p>
            <button 
              onClick={handleToggleCrawler} 
              disabled={crawlerActionLoading}
              className={stats.crawler_status === 'active' ? styles.btnStop : styles.btnStart}
            >
              {crawlerActionLoading ? 'جاري المعالجة...' : (stats.crawler_status === 'active' ? 'إيقاف الزاحف' : 'تشغيل الزاحف')}
            </button>
          </div>
        </div>

        {/* TAB 1: Overview & Crawler Sources */}
        {activeTab === 'stats' && (
          <section className={styles.section}>
            <h3>المواقع المصدرية للزحف</h3>
            {loading ? (
              <p>جاري تحميل البيانات...</p>
            ) : (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>اسم الموقع</th>
                      <th>الرابط الأساسي</th>
                      <th>الحالة</th>
                      <th>آخر أرشفة</th>
                      <th>إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', color: '#9aa0a6' }}>لا توجد مواقع مصدرية مضافة حالياً.</td>
                      </tr>
                    ) : (
                      paginatedSources.map((source) => (
                        <tr key={source.id}>
                          <td>{source.site_name || 'بدون اسم'}</td>
                          <td><a href={source.url} target="_blank" rel="noopener noreferrer" style={{color: '#1a73e8', textDecoration: 'none'}}>{source.url}</a></td>
                          <td>
                            <span className={source.status === 'active' ? styles.badgeSuccess : styles.badgeError}>
                              {source.status === 'active' ? 'نشط' : 'معطل'}
                            </span>
                          </td>
                          <td>
                            {source.last_crawled_at 
                              ? new Date(source.last_crawled_at).toLocaleString('ar-DZ') 
                              : 'لم يُزحف بعد'}
                          </td>
                          <td>
                            <div className={styles.actionsCell}>
                              <button onClick={() => handleOpenEditModal(source)} className={styles.btnSm}>تعديل</button>
                              <button onClick={() => handleDeleteSource(source.id)} className={styles.btnDanger}>حذف</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Sources Pagination */}
            {totalSourcesPages > 1 && (
              <div className={styles.paginationContainer} style={{ marginTop: '15px', marginBottom: '15px' }}>
                <button 
                  onClick={() => setSourcesPage(prev => Math.max(1, prev - 1))} 
                  disabled={sourcesPage === 1}
                  className={styles.paginationBtn}
                >
                  ← السابق
                </button>
                <span className={styles.pageIndicator}>
                  صفحة {sourcesPage} من {totalSourcesPages} (مجموع المواقع: {totalSources})
                </span>
                <button 
                  onClick={() => setSourcesPage(prev => Math.min(totalSourcesPages, prev + 1))} 
                  disabled={sourcesPage === totalSourcesPages}
                  className={styles.paginationBtn}
                >
                  التالي →
                </button>
              </div>
            )}

            <button onClick={handleOpenAddModal} className={styles.btnAdd}>+ إضافة موقع جديد</button>
          </section>
        )}

        {/* TAB 2: User Management */}
        {activeTab === 'users' && (
          <section className={styles.section}>
            <h3>قائمة الأعضاء والطلبة والأساتذة</h3>
            {usersLoading ? (
              <p>جاري تحميل قائمة الأعضاء...</p>
            ) : (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>الاسم الكامل</th>
                      <th>البريد الإلكتروني</th>
                      <th>الصلاحية / الدور</th>
                      <th>تاريخ التسجيل</th>
                      <th>إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', color: '#9aa0a6' }}>لا يوجد أعضاء مسجلين بعد.</td>
                      </tr>
                    ) : (
                      users.map((u) => (
                        <tr key={u.id}>
                          <td>{u.full_name || 'بدون اسم'}</td>
                          <td>{u.email}</td>
                          <td>
                            <span className={
                              u.role === 'admin' ? styles.badgeError : 
                              u.role === 'teacher' ? styles.badgeSuccess : 
                              styles.badgeSuccess
                            } style={{ 
                              backgroundColor: u.role === 'admin' ? '#fce8e6' : u.role === 'teacher' ? '#e8f0fe' : '#e6f4ea',
                              color: u.role === 'admin' ? '#c5221f' : u.role === 'teacher' ? '#1a73e8' : '#137333'
                            }}>
                              {u.role === 'admin' ? 'مدير' : u.role === 'teacher' ? 'أستاذ' : 'طالب'}
                            </span>
                            {u.role === 'teacher' && u.is_verified_teacher && (
                              <span className={styles.badgeSuccess} style={{ marginRight: '8px' }} title="تم توثيق الحساب من قِبل الإدارة">
                                ✔ موثق
                              </span>
                            )}
                          </td>
                          <td>{new Date(u.created_at).toLocaleDateString('ar-DZ')}</td>
                          <td>
                            <div className={styles.actionsCell}>
                              <button onClick={() => handleOpenEditUserModal(u)} className={styles.btnSm}>تعديل</button>
                              <button onClick={() => handleDeleteUser(u.id)} className={styles.btnDanger}>حذف</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* TAB 3: Archived Content */}
        {activeTab === 'documents' && (
          <section className={styles.section}>
            <h3>المحتوى والصفحات المؤرشفة في الفهرس</h3>
            
            {/* Search Bar */}
            <form onSubmit={handleDocSearchSubmit} className={styles.searchBarContainer}>
              <input 
                type="text" 
                placeholder="ابحث في المحتوى المؤرشف..."
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                className={styles.searchBarInput}
              />
              <button type="submit" className={styles.searchBarBtn}>تصفية</button>
            </form>

            {docsLoading ? (
              <p>جاري تحميل المحتوى المؤرشف...</p>
            ) : (
              <>
                <div className={styles.tableContainer}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>عنوان الصفحة</th>
                        <th>النوع</th>
                        <th>الرابط</th>
                        <th>تاريخ الأرشفة</th>
                        <th>إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', color: '#9aa0a6' }}>لا يوجد محتوى مؤرشف يطابق الفلتر حالياً.</td>
                        </tr>
                      ) : (
                        documents.map((doc) => (
                          <tr key={doc.id}>
                            <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.title}>
                              {doc.title}
                            </td>
                            <td>
                              <span style={{ fontSize: '0.85rem', color: '#5f6368' }}>
                                {formatDocType(doc.type)}
                              </span>
                            </td>
                            <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ color: '#1a73e8', textDecoration: 'none' }} title={doc.url}>
                                {doc.url}
                              </a>
                            </td>
                            <td>
                              {doc.crawled_at 
                                ? new Date(doc.crawled_at).toLocaleString('ar-DZ') 
                                : 'غير متوفر'}
                            </td>
                            <td>
                              <div className={styles.actionsCell}>
                                <button onClick={() => handleDeleteDocument(doc.id)} className={styles.btnDanger}>إزالة</button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {docTotal > docLimit && (
                  <div className={styles.paginationContainer}>
                    <button 
                      onClick={() => handleDocPageChange('prev')} 
                      disabled={docSkip === 0}
                      className={styles.paginationBtn}
                    >
                      ← السابق
                    </button>
                    <span className={styles.pageIndicator}>
                      عرض {docSkip + 1} - {Math.min(docSkip + docLimit, docTotal)} من أصل {docTotal}
                    </span>
                    <button 
                      onClick={() => handleDocPageChange('next')} 
                      disabled={docSkip + docLimit >= docTotal}
                      className={styles.paginationBtn}
                    >
                      التالي →
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* TAB 4: Search statistics */}
        {activeTab === 'searches' && (
          <section className={styles.section}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>سجل وإحصائيات البحث الكلية في المنصة</h3>
              <button onClick={handleClearSearchStats} className={styles.btnDanger}>
                مسح سجل البحث بالكامل
              </button>
            </div>

            {searchStatsLoading ? (
              <p>جاري تحميل إحصائيات البحث...</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
                
                {/* Popular searches */}
                <div>
                  <h4 style={{ marginBottom: '15px', fontSize: '1.1rem', color: '#1a73e8', borderBottom: '1px solid #dfe1e5', paddingBottom: '8px' }}>الكلمات الأكثر بحثاً (الشعبية)</h4>
                  <div className={styles.tableContainer}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>الكلمة المفتاحية</th>
                          <th>تكرار البحث</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchStats.popular.length === 0 ? (
                          <tr>
                            <td colSpan="2" style={{ textAlign: 'center', color: '#9aa0a6' }}>لا توجد بيانات متاحة.</td>
                          </tr>
                        ) : (
                          searchStats.popular.map((item, index) => (
                            <tr key={index}>
                              <td style={{ fontWeight: '500' }}>{item.query}</td>
                              <td>
                                <span className={styles.badgeSuccess} style={{ backgroundColor: '#e8f0fe', color: '#1a73e8', padding: '4px 10px', borderRadius: '12px' }}>
                                  {item.count} مرة
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Recent searches */}
                <div>
                  <h4 style={{ marginBottom: '15px', fontSize: '1.1rem', color: '#1a73e8', borderBottom: '1px solid #dfe1e5', paddingBottom: '8px' }}>آخر عمليات البحث</h4>
                  <div className={styles.tableContainer}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>الكلمة المفتاحية</th>
                          <th>تاريخ البحث</th>
                          <th>المستخدم</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchStats.recent.length === 0 ? (
                          <tr>
                            <td colSpan="3" style={{ textAlign: 'center', color: '#9aa0a6' }}>لا توجد عمليات بحث مسجلة بعد.</td>
                          </tr>
                        ) : (
                          searchStats.recent.map((item) => (
                            <tr key={item.id}>
                              <td>{item.query}</td>
                              <td>{new Date(item.searched_at).toLocaleString('ar-DZ')}</td>
                              <td>
                                {item.user_email ? (
                                  <span style={{ fontSize: '0.85rem', color: '#137333', fontWeight: '500' }}>
                                    {item.user_email}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.85rem', color: '#5f6368' }}>زائر</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}
          </section>
        )}

        {/* TAB 5: AI Settings */}
        {activeTab === 'ai_settings' && (
          <section className={styles.section}>
            <h3>تكوين مزود الذكاء الاصطناعي (AI Provider Config)</h3>
            <p style={{ color: 'var(--secondary-text)', fontSize: '0.9rem', marginBottom: '20px' }}>
              اختر مزود الذكاء الاصطناعي المناسب للمنصة لتشغيل مساعد الدراسة RAG وتوليد الاختبارات التفاعلية تلقائياً.
            </p>
            
            {aiMessage.text && (
              <div style={{ 
                padding: '12px 16px', 
                borderRadius: '8px', 
                marginBottom: '20px', 
                fontWeight: '500',
                backgroundColor: aiMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: aiMessage.type === 'success' ? '#10b981' : '#ef4444',
                border: `1px solid ${aiMessage.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
              }}>
                {aiMessage.text}
              </div>
            )}

            {aiLoading ? (
              <p>جاري تحميل الإعدادات...</p>
            ) : (
              <form onSubmit={handleSaveAiSettings} style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px' }}>
                <div className={styles.formGroup}>
                  <label htmlFor="ai_provider">نوع ومزود الخدمة (API Provider)</label>
                  <select 
                    id="ai_provider" 
                    value={aiProvider}
                    onChange={(e) => {
                      setAiProvider(e.target.value);
                      const defaults = {
                        gemini: 'gemini-1.5-flash',
                        deepseek: 'deepseek-chat',
                        groq: 'llama3-8b-8192',
                        openrouter: 'meta-llama/llama-3-8b-instruct:free',
                        mock: 'mock-model'
                      };
                      setAiModel(defaults[e.target.value] || '');
                    }}
                    className={styles.formSelect}
                    style={{ width: '100%' }}
                  >
                    <option value="mock">التجريبي المحلي (Mock) - لا يتطلب مفتاح API</option>
                    <option value="gemini">Google Gemini API</option>
                    <option value="deepseek">DeepSeek API</option>
                    <option value="groq">Groq Cloud API</option>
                    <option value="openrouter">OpenRouter API</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="ai_model_name">اسم النموذج المستخدم (Model Name)</label>
                  <input 
                    type="text" 
                    id="ai_model_name"
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className={styles.formInput}
                    placeholder="مثال: gemini-1.5-flash"
                    required
                  />
                  <p style={{ fontSize: '0.8rem', color: 'var(--secondary-text)', marginTop: '4px' }}>
                    * اسم النموذج الفني المعرّف لدى المزود المختار.
                  </p>
                </div>

                {aiProvider !== 'mock' && (
                  <div className={styles.formGroup}>
                    <label htmlFor="ai_key">مفتاح الاتصال (API Key)</label>
                    <input 
                      type="password" 
                      id="ai_key"
                      value={aiApiKey}
                      onChange={(e) => setAiApiKey(e.target.value)}
                      className={styles.formInput}
                      placeholder={hasApiKey ? "•••••••••••••••• (مفتاح API محفوظ حالياً)" : "أدخل مفتاح API الجديد"}
                    />
                    <p style={{ fontSize: '0.8rem', color: 'var(--secondary-text)', marginTop: '4px' }}>
                      {hasApiKey ? "يرجى ترك الحقل فارغاً للاحتفاظ بمفتاح API المحفوظ مسبقاً، أو أدخل مفتاحاً جديداً لتحديثه." : "أدخل مفتاح الترخيص للاتصال الفعلي بخوادم مزود الخدمة."}
                    </p>
                  </div>
                )}

                <button 
                  type="submit" 
                  className={styles.btnSubmit}
                  style={{ alignSelf: 'flex-start', padding: '12px 30px', borderRadius: '24px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  حفظ إعدادات الذكاء الاصطناعي 💾
                </button>
              </form>
            )}
          </section>
        )}
      </main>

      {/* MODAL 1: Add/Edit Crawler Source */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3>{editingSource ? 'تعديل مصدر الزحف' : 'إضافة موقع زحف جديد'}</h3>
            <form onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label htmlFor="site_name">اسم الموقع</label>
                <input 
                  type="text" 
                  id="site_name" 
                  name="site_name"
                  value={formData.site_name}
                  onChange={handleInputChange}
                  placeholder="مثال: موقع الدراسة الجزائري"
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="url">رابط الموقع (URL)</label>
                <input 
                  type="url" 
                  id="url" 
                  name="url"
                  value={formData.url}
                  onChange={handleInputChange}
                  placeholder="مثال: https://www.eddirasa.com/"
                  className={styles.formInput}
                  required
                  dir="ltr"
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="status">حالة المصدر</label>
                <select 
                  id="status" 
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className={styles.formSelect}
                >
                  <option value="active">نشط (مشمول بالزحف)</option>
                  <option value="inactive">معطل (متوقف مؤقتاً)</option>
                </select>
              </div>
              <div className={styles.buttonGroup}>
                <button type="submit" className={styles.btnSubmit}>حفظ</button>
                <button type="button" onClick={handleCloseModal} className={styles.btnCancel}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit User */}
      {editingUser && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3>تعديل صلاحيات العضو</h3>
            <form onSubmit={handleUpdateUserSubmit}>
              <div className={styles.formGroup}>
                <label htmlFor="user_full_name">الاسم الكامل</label>
                <input 
                  type="text" 
                  id="user_full_name" 
                  name="full_name"
                  value={userFormData.full_name}
                  onChange={handleUserInputChange}
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="user_role">الصلاحية / الدور في المنصة</label>
                <select 
                  id="user_role" 
                  name="role"
                  value={userFormData.role}
                  onChange={handleUserInputChange}
                  className={styles.formSelect}
                >
                  <option value="student">طالب (صلاحيات عادية)</option>
                  <option value="teacher">أستاذ (صلاحيات تدريس)</option>
                  <option value="admin">مدير (صلاحيات كاملة للمحرك)</option>
                </select>
              </div>
              {userFormData.role === 'teacher' && (
                <div className={styles.formGroup} style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                  <input 
                    type="checkbox" 
                    id="user_is_verified_teacher" 
                    name="is_verified_teacher"
                    checked={userFormData.is_verified_teacher}
                    onChange={handleUserInputChange}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="user_is_verified_teacher" style={{ cursor: 'pointer', margin: 0, userSelect: 'none' }}>
                    توثيق حساب الأستاذ (يسمح باعتماد الملفات ورفع النقاط)
                  </label>
                </div>
              )}
              <div style={{ fontSize: '0.85rem', color: '#ea4335', margin: '5px 0 15px 0' }}>
                * ملاحظة: تغيير الدور يؤثر مباشرة على خيارات شريط الرأس والوصول للوحة التحكم.
              </div>
              <div className={styles.buttonGroup}>
                <button type="submit" className={styles.btnSubmit}>حفظ التعديلات</button>
                <button type="button" onClick={() => setEditingUser(null)} className={styles.btnCancel}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

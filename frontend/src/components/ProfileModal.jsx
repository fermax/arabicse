'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import styles from './ProfileModal.module.css';

export default function ProfileModal({ isOpen, onClose }) {
  const { user, token, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' or 'subscriptions'

  // Profile fields state
  const [fullName, setFullName] = useState('');
  const [level, setLevel] = useState('');
  const [branch, setBranch] = useState('');

  // Subscriptions state
  const [subscriptions, setSubscriptions] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  
  // New subscription form state
  const [subSubject, setSubSubject] = useState('');
  const [subLevel, setSubLevel] = useState('');
  const [subBranch, setSubBranch] = useState('');
  const [subTeacher, setSubTeacher] = useState('');

  const [message, setMessage] = useState({ type: '', text: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const API_BASE = "http://localhost:8080";

  // Pre-defined options matching SearchFilters.jsx
  const levels = [
    { value: '1AS', label: 'السنة الأولى ثانوي' },
    { value: '2AS', label: 'السنة الثانية ثانوي' },
    { value: '3AS', label: 'السنة الثالثة ثانوي (بكالوريا)' }
  ];

  const branches = [
    "علوم تجريبية", 
    "رياضيات", 
    "تقني رياضي", 
    "تسيير واقتصاد", 
    "آداب وفلسفة", 
    "لغات أجنبية"
  ];

  const subjects = [
    "الرياضيات", 
    "العلوم الفيزيائية", 
    "علوم الطبيعة والحياة", 
    "اللغة العربية وآدابها", 
    "الفلسفة", 
    "التاريخ والجغرافيا", 
    "العلوم الإسلامية", 
    "اللغة الإنجليزية", 
    "اللغة الفرنسية", 
    "تسيير مالي ومحاسبي", 
    "اقتصاد وقانون", 
    "تكنولوجيا"
  ];

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setLevel(user.level || '');
      setBranch(user.branch || '');
    }
  }, [user, isOpen]);

  useEffect(() => {
    if (isOpen && activeTab === 'subscriptions') {
      fetchSubscriptions();
    }
  }, [isOpen, activeTab]);

  const fetchSubscriptions = async () => {
    if (!token) return;
    setLoadingSubs(true);
    try {
      const res = await fetch(`${API_BASE}/api/subscriptions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data);
      }
    } catch (err) {
      console.error("Error fetching subscriptions:", err);
    } finally {
      setLoadingSubs(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setIsSubmitting(true);

    try {
      const success = await updateProfile(fullName, level || null, branch || null);
      if (success) {
        setMessage({ type: 'success', text: 'تم تحديث معلومات حسابك بنجاح!' });
        setTimeout(() => setMessage({ type: '', text: '' }), 4000);
      } else {
        setMessage({ type: 'error', text: 'حدث خطأ أثناء تحديث بيانات الملف الشخصي.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'فشل الاتصال بالخادم.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSubscription = async (e) => {
    e.preventDefault();
    if (!token) return;
    
    // Check if at least one filter is specified
    if (!subSubject && !subLevel && !subBranch && !subTeacher) {
      setMessage({ type: 'error', text: 'يرجى اختيار ميزة واحدة على الأقل للاشتراك بالتنبيهات.' });
      return;
    }

    setMessage({ type: '', text: '' });
    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/api/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subject: subSubject || null,
          level: subLevel || null,
          branch: subBranch || null,
          teacher: subTeacher || null
        })
      });

      if (res.ok) {
        // Reset form
        setSubSubject('');
        setSubLevel('');
        setSubBranch('');
        setSubTeacher('');
        setMessage({ type: 'success', text: 'تمت إضافة الاشتراك الجديد بنجاح!' });
        fetchSubscriptions();
        setTimeout(() => setMessage({ type: '', text: '' }), 4000);
      } else {
        setMessage({ type: 'error', text: 'فشل إعداد هذا الاشتراك. يرجى إعادة المحاولة.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'فشل الاتصال بالخادم.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSubscription = async (id) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/subscriptions/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setSubscriptions(prev => prev.filter(sub => sub.id !== id));
        setMessage({ type: 'success', text: 'تم إلغاء الاشتراك بنجاح.' });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      } else {
        setMessage({ type: 'error', text: 'حدث خطأ أثناء إلغاء الاشتراك.' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'فشل الاتصال بالخادم لإلغاء الاشتراك.' });
    }
  };

  const formatLevel = (lvl) => {
    switch (lvl) {
      case '3AS': return 'السنة الثالثة ثانوي';
      case '2AS': return 'السنة الثانية ثانوي';
      case '1AS': return 'السنة الأولى ثانوي';
      default: return lvl;
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} dir="rtl">
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>الإعدادات والاشتراكات</h2>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        {/* Navigation Tabs */}
        <div className={styles.tabs}>
          <button 
            className={`${styles.tab} ${activeTab === 'profile' ? styles.activeTab : ''}`}
            onClick={() => { setActiveTab('profile'); setMessage({ type: '', text: '' }); }}
          >
            👤 الملف الشخصي
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'subscriptions' ? styles.activeTab : ''}`}
            onClick={() => { setActiveTab('subscriptions'); setMessage({ type: '', text: '' }); }}
          >
            🔔 الاشتراكات والتنبيهات
          </button>
        </div>

        {/* Messages */}
        {message.text && (
          <div className={`${styles.alert} ${message.type === 'success' ? styles.alertSuccess : styles.alertError}`}>
            {message.text}
          </div>
        )}

        {/* Tab Contents */}
        <div className={styles.content}>
          {activeTab === 'profile' ? (
            <form onSubmit={handleUpdateProfile} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.label}>الاسم الكامل</label>
                <input 
                  type="text" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={styles.input}
                  placeholder="أدخل اسمك بالكامل"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>السنة الدراسية</label>
                <select 
                  value={level} 
                  onChange={(e) => setLevel(e.target.value)}
                  className={styles.select}
                >
                  <option value="">-- اختر السنة الدراسية (اختياري) --</option>
                  {levels.map(l => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
                <p className={styles.helpText}>تستخدم السنة الدراسية لتخصيص نتائج البحث ورفع ترتيب الملفات التي تناسب طورك.</p>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>الشعبة الدراسية</label>
                <select 
                  value={branch} 
                  onChange={(e) => setBranch(e.target.value)}
                  className={styles.select}
                >
                  <option value="">-- اختر الشعبة الدراسية (اختياري) --</option>
                  {branches.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                <p className={styles.helpText}>تستخدم الشعبة لتسريع وتخصيص نتائج البحث تلقائياً.</p>
              </div>

              <button 
                type="submit" 
                className={styles.submitBtn}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>
            </form>
          ) : (
            <div className={styles.subContainer}>
              {/* Add Subscription Section */}
              <form onSubmit={handleAddSubscription} className={styles.addSubForm}>
                <h3 className={styles.subTitle}>إضافة اشتراك تنبيهات جديد</h3>
                <p className={styles.subDesc}>تلقّ تنبيهاً فورياً في لوحة الإشعارات عند توفر مستندات أو دروس جديدة تطابق اهتمامك:</p>
                
                <div className={styles.formRow}>
                  <div className={styles.formCol}>
                    <label className={styles.label}>المادة</label>
                    <select 
                      value={subSubject}
                      onChange={(e) => setSubSubject(e.target.value)}
                      className={styles.select}
                    >
                      <option value="">أي مادة</option>
                      {subjects.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className={styles.formCol}>
                    <label className={styles.label}>السنة الدراسية</label>
                    <select 
                      value={subLevel}
                      onChange={(e) => setSubLevel(e.target.value)}
                      className={styles.select}
                    >
                      <option value="">أي سنة</option>
                      {levels.map(l => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formCol}>
                    <label className={styles.label}>الشعبة</label>
                    <select 
                      value={subBranch}
                      onChange={(e) => setSubBranch(e.target.value)}
                      className={styles.select}
                    >
                      <option value="">أي شعبة</option>
                      {branches.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formCol}>
                    <label className={styles.label}>الأستاذ (اختياري)</label>
                    <input 
                      type="text" 
                      value={subTeacher}
                      onChange={(e) => setSubTeacher(e.target.value)}
                      className={styles.input}
                      placeholder="اسم الأستاذ"
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  className={styles.addBtn}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'جاري الاشتراك...' : 'تفعيل هذا الاشتراك 🔔'}
                </button>
              </form>

              {/* View Subscriptions Section */}
              <div className={styles.mySubs}>
                <h3 className={styles.subTitle}>اشتراكاتي الحالية ({subscriptions.length})</h3>
                {loadingSubs ? (
                  <p className={styles.placeholderText}>جاري تحميل الاشتراكات...</p>
                ) : subscriptions.length === 0 ? (
                  <p className={styles.placeholderText}>ليس لديك أي اشتراكات نشطة حالياً. يمكنك ملء النموذج أعلاه لبدء المتابعة.</p>
                ) : (
                  <div className={styles.subsGrid}>
                    {subscriptions.map(sub => (
                      <div key={sub.id} className={styles.subCard}>
                        <div className={styles.subDetails}>
                          {sub.subject && <span className={styles.tag}>📚 {sub.subject}</span>}
                          {sub.level && <span className={styles.tag}>🎓 {formatLevel(sub.level)}</span>}
                          {sub.branch && <span className={styles.tag}>💡 {sub.branch}</span>}
                          {sub.teacher && <span className={styles.tag}>👨‍🏫 {sub.teacher}</span>}
                          {!sub.subject && !sub.level && !sub.branch && !sub.teacher && (
                            <span className={styles.tag}>إشعار عام</span>
                          )}
                        </div>
                        <button 
                          className={styles.deleteSubBtn}
                          onClick={() => handleDeleteSubscription(sub.id)}
                          title="إلغاء الاشتراك"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

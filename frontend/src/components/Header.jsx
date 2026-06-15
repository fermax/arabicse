'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import ProfileModal from './ProfileModal';
import styles from './Header.module.css';

export default function Header({ query = '' }) {
  const { user, logout, loading, token } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  
  const [searchValue, setSearchValue] = useState(query);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Suggestions states
  const [suggestions, setSuggestions] = useState([]);
  const [isFocused, setIsFocused] = useState(false);
  const searchWrapperRef = useRef(null);

  // Theme management state
  const [theme, setTheme] = useState('light');

  // Phase 2 states
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const notifRef = useRef(null);

  // Initialize theme state based on html class
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDark = document.documentElement.classList.contains('dark');
      setTheme(isDark ? 'dark' : 'light');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  };

  // Sync search input value with the query prop if it changes
  useEffect(() => {
    setSearchValue(query);
  }, [query]);

  // Click outside to close search suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInputChange = async (e) => {
    const value = e.target.value;
    setSearchValue(value);
    
    if (value.trim().length > 1) {
      try {
        const res = await fetch(`http://localhost:8080/api/suggest?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
    }
  };

  // Click outside to close profile dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  // Click outside to close notifications dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotifDropdownOpen(false);
      }
    };

    if (notifDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [notifDropdownOpen]);

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch('http://localhost:8080/api/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  useEffect(() => {
    if (user && token) {
      fetchNotifications();
      // Poll notifications every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    } else {
      setNotifications([]);
    }
  }, [user, token]);

  const handleNotifClick = async (notif) => {
    setNotifDropdownOpen(false);
    
    if (!notif.is_read) {
      try {
        await fetch(`http://localhost:8080/api/notifications/${notif.id}/read`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        // Update local state
        setNotifications(prev => 
          prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n)
        );
      } catch (error) {
        console.error("Error marking notification as read:", error);
      }
    }

    if (notif.document_id) {
      // Extract file name inside quotes if present
      const match = notif.message.match(/'([^']+)'/);
      const searchQ = match ? match[1] : notif.message;
      router.push(`/search?q=${encodeURIComponent(searchQ)}`);
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter(n => !n.is_read);
    if (unread.length === 0) return;

    try {
      await Promise.all(unread.map(n => 
        fetch(`http://localhost:8080/api/notifications/${n.id}/read`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      ));
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchValue.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchValue.trim())}`);
    }
  };

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
    router.push('/');
  };

  const isSearchPage = pathname.startsWith('/search');
  const userInitial = user?.full_name ? user.full_name.trim().charAt(0).toUpperCase() : 'ع';

  return (
    <>
      <header className={styles.header} dir="rtl">
        <div className={styles.headerRight}>
          <Link href="/" className={styles.logo}>
            بيان
          </Link>
          
          {isSearchPage && (
            <div ref={searchWrapperRef} className={styles.searchContainer}>
              <form 
                onSubmit={handleSearchSubmit} 
                className={`${styles.searchForm} ${isFocused && suggestions.length > 0 ? styles.searchFormWithSuggestions : ''}`}
              >
                <input
                  type="text"
                  value={searchValue}
                  onChange={handleInputChange}
                  onFocus={() => setIsFocused(true)}
                  className={styles.searchInput}
                  placeholder="ابحث عن الدروس، الملخصات أو الاختبارات..."
                  autoComplete="off"
                />
                <button type="submit" className={styles.searchButton}>
                  بحث
                </button>
              </form>
              
              {isFocused && suggestions.length > 0 && (
                <ul className={styles.suggestionsList}>
                  {suggestions.map((suggestion, index) => (
                    <li 
                      key={index} 
                      onClick={() => {
                        setSearchValue(suggestion);
                        setIsFocused(false);
                        router.push(`/search?q=${encodeURIComponent(suggestion)}`);
                      }}
                      className={styles.suggestionItem}
                    >
                      <svg className={styles.suggestionIcon} focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="var(--secondary-text)"></path>
                      </svg>
                      {suggestion}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className={styles.headerLeft}>
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className={styles.themeToggle}
            title={theme === 'dark' ? 'تفعيل الوضع المضيء' : 'تفعيل الوضع المظلم'}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {/* Notification Bell (only for logged-in users) */}
          {user && (
            <div className={styles.bellContainer} ref={notifRef}>
              <button
                onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
                className={styles.bellButton}
                title="التنبيهات"
                aria-haspopup="true"
                aria-expanded={notifDropdownOpen}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {notifications.filter(n => !n.is_read).length > 0 && (
                  <span className={styles.badge}>
                    {notifications.filter(n => !n.is_read).length}
                  </span>
                )}
              </button>

              {notifDropdownOpen && (
                <div className={styles.notifDropdown}>
                  <div className={styles.notifHeader}>
                    <span className={styles.notifHeaderTitle}>الإشعارات والتنبيهات</span>
                    {notifications.filter(n => !n.is_read).length > 0 && (
                      <button onClick={handleMarkAllRead} className={styles.markAllReadBtn}>
                        تحديد الكل كمقروء
                      </button>
                    )}
                  </div>
                  
                  <ul className={styles.notifList}>
                    {notifications.length === 0 ? (
                      <li className={styles.notifEmpty}>
                        لا توجد تنبيهات حالياً.
                        <div style={{ fontSize: '0.8rem', marginTop: '6px', opacity: 0.8 }}>
                          اشترك في المواد أو الشعب لتلقي إشعارات عند إضافة ملفات جديدة!
                        </div>
                      </li>
                    ) : (
                      notifications.map(notif => (
                        <li
                          key={notif.id}
                          onClick={() => handleNotifClick(notif)}
                          className={`${styles.notifItem} ${!notif.is_read ? styles.notifUnread : ''}`}
                        >
                          <div className={styles.notifTitle}>
                            {!notif.is_read && <span className={styles.notifDot} />}
                            <span>{notif.title}</span>
                          </div>
                          <div className={styles.notifMessage}>{notif.message}</div>
                          <div className={styles.notifTime}>
                            {new Date(notif.created_at).toLocaleDateString('ar-DZ', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div style={{ width: '100px', height: '36px', borderRadius: '18px', backgroundColor: 'var(--hover-bg)', opacity: 0.6 }} />
          ) : user ? (
            <div className={styles.userSection} ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className={styles.profileButton}
                aria-haspopup="true"
                aria-expanded={dropdownOpen}
              >
                <div className={styles.avatar}>{userInitial}</div>
                <span className={styles.userName}>{user.full_name}</span>
                <span className={`${styles.dropdownIcon} ${dropdownOpen ? styles.dropdownIconOpen : ''}`}>
                  ▼
                </span>
              </button>

              {dropdownOpen && (
                <div className={styles.dropdownMenu}>
                  <div className={styles.dropdownHeader}>
                    <div>{user.full_name}</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: '2px' }}>{user.email}</div>
                  </div>

                  {user.role === 'admin' && (
                    <Link href="/admin" className={`${styles.dropdownItem} ${styles.dropdownItemAdmin}`} onClick={() => setDropdownOpen(false)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '8px' }}>
                        <rect x="3" y="3" width="7" height="9" />
                        <rect x="14" y="3" width="7" height="5" />
                        <rect x="14" y="12" width="7" height="9" />
                        <rect x="3" y="16" width="7" height="5" />
                      </svg>
                      لوحة تحكم المدير
                    </Link>
                  )}

                  {(user.role === 'teacher' || user.role === 'admin') && (
                    <Link href="/upload" className={styles.dropdownItem} onClick={() => setDropdownOpen(false)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '8px' }}>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      بوابة الأساتذة (رفع ملف)
                    </Link>
                  )}

                  <button 
                    onClick={() => { setShowProfileModal(true); setDropdownOpen(false); }} 
                    className={styles.dropdownItem}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '8px' }}>
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    تعديل الملف الشخصي والاشتراكات
                  </button>

                  <Link href="/quiz" className={styles.dropdownItem} onClick={() => setDropdownOpen(false)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '8px' }}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    خض اختباراً تفاعلياً 📝
                  </Link>

                  <Link href="/" className={styles.dropdownItem} onClick={() => setDropdownOpen(false)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '8px' }}>
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    الصفحة الرئيسية
                  </Link>

                  <div className={styles.dropdownDivider} />

                  <button onClick={handleLogout} className={`${styles.dropdownItem} ${styles.logoutButton}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '8px' }}>
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    تسجيل الخروج
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login" className={styles.loginButton}>
                تسجيل الدخول
              </Link>
              <Link href="/register" className={styles.registerButton}>
                إنشاء حساب
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Settings & Profile Modal */}
      <ProfileModal 
        isOpen={showProfileModal} 
        onClose={() => setShowProfileModal(false)} 
      />
    </>
  );
}


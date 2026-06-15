'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './Register.module.css';

export default function RegisterPage() {
  const { user, register, error, loading, setError, socialLogin } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Clear errors on mount
  useEffect(() => {
    setError(null);
  }, [setError]);

  // Listen for social signup popup messages
  useEffect(() => {
    const handleMessage = async (event) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data?.type === 'social-auth-success') {
        const { full_name, email: socialEmail, provider } = event.data.user;
        setSubmitting(true);
        const success = await socialLogin(full_name, socialEmail, provider);
        setSubmitting(false);
        if (success) {
          router.push('/');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [socialLogin, router]);

  // If user is already logged in, redirect to home
  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setError(null);

    if (!fullName || !email || !password || !confirmPassword) {
      setLocalError('يرجى ملء جميع الحقول المطلوبة.');
      return;
    }

    if (password.length < 6) {
      setLocalError('يجب أن تكون كلمة المرور مكونة من 6 أحرف على الأقل.');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('كلمتا المرور غير متطابقتين.');
      return;
    }

    setSubmitting(true);
    const success = await register(fullName, email, password);
    setSubmitting(false);

    if (success) {
      router.push('/');
    }
  };

  const handleSocialClick = (provider) => {
    const width = 450;
    const height = 550;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    window.open(
      `/auth-mock?provider=${provider}`,
      'social_auth_popup',
      `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
    );
  };

  return (
    <div className={styles.authContainer} dir="rtl">
      <div className={styles.authCard}>
        <div className={styles.brandContainer}>
          <Link href="/" className={styles.brandLogo}>بيان</Link>
          <p className={styles.brandSubtitle}>محرك بحث ذكي للطور الثانوي</p>
        </div>

        <h2 className={styles.authTitle}>إنشاء حساب جديد</h2>

        {(localError || error) && (
          <div className={styles.errorAlert}>
            {localError || error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.authForm}>
          <div className={styles.formGroup}>
            <label htmlFor="fullName">الاسم الكامل</label>
            <input 
              type="text" 
              id="fullName" 
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="مثال: محمد أحمد"
              className={styles.authInput}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="email">البريد الإلكتروني</label>
            <input 
              type="email" 
              id="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className={styles.authInput}
              required
              dir="ltr"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password">كلمة المرور</label>
            <input 
              type="password" 
              id="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={styles.authInput}
              required
              dir="ltr"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword">تأكيد كلمة المرور</label>
            <input 
              type="password" 
              id="confirmPassword" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className={styles.authInput}
              required
              dir="ltr"
            />
          </div>

          <button 
            type="submit" 
            className={styles.authButton}
            disabled={submitting || loading}
          >
            {submitting ? 'جاري إنشاء الحساب...' : 'إنشاء حساب جديد'}
          </button>
        </form>

        <div className={styles.socialSeparator}>أو سجّل عبر</div>

        <div className={styles.socialButtons}>
          <button 
            onClick={() => handleSocialClick('google')}
            className={styles.googleButton}
            type="button"
            disabled={submitting || loading}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.137 4.114-3.484 0-6.29-2.905-6.29-6.514 0-3.609 2.806-6.514 6.29-6.514 1.5 0 2.871.536 3.957 1.488l3.111-3.113C18.91 1.79 15.829 1 12.24 1 6.033 1 1 6.033 1 12.24s5.033 11.24 11.24 11.24c6.046 0 10.966-4.92 10.966-11.24 0-.663-.07-1.306-.188-1.955H12.24z"/>
            </svg>
            حساب Google
          </button>

          <button 
            onClick={() => handleSocialClick('facebook')}
            className={styles.facebookButton}
            type="button"
            disabled={submitting || loading}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            حساب Facebook
          </button>
        </div>

        <div className={styles.authFooter}>
          <span>لديك حساب بالفعل؟ </span>
          <Link href="/login" className={styles.authLink}>تسجيل الدخول</Link>
        </div>

        <Link href="/" className={styles.backHomeLink}>← العودة للرئيسية</Link>
      </div>
    </div>
  );
}

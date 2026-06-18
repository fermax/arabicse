'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// المفتاح السري الداخلي لإنشاء التوقيع
// يجب أن يتطابق مع SOCIAL_AUTH_SECRET في backend/.env
const SOCIAL_AUTH_SECRET = 'local-social-auth-secret-bayan-2024';

// دالة لإنشاء توقيع HMAC-SHA256 باستخدام Web Crypto API
async function createHmacSignature(message) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(SOCIAL_AUTH_SECRET);
  const msgData = encoder.encode(message);

  const cryptoKey = await window.crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signatureBuffer = await window.crypto.subtle.sign('HMAC', cryptoKey, msgData);
  // تحويل التوقيع إلى نص hex
  return Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function AuthMockContent() {
  const searchParams = useSearchParams();
  const provider = searchParams.get('provider') || 'google';
  
  const [customName, setCustomName] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);

  const isGoogle = provider === 'google';

  const mockAccounts = isGoogle ? [
    { name: 'أحمد بن علي', email: 'ahmed.ali2008@gmail.com' },
    { name: 'مريم الجزائري', email: 'm.djazairi@gmail.com' }
  ] : [
    { name: 'أحمد علي', email: 'ahmed.ali2008@facebook.com' },
    { name: 'مريم الجزائري', email: 'm.djazairi@facebook.com' }
  ];

  const handleSelectAccount = async (name, email) => {
    if (!window.opener) {
      alert("عذراً، لم يتم العثور على الصفحة الأب. يرجى فتح هذه الصفحة عبر زر الدخول الاجتماعي.");
      return;
    }
    // إنشاء رسالة مُوقَّعة تحتوي على timestamp لمنع إعادة الاستخدام (Replay Attack)
    const timestamp = Date.now();
    const message = `${email}|${provider}|${timestamp}`;
    const signed_token = await createHmacSignature(message);

    window.opener.postMessage({
      type: 'social-auth-success',
      user: {
        full_name: name,
        email: email,
        provider: provider,
        signed_token: signed_token,
        timestamp: timestamp
      }
    }, window.location.origin);
    window.close();
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (customName.trim() && customEmail.trim()) {
      handleSelectAccount(customName.trim(), customEmail.trim());
    }
  };

  return (
    <div style={{
      fontFamily: "'Tajawal', sans-serif",
      minHeight: '100vh',
      backgroundColor: '#f8f9fa',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      direction: 'rtl'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
        padding: '30px',
        width: '100%',
        maxWidth: '400px',
        border: '1px solid #e0e0e0',
        boxSizing: 'border-box'
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            fontSize: '1.8rem',
            fontWeight: 'bold',
            color: isGoogle ? '#1a73e8' : '#1877f2',
            marginBottom: '8px'
          }}>
            {isGoogle ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.137 4.114-3.484 0-6.29-2.905-6.29-6.514 0-3.609 2.806-6.514 6.29-6.514 1.5 0 2.871.536 3.957 1.488l3.111-3.113C18.91 1.79 15.829 1 12.24 1 6.033 1 1 6.033 1 12.24s5.033 11.24 11.24 11.24c6.046 0 10.966-4.92 10.966-11.24 0-.663-.07-1.306-.188-1.955H12.24z"/>
                </svg>
                الدخول بواسطة Google
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#1877f2">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                الدخول بواسطة Facebook
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.9rem', color: '#5f6368', margin: 0 }}>
            لتسجيل الدخول إلى تطبيق <strong>بيان التعليمي</strong>
          </p>
        </div>

        {!showCustomForm ? (
          <div>
            <h3 style={{ fontSize: '1rem', color: '#202124', marginBottom: '16px', fontWeight: '500' }}>
              اختر حساباً للمتابعة:
            </h3>

            {mockAccounts.map((acc, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectAccount(acc.name, acc.email)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #dadce0',
                  backgroundColor: '#ffffff',
                  marginBottom: '10px',
                  cursor: 'pointer',
                  textAlign: 'right',
                  transition: 'background-color 0.2s',
                  fontFamily: 'inherit'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
              >
                <span style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#202124' }}>{acc.name}</span>
                <span style={{ fontSize: '0.8rem', color: '#5f6368', marginTop: '2px' }}>{acc.email}</span>
              </button>
            ))}

            <button
              onClick={() => setShowCustomForm(true)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px dashed #1a73e8',
                backgroundColor: 'rgba(26, 115, 232, 0.04)',
                color: '#1a73e8',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '0.9rem',
                marginTop: '15px',
                fontFamily: 'inherit'
              }}
            >
              + استخدام حساب تجريبي مخصص
            </button>
          </div>
        ) : (
          <form onSubmit={handleCustomSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1rem', color: '#202124', margin: '0 0 5px 0', fontWeight: '500' }}>
              أدخل بيانات الحساب التجريبي:
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', color: '#5f6368' }}>الاسم الكامل</label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="مثال: يوسف محمود"
                required
                style={{
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid #dadce0',
                  fontSize: '0.95rem',
                  fontFamily: 'inherit',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', color: '#5f6368' }}>البريد الإلكتروني</label>
              <input
                type="email"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                placeholder="user@example.com"
                required
                style={{
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid #dadce0',
                  fontSize: '0.95rem',
                  fontFamily: 'inherit',
                  outline: 'none',
                  direction: 'ltr',
                  textAlign: 'right'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button
                type="submit"
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '6px',
                  backgroundColor: isGoogle ? '#1a73e8' : '#1877f2',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: '700',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                دخول
              </button>
              <button
                type="button"
                onClick={() => setShowCustomForm(false)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '6px',
                  backgroundColor: '#e0e0e0',
                  color: '#3c4043',
                  border: 'none',
                  fontWeight: '700',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                إلغاء
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function AuthMockPage() {
  return (
    <Suspense fallback={
      <div style={{
        fontFamily: "'Tajawal', sans-serif",
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8f9fa'
      }}>
        جاري التحميل...
      </div>
    }>
      <AuthMockContent />
    </Suspense>
  );
}

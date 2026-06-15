'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Link from 'next/link';
import styles from './Upload.module.css';

const API_BASE = "http://localhost:8080";

export default function UploadPage() {
  const { token, user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Form states
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('الرياضيات');
  const [level, setLevel] = useState('3AS');
  const [branch, setBranch] = useState('عام');
  const [fileType, setFileType] = useState('ملخص');
  const [wilaya, setWilaya] = useState('الجزائر');

  // Request feedback states
  const [uploading, setUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef(null);

  // Guard redirection if not auth
  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'teacher' && user.role !== 'admin'))) {
      // Not allowed
    }
  }, [user, authLoading]);

  if (authLoading) {
    return (
      <>
        <Header />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', fontSize: '1.2rem', color: 'var(--secondary-text)' }}>
          جاري تحميل بيانات المصادقة...
        </div>
      </>
    );
  }

  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return (
      <>
        <Header />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', textAlign: 'center', padding: '20px' }} dir="rtl">
          <div style={{ fontSize: '3.5rem', marginBottom: '20px' }}>🔒</div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '10px', color: 'var(--foreground)' }}>بوابة الأساتذة - وصول غير مصرح به</h2>
          <p style={{ color: 'var(--secondary-text)', maxWidth: '500px', marginBottom: '25px', lineHeight: '1.6' }}>
            عذراً، رفع الملفات متاح فقط للأساتذة المعتمدين والمشرفين على محرك بيان. يرجى تسجيل الدخول بحساب أستاذ للوصول لهذه الصفحة.
          </p>
          <Link href="/" style={{ padding: '10px 24px', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '24px', fontWeight: 'bold', textDecoration: 'none' }}>
            العودة للمحرك الرئيسي
          </Link>
        </div>
      </>
    );
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.size > 20 * 1024 * 1024) {
        setErrorMsg('حجم الملف كبير جداً. الحد الأقصى المسموح به هو 20 ميجابايت.');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setErrorMsg('');
      
      // Auto fill title if empty
      if (!title) {
        const nameWithoutExt = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.')) || selectedFile.name;
        setTitle(nameWithoutExt);
      }
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current.click();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (droppedFile.size > 20 * 1024 * 1024) {
        setErrorMsg('حجم الملف كبير جداً. الحد الأقصى المسموح به هو 20 ميجابايت.');
        setFile(null);
        return;
      }
      setFile(droppedFile);
      setErrorMsg('');
      if (!title) {
        const nameWithoutExt = droppedFile.name.substring(0, droppedFile.name.lastIndexOf('.')) || droppedFile.name;
        setTitle(nameWithoutExt);
      }
    }
  };

  const handleRemoveFile = (e) => {
    e.stopPropagation();
    setFile(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setErrorMsg('الرجاء اختيار ملف للرفع أولاً.');
      return;
    }
    if (!title.trim()) {
      setErrorMsg('الرجاء كتابة عنوان توضيحي للمستند.');
      return;
    }

    setUploading(true);
    setSuccessMsg('');
    setErrorMsg('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('subject', subject);
    formData.append('level', level);
    formData.append('branch', branch);
    formData.append('file_type', fileType);
    formData.append('wilaya', wilaya);

    try {
      const res = await fetch(`${API_BASE}/api/documents/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessMsg('تم رفع وتوثيق وتصنيف الملف بنجاح في فهارس البحث!');
        setFile(null);
        setTitle('');
      } else {
        setErrorMsg(data.detail || 'حدث خطأ غير متوقع أثناء الرفع.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('فشل الاتصال بالخادم لرفع الملف. يرجى التحقق من الشبكة.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Header />
      <div className={styles.uploadContainer} dir="rtl">
        <div className={styles.uploadCard}>
          <h1 className={styles.title}>بوابة الأساتذة لرفع المستندات</h1>
          <p className={styles.subtitle}>شارك ملخصاتك، امتحاناتك والملفات التعليمية مع آلاف الطلبة عبر فهارس محرك بيان.</p>
          
          {successMsg && <div className={styles.alertSuccess} style={{ marginBottom: '20px' }}>{successMsg}</div>}
          {errorMsg && <div className={styles.alertError} style={{ marginBottom: '20px' }}>{errorMsg}</div>}

          <form onSubmit={handleSubmit} className={styles.form}>
            {/* File Dropzone */}
            <div className={styles.formGroup}>
              <label>ملف المستند (PDF أو نصي)</label>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".pdf,.txt" 
                style={{ display: 'none' }}
              />
              
              {!file ? (
                <div 
                  className={styles.fileDropzone} 
                  onClick={triggerFileSelect}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <div className={styles.dropzoneIcon}>📁</div>
                  <div className={styles.dropzoneText}>اسحب وأفلت الملف هنا أو انقر للاختيار</div>
                  <div className={styles.dropzoneSubtext}>صيغ الملفات المتاحة: PDF أو TXT (الحد الأقصى 20 ميجابايت)</div>
                </div>
              ) : (
                <div className={styles.selectedFileBar}>
                  <div className={styles.selectedFileInfo}>
                    <span>📄</span>
                    <span className={styles.selectedFileName} title={file.name}>{file.name}</span>
                    <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
                  </div>
                  <button type="button" onClick={handleRemoveFile} className={styles.removeFileBtn} title="إلغاء اختيار الملف">×</button>
                </div>
              )}
            </div>

            {/* Document Title */}
            <div className={styles.formGroup}>
              <label htmlFor="title">عنوان المستند التعليمي</label>
              <input 
                type="text" 
                id="title" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                placeholder="مثال: ملخص درس الفيزياء حركة الأقمار الاصطناعية"
                className={styles.formInput}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              {/* Subject */}
              <div className={styles.formGroup}>
                <label htmlFor="subject">المادة التعليمية</label>
                <select id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={styles.formSelect}>
                  <option value="الرياضيات">الرياضيات</option>
                  <option value="العلوم الفيزيائية">العلوم الفيزيائية</option>
                  <option value="علوم الطبيعة والحياة">علوم الطبيعة والحياة</option>
                  <option value="الأدب العربي">الأدب العربي</option>
                  <option value="التاريخ والجغرافيا">التاريخ والجغرافيا</option>
                  <option value="الفلسفة">الفلسفة</option>
                  <option value="العلوم الإسلامية">العلوم الإسلامية</option>
                  <option value="اللغة الإنجليزية">اللغة الإنجليزية</option>
                  <option value="اللغة الفرنسية">اللغة الفرنسية</option>
                  <option value="تسيير محاسبي ومالي">تسيير محاسبي ومالي</option>
                </select>
              </div>

              {/* Level */}
              <div className={styles.formGroup}>
                <label htmlFor="level">السنة الدراسية (الطور)</label>
                <select id="level" value={level} onChange={(e) => setLevel(e.target.value)} className={styles.formSelect}>
                  <option value="3AS">السنة الثالثة ثانوي (بكالوريا)</option>
                  <option value="2AS">السنة الثانية ثانوي</option>
                  <option value="1AS">السنة الأولى ثانوي</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              {/* Branch */}
              <div className={styles.formGroup}>
                <label htmlFor="branch">الشعبة التعليمية</label>
                <select id="branch" value={branch} onChange={(e) => setBranch(e.target.value)} className={styles.formSelect}>
                  <option value="عام">جذع مشترك / شعب عامة</option>
                  <option value="علوم تجريبية">علوم تجريبية</option>
                  <option value="رياضيات">رياضيات</option>
                  <option value="تقني رياضي">تقني رياضي</option>
                  <option value="تسيير واقتصاد">تسيير واقتصاد</option>
                  <option value="آداب وفلسفة">آداب وفلسفة</option>
                  <option value="لغات أجنبية">لغات أجنبية</option>
                </select>
              </div>

              {/* File Type */}
              <div className={styles.formGroup}>
                <label htmlFor="fileType">نوع الملف</label>
                <select id="fileType" value={fileType} onChange={(e) => setFileType(e.target.value)} className={styles.formSelect}>
                  <option value="ملخص">ملخص / درس</option>
                  <option value="تمرين">تمرين مع الحل</option>
                  <option value="موضوع بكالوريا سابق">بكالوريا سابقة / امتحانات</option>
                  <option value="كتاب">كتاب مدرسي / مرجع</option>
                </select>
              </div>
            </div>

            {/* Wilaya */}
            <div className={styles.formGroup}>
              <label htmlFor="wilaya">الولاية المرفقة (اختياري)</label>
              <select id="wilaya" value={wilaya} onChange={(e) => setWilaya(e.target.value)} className={styles.formSelect}>
                <option value="الجزائر">الجزائر</option>
                <option value="وهران">وهران</option>
                <option value="قسنطينة">قسنطينة</option>
                <option value="تيزي وزو">تيزي وزو</option>
                <option value="سطيف">سطيف</option>
                <option value="شلف">شلف</option>
                <option value="بجاية">بجاية</option>
                <option value="عنابة">عنابة</option>
              </select>
            </div>

            {/* Submit */}
            <button 
              type="submit" 
              disabled={uploading || !file || !title.trim()} 
              className={styles.btnSubmit}
            >
              {uploading ? 'جاري معالجة وفهرسة الملف بالذكاء الاصطناعي...' : 'تأكيد الرفع والأرشفة'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

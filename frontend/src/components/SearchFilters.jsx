'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styles from './SearchFilters.module.css';

export default function SearchFilters({ facets }) {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [showAuthModal, setShowAuthModal] = useState(false);

  const currentQuery = searchParams.get('q') || '';
  const currentBranch = searchParams.get('branch') || '';
  const currentSubject = searchParams.get('subject') || '';
  const currentLevel = searchParams.get('level') || '';
  const currentFileType = searchParams.get('file_type') || '';
  const currentWilaya = searchParams.get('wilaya') || '';
  const currentTeacher = searchParams.get('teacher') || '';

  // Dynamically populated filter options from search result facets, with static fallback
  let subjects = facets?.subjects?.length > 0 ? [...facets.subjects] : ["الرياضيات", "العلوم الفيزيائية", "علوم الطبيعة والحياة", "اللغة العربية وآدابها", "الفلسفة", "التاريخ والجغرافيا", "العلوم الإسلامية", "اللغة الإنجليزية", "اللغة الفرنسية", "تسيير مالي ومحاسبي", "اقتصاد وقانون", "تكنولوجيا"];
  if (currentSubject && !subjects.includes(currentSubject)) {
    subjects.push(currentSubject);
  }

  let levels = facets?.levels?.length > 0 ? [...facets.levels] : ["3AS", "2AS", "1AS"];
  if (currentLevel && !levels.includes(currentLevel)) {
    levels.push(currentLevel);
  }

  let branches = facets?.branches?.length > 0 ? [...facets.branches] : ["علوم تجريبية", "رياضيات", "تقني رياضي", "تسيير واقتصاد", "آداب وفلسفة", "لغات أجنبية"];
  if (currentBranch && !branches.includes(currentBranch)) {
    branches.push(currentBranch);
  }

  const allFileTypes = [
    { label: "ملخص / درس", value: "ملخص" },
    { label: "تمرين وحلول", value: "تمرين" },
    { label: "موضوع بكالوريا سابق", value: "موضوع بكالوريا سابق" },
    { label: "كتاب مدرسي", value: "كتاب" },
    { label: "شرح فيديو", value: "شرح فيديو" }
  ];
  let fileTypes = facets?.file_types?.length > 0
    ? allFileTypes.filter(ft => facets.file_types.includes(ft.value) || ft.value === currentFileType)
    : allFileTypes;
  if (currentFileType && !fileTypes.some(ft => ft.value === currentFileType)) {
    fileTypes.push({ label: currentFileType, value: currentFileType });
  }

  let wilayas = facets?.wilayas?.length > 0 ? [...facets.wilayas] : ["الجزائر", "وهران", "قسنطينة", "تيزي وزو", "سطيف", "شلف", "بجاية", "عنابة"];
  if (currentWilaya && !wilayas.includes(currentWilaya)) {
    wilayas.push(currentWilaya);
  }

  let teachers = facets?.teachers?.length > 0 ? [...facets.teachers] : ["الأستاذ بوسيف", "الأستاذ أحمد", "الأستاذة عائشة", "الأستاذ بن سالم", "الأستاذة ليلى"];
  if (currentTeacher && !teachers.includes(currentTeacher)) {
    teachers.push(currentTeacher);
  }

  const formatLevel = (lvl) => {
    switch (lvl) {
      case '3AS': return 'السنة الثالثة ثانوي (بكالوريا)';
      case '2AS': return 'السنة الثانية ثانوي';
      case '1AS': return 'السنة الأولى ثانوي';
      default: return lvl;
    }
  };

  const handleFilterClick = (key, value) => {
    // If user is guest (not logged in), block and show auth modal
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    // Clone current search params
    const params = new URLSearchParams(searchParams.toString());
    
    // Toggle parameter
    if (params.get(key) === value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    // Reset pagination skip if it exists
    params.delete('skip');

    router.push(`/search?${params.toString()}`);
  };

  const handleClearFilters = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    const params = new URLSearchParams();
    params.set('q', currentQuery);
    router.push(`/search?${params.toString()}`);
  };

  const hasActiveFilters = currentBranch || currentFileType || currentWilaya || currentTeacher || currentSubject || currentLevel;

  return (
    <>
      <aside className={styles.sidebar} dir="rtl">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <span style={{ fontWeight: '800', fontSize: '1.1rem', color: 'var(--foreground)' }}>تخصيص البحث</span>
          {hasActiveFilters && (
            <button onClick={handleClearFilters} className={styles.clearFiltersBtn} style={{ margin: 0, padding: '4px 8px', fontSize: '0.8rem' }}>
              إعادة تعيين
            </button>
          )}
        </div>

        {/* 1. Subject Filter */}
        <div className={styles.filterSection}>
          <h4 className={styles.filterTitle}>المادة الدراسية</h4>
          <ul className={styles.filterList}>
            {subjects.map((sub) => {
              const isActive = currentSubject === sub;
              return (
                <li key={sub} className={styles.filterItem} onClick={() => handleFilterClick('subject', sub)}>
                  <input
                    type="checkbox"
                    checked={isActive}
                    readOnly
                    className={styles.checkboxInput}
                  />
                  <span className={isActive ? styles.activeFilterText : ''}>{sub}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* 2. Level Filter */}
        <div className={styles.filterSection}>
          <h4 className={styles.filterTitle}>السنة الدراسية</h4>
          <ul className={styles.filterList}>
            {levels.map((lvl) => {
              const isActive = currentLevel === lvl;
              return (
                <li key={lvl} className={styles.filterItem} onClick={() => handleFilterClick('level', lvl)}>
                  <input
                    type="checkbox"
                    checked={isActive}
                    readOnly
                    className={styles.checkboxInput}
                  />
                  <span className={isActive ? styles.activeFilterText : ''}>{formatLevel(lvl)}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* 3. Branch Filter */}
        <div className={styles.filterSection}>
          <h4 className={styles.filterTitle}>الشعبة الدراسية</h4>
          <ul className={styles.filterList}>
            {branches.map((b) => {
              const isActive = currentBranch === b;
              return (
                <li key={b} className={styles.filterItem} onClick={() => handleFilterClick('branch', b)}>
                  <input
                    type="checkbox"
                    checked={isActive}
                    readOnly
                    className={styles.checkboxInput}
                  />
                  <span className={isActive ? styles.activeFilterText : ''}>{b}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* 4. File Type Filter */}
        <div className={styles.filterSection}>
          <h4 className={styles.filterTitle}>نوع الملف</h4>
          <ul className={styles.filterList}>
            {fileTypes.map((ft) => {
              const isActive = currentFileType === ft.value;
              return (
                <li key={ft.value} className={styles.filterItem} onClick={() => handleFilterClick('file_type', ft.value)}>
                  <input
                    type="checkbox"
                    checked={isActive}
                    readOnly
                    className={styles.checkboxInput}
                  />
                  <span className={isActive ? styles.activeFilterText : ''}>{ft.label}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* 5. Wilaya Filter */}
        <div className={styles.filterSection}>
          <h4 className={styles.filterTitle}>الولاية</h4>
          <ul className={styles.filterList}>
            {wilayas.map((w) => {
              const isActive = currentWilaya === w;
              return (
                <li key={w} className={styles.filterItem} onClick={() => handleFilterClick('wilaya', w)}>
                  <input
                    type="checkbox"
                    checked={isActive}
                    readOnly
                    className={styles.checkboxInput}
                  />
                  <span className={isActive ? styles.activeFilterText : ''}>{w}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* 6. Teacher Filter */}
        <div className={styles.filterSection}>
          <h4 className={styles.filterTitle}>الأستاذ صاحب الملف</h4>
          <ul className={styles.filterList}>
            {teachers.map((t) => {
              const isActive = currentTeacher === t;
              return (
                <li key={t} className={styles.filterItem} onClick={() => handleFilterClick('teacher', t)}>
                  <input
                    type="checkbox"
                    checked={isActive}
                    readOnly
                    className={styles.checkboxInput}
                  />
                  <span className={isActive ? styles.activeFilterText : ''}>{t}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      {/* Guest Lock Auth Prompt Modal */}
      {showAuthModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAuthModal(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalIcon}>🔒</div>
            <h3 className={styles.modalTitle}>خدمة التصفية والتخصيص المتقدم</h3>
            <p className={styles.modalDescription}>
              عذراً! ميزة التخصيص العميق وفلاتر البحث (Faceted Search) مخصصة فقط للأعضاء المسجلين في محرك بيان التعليمي. 
              يرجى تسجيل الدخول أو إنشاء حساب مجاني للاستفادة الكاملة من محرك البحث المتقدم!
            </p>
            <div className={styles.modalActions}>
              <Link href="/login" className={styles.modalBtnPrimary}>
                تسجيل الدخول
              </Link>
              <Link href="/register" className={styles.modalBtnSecondary}>
                إنشاء حساب جديد
              </Link>
              <button onClick={() => setShowAuthModal(false)} className={styles.modalBtnClose}>
                العودة للبحث العادي
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

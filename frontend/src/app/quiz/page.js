'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { useAuth } from '@/context/AuthContext';
import styles from './QuizPage.module.css';
import Link from 'next/link';

const API_BASE = "http://localhost:8080";

export default function QuizPage() {
  const { token, user } = useAuth();
  
  // Selection/Setup states
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState('الرياضيات');
  const [quizState, setQuizState] = useState('setup'); // 'setup', 'loading', 'active', 'finished'

  // Quiz content states
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [error, setError] = useState('');

  const subjects = [
    "الرياضيات", 
    "العلوم الفيزيائية", 
    "علوم الطبيعة والحياة", 
    "اللغة العربية وآدابها", 
    "الفلسفة", 
    "التاريخ والجغرافيا", 
    "العلوم الإسلامية", 
    "اللغة الإنجليزية", 
    "اللغة الفرنسية"
  ];

  const handleStartQuiz = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setQuizState('loading');
    setQuestions([]);
    setCurrentIdx(0);
    setScore(0);
    setIsAnswered(false);
    setSelectedOption(null);

    // If no specific topic is written, use the selected subject
    const queryTopic = topic.trim() || subject;

    try {
      const res = await fetch(`${API_BASE}/api/ai/quiz/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          topic: queryTopic
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.questions && data.questions.length > 0) {
          setQuestions(data.questions);
          setQuizState('active');
        } else {
          setError("عذراً، لم نتمكن من توليد أسئلة لهذا الموضوع. يرجى تجربة كلمة مختلفة.");
          setQuizState('setup');
        }
      } else {
        const errData = await res.json();
        setError(errData.detail || "فشل توليد الاختبار التفاعلي.");
        setQuizState('setup');
      }
    } catch (err) {
      console.error(err);
      setError("فشل الاتصال بالخادم الذكي. يرجى التحقق من اتصالك بالإنترنت.");
      setQuizState('setup');
    }
  };

  const handleOptionSelect = (optionIdx) => {
    if (isAnswered) return;
    setSelectedOption(optionIdx);
    setIsAnswered(true);

    const currentQuestion = questions[currentIdx];
    if (optionIdx === currentQuestion.correct_option) {
      setScore(prev => prev + 1);
    }
  };

  const handleNext = () => {
    setSelectedOption(null);
    setIsAnswered(false);
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx(prev => prev + 1);
    } else {
      setQuizState('finished');
    }
  };

  const handleReset = () => {
    setTopic('');
    setQuizState('setup');
  };

  const getScoreMessage = () => {
    const percent = (score / questions.length) * 100;
    if (percent === 100) {
      return {
        title: "🥇 نتيجتك ممتازة!",
        desc: "أحسنت! لقد أجبت على كافة الأسئلة بشكل صحيح تماماً. واصل هذا الأداء الرائع!"
      };
    } else if (percent >= 60) {
      return {
        title: "🥈 نتيجتك جيدة جداً!",
        desc: "عمل رائع! لديك فهم متين وجيد للموضوع، ننصح بمراجعة التفسيرات المرفقة لتغطية أي ثغرات."
      };
    } else {
      return {
        title: "📚 تحتاج لبعض المراجعة",
        desc: "لا تقلق! الاختبار فرصة للتعلم. ننصحك بالاطلاع على الملخصات والدروس المفهرسة بالمنصة وإعادة المحاولة."
      };
    }
  };

  const scoreInfo = getScoreMessage();

  if (!token) {
    return (
      <div className={styles.pageContainer}>
        <Header />
        <div className={styles.authLockCard} dir="rtl">
          <div className={styles.lockIcon}>🔒</div>
          <h2>خدمة التقييم الذاتي التفاعلية</h2>
          <p>
            عذراً، ميزة توليد الاختبارات التفاعلية وحلولها الذكية بالذكاء الاصطناعي مخصصة فقط للأعضاء المسجلين في محرك بيان.
          </p>
          <div className={styles.authActions}>
            <Link href="/login" className={styles.btnPrimary}>تسجيل الدخول</Link>
            <Link href="/register" className={styles.btnSecondary}>إنشاء حساب جديد</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <Header />

      <div className={styles.mainWrapper} dir="rtl">
        {/* SETUP SCREEN */}
        {quizState === 'setup' && (
          <div className={styles.quizCard}>
            <h2 className={styles.cardTitle}>توليد اختبار تفاعلي ذاتي 📝</h2>
            <p className={styles.cardDesc}>
              فكر في مادة أو درس ترغب في تقييم مدى استيعابك له. سيقوم مساعد بيان AI بقراءة المناهج وتوليد 5 أسئلة خيارات متعددة مخصصة لك:
            </p>

            {error && <div className={styles.errorAlert}>{error}</div>}

            <form onSubmit={handleStartQuiz} className={styles.setupForm}>
              <div className={styles.formGroup}>
                <label className={styles.label}>اختر المادة الدراسية</label>
                <select 
                  value={subject} 
                  onChange={(e) => setSubject(e.target.value)}
                  className={styles.select}
                >
                  {subjects.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>اسم الدرس أو الموضوع (اختياري)</label>
                <input 
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="مثال: المتتاليات العددية، دراسة الدوال، الحرب الباردة..."
                  className={styles.input}
                />
                <p className={styles.helpText}>اترك هذا الحقل فارغاً لتوليد اختبار عام في المادة المختارة.</p>
              </div>

              <button type="submit" className={styles.submitBtn}>
                توليد الاختبار بالذكاء الاصطناعي ✨
              </button>
            </form>
          </div>
        )}

        {/* LOADING SCREEN */}
        {quizState === 'loading' && (
          <div className={styles.quizCard} style={{ textAlign: 'center', padding: '50px 20px' }}>
            <div className={styles.spinner} />
            <h3 style={{ marginTop: '20px', fontWeight: 'bold' }}>جاري صياغة الأسئلة...</h3>
            <p style={{ color: 'var(--secondary-text)', fontSize: '0.9rem' }}>
              يقوم الذكاء الاصطناعي الآن بقراءة وتحليل محتويات المناهج في قاعدة البيانات لتوليد اختبار دقيق ومفصل.
            </p>
          </div>
        )}

        {/* ACTIVE QUIZ SCREEN */}
        {quizState === 'active' && questions.length > 0 && (
          <div className={styles.quizCard}>
            {/* Progress and Score */}
            <div className={styles.quizHeader}>
              <span className={styles.quizProgress}>
                السؤال <strong>{currentIdx + 1}</strong> من <strong>{questions.length}</strong>
              </span>
              <div className={styles.progressBarWrapper}>
                <div 
                  className={styles.progressBar} 
                  style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Question Text */}
            <h3 className={styles.questionText}>
              {questions[currentIdx].question}
            </h3>

            {/* Options Grid */}
            <div className={styles.optionsGrid}>
              {questions[currentIdx].options.map((option, idx) => {
                const isSelected = selectedOption === idx;
                const isCorrect = questions[currentIdx].correct_option === idx;
                
                let optionClass = styles.optionCard;
                if (isAnswered) {
                  if (isCorrect) optionClass += ` ${styles.optionCorrect}`;
                  else if (isSelected) optionClass += ` ${styles.optionIncorrect}`;
                  else optionClass += ` ${styles.optionDisabled}`;
                } else if (isSelected) {
                  optionClass += ` ${styles.optionSelected}`;
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleOptionSelect(idx)}
                    disabled={isAnswered}
                    className={optionClass}
                  >
                    <span className={styles.optionLetter}>{String.fromCharCode(65 + idx)}</span>
                    <span className={styles.optionContent}>{option}</span>
                  </button>
                );
              })}
            </div>

            {/* Explanation box */}
            {isAnswered && (
              <div className={styles.explanationBox}>
                <h4 className={styles.explanationTitle}>💡 شرح وتفسير الإجابة:</h4>
                <p className={styles.explanationText}>
                  {questions[currentIdx].explanation}
                </p>
              </div>
            )}

            {/* Navigation button */}
            {isAnswered && (
              <button onClick={handleNext} className={styles.nextBtn}>
                {currentIdx + 1 < questions.length ? 'السؤال التالي ➔' : 'عرض النتيجة النهائية 🏁'}
              </button>
            )}
          </div>
        )}

        {/* FINISHED SCREEN */}
        {quizState === 'finished' && (
          <div className={styles.quizCard} style={{ textAlign: 'center' }}>
            <div className={styles.resultCircle}>
              <span className={styles.resultScore}>{score}</span>
              <span className={styles.resultTotal}>/ {questions.length}</span>
            </div>

            <h2 className={styles.resultTitle}>{scoreInfo.title}</h2>
            <p className={styles.resultDesc}>{scoreInfo.desc}</p>

            <div className={styles.resultActions}>
              <button onClick={handleStartQuiz} className={styles.btnPrimary}>
                إعادة المحاولة 🔄
              </button>
              <button onClick={handleReset} className={styles.btnSecondary}>
                اختبار جديد 📝
              </button>
              <Link href="/" className={styles.btnOutline}>
                العودة للبحث الرئيسي 🏠
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

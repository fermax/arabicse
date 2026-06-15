import re

class EducationalClassifier:
    # 1. Subject semantic vocabularies with weights
    SUBJECTS = {
        "اللغة العربية وآدابها": [
            "اللغة العربية", "نصوص", "شعر", "نثر", "بلاغة", "إعراب", "قواعد", "قصيدة", 
            "استعارة", "تشبيه", "مجاز", "أدب", "أديب", "البناء اللغوي", "البناء الفكري", 
            "الاعراب", "المجاز", "القصيدة", "أدبية", "ادبية", "نص", "الكاتب", "الشاعر"
        ],
        "الرياضيات": [
            "رياضيات", "دالة", "دوال", "تكامل", "مشتقة", "متتاليات", "هندسة", "مبرهنة", 
            "احتمالات", "إحصاء", "مصفوفات", "أشعة", "زاوية", "معادلات", "متراجحات", 
            "أعداد مركبة", "قواسم", "مضاعفات", "نهايات", "مماس", "الاشتقاق", "حساب مثلثي"
        ],
        "العلوم الفيزيائية": [
            "فيزياء", "كيمياء", "قوة", "حركة", "سرعة", "طاقة حركية", "طاقة كامنة", "ميكانيك", 
            "كهرباء", "مغناطيس", "مقاومة", "مكثفة", "وشيعة", "نووي", "إشعاع", "تفاعل كيميائي", 
            "حمض", "أساس", "أكسدة", "إرجاع", "كمية المادة", "مول", "ناقلية", "توازن كيميائي"
        ],
        "علوم الطبيعة والحياة": [
            "علوم طبيعية", "خلية", "بروتين", "إنزيم", "تركيب ضوئي", "تنفس", "علم الوراثة", 
            "مناعة", "جيولوجيا", "صخور", "زلازل", "قشرة أرضية", "عصبون", "مشبك", "اتصال عصبي",
            "صخر", "حمض نووي", "adn", "التحلية", "النظام البيئي", "العضلة", "العصبي"
        ],
        "الفلسفة": [
            "فلسفة", "أطروحة", "جدلية", "مقالة فلسفية", "إدراك", "إحساس", "ذاكرة", "خيال", 
            "لغة", "فكر", "أخلاق", "دولة", "عدالة", "حرية", "مسؤولية", "فلسفة العلوم", 
            "الحقيقة", "العنف", "التسامح", "الشعور", "اللاشعور", "المنطق"
        ],
        "التاريخ والجغرافيا": [
            "تاريخ", "جغرافيا", "ثورة", "استعمار", "احتلال", "حرب باردة", "معركة", 
            "جبهة التحرير", "مؤتمر", "خريطة", "مناخ", "تضاريس", "سكان", "تنمية", 
            "تهيئة إقليمية", "اقتصاد عالمي", "الاتحاد الأوروبي", "الولايات المتحدة", "الجزائر",
            "استقلال", "الاستعمار", "الحرب العالمية", "الموقع الفلكي", "الصناعة"
        ],
        "العلوم الإسلامية": [
            "علوم إسلامية", "قرآن", "حديث", "فقه", "شريعة", "عقيدة", "إيمان", "معاملات", 
            "إرث", "زكاة", "طهارة", "ربا", "ربا الفضل", "ربا النسيئة", "الأخلاق الإسلامية", 
            "مقاصد الشريعة", "الرسول", "النبي", "الصحابة", "القرآن", "السنة"
        ],
        "اللغة الإنجليزية": [
            "english", "grammar", "tenses", "verb", "vocabulary", "reading", "writing", 
            "passive", "active", "unit", "text", "pronunciation", "vocabulary", "إنجليزية"
        ],
        "اللغة الفرنسية": [
            "français", "grammaire", "texte", "auteur", "conjugaison", "verbe", "vocabulaire", 
            "expression écrite", "projet", "français", "فرنسية"
        ],
        "تسيير مالي ومحاسبي": [
            "ميزانية", "محاسبة", "جرد", "اهتلاك", "مؤونة", "حسابات", "مدين", "دائن", 
            "قيد محاسبي", "كشف راتب", "فاتورة", "تسجيل محاسبي", "المخزونات"
        ],
        "اقتصاد وقانون": [
            "عقد", "شركة", "عمل", "تجارة", "بيع", "شراء", "نقود", "بنك", "تضخم", 
            "بطالة", "سوق", "عرض", "طلب", "قانون العمل", "الشركات", "النظام القانوني"
        ],
        "تكنولوجيا": [
            "كهرباء صناعية", "هندسة مدنية", "هندسة طرائق", "هندسة ميكانيكية", "صمام", "دارة", 
            "إسمنت", "خرسانة", "تفاعلات عضوية", "ميكانيك تطبيقي", "مخطط كهربائي"
        ]
    }

    # 2. Academic levels
    LEVELS = {
        "3AS": ["3as", "بكالوريا", "باك", "bac", "ثالثة ثانوي", "سنة ثالثة", "شهادة البكالوريا"],
        "2AS": ["2as", "ثانية ثانوي", "2 ثا", "سنة ثانية", "الثانية ثانوي"],
        "1AS": ["1as", "أولى ثانوي", "1 ثا", "سنة أولى", "الأولى ثانوي", "جذع مشترك"]
    }

    # 3. Branches
    BRANCHES = {
        "علوم تجريبية": ["علوم تجريبية", "ع ت", "شعبة العلوم", "علوم الطبيعة", "فيزياء", "طبيعية"],
        "رياضيات": ["شعبة الرياضيات", "رياضيات", "تقني رياضي", "هندسة"],
        "تقني رياضي": ["تقني رياضي", "ت ر", "هندسة مدنية", "هندسة ميكانيكية", "هندسة طرائق", "هندسة كهربائية"],
        "تسيير واقتصاد": ["تسيير واقتصاد", "ت و", "محاسبة", "مالية", "اقتصاد", "دائن", "مدين"],
        "آداب وفلسفة": ["آداب وفلسفة", "أ ف", "شعبة الآداب", "فلسفة", "مقالة فلسفية"],
        "لغات أجنبية": ["لغات أجنبية", "ل أ", "فرنسية", "إنجليزية", "إسبانية", "ألمانية", "إيطالية"]
    }

    # Stopwords for teacher name cleaning
    STOPWORDS = {"في", "على", "من", "عن", "مع", "إلى", "الذي", "التي", "هو", "هي", "تم", "هذا", "هذه", "أن", "ان", "درس", "ملخص", "شرح", "فيديو", "يقدم", "يقدمه", "يشرح", "شرحا", "شرحاً", "مقدم", "قناة"}

    @classmethod
    def clean_text(cls, text):
        if not text:
            return ""
        # Lowercase, remove special characters and retain Arabic/English words
        text = text.lower()
        words = re.findall(r"[\u0621-\u064A0-9a-zA-Z_-]+", text)
        return " ".join(words)

    @classmethod
    def classify_subject(cls, title, content, url):
        full_text = f"{title} {url} {content}"
        cleaned = cls.clean_text(full_text)
        
        scores = {}
        for subject, keywords in cls.SUBJECTS.items():
            score = 0
            # Give higher weights to title and URL matches
            cleaned_title_url = cls.clean_text(f"{title} {url}")
            for kw in keywords:
                kw_cleaned = cls.clean_text(kw)
                if not kw_cleaned:
                    continue
                score += cleaned_title_url.count(kw_cleaned) * 8
                score += cleaned.count(kw_cleaned) * 1
                
            scores[subject] = score

        # Find subject with maximum score
        best_subject = max(scores, key=scores.get)
        # If score is very low (e.g. no match at all), default to "اللغة العربية وآدابها"
        if scores[best_subject] == 0:
            return "اللغة العربية وآدابها"
        return best_subject

    @classmethod
    def classify_level(cls, title, content, url):
        full_text = f"{title} {url} {content}"
        cleaned = cls.clean_text(full_text)
        
        scores = {}
        for level, keywords in cls.LEVELS.items():
            score = 0
            cleaned_title_url = cls.clean_text(f"{title} {url}")
            for kw in keywords:
                kw_cleaned = cls.clean_text(kw)
                if not kw_cleaned:
                    continue
                score += cleaned_title_url.count(kw_cleaned) * 5
                score += cleaned.count(kw_cleaned) * 1
            scores[level] = score

        best_level = max(scores, key=scores.get)
        if scores[best_level] == 0:
            return "3AS"  # Default to Baccalaureate
        return best_level

    @classmethod
    def classify_branch(cls, title, content, url, subject=None):
        level = cls.classify_level(title, content, url)
        if level == "1AS":
            return "عام"

        full_text = f"{title} {url} {content}"
        cleaned = cls.clean_text(full_text)
        
        if subject == "فلسفة" or subject == "الفلسفة":
            return "آداب وفلسفة"
        if subject == "تسيير مالي ومحاسبي" or subject == "اقتصاد وقانون":
            return "تسيير واقتصاد"
        
        scores = {}
        for branch, keywords in cls.BRANCHES.items():
            score = 0
            cleaned_title_url = cls.clean_text(f"{title} {url}")
            for kw in keywords:
                kw_cleaned = cls.clean_text(kw)
                if not kw_cleaned:
                    continue
                score += cleaned_title_url.count(kw_cleaned) * 5
                score += cleaned.count(kw_cleaned) * 1
            scores[branch] = score

        best_branch = max(scores, key=scores.get)
        if scores[best_branch] == 0:
            return "عام"  # General/All branches
        return best_branch

    @classmethod
    def extract_teacher(cls, title, content, author_name=None):
        teacher_pattern = r"(الأستاذ|الأستاذة)\s+([\u0621-\u064A]+(?:\s+[\u0621-\u064A]+){0,2})"
        
        for text_source in [title, author_name, content]:
            if not text_source:
                continue
            match = re.search(teacher_pattern, text_source)
            if match:
                prefix = match.group(1)
                name_parts = match.group(2).strip().split()
                filtered_parts = []
                for part in name_parts:
                    if part in cls.STOPWORDS:
                        break
                    filtered_parts.append(part)
                if filtered_parts:
                    return f"{prefix} {' '.join(filtered_parts)}"
        
        if author_name and len(author_name.strip()) > 2 and author_name != "YouTube":
            return author_name.strip()
            
        return "أستاذ المادة"

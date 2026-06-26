import os
import sys
import json
import time
import requests
from elasticsearch import Elasticsearch

# تهيئة الاتصال بـ Elasticsearch
ES_URL = "http://localhost:9200"
OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "qwen2.5:7b"
INDEX_NAME = "documents"

# المواد الدراسية الرسمية المعتمدة
VALID_SUBJECTS = [
    "اللغة العربية وآدابها", "الرياضيات", "العلوم الفيزيائية", "علوم الطبيعة والحياة",
    "الفلسفة", "التاريخ والجغرافيا", "العلوم الإسلامية", "اللغة الإنجليزية",
    "اللغة الفرنسية", "تسيير مالي ومحاسبي", "اقتصاد وقانون", "تكنولوجيا"
]

# السنوات الدراسية الرسمية
VALID_LEVELS = ["3AS", "2AS", "1AS"]

# الشعب الدراسية الرسمية
VALID_BRANCHES = ["علوم تجريبية", "رياضيات", "تقني رياضي", "تسيير واقتصاد", "آداب وفلسفة", "لغات أجنبية", "عام"]

# أنواع الملفات
VALID_FILE_TYPES = ["ملخص", "تمرين", "موضوع بكالوريا سابق", "كتاب", "شرح فيديو"]

def get_unclassified_documents(es):
    """
    جلب الوثائق التي لم يتم تصنيفها بالذكاء الاصطناعي المحلي بعد.
    """
    query = {
        "query": {
            "bool": {
                "must_not": [
                    {
                        "term": {
                            "metadata.llm_classified": True
                        }
                    }
                ]
            }
        }
    }
    try:
        # نبدأ بحجم 1000 وثيقة كحد أقصى للتشغيل الليلي
        res = es.search(index=INDEX_NAME, query=query["query"], size=1000)
        hits = res["hits"]["hits"]
        return hits
    except Exception as e:
        print(f"[-] خطأ أثناء جلب البيانات من Elasticsearch: {e}")
        return []

def classify_with_ollama(title, content, url):
    """
    إرسال بيانات المستند لنموذج Qwen2.5 عبر Ollama واستلام التصنيفات كـ JSON.
    """
    # نأخذ جزءاً كافياً من المحتوى لتوفير الوقت وسرعة المعالجة
    content_snippet = content[:600] if content else ""
    
    prompt = f"""
أنت خبير محترف في تصنيف المستندات والملفات التعليمية الجزائرية لجميع أطوار الثانوي.
قم بتحليل المستند التعليمي التالي بدقة:
- العنوان: {title}
- الرابط: {url}
- المحتوى: {content_snippet}

قم بتصنيف المستند وإرجاع الإجابة بصيغة JSON حصرياً تحتوي على المفاتيح التالية فقط:
1. "subject": اختر مادة واحدة فقط من هذه القائمة حصراً: {json.dumps(VALID_SUBJECTS, ensure_ascii=False)}
2. "level": حدد السنة الدراسية من هذه القائمة حصراً: {json.dumps(VALID_LEVELS, ensure_ascii=False)} (3AS تعني بكالوريا، 2AS ثانية ثانوي، 1AS أولى ثانوي).
3. "branch": حدد الشعبة الدراسية من هذه القائمة حصراً: {json.dumps(VALID_BRANCHES, ensure_ascii=False)}. تنبيه: إذا كانت السنة الدراسية "1AS" يجب أن تكون الشعبة دائماً "عام".
4. "teacher": استخلص اسم الأستاذ بدقة بالصيغة (الأستاذ فلان أو الأستاذة فلانة) إذا ذكر في العنوان أو النص. وإلا أرجع "أستاذ المادة".
5. "file_type": حدد نوع الملف من هذه القائمة حصراً: {json.dumps(VALID_FILE_TYPES, ensure_ascii=False)} (إذا كان الرابط يوتيوب فهو دائماً "شرح فيديو").
6. "wilaya": استخلص اسم الولاية الجزائرية إن ذكرت في النص (مثل الجزائر، وهران، قسنطينة، إلخ)، وإلا أرجع "الجزائر".

شروط الإخراج:
- أرجع كائن JSON صالح فقط، بدون أي شرح، وبدون استخدام كود تجميلي مثل ```json أو أي نصوص زائدة.
"""

    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "format": "json"
    }

    try:
        response = requests.post(OLLAMA_URL, json=payload, timeout=180)
        if response.status_code == 200:
            result = response.json()
            response_text = result.get("response", "").strip()
            # فك ترميز JSON المستلم من النموذج
            classified_data = json.loads(response_text)
            return classified_data
        else:
            print(f"[-] فشل الاتصال بـ Ollama. رمز الاستجابة: {response.status_code}")
            return None
    except Exception as e:
        print(f"[-] خطأ أثناء استدعاء Ollama: {e}")
        return None

def validate_and_clean_data(data, original_url):
    """
    التحقق من صحة المدخلات والتصنيفات والتأكد من توافقها مع القيم المعتمدة.
    """
    if not data or not isinstance(data, dict):
        return None
        
    # التحقق من المادة الدراسية
    subject = data.get("subject", "اللغة العربية وآدابها")
    if subject not in VALID_SUBJECTS:
        subject = "اللغة العربية وآدابها"
        
    # التحقق من السنة الدراسية
    level = data.get("level", "3AS")
    if level not in VALID_LEVELS:
        level = "3AS"
        
    # التحقق من الشعبة الدراسية
    branch = data.get("branch", "عام")
    if level == "1AS":
        branch = "عام"
    elif branch not in VALID_BRANCHES:
        branch = "عام"
        
    # التحقق من نوع الملف
    file_type = data.get("file_type", "ملخص")
    if "youtube.com" in original_url.lower() or "youtu.be" in original_url.lower():
        file_type = "شرح فيديو"
    elif file_type not in VALID_FILE_TYPES:
        file_type = "ملخص"
        
    # اسم الأستاذ والولاية
    teacher = data.get("teacher", "أستاذ المادة")
    if not teacher or len(teacher.strip()) < 2:
        teacher = "أستاذ المادة"
        
    wilaya = data.get("wilaya", "الجزائر")
    if not wilaya:
        wilaya = "الجزائر"

    return {
        "subject": subject,
        "level": level,
        "branch": branch,
        "file_type": file_type,
        "teacher": teacher,
        "wilaya": wilaya
    }

def main():
    print("[*] بدء سكريبت التصنيف والفرز الليلي باستخدام ذكاء اصطناعي محلي...")
    start_time = time.time()
    
    time_limit = None
    if len(sys.argv) > 1:
        try:
            time_limit = int(sys.argv[1])
            print(f"[+] تم ضبط مهلة تشغيل زمنية: {time_limit} ثانية.")
        except ValueError:
            pass
    
    # الاتصال بـ Elasticsearch
    try:
        es = Elasticsearch([ES_URL])
        if not es.ping():
            print("[-] لا يمكن الاتصال بـ Elasticsearch. تأكد من تشغيل الحاوية.")
            sys.exit(1)
        print("[+] تم الاتصال بـ Elasticsearch بنجاح.")
    except Exception as e:
        print(f"[-] خطأ اتصال: {e}")
        sys.exit(1)

    # جلب الوثائق التي تحتاج لتصنيف
    documents = get_unclassified_documents(es)
    total_docs = len(documents)
    print(f"[+] تم العثور على {total_docs} وثيقة تحتاج لتصنيف ذكي.")
    
    if total_docs == 0:
        print("[+] لا توجد مستندات جديدة لتصنيفها. انتهى العمل بنجاح.")
        sys.exit(0)

    success_count = 0
    
    for index, hit in enumerate(documents, 1):
        # التحقق من انتهاء المهلة الزمنية
        if time_limit and (time.time() - start_time) > time_limit:
            print(f"\n[!] تم الوصول إلى الحد الزمني المسموح به ({time_limit} ثانية). إيقاف المعالجة مؤقتاً وحفظ التقدم...")
            break
            
        doc_id = hit["_id"]
        source = hit["_source"]
        
        title = source.get("title", "")
        content = source.get("content", "")
        url = source.get("url", "")
        doc_type = source.get("type", "lesson")
        
        print(f"[{index}/{total_docs}] جاري تصنيف الوثيقة: {title[:50]}...")
        
        # استدعاء النموذج المحلي
        llm_response = classify_with_ollama(title, content, url)
        
        # التحقق وتطهير المخرجات
        cleaned_data = validate_and_clean_data(llm_response, url)
        
        if cleaned_data:
            # إعداد الحقول للتحديث
            metadata = source.get("metadata", {})
            metadata["level"] = cleaned_data["level"]
            metadata["subject"] = cleaned_data["subject"]
            metadata["llm_classified"] = True  # وسم لمنع إعادة التصنيف لاحقاً
            
            updated_doc = {
                "title": title,
                "content": content,
                "url": url,
                "type": doc_type,
                "subject": cleaned_data["subject"],
                "branch": cleaned_data["branch"],
                "wilaya": cleaned_data["wilaya"],
                "teacher": cleaned_data["teacher"],
                "file_type": cleaned_data["file_type"],
                "metadata": metadata,
                "crawled_at": source.get("crawled_at", "")
            }
            
            try:
                es.index(index=INDEX_NAME, id=doc_id, document=updated_doc)
                print(f"    ✅ تم التصنيف: المادة: {cleaned_data['subject']} | السنة: {cleaned_data['level']} | الشعبة: {cleaned_data['branch']} | الأستاذ: {cleaned_data['teacher']}")
                success_count += 1
            except Exception as e:
                print(f"    [-] خطأ أثناء حفظ التحديث في Elasticsearch للوثيقة {doc_id}: {e}")
        else:
            print("    ❌ فشل التصنيف بالذكاء الاصطناعي لهذه الوثيقة. سيتم محاولتها في المرة القادمة.")
            
    print(f"\n[+] اكتملت العملية. تم بنجاح تصنيف {success_count}/{total_docs} وثيقة.")

if __name__ == "__main__":
    main()

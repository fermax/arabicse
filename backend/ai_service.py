import aiohttp
import json
import re
from sqlalchemy.orm import Session
import models

# Default model names for each provider
DEFAULT_MODELS = {
    "gemini": "gemini-1.5-flash",
    "deepseek": "deepseek-chat",
    "groq": "llama3-8b-8192",
    "openrouter": "meta-llama/llama-3-8b-instruct:free",
    "mock": "mock-model"
}

# Helper to get active AI settings from database
def get_active_settings(db: Session):
    provider_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "ai_provider").first()
    key_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "ai_api_key").first()
    model_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "ai_model").first()
    
    provider = provider_setting.value if provider_setting else "mock"
    api_key = key_setting.value if key_setting else ""
    model_name = model_setting.value if model_setting else DEFAULT_MODELS.get(provider, "mock-model")
    
    if not model_name or model_name == "mock-model":
        model_name = DEFAULT_MODELS.get(provider, "mock-model")
        
    return {
        "provider": provider,
        "api_key": api_key,
        "model_name": model_name
    }

# Dynamic call function to call the selected AI provider
async def call_ai_provider(prompt: str, provider: str, api_key: str, model_name: str) -> str:
    if provider == "mock" or not api_key:
        return "" # Handled by caller to use mock fallback
        
    async with aiohttp.ClientSession() as session:
        try:
            if provider == "gemini":
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
                payload = {
                    "contents": [{
                        "parts": [{"text": prompt}]
                    }],
                    "generationConfig": {
                        "temperature": 0.3
                    }
                }
                async with session.post(url, json=payload, timeout=15) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return data["candidates"][0]["content"]["parts"][0]["text"]
                    else:
                        err_text = await resp.text()
                        print(f"Gemini API error ({resp.status}): {err_text}")
                        return ""
                        
            else:
                # OpenAI compatible endpoint mapping
                urls = {
                    "deepseek": "https://api.deepseek.com/v1/chat/completions",
                    "groq": "https://api.groq.com/openai/v1/chat/completions",
                    "openrouter": "https://openrouter.ai/api/v1/chat/completions"
                }
                
                url = urls.get(provider)
                if not url:
                    return ""
                    
                headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                }
                
                if provider == "openrouter":
                    headers["HTTP-Referer"] = "http://localhost:4000"
                    headers["X-Title"] = "Bayan Edu Search"
                    
                payload = {
                    "model": model_name,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.3
                }
                
                async with session.post(url, json=payload, headers=headers, timeout=15) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return data["choices"][0]["message"]["content"]
                    else:
                        err_text = await resp.text()
                        print(f"{provider.capitalize()} API error ({resp.status}): {err_text}")
                        return ""
                        
        except Exception as e:
            print(f"Error calling {provider} API: {e}")
            return ""

# RAG Answer Generator
async def generate_rag_answer(question: str, docs: list, provider: str, api_key: str, model_name: str) -> str:
    # Build context
    context_items = []
    for i, doc in enumerate(docs):
        context_items.append(f"المستند [{i+1}]: {doc.get('title')}\nالمحتوى: {doc.get('highlight') or doc.get('content')[:300]}")
    context = "\n\n".join(context_items)
    
    prompt = f"""أنت معلم دراسي خبير ومساعد ذكي للتعليم الثانوي في الجزائر. مهمتك هي إجابة سؤال الطالب بناءً على المستندات والدروس التالية فقط.
سؤال الطالب: {question}

السياق والمستندات المتاحة:
{context}

يرجى إعطاء إجابة نموذجية ومنظمة وواضحة باللغة العربية الفصحى. استخدم التنسيق الغني (Markdown) مثل القوائم والخط العريض لتسهيل القراءة. إذا لم تجد الإجابة في السياق، وضح ذلك بأدب ولا تقم باختلاق معلومات خارج السياق."""

    # Call AI
    answer = await call_ai_provider(prompt, provider, api_key, model_name)
    
    if answer:
        return answer
        
    # Mock fallback
    return generate_mock_rag_answer(question, docs)

# Dynamic Quiz Generator
async def generate_quiz_questions(topic: str, docs: list, provider: str, api_key: str, model_name: str) -> list:
    context_items = []
    for i, doc in enumerate(docs[:3]):
        context_items.append(f"محتوى [{i+1}]: {doc.get('title')}\n{doc.get('content')[:400]}")
    context = "\n\n".join(context_items)
    
    prompt = f"""أنت مصمم امتحانات تعليمية خبير للتعليم الثانوي في الجزائر. مهمتك هي توليد 5 أسئلة خيارات متعددة (MCQ) لاختبار استيعاب الطالب للموضوع أو الدرس التالي.

محتوى الدرس والسياق المتاح:
{context}

موضوع الدرس العام: {topic}

يجب أن ترجع النتيجة بصيغة JSON حصراً وتكون عبارة عن مصفوفة من الكائنات (JSON Array of Objects) بالهيكل التالي تماماً دون أي نص خارجي أو علامات markdown للفات بالفيديو:
[
  {{
    "question": "نص السؤال باللغة العربية الفصحى",
    "options": ["الخيار الأول", "الخيار الثاني", "الخيار الثالث", "الخيار الرابع"],
    "correct_option": 0, // رقم صحيح يمثل فهرس الخيار الصحيح (0 إلى 3)
    "explanation": "شرح مفصل وواضح باللغة العربية لسبب صحة هذا الخيار وكيفية استخلاصه من الدرس"
  }}
]
تأكد من تنوع وصعوبة الأسئلة لتشمل الفهم والتطبيق."""

    ai_response = await call_ai_provider(prompt, provider, api_key, model_name)
    
    if ai_response:
        try:
            # Clean JSON markdown wrapper
            cleaned = ai_response.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
            
            questions = json.loads(cleaned)
            if isinstance(questions, list) and len(questions) > 0:
                return questions
        except Exception as e:
            print(f"Error parsing generated quiz JSON: {e}. Raw response: {ai_response}")
            
    # Mock fallback
    return generate_mock_quiz_questions(topic, docs)

def generate_mock_rag_answer(question: str, docs: list) -> str:
    if not docs:
        return "عذراً، لم أتمكن من العثور على أي مستندات دراسية تتعلق بسؤالك في قاعدة البيانات، لذا لا يمكنني تقديم إجابة دقيقة حالياً."
        
    doc_titles = [d.get("title") for d in docs]
    snippet = docs[0].get("highlight") or docs[0].get("content")[:200]
    # Clean HTML tags from snippet
    snippet = re.sub(r'<[^>]*>', '', snippet)
    
    answer = f"""### 🤖 إجابة مساعد بيان AI (محاكاة ذكية):
 
أهلاً بك! بناءً على الدروس والمستندات المتوفرة في المنصة حول موضوع **"{question}"** (وخاصة درس *{doc_titles[0]}*):

1. **المفهوم العام**:
   {snippet}...
   
2. **النقاط الأساسية المستخلصة**:
   * تم استخراج هذا المحتوى من المناهج المعتمدة للتعليم الثانوي.
   * يمكنك الاطلاع على الدروس المرفقة في قسم المراجع أدناه لقراءة الشرح الكامل وتحميل التمارين وحلولها النموذجية.
   
*ملاحظة: هذه الإجابة تم إنشاؤها عبر محاكي الذكاء الاصطناعي الخاص بالمنصة نظراً لعدم إعداد مفتاح API حقيقي من قِبل الإدارة.*"""
    return answer

# Mock Quiz generator helper
def generate_mock_quiz_questions(topic: str, docs: list = None) -> list:
    questions = []
    
    # Try to extract actual questions from retrieved documents
    if docs:
        all_text = ""
        for doc in docs:
            all_text += " " + (doc.get("content") or "")
            
        # Clean text
        all_text = re.sub(r'\s+', ' ', all_text).strip()
        
        # Split into sentences using common Arabic punctuation
        sentences = re.split(r'[.!?•\n]\s*', all_text)
        sentences = [s.strip() for s in sentences if len(s.strip()) > 30]
        
        definitions = []
        for s in sentences:
            # Look for definition structures in Arabic:
            # Word + (هو|هي|عبارة عن|يمثل|تعتبر|يُعرف بـ) + description
            match = re.search(
                r'\b([\u0621-\u064A\s]{3,30})\s+(هو|هي|عبارة\s+عن|يمثل|تعتبر|يُعرّف\s+بأن|يُعرّف\s+بـ|تُعرف\s+بأن)\s+([\u0621-\u064A\s\d\(\)\-\,\.\:\!\?]{15,120})',
                s
            )
            if match:
                term = match.group(1).strip()
                definition = match.group(3).strip()
                # Clean up leading/trailing particles
                term = re.sub(r'^(أن|بأن|الـ|في|من|على|أن|إن|حيث|حيث\s+أن)\s+', '', term)
                if len(term.split()) <= 4 and term not in ["هذا", "ذلك", "وهي", "وهو", "كما", "التي", "الذي", "حيث", "عن"]:
                    definitions.append((term, definition, s))
        
        # Build quiz questions from definitions
        for term, definition, original_sentence in definitions:
            if len(questions) >= 5:
                break
                
            # Create distractors from other definitions
            other_defs = [d[1] for d in definitions if d[0] != term]
            distractors = []
            for d in other_defs:
                if d not in distractors and len(d) > 20:
                    distractors.append(d)
                    
            # If not enough distractors, add high quality general ones
            while len(distractors) < 3:
                distractors.append(f"يمثل القوانين الرياضية لتفسير حركة الجسيمات في الفضاء الثلاثي الأبعاد.")
                distractors.append(f"هو المقاربة المفاهيمية لتحليل البنية اللغوية للنصوص الأدبية والبلاغية.")
                distractors.append(f"يعبر عن التغير الطردي لدرجات الحرارة والضغط الجوي المقاس في المرتفعات.")
                
            options = [definition] + distractors[:3]
            
            # Deterministic shuffle or just random
            import random
            indices = [0, 1, 2, 3]
            random.shuffle(indices)
            shuffled_options = [options[i] for i in indices]
            correct_option = indices.index(0)
            
            questions.append({
                "question": f"ما هو التعريف أو المفهوم الدقيق للمصطلح: '{term}'؟",
                "options": shuffled_options,
                "correct_option": correct_option,
                "explanation": f"وفقاً لمحتوى الدرس المرجعي: {original_sentence}"
            })
            
    # If we got at least 3 questions, we can fill the rest or return them
    if len(questions) >= 3:
        # Let's top it up to 5 if needed
        if len(questions) < 5:
            general_pool = [
                {
                    "question": f"ما هي الخطوة المنهجية الأساسية للتحقق من صحة الفرضيات العلمية في درس '{topic}'؟",
                    "options": ["الاستنتاج المباشر دون تجربة", "القيام بالتجريب العلمي والملاحظة المنظمة وثم تحليل النتائج", "الاعتماد على التخمين الشخصي البسيط", "إهمال النتائج التي تعارض الفرضية"],
                    "correct_option": 1,
                    "explanation": "المنهج العلمي السليم يعتمد على الملاحظة، بناء الفرضية، ثم التجريب والتحليل للوصول إلى الاستنتاجات الصحيحة."
                },
                {
                    "question": "الهدف الأساسي من حل الاختبارات التفاعلية والتقييم الذاتي في المنصة هو:",
                    "options": ["الحفظ الآلي للأسئلة فقط دون فهم", "تثبيت المفاهيم العلمية وتحديد نقاط القوة والضعف لتعزيز التحصيل الدراسي", "مقارنة الدرجات والترتيب مع الزملاء بشكل سلبي", "تجنب قراءة ومذاكرة الدروس المنهجية المعتمدة"],
                    "correct_option": 1,
                    "explanation": "يهدف التقييم الذاتي لمساعدة المتعلم على قياس مستواه الدراسي بشكل ذاتي، تثبيت المعلومات، وتوضيح المفاهيم الغامضة."
                }
            ]
            for g_q in general_pool:
                if len(questions) >= 5:
                    break
                questions.append(g_q)
        return questions

    # Default fallback set if no docs or docs extraction failed
    topic_lower = (topic or "").lower()
    
    if "فيز" in topic_lower or "كهرب" in topic_lower or "ميكانيك" in topic_lower:
        return [
            {
                "question": "ما هي وحدة قياس المقاومة الكهربائية في النظام الدولي للوحدات؟",
                "options": ["الفولت", "الأمبير", "الأوم", "الوات"],
                "correct_option": 2,
                "explanation": "الأوم (Ω) هو وحدة قياس المقاومة الكهربائية، بينما الفولت هو الجهد الكهربائي، والأمبير للتيار."
            },
            {
                "question": "وفقاً لقانون نيوتن الثاني، القوة تساوي الكتلة مضروبة في:",
                "options": ["السرعة", "التسارع", "المسافة", "الزمن"],
                "correct_option": 1,
                "explanation": "ينص القانون على أن القوة (F) تساوي الكتلة (m) مضروبة في التسارع (a): F = m * a."
            },
            {
                "question": "ما هو الجهاز المستخدم لقياس شدة التيار الكهربائي؟",
                "options": ["الفولتمتر", "الأومتر", "البارومتر", "الأمبيرمتر"],
                "correct_option": 3,
                "explanation": "الأمبيرمتر هو الجهاز المخصص لقياس شدة التيار المار في دارة كهربائية ويربط على التسلسل."
            },
            {
                "question": "طاقة الحركة لجسم كتلته m وسرعته v تعطى بالعلاقة:",
                "options": ["m * v", "0.5 * m * v", "0.5 * m * v^2", "m * v^2"],
                "correct_option": 2,
                "explanation": "طاقة الحركة (Ec) تحسب بالقانون: Ec = 1/2 * m * v^2."
            },
            {
                "question": "عند انضغاط نابض مرن، تختزن فيه طاقة:",
                "options": ["حركية", "كامنة مرونية", "كامنة ثقالية", "حرارية"],
                "correct_option": 1,
                "explanation": "تشوه النابض بالانضغاط أو الاستطالة يؤدي إلى تخزين طاقة كامنة مرونية (Epe)."
            }
        ]
    elif "أدب" in topic_lower or "عرب" in topic_lower or "شعر" in topic_lower or "بلاغ" in topic_lower:
        return [
            {
                "question": "من هو شاعر الرسول صلى الله عليه وسلم؟",
                "options": ["حسان بن ثابت", "كعب بن زهير", "المتنبي", "أحمد شوقي"],
                "correct_option": 0,
                "explanation": "حسان بن ثابت الأنصاري هو الشاعر الذي كان يدافع عن الرسول والإسلام ولقب بشاعر الرسول."
            },
            {
                "question": "ما هو نوع التشبيه في الجملة: 'العلم نور'؟",
                "options": ["تشبيه مجمل", "تشبيه بليغ", "تشبيه مفصل", "تشبيه تمثيلي"],
                "correct_option": 1,
                "explanation": "التشبيه البليغ هو ما حُذفت منه أداة التشبيه ووجه الشبه، وبقي المشبه والمشبه به فقط."
            },
            {
                "question": "ما هو البحر الشعري الذي يزن على تفاعيل: 'مفاعلتن مفاعلتن فعولن'؟",
                "options": ["بحر الطويل", "بحر البسيط", "بحر الوافر", "بحر الكامل"],
                "correct_option": 2,
                "explanation": "وزن بحر الوافر هو: مفاعلتن مفاعلتن فعولن (في مجزوئه أو تامه)."
            },
            {
                "question": "ما الكلمة التي تمثل استعارة مكنية في قولنا: 'سجدت الأشجار للريح'؟",
                "options": ["الريح", "سجدت الأشجار", "للريح", "الأشجار"],
                "correct_option": 1,
                "explanation": "سجدت الأشجار استعارة مكنية حيث شبه الأشجار بإنسان يسجد، وحذف المشبه به ودل عليه بشيء من لوازمه وهو السجود."
            },
            {
                "question": "ما الفن الأدبي الذي يتميز بالمحسن البديعي 'السجع' في نهاية الجمل؟",
                "options": ["الشعر الحر", "الرواية", "المقامة", "القصيدة العمودية"],
                "correct_option": 2,
                "explanation": "المقامة فن نثري أدبي يعتمد بكثافة على السجع والجناس والمحسنات اللفظية البديعية."
            }
        ]
    else:
        # Default Mathematics & Logic Quiz
        return [
            {
                "question": "ما هي نهاية الدالة (1/x) عندما يؤول x إلى ما لا نهاية موجبة (+∞)؟",
                "options": ["+∞", "1", "0", "-∞"],
                "correct_option": 2,
                "explanation": "نهاية مقلوب x عند اللانهاية تساوي دائماً الصفر (عدد على لانهاية يساوي صفر)."
            },
            {
                "question": "إذا كانت الدالة f متزايدة تماماً على مجال، فإن دالتها المشتقة f' تكون:",
                "options": ["سالبة تماماً", "معدومة", "موجبة تماماً", "متناقصة"],
                "correct_option": 2,
                "explanation": "تكون المشتقة موجبة تماماً (f' > 0) على المجال الذي تكون فيه الدالة الأصلية متزايدة تماماً."
            },
            {
                "question": "ما هي قيمة المتتالية الحسابية التي حدها الأول U0 = 2 وأساسها r = 3 عند الحد U5؟",
                "options": ["15", "17", "12", "20"],
                "correct_option": 1,
                "explanation": "قانون الحد العام: Un = U0 + n*r. بالتعويض: U5 = 2 + 5*3 = 2 + 15 = 17."
            },
            {
                "question": "مجموعة تعريف الدالة اللوغاريتمية النيبيرية ln(x) هي المجال:",
                "options": ["كل الأعداد الحقيقية R", "المجال المغلق [0, +∞)", "المجال المفتوح (0, +∞)", "كل الأعداد غير المعدومة"],
                "correct_option": 2,
                "explanation": "الدالة ln(x) معرفة فقط للأعداد الحقيقية الموجبة تماماً (أكبر تماماً من الصفر)."
            },
            {
                "question": "ما هي الدالة الأصلية للدالة f(x) = 2x؟",
                "options": ["F(x) = x^2 + c", "F(x) = 2", "F(x) = x^2 / 2 + c", "F(x) = 2x^2 + c"],
                "correct_option": 0,
                "explanation": "مشتقة x^2 هي 2x، وبالتالي فإن الدالة الأصلية لـ 2x هي x^2 زائد ثابت الاختيار c."
            }
        ]

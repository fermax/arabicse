@echo off
chcp 65001 > nul
echo ========================================================
echo [ Nightly Classifier ] بدء تشغيل الفرز والزحف الذكي لليان
echo ========================================================

:: 1. التحقق من تشغيل Ollama أو تشغيلها تلقائياً
tasklist /fi "imagename eq ollama.exe" 2>NUL | find /i /n "ollama.exe" >NUL
if "%ERRORLEVEL%"=="0" (
    echo [+][Ollama] تعمل بالفعل في الخلفية.
) else (
    echo [*][Ollama] الخدمة غير نشطة. جاري تشغيل Ollama...
    start "" "%USERPROFILE%\AppData\Local\Programs\Ollama\ollama.exe"
    echo [*] انتظار تشغيل الخدمة (15 ثانية)...
    timeout /t 15 /nobreak
)

:: 2. الانتقال إلى مسار المشروع وتشغيل سكريبت التصنيف
echo [*] تشغيل سكريبت التصنيف الذكي...
cd /d "%~dp0"
.\venv\Scripts\python.exe classify_local_llm.py

:: 3. إغلاق خدمة Ollama تلقائياً لتحرير موارد الجهاز وكارت الشاشة
echo [*] إنهاء عمل خدمة Ollama لتحرير الذاكرة وكارت الشاشة...
taskkill /f /im ollama.exe >nul 2>&1
taskkill /f /im ollama_llama_server.exe >nul 2>&1

echo ========================================================
echo [ Nightly Classifier ] انتهى العمل بنجاح وتم إغلاق الخدمة
echo ========================================================
pause

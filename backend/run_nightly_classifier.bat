@echo off
echo ========================================================
echo [ Nightly Classifier ] Starting local AI classification
echo ========================================================

:: Check if Ollama is running
tasklist /fi "imagename eq ollama.exe" 2>NUL | find /i /n "ollama.exe" >NUL
if "%ERRORLEVEL%"=="0" (
    echo [+] Ollama is already running.
) else (
    echo [*] Ollama is not active. Starting Ollama...
    start "" "%USERPROFILE%\AppData\Local\Programs\Ollama\ollama.exe"
    echo [*] Waiting for Ollama to load 15 seconds...
    timeout /t 15 /nobreak
)

:: Run classification script
echo [*] Running python classifier script...
cd /d "%~dp0"
.\venv\Scripts\python.exe -u classify_local_llm.py %*

:: Terminate Ollama to release RAM and VRAM
echo [*] Shutting down Ollama to free system resources...
taskkill /f /im ollama.exe >nul 2>&1
taskkill /f /im ollama_llama_server.exe >nul 2>&1

echo ========================================================
echo [ Nightly Classifier ] Finished successfully
echo ========================================================

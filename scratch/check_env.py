import os

print("--- Checking API keys and environment variables ---")
for key in os.environ:
    if "API" in key or "KEY" in key or "GEMINI" in key or "GOOGLE" in key or "TOKEN" in key:
        # Print key name and length of value for security
        val = os.environ[key]
        print(f"{key}: length={len(val)}, starts with={val[:4] if len(val) > 4 else '...'}")

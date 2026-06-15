import os
import psycopg2

def upgrade():
    # Load env
    db_url = "postgresql://postgres:postgres@localhost:5432/arabic_se"
    env_path = os.path.join(os.path.dirname(__file__), "..", "backend", ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.strip().startswith("DATABASE_URL="):
                    db_url = line.strip().split("=", 1)[1].strip()
                    break
                    
    print(f"Connecting to database to apply Phase 3 upgrades: {db_url}")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    # 1. Create table system_settings if not exists
    cur.execute("""
    CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(100) PRIMARY KEY,
        value VARCHAR(1000) NULL
    );
    """)
    print("Table 'system_settings' created/verified.")
    
    # 2. Insert default values if not present
    defaults = {
        "ai_provider": "mock",
        "ai_api_key": "",
        "ai_model": "mock-model"
    }
    
    for key, val in defaults.items():
        cur.execute("SELECT 1 FROM system_settings WHERE key = %s", (key,))
        exists = cur.fetchone()
        if not exists:
            cur.execute("INSERT INTO system_settings (key, value) VALUES (%s, %s)", (key, val))
            print(f"Initialized default setting: {key}='{val}'")
            
    conn.commit()
    cur.close()
    conn.close()
    print("Database Phase 3 upgrade completed successfully.")

if __name__ == "__main__":
    upgrade()

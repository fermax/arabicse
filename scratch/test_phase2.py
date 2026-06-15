import requests
import sys
import uuid
import json

API_BASE = "http://localhost:8080"

def test_phase2_flow():
    print("--- starting phase 2 backend tests ---")
    
    # 1. Register a new user
    email = f"student_{uuid.uuid4().hex[:6]}@bayan.dz"
    password = "SecurePassword123"
    full_name = "طالب تجريبي"
    
    print(f"\n1. Registering user: {email}...")
    reg_data = {
        "email": email,
        "password": password,
        "full_name": full_name
    }
    
    res = requests.post(f"{API_BASE}/register", json=reg_data)
    if res.status_code != 200:
        print(f"Error registering user: {res.text}")
        sys.exit(1)
        
    user_data = res.json()
    user_id = user_data["id"]
    print(f"Success! User registered with ID: {user_id}")
    
    # 2. Login to get JWT Token
    print("\n2. Logging in...")
    login_data = {
        "username": email,
        "password": password
    }
    res = requests.post(f"{API_BASE}/login", data=login_data)
    if res.status_code != 200:
        print(f"Error logging in: {res.text}")
        sys.exit(1)
        
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("Success! Token received.")
    
    # 3. Update Profile Settings
    print("\n3. Updating user profile...")
    profile_update = {
        "full_name": "أحمد الطالب",
        "level": "3AS",
        "branch": "علوم تجريبية"
    }
    res = requests.put(f"{API_BASE}/api/users/profile", json=profile_update, headers=headers)
    if res.status_code != 200:
        print(f"Error updating profile: {res.text}")
        sys.exit(1)
        
    updated_user = res.json()
    assert updated_user["level"] == "3AS"
    assert updated_user["branch"] == "علوم تجريبية"
    assert updated_user["full_name"] == "أحمد الطالب"
    print("Success! User profile updated to 3AS & علوم تجريبية.")
    
    # 4. Create Subscriptions
    # Let's subscribe to: Subject "الرياضيات", Level "3AS", Branch "علوم تجريبية"
    print("\n4. Creating subscription for Mathematics (الرياضيات)...")
    sub_data = {
        "subject": "الرياضيات",
        "level": "3AS",
        "branch": "علوم تجريبية",
        "teacher": "الأستاذ بوسيف"
    }
    res = requests.post(f"{API_BASE}/api/subscriptions", json=sub_data, headers=headers)
    if res.status_code != 200:
        print(f"Error creating subscription: {res.text}")
        sys.exit(1)
        
    sub_res = res.json()
    sub_id = sub_res["id"]
    print(f"Success! Subscription created with ID: {sub_id}")
    
    # Verify subscription is returned by GET /api/subscriptions
    res = requests.get(f"{API_BASE}/api/subscriptions", headers=headers)
    subs = res.json()
    assert len(subs) > 0
    assert any(s["id"] == sub_id for s in subs)
    print(f"Success! Found active subscriptions: {len(subs)}")
    
    # 5. Upload a document simulating a teacher's upload matching user's subscription
    # We must be an admin/teacher to upload. Let's use social_auth to create an admin/teacher quickly or register a teacher.
    # Actually, we can use the admin role. Let's register a teacher.
    teacher_email = f"teacher_{uuid.uuid4().hex[:6]}@bayan.dz"
    print(f"\n5. Registering teacher: {teacher_email}...")
    res = requests.post(f"{API_BASE}/register", json={
        "email": teacher_email,
        "password": "TeacherPassword123",
        "full_name": "الأستاذ بوسيف"
    })
    if res.status_code != 200:
        print(f"Error registering teacher: {res.text}")
        sys.exit(1)
        
    # Get teacher token
    res = requests.post(f"{API_BASE}/login", data={"username": teacher_email, "password": "TeacherPassword123"})
    teacher_token = res.json()["access_token"]
    
    # Force teacher role by calling social auth under same email with provider or we can use admin to promote,
    # or let's use the login of an admin if we have one.
    # Wait, social_auth creates a user with 'student' role.
    # Let's check how main.py handles roles.
    # Let's see: `is_verified_teacher` is updated via admin. But let's check:
    # We can perform a social login to get a user and then we can promote it. Or can we upload if we are admin?
    # Let's use the teacher token but wait, models.User has role. Let's see if we can perform a verification test.
    # Wait, instead of setting up a complex admin role modification in tests, we can just trigger a test upload.
    # Wait! In main.py:
    # `if current_user.role not in ["teacher", "admin"]:` -> raises 403.
    # Let's see if we can promote our teacher user using our db script, or since the test runs on the same machine,
    # we can run a direct python command to update our user's role to "teacher" in PostgreSQL!
    # Yes! We can run a direct DB script to update role of `teacher_email` to `teacher` and `is_verified_teacher` to `True`.
    
    print(f"Promoting {teacher_email} to verified teacher in database...")
    import psycopg2
    import os
    db_url = "postgresql://postgres:postgres@localhost:5432/arabic_se"
    if os.path.exists("backend/.env"):
        with open("backend/.env") as f:
            for line in f:
                if line.strip().startswith("DATABASE_URL="):
                    db_url = line.strip().split("=", 1)[1].strip()
                    break
    elif os.path.exists("../backend/.env"):
        with open("../backend/.env") as f:
            for line in f:
                if line.strip().startswith("DATABASE_URL="):
                    db_url = line.strip().split("=", 1)[1].strip()
                    break
    print(f"Connecting to DB using URL: {db_url}")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute("UPDATE users SET role = 'teacher', is_verified_teacher = true WHERE email = %s", (teacher_email,))
    conn.commit()
    cur.close()
    conn.close()
    print("Teacher promoted successfully.")
    
    # Now upload the document
    teacher_headers = {"Authorization": f"Bearer {teacher_token}"}
    doc_title = f"ملخص شامل للمتتاليات العددية {uuid.uuid4().hex[:4]}"
    print(f"Uploading document: '{doc_title}'...")
    
    files = {
        'file': ('test_doc.txt', b'content text about math sequences and series and limits.')
    }
    data = {
        'title': doc_title,
        'subject': 'الرياضيات',
        'level': '3AS',
        'branch': 'علوم تجريبية',
        'file_type': 'ملخص',
        'wilaya': 'الجزائر'
    }
    
    res = requests.post(
        f"{API_BASE}/api/documents/upload",
        headers=teacher_headers,
        data=data,
        files=files
    )
    if res.status_code != 200:
        print(f"Error uploading document: {res.text}")
        sys.exit(1)
        
    doc_res = res.json()
    print(f"Success! Document uploaded. ID: {doc_res['document_id']}")
    
    # 6. Check if student received notifications
    print("\n6. Checking notifications for student user...")
    import time
    time.sleep(1) # wait for async background task to write to DB
    
    res = requests.get(f"{API_BASE}/api/notifications", headers=headers)
    if res.status_code != 200:
        print(f"Error fetching notifications: {res.text}")
        sys.exit(1)
        
    notifs = res.json()
    print(f"Student Notifications Count: {len(notifs)}")
    assert len(notifs) > 0, "No notifications received!"
    
    target_notif = notifs[0]
    print(f"Notification Title: {target_notif['title']}")
    print(f"Notification Message: {target_notif['message']}")
    assert "ملخص شامل للمتتاليات" in target_notif["message"]
    
    # Mark notification as read
    notif_id = target_notif["id"]
    print(f"Marking notification {notif_id} as read...")
    res = requests.post(f"{API_BASE}/api/notifications/{notif_id}/read", headers=headers)
    assert res.status_code == 200
    assert res.json()["is_read"] == True
    print("Success! Notification marked as read.")
    
    # 7. Test personalized search boosting
    print("\n7. Testing personalized search...")
    # Search for "متتاليات" without filters. Because user has 3AS and علوم تجريبية profile, 
    # it should trigger `is_personalized=True` in ES scoring.
    res = requests.get(f"{API_BASE}/api/search?q=متتاليات", headers=headers)
    if res.status_code != 200:
        print(f"Search failed: {res.text}")
        sys.exit(1)
        
    search_res = res.json()
    print(f"Personalized search returned is_personalized: {search_res.get('is_personalized')}")
    assert search_res.get("is_personalized") == True, "Search was not personalized!"
    
    # Now test search with manual filters: level="1AS" -> should NOT be personalized
    res = requests.get(f"{API_BASE}/api/search?q=متتاليات&level=1AS", headers=headers)
    search_res_filtered = res.json()
    print(f"Filtered search returned is_personalized: {search_res_filtered.get('is_personalized')}")
    assert search_res_filtered.get("is_personalized") == False, "Personalized should be false when level filter is applied!"
    
    print("\n--- ALL PHASE 2 TESTS PASSED SUCCESSFULLY! ---")

if __name__ == "__main__":
    test_phase2_flow()

import os
import sys
from elasticsearch import Elasticsearch

# Add crawler to path to import EducationalClassifier
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "crawler")))
from arabic_edu.classifier import EducationalClassifier

def reclassify_all():
    print("Connecting to Elasticsearch on http://localhost:9200...")
    es = Elasticsearch(["http://localhost:9200"])
    
    # 1. Fetch all documents (up to 1000)
    print("Fetching documents from index 'documents'...")
    try:
        res = es.search(index="documents", query={"match_all": {}}, size=1000)
        hits = res["hits"]["hits"]
        total_docs = len(hits)
        print(f"Found {total_docs} documents in index.")
    except Exception as e:
        print(f"Error fetching from Elasticsearch: {e}")
        return
        
    stats = {
        "subjects": {},
        "levels": {},
        "branches": {},
        "file_types": {},
        "teachers": {}
    }
    
    updated_count = 0
    
    # 2. Iterate and reclassify
    for hit in hits:
        doc_id = hit["_id"]
        source = hit["_source"]
        
        title = source.get("title", "")
        content = source.get("content", "")
        url = source.get("url", "")
        doc_type = source.get("type", "lesson")
        
        # Classify
        subject = EducationalClassifier.classify_subject(title, content, url)
        level = EducationalClassifier.classify_level(title, content, url)
        branch = EducationalClassifier.classify_branch(title, content, url, subject)
        teacher = EducationalClassifier.extract_teacher(title, content)
        
        # Re-determine file_type dynamically
        url_lower = url.lower()
        title_lower = title.lower()
        
        file_type = source.get("file_type")
        if "youtube.com" in url_lower or "youtu.be" in url_lower:
            file_type = "شرح فيديو"
        elif any(x in url_lower or x in title_lower for x in ["ملخص", "دروس", "تلخيص"]):
            file_type = "ملخص"
        elif any(x in url_lower or x in title_lower for x in ["تمرين", "تمارين", "مسائل"]):
            file_type = "تمرين"
        elif any(x in url_lower or x in title_lower for x in ["بكالوريا", "موضوع", "امتحان", "فرض", "bac"]):
            file_type = "موضوع بكالوريا سابق"
        elif any(x in url_lower or x in title_lower for x in ["كتاب", "كتب", "تحميل"]):
            file_type = "كتاب"
        else:
            if doc_type == 'exam':
                file_type = "موضوع بكالوريا سابق"
            elif doc_type == 'book':
                file_type = "كتاب"
            else:
                file_type = "ملخص"

        # Wilaya extraction
        wilayas = ["الجزائر", "وهران", "قسنطينة", "تيزي وزو", "سطيف", "شلف", "بجاية", "عنابة"]
        wilaya = None
        for w in wilayas:
            if w in title or w in content or w in url:
                wilaya = w
                break
        if not wilaya:
            wilaya = "الجزائر"

        # Update metadata
        metadata = source.get("metadata", {})
        metadata["level"] = level
        metadata["subject"] = subject
        
        # Prepare updated fields
        updated_doc = {
            "title": title,
            "content": content,
            "url": url,
            "type": doc_type,
            "subject": subject,
            "branch": branch,
            "wilaya": wilaya,
            "teacher": teacher,
            "file_type": file_type,
            "metadata": metadata,
            "crawled_at": source.get("crawled_at", "")
        }
        
        # Save to ES
        try:
            es.index(index="documents", id=doc_id, document=updated_doc)
            updated_count += 1
            
            # Record stats
            stats["subjects"][subject] = stats["subjects"].get(subject, 0) + 1
            stats["levels"][level] = stats["levels"].get(level, 0) + 1
            stats["branches"][branch] = stats["branches"].get(branch, 0) + 1
            stats["file_types"][file_type] = stats["file_types"].get(file_type, 0) + 1
            stats["teachers"][teacher] = stats["teachers"].get(teacher, 0) + 1
        except Exception as e:
            print(f"Failed to update document {doc_id}: {e}")
            
    print(f"\nSuccessfully reclassified and indexed {updated_count}/{total_docs} documents.")
    
    # Print Stats Summary
    print("\n=== AI Classification Summary ===")
    print("\nSubjects (المواد):")
    for k, v in sorted(stats["subjects"].items(), key=lambda x: x[1], reverse=True):
        print(f" - {k}: {v} documents")
        
    print("\nAcademic Levels (السنة الدراسية):")
    for k, v in sorted(stats["levels"].items(), key=lambda x: x[1], reverse=True):
        print(f" - {k}: {v} documents")
        
    print("\nBranches (الشعب):")
    for k, v in sorted(stats["branches"].items(), key=lambda x: x[1], reverse=True):
        print(f" - {k}: {v} documents")

    print("\nFile Types (نوع الملف):")
    for k, v in sorted(stats["file_types"].items(), key=lambda x: x[1], reverse=True):
        print(f" - {k}: {v} documents")

    print("\nTop Teachers (أبرز الأساتذة):")
    for k, v in sorted(stats["teachers"].items(), key=lambda x: x[1], reverse=True)[:10]:
        print(f" - {k}: {v} documents")

if __name__ == "__main__":
    reclassify_all()

import asyncio
from elasticsearch import AsyncElasticsearch

async def enrich_existing_documents():
    es = AsyncElasticsearch(["http://localhost:9200"])
    
    print("1. Fetching all indexed documents...")
    try:
        res = await es.search(
            index="documents",
            body={"query": {"match_all": {}}},
            size=200
        )
        hits = res['hits']['hits']
        print(f"   Found {len(hits)} documents in Elasticsearch.")
    except Exception as e:
        print(f"   Failed to search documents: {e}")
        await es.close()
        return

    branches = ["علوم تجريبية", "رياضيات", "تقني رياضي", "تسيير واقتصاد", "آداب وفلسفة", "لغات أجنبية"]
    wilayas = ["الجزائر", "وهران", "قسنطينة", "تيزي وزو", "سطيف", "شلف", "بجاية", "عنابة"]
    teachers = ["الأستاذ بوسيف", "الأستاذ أحمد", "الأستاذة عائشة", "الأستاذ بن سالم", "الأستاذة ليلى"]
    file_types = ["ملخص", "تمرين", "موضوع بكالوريا سابق", "كتاب"]

    print("\n2. Enriching and updating documents...")
    updated_count = 0
    for hit in hits:
        doc_id = hit["_id"]
        source = hit["_source"]
        
        url = source.get("url", "")
        title = source.get("title", "")
        content = source.get("content", "")
        
        url_lower = url.lower()
        title_lower = title.lower()
        
        # Branch
        branch = None
        for b in branches:
            if b in title_lower or b in url_lower or b in content:
                branch = b
                break
        if not branch:
            branch = branches[len(url) % len(branches)]
            
        # File Type
        file_type = None
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
            file_type = file_types[len(url) % len(file_types)]
            
        # Wilaya
        wilaya = None
        for w in wilayas:
            if w in title or w in content or w in url:
                wilaya = w
                break
        if not wilaya:
            wilaya = wilayas[len(url) % len(wilayas)]
        
        # Teacher (extract from title/content if present, else fallback)
        teacher_fallback = teachers[len(url) % len(teachers)]
        teacher = teacher_fallback
        
        import re
        teacher_pattern = r"(الأستاذ|الأستاذة)\s+([\u0621-\u064A]+(?:\s+[\u0621-\u064A]+){0,2})"
        
        for text_source in [title, content]:
            if not text_source:
                continue
            match = re.search(teacher_pattern, text_source)
            if match:
                prefix = match.group(1)
                name_parts = match.group(2).strip().split()
                filtered_parts = []
                stop_words = {"في", "على", "من", "عن", "مع", "إلى", "الذي", "التي", "هو", "هي", "تم", "هذا", "هذه", "أن", "ان"}
                for part in name_parts:
                    if part in stop_words:
                        break
                    filtered_parts.append(part)
                if filtered_parts:
                    teacher = f"{prefix} {' '.join(filtered_parts)}"
                    break

        
        # Build update body
        update_doc = {
            "branch": branch,
            "file_type": file_type,
            "wilaya": wilaya,
            "teacher": teacher,
            "subject": "اللغة العربية وآدابها"
        }
        
        try:
            await es.update(
                index="documents",
                id=doc_id,
                body={"doc": update_doc}
            )
            updated_count += 1
        except Exception as e:
            print(f"   Error updating document {doc_id}: {e}")

    print(f"\n3. Migration complete! Successfully enriched {updated_count} documents in Elasticsearch.")
    await es.close()

if __name__ == "__main__":
    asyncio.run(enrich_existing_documents())

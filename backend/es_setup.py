import asyncio
from elasticsearch import AsyncElasticsearch

es = AsyncElasticsearch(["http://localhost:9200"])

async def setup_elasticsearch():
    # 1. Setup 'documents' index
    doc_mapping = {
        "mappings": {
            "properties": {
                "id": {"type": "keyword"},
                "title": {"type": "text", "analyzer": "arabic"},
                "content": {"type": "text", "analyzer": "arabic"},
                "url": {"type": "keyword"},
                "type": {"type": "keyword"},
                "metadata": {
                    "properties": {
                        "author": {"type": "text"},
                        "level": {"type": "keyword"},
                        "tags": {"type": "keyword"}
                    }
                },
                "crawled_at": {"type": "date"}
            }
        }
    }
    
    # 2. Setup 'keywords' index for autocomplete
    kw_mapping = {
        "mappings": {
            "properties": {
                "keyword": {
                    "type": "text",
                    "analyzer": "arabic",
                    "fields": {
                        "suggest": {
                            "type": "completion",
                            "analyzer": "arabic"
                        }
                    }
                },
                "frequency": {"type": "integer"},
                "intent_category": {"type": "keyword"}
            }
        }
    }

    try:
        # Create documents index
        if not await es.indices.exists(index="documents"):
            await es.indices.create(index="documents", body=doc_mapping)
            print("Created 'documents' index")
        else:
            print("'documents' index already exists")

        # Create keywords index
        if not await es.indices.exists(index="keywords"):
            await es.indices.create(index="keywords", body=kw_mapping)
            print("Created 'keywords' index")
        else:
            print("'keywords' index already exists")

    except Exception as e:
        print(f"Error setting up Elasticsearch: {e}")
    finally:
        await es.close()

if __name__ == "__main__":
    asyncio.run(setup_elasticsearch())

"""Quick test script to verify all new backend features."""

import asyncio
import json
import sys

import requests


BASE_URL = "http://localhost:8000"


def test_health():
    print("🔍 Testing /api/health...")
    response = requests.get(f"{BASE_URL}/api/health")
    data = response.json()
    print(f"✓ Status: {data['status']}")
    print(f"  Gemini: {data['gemini_key']}")
    print(f"  Supabase: {data['supabase']}")
    print(f"  Email: {data['email']}")
    print()


def test_metrics():
    print("📊 Testing /api/metrics...")
    response = requests.get(f"{BASE_URL}/api/metrics")
    data = response.json()
    print(f"✓ Total executions: {data['total_executions']}")
    print(f"  Success rate: {data['success_rate']}%")
    print(f"  Avg time: {data['average_execution_time_ms']}ms")
    print()


def test_history():
    print("📚 Testing /api/history...")
    response = requests.get(f"{BASE_URL}/api/history?limit=5")
    data = response.json()
    print(f"✓ Found {len(data)} research records")
    for record in data[:3]:
        print(f"  - {record['query'][:50]}... ({record['execution_time_ms']}ms)")
    print()


def test_run_research():
    print("🤖 Testing /api/run with caching...")
    query = "What are the benefits of AI?"
    
    print(f"  Query: {query}")
    response = requests.post(
        f"{BASE_URL}/api/run",
        json={"query": query, "use_cache": True},
        timeout=60
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Success: {data['success']}")
        print(f"  Goal: {data['goal']}")
        print(f"  Logs: {len(data['log'])} entries")
        if "Retrieved from cache" in data['log']:
            print(f"  ⚡ Result served from cache!")
        else:
            print(f"  🔬 Fresh research completed")
    else:
        print(f"✗ Failed: {response.status_code}")
    print()


def test_export():
    print("📄 Testing /api/export (PDF generation)...")
    query = "What are the benefits of AI?"
    
    response = requests.post(
        f"{BASE_URL}/api/export",
        json={"query": query, "generate_pdf": True}
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Export successful")
        if data.get('pdf_url'):
            print(f"  PDF URL: {data['pdf_url'][:60]}...")
        else:
            print(f"  PDF generated (Supabase not configured)")
    else:
        print(f"✗ Failed: {response.status_code}")
        print(f"  Note: Run research first with /api/run")
    print()


def main():
    print("=" * 60)
    print("AgentOffice Backend Feature Test")
    print("=" * 60)
    print()
    
    try:
        test_health()
        test_metrics()
        test_history()
        
        print("⚠️  Running live research (may take 30-40 seconds)...")
        test_run_research()
        
        test_export()
        
        test_metrics()
        test_history()
        
        print("=" * 60)
        print("✅ All tests completed!")
        print("=" * 60)
        
    except requests.exceptions.ConnectionError:
        print("❌ Error: Backend server is not running on http://localhost:8000")
        print("   Start it with: uvicorn src.lib.server:app --reload --port 8000")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

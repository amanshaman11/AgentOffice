"""Quick test script to demonstrate all new backend features."""

import asyncio
import json
from datetime import datetime

import requests


BASE_URL = "http://localhost:8000"


def test_health():
    print("1. Testing Health Endpoint...")
    response = requests.get(f"{BASE_URL}/api/health")
    data = response.json()
    print(f"   Status: {data['status']}")
    print(f"   Version: {data['version']}")
    print(f"   Gemini: {data['gemini_key']}")
    print(f"   Supabase: {data['supabase']}")
    print(f"   Email: {data['email']}")
    print()


def test_research():
    print("2. Testing Research Execution...")
    response = requests.post(
        f"{BASE_URL}/api/run",
        json={"query": "benefits of renewable energy", "use_cache": False}
    )
    data = response.json()
    print(f"   Success: {data['success']}")
    print(f"   Goal: {data['goal']}")
    print(f"   Output length: {len(data['final_output'])} characters")
    print(f"   Steps executed: {len(data['log'])}")
    print()
    return data


def test_history():
    print("3. Testing History Endpoint...")
    response = requests.get(f"{BASE_URL}/api/history?limit=5")
    data = response.json()
    print(f"   Total records: {len(data['history'])}")
    if data['history']:
        latest = data['history'][0]
        print(f"   Latest query: {latest['query']}")
        print(f"   Created: {latest['created_at']}")
    print()


def test_metrics():
    print("4. Testing Metrics Endpoint...")
    response = requests.get(f"{BASE_URL}/api/metrics")
    data = response.json()
    print(f"   Total executions: {data['total_executions']}")
    print(f"   Success rate: {data['success_rate']}%")
    print(f"   Avg execution time: {data['average_execution_time_ms']}ms")
    if data['agent_metrics']:
        print(f"   Agents tracked: {', '.join(data['agent_metrics'].keys())}")
    print()


def test_search():
    print("5. Testing Search Endpoint...")
    response = requests.get(f"{BASE_URL}/api/search?q=renewable")
    data = response.json()
    print(f"   Search results: {len(data['results'])}")
    print()


def test_pdf_export(research_id: int):
    print("6. Testing PDF Export...")
    response = requests.get(f"{BASE_URL}/api/export/pdf/{research_id}")
    if response.status_code == 200:
        filename = f"test_research_{research_id}.pdf"
        with open(filename, "wb") as f:
            f.write(response.content)
        print(f"   PDF saved: {filename} ({len(response.content)} bytes)")
    else:
        print(f"   PDF export failed: {response.status_code}")
    print()


def test_websocket():
    print("7. WebSocket Streaming Test...")
    print("   (WebSocket requires async client - see BACKEND_FEATURES.md for example)")
    print()


def main():
    print("=" * 60)
    print("AgentOffice Backend Features Test")
    print("=" * 60)
    print()
    
    try:
        test_health()
        
        print("Waiting for research to complete (this may take 30-40 seconds)...")
        result = test_research()
        
        test_history()
        test_metrics()
        test_search()
        
        if result.get('success'):
            history_response = requests.get(f"{BASE_URL}/api/history?limit=1")
            history_data = history_response.json()
            if history_data['history']:
                research_id = history_data['history'][0]['id']
                test_pdf_export(research_id)
        
        test_websocket()
        
        print("=" * 60)
        print("All tests completed!")
        print("=" * 60)
        
    except requests.exceptions.ConnectionError:
        print("ERROR: Could not connect to backend server.")
        print("Make sure the server is running: uvicorn src.lib.server:app --reload --port 8000")
    except Exception as error:
        print(f"ERROR: {error}")


if __name__ == "__main__":
    main()

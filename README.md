# AgentOffice

**Build your AI workforce in minutes.**

## Overview

AgentOffice is a multi-agent workspace that allows users to create AI-powered offices for different tasks without building complex workflows manually.

Instead of configuring automation tools like n8n or writing code, users add built-in agents to their office roster in the order they want them to run — and that roster **is** the workflow. Send a query and every agent you added executes in sequence, each building on the previous agent's output.

Our vision is to make AI collaboration accessible through a visual office environment where agents communicate, validate each other's work, and deliver final results to the user.

## Problem

Current AI tools are powerful but difficult to use. Most users must:

- Learn automation platforms
- Connect APIs manually
- Build workflows themselves
- Manage multiple AI tools

This creates a high barrier for students, researchers, entrepreneurs, and non-technical users.

## Solution

AgentOffice allows users to create an AI office instead of building workflows manually.

**Simple process:**
1. Add AI agents to your office in execution order
2. Type a query and run the office
3. Each agent in your roster runs in sequence, then you receive the final result

Use the **Suggest workflow** (wand icon) to ask Gemini which agents to add for a given query, then hit **Apply to office** to load the recommendation into your roster in one click.

Agents collaborate, review each other's work, and can intervene when errors are detected.

## Team
| Name	| Role |
|-------|------|
| Nurmukhanbetov Aman	| AI Engineer |
| Ruslan Kim |	Product Manager |
| Arhan Us	| Lead Developer |

## Future Vision

AgentOffice will evolve into a platform where users can build complete AI teams for:

- Research
- Sales
- Marketing
- Customer Support
- Logistics
- Product Development
- Business Operations

## Office Types

### Research Office

Designed for academic and professional research.

| Agent | Role |
|-------|------|
| Searcher | Finds and collects sources |
| Analyzer | Reviews quality and sends feedback if weak |
| Summarizer | Creates concise research summary |
| Sender | Formats APA 7/MLA citations and delivers results |

**Intervention System:** Analyzer checks sources. If quality is weak, workflow returns to Searcher with feedback.

### SaaS Developer Office

Designed for software development projects.

| Agent | Role |
|-------|------|
| Planner | Converts ideas into development plans |
| Executor | Generates code and builds functionality |
| QA Engineer | Reviews code and sends feedback for fixes |
| Deployer | Creates deployment checklist and instructions |
| Marketing Manager | Generates launch content and social media assets |

**Intervention System:** QA reviews all code. If issues are found, workflow returns to Executor until requirements are met.

## Key Features

- Visual AI office interface (3D environment)
- **Roster = workflow**: every agent you add is an execution step, in the order you arranged them
- **AI workflow suggestion**: ask Gemini to recommend which agents to add for your query
- Multi-agent collaboration with intervention logic (analyzer failure retries searcher)
- Step-keyed outputs — duplicate agents (e.g. two Searchers) each have their own result
- Local memory and data storage
- Research automation with citation support (APA 7, MLA)
- Desktop-ready architecture
  
## Tech Stack

| Category | Technology |
|----------|------------|
| Frontend | React, Next.js, Three.js, Tailwind CSS |
| AI | Gemini API |
| Storage | LocalStorage, IndexedDB |
| Future | Claude, ChatGPT, DeepSeek, Grok, Cursor |

## Why AgentOffice?

Most AI products are chat interfaces. AgentOffice introduces a new interaction model: AI workers operating inside a visual office environment.

Instead of talking to one assistant, users manage an entire AI workforce.

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- Gemini API key

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/AgentOffice.git
cd AgentOffice

# Set up Python backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Add your Gemini API key
cp .env.example .env
# Edit .env and set GEMINI_API_KEY=your_key_here

# Install frontend dependencies
cd frontend && npm install && cd ..

# Start both backend and frontend with one command
npm run dev

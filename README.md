# AgentOffice

**Build your AI workforce in minutes.**

## Overview

AgentOffice is a multi-agent workspace that allows users to create AI-powered offices for different tasks without building complex workflows manually.

Instead of configuring automation tools like n8n or writing code, users simply choose an office type, add agents, and run a complete AI workflow.

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
1. Select an office type
2. Add AI agents
3. Run the office
4. Receive validated results

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
- Multi-agent collaboration with intervention logic
- Local memory and data storage
- Research automation with citation support (APA 7, MLA)
- SaaS development automation
- Email and Telegram export
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

# Navigate to project folder
cd AgentOffice

# Install dependencies
npm install

# Create .env.local file and add your API key
NEXT_PUBLIC_GEMINI_API_KEY=your_api_key_here

# Run the development server
npm run dev

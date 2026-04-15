# LLM-Knowledge-Bases

A hierarchical memory system for LLM assistants that enables human-like memory capabilities across conversations.

## Overview

This project provides tools for giving LLM agents persistent, hierarchical memory:

- **User Profiles** - Track user identity, goals, preferences, and facts
- **Context Threads** - Maintain conversation history with automatic compression
- **Hierarchical Memory** - Compresses old messages into summaries while keeping recent context fresh
- **Fact Extraction** - Automatically extracts and stores important user information

Based on concepts from: [Andrej Karpathy's tweet](https://x.com/karpathy/status/2039805659525644595)

## Files

| File | Purpose |
|------|---------|
| `memory.ts` | Core memory system with user profiles, threads, and hierarchical compression |
| `skill-manager.ts` | Skill installation and management utilities |
| `tools/` | Additional tools and utilities |

## Memory Architecture

```
┌─────────────────────────────────────────────────────┐
│                 User Context                         │
│  ┌─────────────────────────────────────────────┐    │
│  │  User Profile                                │    │
│  │  - Identity, Goals, Preferences              │    │
│  │  - Facts with confidence scores             │    │
│  │  - Relationship tracking                    │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  Context Threads                            │    │
│  │                                             │    │
│  │  ┌─────────────────────────────────────┐    │    │
│  │  │ Recent Messages (Working Memory)     │    │    │
│  │  │ Last N messages kept verbatim       │    │    │
│  │  └─────────────────────────────────────┘    │    │
│  │                                             │    │
│  │  ┌─────────────────────────────────────┐    │    │
│  │  │ Compressed Summaries (Long-term)    │    │    │
│  │  │ Older messages → summaries           │    │    │
│  │  └─────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

## Usage

```typescript
import { MemoryStore } from './memory';

// Initialize with a data directory
const memory = new MemoryStore('./data');

// Get or create user profile
const profile = memory.getOrCreateProfile('user123', 'stan');

// Add a goal
memory.addGoal('user123', 'Build a chatbot', 'Create an LLM-powered assistant');

// Add conversation messages
memory.addMessageToThread('channel1', 'user123', 'user', 'I want to build a chatbot');
memory.addMessageToThread('channel1', 'user123', 'assistant', 'Great! I can help with that.');

// Build context for LLM prompt
const context = memory.buildUserContext('user123', 'stan');
```

## Key Concepts

### Hierarchical Memory
- **Working Memory**: Last N messages kept verbatim for fresh context
- **Compressed Summaries**: Older messages compressed into summaries to prevent unlimited growth
- **Automatic Compaction**: Threads automatically compact when they exceed threshold

### Fact Extraction
Automatically extracts from conversations:
- User interests and hobbies
- Goals and objectives
- Motivations and reasons
- Preferences

### Confidence Tracking
- Facts have confidence scores that increase when reinforced
- Higher confidence facts appear first in context

## License

MIT

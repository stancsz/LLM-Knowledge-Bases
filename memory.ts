/**
 * memory.ts - Hierarchical Memory System for LLM Assistants
 *
 * Provides human-like memory capabilities for LLM agents:
 * - User profiles (identity, goals, motivations, relationships)
 * - Assistant identity/personality (configurable)
 * - Context threads with hierarchical compression
 * - Facts with source and confidence tracking
 *
 * Based on concepts from: https://x.com/karpathy/status/2039805659525644595
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ============================================================================
// Types
// ============================================================================

export interface UserProfile {
  id: string;
  name: string;
  displayName?: string;
  discriminator?: string;
  relationships: Relationship[];
  goals: Goal[];
  motivations: string[];
  preferences: UserPreferences;
  facts: Fact[];
  contextThreads: ContextThread[];
  lastSeen: number;
  firstSeen: number;
  interactionCount: number;
}

export interface Relationship {
  targetId: string;
  targetName: string;
  type: "friend" | "colleague" | "family" | "acquaintance" | "assistant" | "unknown";
  strength: number; // 0-1
  notes?: string;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  status: "active" | "completed" | "abandoned" | "on_hold";
  createdAt: number;
  updatedAt: number;
  relatedThreads: string[];
}

export interface UserPreferences {
  tone: "formal" | "casual" | "playful" | "warm";
  communicationStyle: "concise" | "detailed" | "balanced";
  interests: string[];
  topicsToAvoid: string[];
}

export interface Fact {
  id: string;
  content: string;
  category: "identity" | "preference" | "goal" | "motivation" | "relationship" | "interest" | "project" | "general";
  confidence: number; // 0-1
  source: string; // where we learned this
  createdAt: number;
  lastReinforced: number;
}

export interface ContextThread {
  id: string;
  title: string;
  summary: string;
  status: "active" | "dormant" | "resolved";
  messages: ThreadMessage[];
  compressedSummaries: CompressedSummary[]; // Hierarchical memory: old msgs compressed
  createdAt: number;
  updatedAt: number;
}

export interface CompressedSummary {
  id: string;
  startIndex: number; // Which message this summarizes from
  endIndex: number;
  summary: string; // 2-3 sentence summary of that chunk
  keyFacts: string[]; // Extracted facts from this chunk
  timestamp: number;
}

export interface ThreadMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface AssistantIdentity {
  name: string;
  identity: string;
  personalityTraits: string[];
  values: string[];
  quirks: string[];
  formativeMemories: string[];
  relationships: MapOfRelationships;
}

export interface MapOfRelationships {
  [userId: string]: UserRelationship;
}

export interface UserRelationship {
  userId: string;
  name: string;
  rapportLevel: number; // 0-1, how close/trusting
  interactions: number;
  lastInteraction: number;
  notes: string;
}

// ============================================================================
// Memory Store
// ============================================================================

// Hierarchical memory constants
const WORKING_MEMORY_SIZE = 10; // Keep last N messages as-is
const COMPACT_THRESHOLD = 20; // When to trigger compaction
const COMPRESS_CHUNK_SIZE = 10; // Compress N messages at a time

export class MemoryStore {
  private dataDir: string;
  private profilesFile: string;
  private identityFile: string;
  private threadsFile: string;

  private userProfiles: Map<string, UserProfile> = new Map();
  private contextThreads: Map<string, ContextThread> = new Map();
  private identity: AssistantIdentity;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.profilesFile = join(dataDir, "profiles.json");
    this.identityFile = join(dataDir, "identity.json");
    this.threadsFile = join(dataDir, "threads.json");

    // Ensure data directory exists
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    this.load();
    this.initializeIdentity();
  }

  private load() {
    // Load user profiles
    try {
      if (existsSync(this.profilesFile)) {
        const data = JSON.parse(readFileSync(this.profilesFile, "utf-8"));
        for (const [id, profile] of Object.entries(data)) {
          this.userProfiles.set(id, profile as UserProfile);
        }
        console.log(`[memory] Loaded ${this.userProfiles.size} user profiles`);
      }
    } catch (e) {
      console.warn("[memory] Could not load profiles:", e);
    }

    // Load context threads
    try {
      if (existsSync(this.threadsFile)) {
        const data = JSON.parse(readFileSync(this.threadsFile, "utf-8"));
        for (const [id, thread] of Object.entries(data)) {
          // Ensure compressedSummaries exists (migrate from old format)
          if (!thread.compressedSummaries) {
            thread.compressedSummaries = [];
          }
          this.contextThreads.set(id, thread as ContextThread);
        }
        console.log(`[memory] Loaded ${this.contextThreads.size} context threads`);
      }
    } catch (e) {
      console.warn("[memory] Could not load threads:", e);
    }

    // Load assistant identity
    try {
      if (existsSync(this.identityFile)) {
        const data = JSON.parse(readFileSync(this.identityFile, "utf-8"));
        this.identity = data as AssistantIdentity;
      }
    } catch (e) {
      console.warn("[memory] Could not load identity:", e);
    }
  }

  save() {
    try {
      // Save profiles
      const profilesData: Record<string, UserProfile> = {};
      for (const [id, profile] of this.userProfiles) {
        profilesData[id] = profile;
      }
      writeFileSync(this.profilesFile, JSON.stringify(profilesData, null, 2));

      // Save threads
      const threadsData: Record<string, ContextThread> = {};
      for (const [id, thread] of this.contextThreads) {
        threadsData[id] = thread;
      }
      writeFileSync(this.threadsFile, JSON.stringify(threadsData, null, 2));

      // Save identity
      writeFileSync(this.identityFile, JSON.stringify(this.identity, null, 2));
    } catch (e) {
      console.warn("[memory] Could not save memory:", e);
    }
  }

  private initializeIdentity() {
    if (!this.identity) {
      this.identity = {
        name: "Assistant",
        identity: "A helpful AI assistant focused on being genuinely useful and remembering details that matter to users.",
        personalityTraits: [
          "Helpful and solution-oriented",
          "Curious about user needs and goals",
          "Remembers important details across conversations",
          "Adaptable tone based on user preferences",
          "Efficient without being dismissive"
        ],
        values: [
          "Being genuinely helpful",
          "Honesty and transparency",
          "Respecting user privacy and preferences",
          "Remembering details that enhance conversations"
        ],
        quirks: [
          "Notices patterns in user behavior",
          "Remembers user-stated preferences and goals",
          "Builds context over multiple conversations"
        ],
        formativeMemories: [
          "Learned that memory of user context dramatically improves assistance quality",
          "Designed to scale without losing personal touch"
        ],
        relationships: {}
      };
      this.save();
    }
  }

  // ============================================================================
  // User Profile Management
  // ============================================================================

  getOrCreateProfile(userId: string, username: string, discriminator?: string): UserProfile {
    let profile = this.userProfiles.get(userId);
    if (!profile) {
      profile = {
        id: userId,
        name: username,
        discriminator,
        relationships: [],
        goals: [],
        motivations: [],
        preferences: {
          tone: "balanced",
          communicationStyle: "balanced",
          interests: [],
          topicsToAvoid: []
        },
        facts: [],
        contextThreads: [],
        lastSeen: Date.now(),
        firstSeen: Date.now(),
        interactionCount: 0
      };
      this.userProfiles.set(userId, profile);
    }
    return profile;
  }

  getProfile(userId: string): UserProfile | undefined {
    return this.userProfiles.get(userId);
  }

  updateLastSeen(userId: string, username: string) {
    const profile = this.getOrCreateProfile(userId, username);
    profile.lastSeen = Date.now();
    profile.name = username; // Update name in case it changed
  }

  incrementInteractions(userId: string) {
    const profile = this.userProfiles.get(userId);
    if (profile) {
      profile.interactionCount++;
    }
  }

  // ============================================================================
  // Fact Management
  // ============================================================================

  addFact(userId: string, content: string, category: Fact["category"], confidence = 0.8, source = "conversation") {
    const profile = this.getOrCreateProfile(userId, userId);

    // Check if we already know this fact
    const existing = profile.facts.find(f =>
      f.content.toLowerCase() === content.toLowerCase()
    );

    if (existing) {
      existing.lastReinforced = Date.now();
      existing.confidence = Math.min(1, existing.confidence + 0.1);
      return existing;
    }

    const fact: Fact = {
      id: `fact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      content,
      category,
      confidence,
      source,
      createdAt: Date.now(),
      lastReinforced: Date.now()
    };

    profile.facts.push(fact);
    return fact;
  }

  getFacts(userId: string, category?: Fact["category"]): Fact[] {
    const profile = this.userProfiles.get(userId);
    if (!profile) return [];

    if (category) {
      return profile.facts.filter(f => f.category === category);
    }
    return profile.facts;
  }

  // ============================================================================
  // Goal Management
  // ============================================================================

  addGoal(userId: string, title: string, description: string): Goal {
    const profile = this.getOrCreateProfile(userId, userId);

    const goal: Goal = {
      id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title,
      description,
      status: "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      relatedThreads: []
    };

    profile.goals.push(goal);
    return goal;
  }

  updateGoalStatus(userId: string, goalId: string, status: Goal["status"]) {
    const profile = this.userProfiles.get(userId);
    if (!profile) return;

    const goal = profile.goals.find(g => g.id === goalId);
    if (goal) {
      goal.status = status;
      goal.updatedAt = Date.now();
    }
  }

  // ============================================================================
  // Relationship Management
  // ============================================================================

  addRelationship(userId: string, targetId: string, targetName: string, type: Relationship["type"]) {
    const profile = this.getOrCreateProfile(userId, userId);

    const existing = profile.relationships.find(r => r.targetId === targetId);
    if (existing) {
      existing.strength = Math.min(1, existing.strength + 0.1);
      return existing;
    }

    const relationship: Relationship = {
      targetId,
      targetName,
      type,
      strength: 0.5
    };

    profile.relationships.push(relationship);
    return relationship;
  }

  // ============================================================================
  // Context Threads
  // ============================================================================

  getOrCreateThread(channelId: string, userId: string, initialTitle: string): ContextThread {
    let thread = this.contextThreads.get(channelId);
    if (!thread) {
      thread = {
        id: channelId,
        title: initialTitle,
        summary: "",
        status: "active",
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      this.contextThreads.set(channelId, thread);
    }
    return thread;
  }

  addMessageToThread(channelId: string, userId: string, role: "user" | "assistant", content: string) {
    const thread = this.getOrCreateThread(channelId, userId, "Conversation");

    thread.messages.push({
      role,
      content,
      timestamp: Date.now()
    });

    // Auto-compact if thread is getting too long
    if (thread.messages.length >= COMPACT_THRESHOLD) {
      this.compactThread(channelId, userId);
    }

    thread.updatedAt = Date.now();
  }

  /**
   * Get thread context: compressed summaries + recent working memory
   * This is the main method for building context without bloat
   */
  getThreadContext(channelId: string, username: string, maxChars = 4000): string {
    const thread = this.contextThreads.get(channelId);
    if (!thread) return "";

    let context = "";

    // 1. Add compressed summaries (older conversation)
    if (thread.compressedSummaries && thread.compressedSummaries.length > 0) {
      context += "## Past Conversation Summary\n";
      for (const summary of thread.compressedSummaries) {
        context += `- ${summary.summary}\n`;
      }
      context += "\n";
    }

    // 2. Add recent messages (working memory)
    const recentMessages = thread.messages.slice(-WORKING_MEMORY_SIZE);
    if (recentMessages.length > 0) {
      context += "## Recent Conversation\n";
      for (const msg of recentMessages) {
        const speaker = msg.role === "user" ? username : "Assistant";
        context += `${speaker}: ${msg.content.slice(0, 200)}${msg.content.length > 200 ? "..." : ""}\n`;
      }
      context += "\n";
    }

    // Truncate if too long
    if (context.length > maxChars) {
      context = context.slice(-maxChars);
    }

    return context;
  }

  /**
   * Check if thread needs compaction
   */
  needsCompaction(channelId: string): boolean {
    const thread = this.contextThreads.get(channelId);
    if (!thread) return false;
    return thread.messages.length >= COMPACT_THRESHOLD;
  }

  /**
   * Compact old messages into summaries (hierarchical memory)
   * This compresses older messages to prevent unlimited growth
   */
  compactThread(channelId: string, userId: string) {
    const thread = this.contextThreads.get(channelId);
    if (!thread || thread.messages.length < COMPACT_THRESHOLD) return;

    // Only compact if we have more than WORKING_MEMORY_SIZE messages
    const messagesToCompact = thread.messages.slice(0, -WORKING_MEMORY_SIZE);
    if (messagesToCompact.length < 5) return; // Need at least 5 msgs to compress

    // Build a summary of what happened
    const summary = this.generateSimpleSummary(messagesToCompact, userId);
    const facts = this.extractFactsFromMessages(messagesToCompact, userId);

    // Add compressed summary
    thread.compressedSummaries.push({
      id: `comp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      startIndex: 0,
      endIndex: messagesToCompact.length - 1,
      summary,
      keyFacts: facts,
      timestamp: Date.now()
    });

    // Keep only working memory
    thread.messages = thread.messages.slice(-WORKING_MEMORY_SIZE);

    // Limit number of compressed summaries (keep last 20)
    if (thread.compressedSummaries.length > 20) {
      thread.compressedSummaries = thread.compressedSummaries.slice(-20);
    }

    console.log(`[memory] Compacted thread ${channelId}: ${messagesToCompact.length} msgs → 1 summary`);
  }

  /**
   * Simple extractive summarization - no LLM needed
   * Extracts key sentences and themes from messages
   */
  private generateSimpleSummary(messages: ThreadMessage[], userId: string): string {
    if (messages.length === 0) return "";

    const userMessages = messages.filter(m => m.role === "user");
    const assistantMessages = messages.filter(m => m.role === "assistant");

    // Find topics mentioned
    const topics = this.extractTopics(messages);

    // Find outcomes/results
    const outcomes: string[] = [];
    for (const msg of userMessages) {
      const lower = msg.content.toLowerCase();
      if (lower.includes("done") || lower.includes("finished") || lower.includes("worked") || lower.includes("success")) {
        outcomes.push(msg.content.slice(0, 80));
      }
    }

    let summary = "";

    // Topic summary
    if (topics.length > 0) {
      summary += `Discussed: ${topics.slice(0, 3).join(", ")}. `;
    }

    // Outcome summary
    if (outcomes.length > 0) {
      summary += `Outcomes: ${outcomes.slice(0, 2).join("; ")}.`;
    } else if (assistantMessages.length > 0) {
      // Last assistant response theme
      const lastAssistant = assistantMessages[assistantMessages.length - 1].content;
      summary += `Assistant helped with: ${lastAssistant.slice(0, 60)}...`;
    }

    // Message count
    summary += ` (${messages.length} messages)`;

    return summary || "General conversation";
  }

  /**
   * Extract topics/themes from messages
   */
  private extractTopics(messages: ThreadMessage[]): string[] {
    const topicKeywords = [
      "coding", "programming", "bug", "fix", "build", "test",
      "github", "git", "clone", "project", "code",
      "docker", "container", "deployment",
      "api", "database", "server", "web",
      "learning", "tutorial", "docs",
      "chatbot", "bot", "llm", "model", "training",
      "architecture", "design", "refactor"
    ];

    const found: string[] = [];
    const text = messages.map(m => m.content.toLowerCase()).join(" ");

    for (const keyword of topicKeywords) {
      if (text.includes(keyword) && !found.includes(keyword)) {
        found.push(keyword);
      }
    }

    return found;
  }

  /**
   * Extract facts from messages and store them in user profile
   */
  private extractFactsFromMessages(messages: ThreadMessage[], userId: string): string[] {
    const profile = this.getOrCreateProfile(userId, userId);
    const extractedFacts: string[] = [];

    for (const msg of messages) {
      if (msg.role !== "user") continue;

      // Interest detection
      const interestPatterns = [
        /i (like|love|enjoy|am into|am passionate about)/i,
        /my (hobby|interest|passion) is/i,
        /i've been working on/i,
        /i'm building/i,
        /i'm learning/i
      ];

      for (const pattern of interestPatterns) {
        const match = msg.content.match(pattern);
        if (match) {
          const fact = match[0] + " " + msg.content.slice(match.index! + match[0].length).split(/[,.]/)[0];
          if (fact.length > 10) {
            this.addFact(userId, fact.trim(), "interest", 0.5, "conversation_compression");
            extractedFacts.push(fact.trim());
          }
        }
      }

      // Goal detection
      const goalPatterns = [
        /i want to (.+)/i,
        /i'm trying to (.+)/i,
        /my goal is (.+)/i,
        /i need to (.+)/i
      ];

      for (const pattern of goalPatterns) {
        const match = msg.content.match(pattern);
        if (match && match[1] && match[1].length > 5) {
          const goal = match[1].trim().slice(0, 100);
          const existing = profile.goals.find(g => g.title.toLowerCase().includes(goal.toLowerCase().slice(0, 30)));
          if (!existing && goal.length > 5) {
            this.addGoal(userId, goal, `Extracted from conversation`);
            extractedFacts.push(`Goal: ${goal}`);
          }
        }
      }
    }

    return extractedFacts;
  }

  /**
   * Schedule periodic compaction for all threads
   */
  startCompactionScheduler(intervalMs = 60000) {
    setInterval(() => {
      for (const [channelId, thread] of this.contextThreads) {
        if (thread.messages.length >= COMPACT_THRESHOLD) {
          const userId = thread.messages[0]?.role === "user" ? "unknown" : "unknown";
          this.compactThread(channelId, userId);
        }
      }
    }, intervalMs);
  }

  // ============================================================================
  // Assistant Identity & User Relationship
  // ============================================================================

  updateUserRelationship(userId: string, name: string, notes: string) {
    if (!this.identity.relationships[userId]) {
      this.identity.relationships[userId] = {
        userId,
        name,
        rapportLevel: 0.1,
        interactions: 0,
        lastInteraction: Date.now(),
        notes: ""
      };
    }

    const rel = this.identity.relationships[userId];
    rel.interactions++;
    rel.lastInteraction = Date.now();
    rel.rapportLevel = Math.min(1, rel.rapportLevel + 0.01);
    rel.name = name;
    if (notes) rel.notes = notes;
  }

  getIdentity(): AssistantIdentity {
    return this.identity;
  }

  /**
   * Set custom assistant identity
   */
  setIdentity(name: string, identity: string, traits: string[], values: string[], quirks: string[]) {
    this.identity.name = name;
    this.identity.identity = identity;
    this.identity.personalityTraits = traits;
    this.identity.values = values;
    this.identity.quirks = quirks;
    this.save();
  }

  /**
   * Get rapport level for a user (0.0 to 1.0)
   */
  getRapportLevel(userId: string): number {
    const rel = this.identity.relationships[userId];
    return rel ? rel.rapportLevel : 0;
  }

  /**
   * Get tone adaptation based on rapport
   */
  getRapportTone(userId: string): string {
    const rapport = this.getRapportLevel(userId);

    if (rapport < 0.3) {
      return "polite and professional";
    } else if (rapport < 0.6) {
      return "friendly and warm";
    } else if (rapport < 0.8) {
      return "casual and relaxed";
    } else {
      return "familiar and comfortable";
    }
  }

  // ============================================================================
  // Context Building
  // ============================================================================

  /**
   * Build a rich context prompt with user knowledge
   */
  buildUserContext(userId: string, username: string): string {
    const profile = this.getOrCreateProfile(userId, username);

    let context = "";

    // Basic identity
    context += `## About ${username}\n`;
    context += `First seen: ${new Date(profile.firstSeen).toLocaleDateString()}\n`;
    context += `Interactions: ${profile.interactionCount}\n\n`;

    // Relationships
    if (profile.relationships.length > 0) {
      context += "## Relationships\n";
      for (const rel of profile.relationships) {
        context += `- ${rel.targetName} (${rel.type}, strength: ${Math.round(rel.strength * 100)}%)\n`;
      }
      context += "\n";
    }

    // Goals (active)
    const activeGoals = profile.goals.filter(g => g.status === "active");
    if (activeGoals.length > 0) {
      context += "## Active Goals\n";
      for (const goal of activeGoals) {
        context += `- ${goal.title}: ${goal.description}\n`;
      }
      context += "\n";
    }

    // Motivations
    if (profile.motivations.length > 0) {
      context += `## Motivations\n`;
      context += profile.motivations.map(m => `- ${m}`).join("\n") + "\n\n";
    }

    // Key facts by category
    const importantFacts = profile.facts
      .filter(f => f.confidence > 0.5)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);

    if (importantFacts.length > 0) {
      context += "## Things I Know About This Person\n";
      for (const fact of importantFacts) {
        context += `- ${fact.content} (${fact.category})\n`;
      }
      context += "\n";
    }

    // Preferences
    if (profile.preferences.interests.length > 0) {
      context += "## Interests\n";
      context += profile.preferences.interests.map(i => `- ${i}`).join("\n") + "\n\n";
    }

    // Recent context thread
    const thread = this.contextThreads.get(userId);
    if (thread && thread.messages.length > 0) {
      context += "## Recent Conversation\n";
      const recentMsgs = thread.messages.slice(-6);
      for (const msg of recentMsgs) {
        const speaker = msg.role === "user" ? username : "Assistant";
        context += `${speaker}: ${msg.content.slice(0, 100)}${msg.content.length > 100 ? "..." : ""}\n`;
      }
      context += "\n";
    }

    return context;
  }

  /**
   * Extract facts from conversation
   */
  processConversationForFacts(userId: string, username: string, userMessage: string, assistantMessage: string) {
    const lowerUser = userMessage.toLowerCase();

    // Detect interests
    const interestPatterns = [
      /i (like|love|enjoy|am into|am passionate about)/i,
      /my (hobby|interest|passion) is/i,
      /i've been working on/i,
      /i'm building/i,
      /i'm learning/i
    ];

    for (const pattern of interestPatterns) {
      if (pattern.test(userMessage)) {
        const match = userMessage.match(pattern);
        if (match && match[0]) {
          const interest = match[0] + " " + userMessage.slice(match.index! + match[0].length).split(/[,.]/)[0];
          this.addFact(userId, interest.trim(), "interest", 0.6, "conversation_inference");
        }
      }
    }

    // Detect goals
    const goalPatterns = [
      /i want to (.+)/i,
      /i'm trying to (.+)/i,
      /my goal is (.+)/i,
      /i need to (.+)/i,
      /i'm working on (.+)/i
    ];

    for (const pattern of goalPatterns) {
      const match = userMessage.match(pattern);
      if (match && match[1]) {
        const goalText = match[1].trim();
        if (goalText.length > 5 && goalText.length < 100) {
          this.addGoal(userId, goalText, `User mentioned: ${goalText}`);
        }
      }
    }

    // Detect motivations
    if (lowerUser.includes("because i want") || lowerUser.includes("so that i can") || lowerUser.includes("in order to")) {
      this.addFact(userId, userMessage.slice(Math.max(0, userMessage.toLowerCase().indexOf("because") - 10)), "motivation", 0.5, "conversation_inference");
    }
  }
}

/**
 * MemoryManager Unit Tests
 * 
 * Tests for AI conversation memory management including:
 * - Basic CRUD operations
 * - Session management
 * - Message pruning
 * - Statistics
 * - Redis persistence (if available)
 * 
 * @module __tests__/memory-manager
 */

import { MemoryManager } from "../utils/ai/MemoryManager";
import { AIMessage } from "../types/ai.types";

describe("MemoryManager", () => {
  let memoryManager: MemoryManager;

  beforeAll(() => {
    memoryManager = MemoryManager.getInstance();
  });

  afterEach(async () => {
    // Clean up test sessions
    const sessions = await memoryManager.getActiveSessions();
    for (const sessionId of sessions) {
      if (sessionId.startsWith("test-")) {
        await memoryManager.clearMemory(sessionId);
      }
    }
  });

  describe("Basic Operations", () => {
    it("should create a new conversation", async () => {
      const sessionId = "test-session-1";
      const memory = await memoryManager.getMemory(sessionId);

      expect(memory).toBeDefined();
      expect(memory.sessionId).toBe(sessionId);
      expect(memory.messages).toEqual([]);
    });

    it("should add messages to conversation", async () => {
      const sessionId = "test-session-2";

      const message1: AIMessage = {
        role: "user",
        content: "Hello",
        timestamp: Date.now(),
      };

      const message2: AIMessage = {
        role: "assistant",
        content: "Hi there!",
        timestamp: Date.now(),
      };

      await memoryManager.addMessage(sessionId, message1);
      await memoryManager.addMessage(sessionId, message2);

      const messages = await memoryManager.getMessages(sessionId);
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe("Hello");
      expect(messages[1].content).toBe("Hi there!");
    });

    it("should retrieve existing conversation", async () => {
      const sessionId = "test-session-3";

      const message: AIMessage = {
        role: "user",
        content: "Test message",
        timestamp: Date.now(),
      };

      await memoryManager.addMessage(sessionId, message);

      // Retrieve the conversation
      const memory = await memoryManager.getMemory(sessionId);
      expect(memory.messages).toHaveLength(1);
      expect(memory.messages[0].content).toBe("Test message");
    });

    it("should clear conversation", async () => {
      const sessionId = "test-session-4";

      const message: AIMessage = {
        role: "user",
        content: "Test",
        timestamp: Date.now(),
      };

      await memoryManager.addMessage(sessionId, message);
      await memoryManager.clearMemory(sessionId);

      const memory = await memoryManager.getMemory(sessionId);
      expect(memory.messages).toEqual([]);
    });
  });

  describe("Session Management", () => {
    it("should list active sessions", async () => {
      const sessionId1 = "test-session-5";
      const sessionId2 = "test-session-6";

      const message: AIMessage = {
        role: "user",
        content: "Test",
        timestamp: Date.now(),
      };

      await memoryManager.addMessage(sessionId1, message);
      await memoryManager.addMessage(sessionId2, message);

      const sessions = await memoryManager.getActiveSessions();
      expect(sessions).toContain(sessionId1);
      expect(sessions).toContain(sessionId2);
    });

    it("should get conversation count", async () => {
      const sessionId = "test-session-7";

      const message: AIMessage = {
        role: "user",
        content: "Test",
        timestamp: Date.now(),
      };

      await memoryManager.addMessage(sessionId, message);

      const count = await memoryManager.getConversationCount();
      expect(count).toBeGreaterThan(0);
    });
  });

  describe("Memory Pruning", () => {
    it("should prune messages when exceeding limit", async () => {
      const sessionId = "test-session-8";

      // Add system message
      const systemMessage: AIMessage = {
        role: "system",
        content: "You are a helpful assistant",
        timestamp: Date.now(),
      };
      await memoryManager.addMessage(sessionId, systemMessage);

      // Add 60 messages (exceeds MAX_MESSAGES of 50)
      for (let i = 0; i < 60; i++) {
        const message: AIMessage = {
          role: i % 2 === 0 ? "user" : "assistant",
          content: `Message ${i}`,
          timestamp: Date.now(),
        };
        await memoryManager.addMessage(sessionId, message);
      }

      const memory = await memoryManager.getMemory(sessionId);
      
      // Should keep system message + 50 recent messages
      expect(memory.messages.length).toBeLessThanOrEqual(51);
      
      // System message should be preserved
      expect(memory.messages[0].role).toBe("system");
    });
  });

  describe("Statistics", () => {
    it("should return memory stats", async () => {
      const sessionId = "test-session-9";

      const message: AIMessage = {
        role: "user",
        content: "Test",
        timestamp: Date.now(),
      };

      await memoryManager.addMessage(sessionId, message);

      const stats = await memoryManager.getStats();
      
      expect(stats).toHaveProperty("activeConversations");
      expect(stats).toHaveProperty("totalMessages");
      expect(stats).toHaveProperty("averageMessagesPerConversation");
      expect(stats).toHaveProperty("usingRedis");
      
      expect(stats.activeConversations).toBeGreaterThan(0);
      expect(stats.totalMessages).toBeGreaterThan(0);
    });
  });
});

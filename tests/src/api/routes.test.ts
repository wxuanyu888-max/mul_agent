// API Routes 测试
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import { createChatRouter } from "../../../src/api/routes/chat.js";
import { createInfoRouter } from "../../../src/api/routes/info.js";
import { messageQueue } from "../../../src/message/index.js";

describe("API Routes", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api/v1", createChatRouter());
    app.use("/api/v1", createInfoRouter());
    // 清空消息队列
    messageQueue.clear();
  });

  afterEach(() => {
    messageQueue.clear();
  });

  describe("Chat Routes", () => {
    describe("POST /chat", () => {
      it("should enqueue a message", async () => {
        const response = await request(app)
          .post("/api/v1/chat")
          .send({ message: "Hello world" });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe("queued");
        expect(response.body.message_id).toBeDefined();
        expect(response.body.conversation_id).toBeDefined();
      });

      it("should return 400 if message is missing", async () => {
        const response = await request(app)
          .post("/api/v1/chat")
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Message is required");
      });

      it("should use provided conversation_id", async () => {
        const response = await request(app)
          .post("/api/v1/chat")
          .send({ message: "Hello", conversation_id: "my-session" });

        expect(response.body.conversation_id).toBe("my-session");
      });

      it("should accept agent_id parameter", async () => {
        const response = await request(app)
          .post("/api/v1/chat")
          .send({ message: "Hello", agent_id: "test-agent" });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe("queued");
      });
    });

    describe("POST /chat/process", () => {
      it("should process queued message", async () => {
        // 先加入消息
        await request(app)
          .post("/api/v1/chat")
          .send({ message: "Test message", conversation_id: "process-test" });

        // 处理消息
        const response = await request(app)
          .post("/api/v1/chat/process")
          .send({ conversation_id: "process-test" });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe("processing");
        expect(response.body.response).toContain("处理中");
      });

      it("should return idle when no pending messages", async () => {
        const response = await request(app)
          .post("/api/v1/chat/process")
          .send({ conversation_id: "empty-session" });

        expect(response.body.status).toBe("idle");
        expect(response.body.message).toBe("No pending messages");
      });
    });

    describe("GET /chat/queue/:session_id", () => {
      it("should return queue status", async () => {
        // 添加消息
        await request(app)
          .post("/api/v1/chat")
          .send({ message: "Test", conversation_id: "queue-test" });

        const response = await request(app)
          .get("/api/v1/chat/queue/queue-test");

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("pending");
        expect(response.body).toHaveProperty("processing");
        expect(response.body).toHaveProperty("completed");
        expect(response.body).toHaveProperty("total");
      });
    });

    describe("DELETE /chat/queue/:session_id", () => {
      it("should clear session queue", async () => {
        // 添加消息
        await request(app)
          .post("/api/v1/chat")
          .send({ message: "Test", conversation_id: "clear-test" });

        // 清空队列
        const response = await request(app)
          .delete("/api/v1/chat/queue/clear-test");

        expect(response.status).toBe(200);
        expect(response.body.status).toBe("success");

        // 验证队列已清空
        const status = await request(app)
          .get("/api/v1/chat/queue/clear-test");
        expect(status.body.total).toBe(0);
      });
    });

    describe("GET /chat/history", () => {
      it("should return chat history", async () => {
        // 先添加消息
        await request(app)
          .post("/api/v1/chat")
          .send({ message: "Hello", conversation_id: "history-test" });

        await request(app)
          .post("/api/v1/chat/process")
          .send({ conversation_id: "history-test" });

        const response = await request(app)
          .get("/api/v1/chat/history?session_id=history-test");

        expect(response.status).toBe(200);
        expect(response.body.history).toBeDefined();
        expect(response.body.total).toBeGreaterThan(0);
      });

      it("should respect limit parameter", async () => {
        const response = await request(app)
          .get("/api/v1/chat/history?limit=5");

        expect(response.status).toBe(200);
        expect(response.body.history).toBeDefined();
      });
    });

    describe("GET /chat/sessions", () => {
      it("should return list of sessions", async () => {
        await request(app)
          .post("/api/v1/chat")
          .send({ message: "Test", conversation_id: "session-1" });

        const response = await request(app)
          .get("/api/v1/chat/sessions");

        expect(response.status).toBe(200);
        expect(response.body.sessions).toBeDefined();
        expect(Array.isArray(response.body.sessions)).toBe(true);
      });
    });

    describe("GET /chat/session/:session_id", () => {
      it("should return session messages", async () => {
        await request(app)
          .post("/api/v1/chat")
          .send({ message: "Hello", conversation_id: "session-detail" });

        await request(app)
          .post("/api/v1/chat/process")
          .send({ conversation_id: "session-detail" });

        const response = await request(app)
          .get("/api/v1/chat/session/session-detail");

        expect(response.status).toBe(200);
        expect(response.body.session_id).toBe("session-detail");
        expect(response.body.messages).toBeDefined();
        expect(response.body.total).toBeGreaterThan(0);
      });

      it("should respect limit parameter", async () => {
        const response = await request(app)
          .get("/api/v1/chat/session/unknown-session?limit=10");

        expect(response.status).toBe(200);
        expect(response.body.messages).toEqual([]);
      });
    });

    describe("DELETE /chat/session/:session_id", () => {
      it("should delete session", async () => {
        await request(app)
          .post("/api/v1/chat")
          .send({ message: "Test", conversation_id: "delete-test" });

        const response = await request(app)
          .delete("/api/v1/chat/session/delete-test");

        expect(response.status).toBe(200);
        expect(response.body.status).toBe("success");
      });

      it("should handle non-existent session", async () => {
        const response = await request(app)
          .delete("/api/v1/chat/session/non-existent");

        expect(response.status).toBe(200);
      });
    });
  });

  describe("Info Routes", () => {
    describe("GET /info/summary", () => {
      it("should return summary", async () => {
        const response = await request(app)
          .get("/api/v1/info/summary");

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("total_runs");
        expect(response.body).toHaveProperty("success");
        expect(response.body).toHaveProperty("failed");
      });
    });

    describe("GET /info/routes", () => {
      it("should return routes", async () => {
        const response = await request(app)
          .get("/api/v1/info/routes");

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("routes");
      });
    });

    describe("GET /info/runs", () => {
      it("should return runs", async () => {
        const response = await request(app)
          .get("/api/v1/info/runs");

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("runs");
      });
    });

    describe("GET /info/workflow/current", () => {
      it("should return current workflow", async () => {
        const response = await request(app)
          .get("/api/v1/info/workflow/current");

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("active");
        expect(response.body).toHaveProperty("run_id");
      });
    });

    describe("GET /info/workflow/latest", () => {
      it("should return latest workflow runs", async () => {
        const response = await request(app)
          .get("/api/v1/info/workflow/latest");

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("runs");
      });
    });

    describe("GET /info/agent-team", () => {
      it("should return agent team info", async () => {
        const response = await request(app)
          .get("/api/v1/info/agent-team");

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("agents");
        expect(response.body).toHaveProperty("active_sub_agents");
      });
    });

    describe("GET /info/agent/:agent_id/details", () => {
      it("should return agent details", async () => {
        const response = await request(app)
          .get("/api/v1/info/agent/test-agent/details");

        expect(response.status).toBe(200);
        expect(response.body.agent_id).toBe("test-agent");
        expect(response.body).toHaveProperty("name");
        expect(response.body).toHaveProperty("status");
      });

      it("should accept project_id query param", async () => {
        const response = await request(app)
          .get("/api/v1/info/agent/test-agent/details?project_id=proj-123");

        expect(response.status).toBe(200);
        expect(response.body.project_id).toBe("proj-123");
      });
    });

    describe("GET /info/agent/:agent_id/loaded-docs", () => {
      it("should return loaded docs", async () => {
        const response = await request(app)
          .get("/api/v1/info/agent/test-agent/loaded-docs");

        expect(response.status).toBe(200);
        expect(response.body.agent_id).toBe("test-agent");
        expect(response.body).toHaveProperty("loaded_docs");
        expect(response.body).toHaveProperty("doc_count");
      });
    });

    describe("GET /thinking/modes", () => {
      it("should return thinking modes", async () => {
        const response = await request(app)
          .get("/api/v1/thinking/modes");

        expect(response.status).toBe(200);
        expect(response.body.modes).toBeDefined();
        expect(Array.isArray(response.body.modes)).toBe(true);
      });
    });

    describe("GET /thoughts/:session_id", () => {
      it("should return thoughts for session", async () => {
        const response = await request(app)
          .get("/api/v1/thoughts/test-session");

        expect(response.status).toBe(200);
        expect(response.body.session_id).toBe("test-session");
        expect(response.body).toHaveProperty("steps");
        expect(response.body).toHaveProperty("is_complete");
      });
    });

    describe("POST /thinking/config", () => {
      it("should update thinking config", async () => {
        const response = await request(app)
          .post("/api/v1/thinking/config")
          .send({ mode: "high", maxTokens: 4000 });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe("success");
        expect(response.body.mode).toBe("high");
      });
    });

    describe("POST /info/files/batch", () => {
      it("should check file existence", async () => {
        const response = await request(app)
          .post("/api/v1/info/files/batch")
          .send({ file_paths: ["/test/file1.txt", "/test/file2.txt"] });

        expect(response.status).toBe(200);
        expect(response.body.files).toBeDefined();
        expect(response.body.files["/test/file1.txt"]).toBeDefined();
        expect(response.body.files["/test/file1.txt"].exists).toBe(false);
      });

      it("should handle empty file_paths", async () => {
        const response = await request(app)
          .post("/api/v1/info/files/batch")
          .send({});

        expect(response.status).toBe(200);
        expect(response.body.files).toEqual({});
      });
    });
  });
});

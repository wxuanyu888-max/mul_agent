// Cron 工具
import { jsonResult, errorResult } from "../types.js";
import { getCronManager, type CronJob } from "./cron-manager.js";

export function createCronTool() {
  const manager = getCronManager();

  return {
    label: "Cron",
    name: "cron",
    description: "Manage cron jobs and wake events - create, list, or delete scheduled tasks",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list", "create", "delete"] },
        schedule: { type: "string", description: "Cron expression (e.g., '30 20 * * *' for 8:30 PM daily)" },
        task: { type: "string", description: "Task description to remind user" },
        label: { type: "string", description: "Label for the cron job" },
        job_id: { type: "string", description: "Job ID (required for delete action)" },
        session_id: { type: "string", description: "Session ID to trigger when cron fires (optional)" },
        agent_id: { type: "string", description: "Agent ID to trigger when cron fires (optional)" },
      },
      required: ["action"],
    },
    execute: async (_toolCallId: string, params: { action: string; schedule?: string; task?: string; label?: string; job_id?: string; session_id?: string; agent_id?: string }) => {
      try {
        switch (params.action) {
          case "list": {
            const jobs = manager.listJobs();
            const jobList = jobs.map((job: CronJob) => ({
              id: job.id,
              label: job.label,
              schedule: job.schedule,
              task: job.task,
              nextRun: new Date(job.nextRun).toLocaleString(),
              enabled: job.enabled,
            }));
            return jsonResult({ action: "list", jobs: jobList, count: jobList.length });
          }

          case "create": {
            if (!params.schedule || !params.task) {
              return errorResult("Missing required fields: schedule and task are required for create action");
            }

            const label = params.label || `Task_${Date.now()}`;
            const job = manager.createJob(label, params.schedule, params.task, params.session_id, params.agent_id);

            return jsonResult({
              action: "create",
              success: true,
              job: {
                id: job.id,
                label: job.label,
                schedule: job.schedule,
                task: job.task,
                nextRun: new Date(job.nextRun).toLocaleString(),
                sessionId: job.sessionId,
                agentId: job.agentId,
              },
              message: job.sessionId
                ? `Cron job created: ${label}. Next run at ${new Date(job.nextRun).toLocaleString()}. Will trigger agent ${job.agentId || 'default'} in session ${job.sessionId}`
                : `Cron job created: ${label}. Next run at ${new Date(job.nextRun).toLocaleString()}`,
            });
          }

          case "delete": {
            if (!params.job_id) {
              return errorResult("Missing required field: job_id is required for delete action");
            }

            const deleted = manager.deleteJob(params.job_id);
            if (!deleted) {
              return errorResult(`Job not found: ${params.job_id}`);
            }

            return jsonResult({
              action: "delete",
              success: true,
              message: `Job ${params.job_id} deleted`,
            });
          }

          default:
            return errorResult(`Unknown action: ${params.action}`);
        }
      } catch (error) {
        return errorResult(`Failed: ${error}`);
      }
    },
  };
}

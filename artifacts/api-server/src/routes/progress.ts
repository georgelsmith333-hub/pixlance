import { Router } from "express";
import { EventEmitter } from "events";

export const jobEmitter = new EventEmitter();
jobEmitter.setMaxListeners(2000);

const router = Router();

router.get("/progress/:jobId", (req, res) => {
  const { jobId } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (data: object) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch {
      // client disconnected
    }
  };

  send({ type: "connected", jobId });

  const key = `job:${jobId}`;
  const onProgress = (data: object) => send(data);

  jobEmitter.on(key, onProgress);

  const timeout = setTimeout(
    () => {
      jobEmitter.off(key, onProgress);
      res.end();
    },
    15 * 60 * 1000,
  );

  req.on("close", () => {
    clearTimeout(timeout);
    jobEmitter.off(key, onProgress);
  });
});

export function emitJobProgress(jobId: string, data: object) {
  jobEmitter.emit(`job:${jobId}`, data);
}

export default router;

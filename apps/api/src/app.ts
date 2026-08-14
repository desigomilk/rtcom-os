import { BusinessRuleError } from "@rtcom/business-rules";
import Fastify, { type FastifyError } from "fastify";
import { ZodError } from "zod";
import authPlugin from "./plugins/auth";
import authRoutes from "./routes/auth";
import leadRoutes from "./routes/leads";
import messageRoutes from "./routes/messages";

export function buildApp() {
  const app = Fastify({ logger: true });

  app.setErrorHandler(
    (error: FastifyError | ZodError | BusinessRuleError, _request, reply) => {
      if (error instanceof ZodError) {
        return reply
          .code(400)
          .send({ error: "ValidationError", issues: error.issues });
      }
      if (error instanceof BusinessRuleError) {
        return reply.code(400).send({ error: error.message });
      }
      app.log.error(error);
      return reply.code(error.statusCode ?? 500).send({
        error: error.message ?? "Internal Server Error",
      });
    },
  );

  app.get("/health", async () => ({ status: "ok" }));

  app.register(authPlugin);
  app.register(authRoutes);
  app.register(leadRoutes);
  app.register(messageRoutes);

  return app;
}

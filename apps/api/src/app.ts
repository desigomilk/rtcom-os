import cors from "@fastify/cors";
import { BusinessRuleError } from "@rtcom/business-rules";
import Fastify, { type FastifyError } from "fastify";
import { ZodError } from "zod";
import authPlugin from "./plugins/auth";
import accountingRoutes from "./routes/accounting";
import authRoutes from "./routes/auth";
import billingRoutes from "./routes/billing";
import customerRoutes from "./routes/customers";
import deliveryRoutes from "./routes/delivery";
import geographyRoutes from "./routes/geography";
import leadRoutes from "./routes/leads";
import messageRoutes from "./routes/messages";
import routesManagementRoutes from "./routes/routes-management";
import traceabilityRoutes from "./routes/traceability";
import userRoutes from "./routes/users";

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true });

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
  app.register(deliveryRoutes);
  app.register(customerRoutes);
  app.register(geographyRoutes);
  app.register(routesManagementRoutes);
  app.register(userRoutes);
  app.register(billingRoutes);
  app.register(accountingRoutes);
  app.register(traceabilityRoutes);

  return app;
}

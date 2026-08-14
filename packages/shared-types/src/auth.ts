import { z } from "zod";
import { userRoleSchema } from "./enums";

export const loginRequestSchema = z.object({
  phone: z.string().min(10).max(15),
  password: z.string().min(6),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: z.object({
    id: z.string(),
    name: z.string(),
    phone: z.string(),
    role: userRoleSchema,
  }),
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const refreshRequestSchema = z.object({
  refreshToken: z.string(),
});
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

export const accessTokenPayloadSchema = z.object({
  sub: z.string(), // user id
  role: userRoleSchema,
});
export type AccessTokenPayload = z.infer<typeof accessTokenPayloadSchema>;

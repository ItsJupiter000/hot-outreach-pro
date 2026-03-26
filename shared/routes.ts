import { z } from "zod";
import { TemplateSchema, ApplicationSchema, SendEmailRequestSchema, ApplicationStatusEnum } from "./schema";

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

export const api = {
  templates: {
    list: {
      method: "GET" as const,
      path: "/api/templates" as const,
      responses: { 200: z.array(TemplateSchema) },
    },
    create: {
      method: "POST" as const,
      path: "/api/templates" as const,
      input: TemplateSchema.omit({ id: true, isDefault: true }),
      responses: {
        201: TemplateSchema,
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/templates/:id" as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    setDefault: {
      method: "POST" as const,
      path: "/api/templates/:id/default" as const,
      responses: {
        200: TemplateSchema,
        404: errorSchemas.notFound,
      },
    },
  },
  applications: {
    list: {
      method: "GET" as const,
      path: "/api/applications" as const,
      input: z.object({
        search: z.string().optional(),
        status: z.string().optional(),
      }).optional(),
      responses: { 200: z.array(ApplicationSchema) },
    },
    update: {
      method: "PATCH" as const,
      path: "/api/applications/:id" as const,
      input: z.object({ status: ApplicationStatusEnum.optional(), notes: z.string().optional() }),
      responses: {
        200: ApplicationSchema,
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/applications/:id" as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  documents: {
    list: {
      method: "GET" as const,
      path: "/api/documents" as const,
      responses: { 200: z.array(z.any()) }, // Using any for Document to avoid circular issues if any
    },
    create: {
      method: "POST" as const,
      path: "/api/documents" as const,
      responses: {
        201: z.any(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/documents/:id" as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    setDefault: {
      method: "POST" as const,
      path: "/api/documents/:id/default" as const,
      responses: {
        200: z.any(),
        404: errorSchemas.notFound,
      },
    },
  },
  email: {
    send: {
      method: "POST" as const,
      path: "/api/send-email" as const,
      input: SendEmailRequestSchema,
      responses: {
        201: ApplicationSchema,
        400: errorSchemas.validation,
        429: z.object({ message: z.string() }), // Rate limit / duplicate send
      },
    },
  },
  upload: {
    resume: {
      method: "POST" as const,
      path: "/api/upload-resume" as const,
      responses: {
        200: z.object({ url: z.string(), name: z.string() }),
        400: errorSchemas.validation,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type NoteInput = never; // unused, placeholder to avoid template errors if needed

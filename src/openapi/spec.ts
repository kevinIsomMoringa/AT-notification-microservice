export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Notification Microservice API',
    version: '1.0.0',
    description:
      'Channel-agnostic notification API. Send SMS (Africa\'s Talking), Email (SMTP), or WhatsApp (Twilio). ' +
      'Requests are queued asynchronously and return 202 Accepted with a job id.',
  },
  servers: [{ url: '/', description: 'Current host' }],
  tags: [
    { name: 'Notifications', description: 'Send notifications (authenticated)' },
    { name: 'Health', description: 'Liveness and readiness probes' },
    { name: 'Observability', description: 'Metrics and diagnostics' },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'Service API key. Required in production; optional in development when SERVICE_API_KEY is unset.',
      },
    },
    schemas: {
      HealthResponse: {
        type: 'object',
        required: ['status', 'service', 'timestamp'],
        properties: {
          status: { type: 'string', example: 'ok' },
          service: { type: 'string', example: 'notification-microservice' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      ReadyResponse: {
        type: 'object',
        required: ['status', 'service', 'timestamp', 'uptime'],
        properties: {
          status: { type: 'string', example: 'ready' },
          service: { type: 'string', example: 'notification-microservice' },
          timestamp: { type: 'string', format: 'date-time' },
          uptime: { type: 'number', description: 'Process uptime in seconds' },
        },
      },
      NotificationRequest: {
        type: 'object',
        required: ['channel', 'to', 'message'],
        properties: {
          channel: {
            type: 'string',
            enum: ['sms', 'email', 'whatsapp'],
            description: 'Delivery channel',
          },
          to: {
            type: 'string',
            description: 'E.164 phone number for sms/whatsapp, email address for email',
            examples: ['+254712345678', 'user@example.com'],
          },
          message: {
            type: 'string',
            minLength: 1,
            maxLength: 2000,
            description: 'Message body text',
          },
          subject: {
            type: 'string',
            maxLength: 255,
            description: 'Email subject (ignored by SMS/WhatsApp)',
          },
          metadata: {
            type: 'object',
            additionalProperties: true,
            description: 'Optional tracing data echoed back in the response',
          },
        },
      },
      NotificationAcceptedResponse: {
        type: 'object',
        required: ['success', 'channel', 'provider', 'externalId', 'status', 'metadata', 'timestamp'],
        properties: {
          success: { type: 'boolean', example: true },
          channel: { type: 'string', enum: ['sms', 'email', 'whatsapp'] },
          provider: { type: 'string', example: 'queue' },
          externalId: {
            type: 'string',
            format: 'uuid',
            description: 'Job id — use diagnostics log to track delivery outcome',
          },
          status: { type: 'string', example: 'queued' },
          metadata: { nullable: true, type: 'object', additionalProperties: true },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      ValidationErrorResponse: {
        type: 'object',
        required: ['success', 'error', 'details'],
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string', example: 'Validation failed' },
          details: {
            type: 'object',
            additionalProperties: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        required: ['success', 'error'],
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string' },
        },
      },
      DiagnosticsLogResponse: {
        type: 'object',
        required: ['success', 'count', 'storePath', 'records', 'timestamp'],
        properties: {
          success: { type: 'boolean', example: true },
          count: { type: 'integer' },
          storePath: { type: 'string' },
          records: {
            type: 'array',
            items: { $ref: '#/components/schemas/NotificationLogEntry' },
          },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      NotificationLogEntry: {
        type: 'object',
        properties: {
          recordType: { type: 'string', enum: ['request', 'job', 'outcome'] },
          timestamp: { type: 'string', format: 'date-time' },
          jobId: { type: 'string', format: 'uuid' },
          channel: { type: 'string', enum: ['sms', 'email', 'whatsapp'] },
          provider: { type: 'string' },
          success: { type: 'boolean' },
          status: { type: 'string' },
          attempts: { type: 'integer' },
          error: { type: 'string' },
          payload: { type: 'object', additionalProperties: true },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Liveness check',
        description: 'Returns service status. No authentication required.',
        responses: {
          '200': {
            description: 'Service is alive',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
        },
      },
    },
    '/ready': {
      get: {
        tags: ['Health'],
        summary: 'Readiness check',
        description: 'Returns readiness status including process uptime. No authentication required.',
        responses: {
          '200': {
            description: 'Service is ready',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ReadyResponse' },
              },
            },
          },
        },
      },
    },
    '/metrics': {
      get: {
        tags: ['Observability'],
        summary: 'Prometheus metrics',
        description: 'Prometheus text exposition format. No authentication required.',
        responses: {
          '200': {
            description: 'Metrics snapshot',
            content: {
              'text/plain': {
                schema: { type: 'string' },
              },
            },
          },
        },
      },
    },
    '/api/v1/notifications': {
      post: {
        tags: ['Notifications'],
        summary: 'Send a notification',
        description:
          'Validates the payload, enqueues delivery, and returns 202 Accepted with a job id. ' +
          'Delivery happens asynchronously with up to 3 retries.',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/NotificationRequest' },
              examples: {
                sms: {
                  summary: 'SMS',
                  value: {
                    channel: 'sms',
                    to: '+254712345678',
                    message: 'Your OTP is 482913',
                  },
                },
                email: {
                  summary: 'Email',
                  value: {
                    channel: 'email',
                    to: 'user@example.com',
                    subject: 'Welcome',
                    message: 'Thanks for signing up.',
                  },
                },
                whatsapp: {
                  summary: 'WhatsApp',
                  value: {
                    channel: 'whatsapp',
                    to: '+254712345678',
                    message: 'Hello from our notification service!',
                  },
                },
              },
            },
          },
        },
        responses: {
          '202': {
            description: 'Notification queued',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/NotificationAcceptedResponse' },
              },
            },
          },
          '400': {
            description: 'Validation error or malformed JSON body',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    { $ref: '#/components/schemas/ValidationErrorResponse' },
                    { $ref: '#/components/schemas/ErrorResponse' },
                  ],
                },
              },
            },
          },
          '401': {
            description: 'Missing or invalid x-api-key',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '429': {
            description: 'Rate limit exceeded',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/diagnostics': {
      get: {
        tags: ['Observability'],
        summary: 'Diagnostics dashboard (HTML)',
        description:
          'Interactive diagnostics web view. Available in non-production by default; ' +
          'set DIAGNOSTICS_ENABLED=true in production.',
        responses: {
          '200': {
            description: 'HTML diagnostics dashboard',
            content: {
              'text/html': { schema: { type: 'string' } },
            },
          },
          '404': {
            description: 'Diagnostics disabled',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/diagnostics/log': {
      get: {
        tags: ['Observability'],
        summary: 'Notification log snapshot (JSON)',
        description: 'Returns the last N records from the notification store log file.',
        parameters: [
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer', minimum: 1, maximum: 500, default: 200 },
            description: 'Maximum number of log records to return',
          },
        ],
        responses: {
          '200': {
            description: 'Log snapshot',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DiagnosticsLogResponse' },
              },
            },
          },
          '404': {
            description: 'Diagnostics disabled',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/openapi.json': {
      get: {
        tags: ['Observability'],
        summary: 'OpenAPI specification (JSON)',
        responses: {
          '200': {
            description: 'OpenAPI 3.0 document',
            content: {
              'application/json': {
                schema: { type: 'object' },
              },
            },
          },
        },
      },
    },
  },
} as const;

export type OpenApiSpec = typeof openApiSpec;

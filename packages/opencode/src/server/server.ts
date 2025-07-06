import { Log } from "../util/log"
import { Bus } from "../bus"
import { describeRoute, generateSpecs, openAPISpecs } from "hono-openapi"
import { Hono } from "hono"
import { streamSSE } from "hono/streaming"
import { Session } from "../session"
import { SubSession } from "../session/sub-session"
import { resolver, validator as zValidator } from "hono-openapi/zod"
import { z } from "zod"
import { Message } from "../session/message"
import { Provider } from "../provider/provider"
import { App } from "../app/app"
import { mapValues } from "remeda"
import { NamedError } from "../util/error"
import { ModelsDev } from "../provider/models"
import { Ripgrep } from "../file/ripgrep"
import { Config } from "../config/config"
import {
  continuationPromptGenerator,
  ProjectStateSchema,
} from "../session/continuation-prompt-generator"
import {
  emitTaskStarted,
  emitTaskProgress,
  emitTaskCompleted,
  emitTaskFailed,
} from "../events/task-events"

const ERRORS = {
  400: {
    description: "Bad request",
    content: {
      "application/json": {
        schema: resolver(
          z
            .object({
              data: z.record(z.string(), z.any()),
            })
            .openapi({
              ref: "Error",
            }),
        ),
      },
    },
  },
} as const

export namespace Server {
  const log = Log.create({ service: "server" })

  export type Routes = ReturnType<typeof app>

  function app() {
    const app = new Hono()

    const result = app
      .onError((err, c) => {
        if (err instanceof NamedError) {
          return c.json(err.toObject(), {
            status: 400,
          })
        }
        return c.json(
          new NamedError.Unknown({ message: err.toString() }).toObject(),
          {
            status: 400,
          },
        )
      })
      .use(async (c, next) => {
        log.info("request", {
          method: c.req.method,
          path: c.req.path,
        })
        const start = Date.now()
        await next()
        log.info("response", {
          duration: Date.now() - start,
        })
      })
      .get(
        "/doc",
        openAPISpecs(app, {
          documentation: {
            info: {
              title: "dgmo",
              version: "0.0.2",
              description: "dgmo api",
            },
            openapi: "3.0.0",
          },
        }),
      )
      .get(
        "/event",
        describeRoute({
          description: "Get events",
          responses: {
            200: {
              description: "Event stream",
              content: {
                "application/json": {
                  schema: resolver(
                    Bus.payloads().openapi({
                      ref: "Event",
                    }),
                  ),
                },
              },
            },
          },
        }),
        async (c) => {
          log.info("event connected")
          return streamSSE(c, async (stream) => {
            stream.writeSSE({
              data: JSON.stringify({}),
            })
            const unsub = Bus.subscribeAll(async (event) => {
              try {
                await stream.writeSSE({
                  data: JSON.stringify(event),
                })
              } catch (error) {
                log.error(
                  "SSE write failed",
                  error instanceof Error
                    ? { message: error.message, stack: error.stack }
                    : { error },
                )
                // Don't throw - let the connection continue for other events
              }
            })
            await new Promise<void>((resolve) => {
              stream.onAbort(() => {
                unsub()
                resolve()
                log.info("event disconnected")
              })
            })
          })
        },
      )
      .get(
        "/app",
        describeRoute({
          description: "Get app info",
          responses: {
            200: {
              description: "200",
              content: {
                "application/json": {
                  schema: resolver(App.Info),
                },
              },
            },
          },
        }),
        async (c) => {
          return c.json(App.info())
        },
      )
      .post(
        "/app/init",
        describeRoute({
          description: "Initialize the app",
          responses: {
            200: {
              description: "Initialize the app",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
          },
        }),
        async (c) => {
          await App.initialize()
          return c.json(true)
        },
      )
      .get(
        "/config",
        describeRoute({
          description: "Get config info",
          responses: {
            200: {
              description: "Get config info",
              content: {
                "application/json": {
                  schema: resolver(Config.Info),
                },
              },
            },
          },
        }),
        async (c) => {
          return c.json(await Config.get())
        },
      )
      .get(
        "/session",
        describeRoute({
          description: "List all sessions",
          responses: {
            200: {
              description: "List of sessions",
              content: {
                "application/json": {
                  schema: resolver(Session.Info.array()),
                },
              },
            },
          },
        }),
        async (c) => {
          const sessions = await Array.fromAsync(Session.list())
          return c.json(sessions)
        },
      )
      .post(
        "/session",
        describeRoute({
          description: "Create a new session",
          responses: {
            ...ERRORS,
            200: {
              description: "Successfully created session",
              content: {
                "application/json": {
                  schema: resolver(Session.Info),
                },
              },
            },
          },
        }),
        async (c) => {
          const session = await Session.create()
          return c.json(session)
        },
      )
      .delete(
        "/session/:id",
        describeRoute({
          description: "Delete a session and all its data",
          responses: {
            200: {
              description: "Successfully deleted session",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string(),
          }),
        ),
        async (c) => {
          await Session.remove(c.req.valid("param").id)
          return c.json(true)
        },
      )
      .post(
        "/session/:id/init",
        describeRoute({
          description: "Analyze the app and create an AGENTS.md file",
          responses: {
            200: {
              description: "200",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string().openapi({ description: "Session ID" }),
          }),
        ),
        zValidator(
          "json",
          z.object({
            providerID: z.string(),
            modelID: z.string(),
          }),
        ),
        async (c) => {
          const sessionID = c.req.valid("param").id
          const body = c.req.valid("json")
          await Session.initialize({ ...body, sessionID })
          return c.json(true)
        },
      )
      .post(
        "/session/:id/abort",
        describeRoute({
          description: "Abort a session",
          responses: {
            200: {
              description: "Aborted session",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string(),
          }),
        ),
        async (c) => {
          return c.json(Session.abort(c.req.valid("param").id))
        },
      )
      .post(
        "/session/:id/share",
        describeRoute({
          description: "Share a session",
          responses: {
            200: {
              description: "Successfully shared session",
              content: {
                "application/json": {
                  schema: resolver(Session.Info),
                },
              },
            },
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string(),
          }),
        ),
        async (c) => {
          const id = c.req.valid("param").id
          await Session.share(id)
          const session = await Session.get(id)
          return c.json(session)
        },
      )
      .delete(
        "/session/:id/share",
        describeRoute({
          description: "Unshare the session",
          responses: {
            200: {
              description: "Successfully unshared session",
              content: {
                "application/json": {
                  schema: resolver(Session.Info),
                },
              },
            },
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string(),
          }),
        ),
        async (c) => {
          const id = c.req.valid("param").id
          await Session.unshare(id)
          const session = await Session.get(id)
          return c.json(session)
        },
      )
      .post(
        "/session/:id/summarize",
        describeRoute({
          description: "Summarize the session",
          responses: {
            200: {
              description: "Summarized session",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string().openapi({ description: "Session ID" }),
          }),
        ),
        zValidator(
          "json",
          z.object({
            providerID: z.string(),
            modelID: z.string(),
          }),
        ),
        async (c) => {
          const id = c.req.valid("param").id
          const body = c.req.valid("json")
          await Session.summarize({ ...body, sessionID: id })
          return c.json(true)
        },
      )
      .get(
        "/session/:id/message",
        describeRoute({
          description: "List messages for a session",
          responses: {
            200: {
              description: "List of messages",
              content: {
                "application/json": {
                  schema: resolver(Message.Info.array()),
                },
              },
            },
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string().openapi({ description: "Session ID" }),
          }),
        ),
        async (c) => {
          const messages = await Session.messages(c.req.valid("param").id)
          return c.json(messages)
        },
      )
      .post(
        "/session/:id/message",
        describeRoute({
          description: "Create and send a new message to a session",
          responses: {
            200: {
              description: "Created message",
              content: {
                "application/json": {
                  schema: resolver(Message.Info),
                },
              },
            },
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string().openapi({ description: "Session ID" }),
          }),
        ),
        zValidator(
          "json",
          z.object({
            providerID: z.string(),
            modelID: z.string(),
            parts: Message.MessagePart.array(),
          }),
        ),
        async (c) => {
          const sessionID = c.req.valid("param").id
          const body = c.req.valid("json")
          const msg = await Session.chat({ ...body, sessionID })
          return c.json(msg)
        },
      )
      .get(
        "/session/:id/sub-sessions",
        describeRoute({
          description: "Get all sub-sessions for a parent session",
          responses: {
            200: {
              description: "List of sub-sessions",
              content: {
                "application/json": {
                  schema: resolver(SubSession.Info.array()),
                },
              },
            },
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string().openapi({ description: "Parent Session ID" }),
          }),
        ),
        async (c) => {
          const parentId = c.req.valid("param").id

          try {
            const subSessions = await SubSession.getByParent(parentId)
            return c.json(subSessions)
          } catch (error: any) {
            return c.json([])
          }
        },
      )
      .get(
        "/sub-sessions",
        describeRoute({
          description: "List all sub-sessions across all parent sessions",
          responses: {
            200: {
              description: "List of all sub-sessions",
              content: {
                "application/json": {
                  schema: resolver(SubSession.Info.array()),
                },
              },
            },
          },
        }),
        async (c) => {
          const subSessions = await SubSession.list()
          return c.json(subSessions)
        },
      )
      .get(
        "/sub-sessions/search",
        describeRoute({
          description: "Search sub-sessions by query",
          responses: {
            200: {
              description: "Search results",
              content: {
                "application/json": {
                  schema: resolver(SubSession.Info.array()),
                },
              },
            },
          },
        }),
        zValidator(
          "query",
          z.object({
            q: z.string().openapi({ description: "Search query" }),
          }),
        ),
        async (c) => {
          const query = c.req.valid("query").q
          const results = await SubSession.search(query)
          return c.json(results)
        },
      )
      .get(
        "/sub-session/:id",
        describeRoute({
          description: "Get a specific sub-session",
          responses: {
            200: {
              description: "Sub-session details",
              content: {
                "application/json": {
                  schema: resolver(SubSession.Info),
                },
              },
            },
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string().openapi({ description: "Sub-session ID" }),
          }),
        ),
        async (c) => {
          const subSession = await SubSession.get(c.req.valid("param").id)
          return c.json(subSession)
        },
      )
      .delete(
        "/sub-session/:id",
        describeRoute({
          description: "Delete a sub-session",
          responses: {
            200: {
              description: "Successfully deleted sub-session",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string().openapi({ description: "Sub-session ID" }),
          }),
        ),
        async (c) => {
          await SubSession.remove(c.req.valid("param").id)
          return c.json(true)
        },
      )
      .get(
        "/config/providers",
        describeRoute({
          description: "List all providers",
          responses: {
            200: {
              description: "List of providers",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      providers: ModelsDev.Provider.array(),
                      default: z.record(z.string(), z.string()),
                    }),
                  ),
                },
              },
            },
          },
        }),
        async (c) => {
          const providers = await Provider.list().then((x) =>
            mapValues(x, (item) => item.info),
          )
          return c.json({
            providers: Object.values(providers),
            default: mapValues(
              providers,
              (item) => Provider.sort(Object.values(item.models))[0].id,
            ),
          })
        },
      )
      .get(
        "/file",
        describeRoute({
          description: "Search for files",
          responses: {
            200: {
              description: "Search for files",
              content: {
                "application/json": {
                  schema: resolver(z.string().array()),
                },
              },
            },
          },
        }),
        zValidator(
          "query",
          z.object({
            query: z.string(),
          }),
        ),
        async (c) => {
          const query = c.req.valid("query").query
          const app = App.info()
          const result = await Ripgrep.files({
            cwd: app.path.cwd,
            query,
            limit: 10,
          })
          return c.json(result)
        },
      )
      .post(
        "/session/:id/continuation-prompt",
        describeRoute({
          description: "Generate continuation prompt for agent handoff",
          responses: {
            200: {
              description: "Generated continuation prompt",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      prompt: z.string(),
                      projectState: ProjectStateSchema,
                    }),
                  ),
                },
              },
            },
            ...ERRORS,
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string().openapi({ description: "Session ID" }),
          }),
        ),
        zValidator(
          "json",
          ProjectStateSchema.partial().extend({
            // Allow partial project state, will be filled with defaults
            projectName: z.string().optional(),
            projectGoal: z.string().optional(),
          }),
        ),
        async (c) => {
          const sessionID = c.req.valid("param").id
          const partialState = c.req.valid("json")
          const startTime = Date.now()
          const taskID = `continuation-${sessionID}-${startTime}`

          // Emit task started event
          emitTaskStarted({
            sessionID,
            taskID,
            agentName: "Continuation Generator",
            taskDescription: "Generating continuation prompt for agent handoff",
            timestamp: startTime,
          })

          try {
            // Get session info to extract project context
            await Session.get(sessionID) // Verify session exists
            const app = App.info()

            // Emit progress event
            emitTaskProgress({
              sessionID,
              taskID,
              progress: 25,
              message: "Analyzing project state...",
              timestamp: Date.now(),
              startTime,
            })

            // Build complete project state with defaults
            const projectState = {
              projectName: partialState.projectName || "opencode",
              projectGoal:
                partialState.projectGoal || "AI coding assistant development",
              completionPercentage: partialState.completionPercentage || 75,
              workingDirectory: partialState.workingDirectory || app.path.cwd,
              completedComponents: partialState.completedComponents || [
                {
                  name: "Continuation Prompt System",
                  description:
                    "Vector memory integration with prompting techniques",
                  filePath: "src/session/continuation-prompt-generator.ts",
                },
                {
                  name: "Server API Integration",
                  description: "REST endpoint for prompt generation",
                  filePath: "src/server/server.ts",
                },
              ],
              remainingTasks: partialState.remainingTasks || [
                {
                  name: "TUI Slash Command",
                  description: "Implement /continue command in Go TUI client",
                  priority: "high" as const,
                  dependencies: ["Server endpoint"],
                },
                {
                  name: "Error Handling",
                  description:
                    "Add comprehensive error handling and user feedback",
                  priority: "medium" as const,
                },
              ],
              criticalFiles: partialState.criticalFiles || [
                {
                  path: "src/server/server.ts",
                  description: "Main server with API endpoints",
                },
                {
                  path: "src/session/continuation-prompt-generator.ts",
                  description: "Core prompt generation logic",
                },
              ],
              knownIssues: partialState.knownIssues || [
                {
                  issue: "Complex metadata arrays fail in vector storage",
                  solution: "Use structured text in information field only",
                },
              ],
              architecturalConstraints:
                partialState.architecturalConstraints || [
                  "Maintain TypeScript/Bun runtime compatibility",
                  "Follow existing Zod validation patterns",
                  "Integrate with MCP server architecture",
                  "Preserve session state management",
                ],
              successCriteria: partialState.successCriteria || [
                "/continue command responds within 2 seconds",
                "Generated prompts follow template structure",
                "Memory searches return relevant context",
                "TUI displays formatted output with copy functionality",
              ],
              testingApproach: partialState.testingApproach || [
                "Test /continue command end-to-end",
                "Validate prompt generation quality",
                "Verify memory search integration",
                "Check TUI display formatting",
              ],
            }

            // Emit progress event for generation
            emitTaskProgress({
              sessionID,
              taskID,
              progress: 75,
              message: "Generating continuation prompt...",
              timestamp: Date.now(),
              startTime,
            })

            // Generate the continuation prompt
            const prompt =
              continuationPromptGenerator.generateContinuationPrompt(
                projectState,
              )

            // Emit completion event
            emitTaskCompleted({
              sessionID,
              taskID,
              duration: Date.now() - startTime,
              success: true,
              summary: `Generated continuation prompt (${prompt.length} characters)`,
              timestamp: Date.now(),
            })

            return c.json({
              prompt,
              projectState,
            })
          } catch (error) {
            // Emit failure event
            const errorMessage =
              error instanceof Error ? error.message : String(error)
            emitTaskFailed({
              sessionID,
              taskID,
              error: errorMessage,
              recoverable: true,
              timestamp: Date.now(),
            })

            log.error("continuation-prompt-error", {
              sessionID,
              error: errorMessage,
              stack: error instanceof Error ? error.stack : undefined,
            })

            throw error
          }
        },
      )
      .get(
        "/events/diagnostics",
        describeRoute({
          description: "Get task event diagnostics information",
          responses: {
            200: {
              description: "Event diagnostics data",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      eventCounts: z.object({
                        started: z.number(),
                        progress: z.number(),
                        completed: z.number(),
                        failed: z.number(),
                      }),
                      lastEvents: z.record(z.any()),
                      websocketClients: z.number(),
                    }),
                  ),
                },
              },
            },
          },
        }),
        async (c) => {
          const { taskEventDiagnostics } = await import(
            "../events/task-events/diagnostics"
          )
          const { taskEventServer } = await import(
            "../events/task-events/server"
          )
          
          const stats = taskEventDiagnostics.getStats()
          
          return c.json({
            ...stats,
            websocketClients: (taskEventServer as any).clients?.size || 0,
          })
        },
      )
      .post(
        "/events/test",
        describeRoute({
          description: "Test task event flow",
          responses: {
            200: {
              description: "Test completed",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      success: z.boolean(),
                      message: z.string(),
                    }),
                  ),
                },
              },
            },
          },
        }),
        async (c) => {
          const { taskEventDiagnostics } = await import(
            "../events/task-events/diagnostics"
          )
          
          await taskEventDiagnostics.testEventFlow()
          
          return c.json({
            success: true,
            message: "Event flow test completed. Check logs for details.",
          })
        },
      )

    return result
  }

  export async function openapi() {
    const a = app()
    const result = await generateSpecs(a, {
      documentation: {
        info: {
          title: "dgmo",
          version: "1.0.0",
          description: "dgmo api",
        },
        openapi: "3.0.0",
      },
    })
    return result
  }

  export function listen(opts: { port: number; hostname: string }) {
    const server = Bun.serve({
      port: opts.port,
      hostname: opts.hostname,
      idleTimeout: 0,
      fetch: app().fetch,
    })
    return server
  }
}

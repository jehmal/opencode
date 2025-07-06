import { App } from "../../app/app"
import { Provider } from "../../provider/provider"
import { Server } from "../../server/server"
import { Share } from "../../share/share"
import { cmd } from "./cmd"
import { taskEventServer } from "../../events/task-events/server"
export const ServeCommand = cmd({
  command: "serve",
  builder: (yargs) =>
    yargs
      .option("port", {
        alias: ["p"],
        type: "number",
        describe: "port to listen on",
        default: 4096,
      })
      .option("hostname", {
        alias: ["h"],
        type: "string",
        describe: "hostname to listen on",
        default: "127.0.0.1",
      }),
  describe: "starts a headless dgmo server",
  handler: async (args) => {
    const cwd = process.cwd()
    await App.provide({ cwd }, async () => {
      const providers = await Provider.list()
      if (Object.keys(providers).length === 0) {
        return "needs_provider"
      }

      const hostname = args.hostname
      const port = args.port

      await Share.init()
      const server = Server.listen({
        port,
        hostname,
      })

      // Start WebSocket server for task events
      taskEventServer.start()

      console.log(
        `dgmo server listening on http://${server.hostname}:${server.port}`,
      )
      console.log(
        `Task event WebSocket server listening on ws://localhost:5747`,
      )

      await new Promise(() => {})

      server.stop()
    })
  },
})

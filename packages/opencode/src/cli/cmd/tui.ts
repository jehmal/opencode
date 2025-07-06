import { Global } from "../../global"
import { Provider } from "../../provider/provider"
import { Server } from "../../server/server"
import { bootstrap } from "../bootstrap"
import { UI } from "../ui"
import { cmd } from "./cmd"
import path from "path"
import fs from "fs/promises"
import { Installation } from "../../installation"
import { Config } from "../../config/config"
import { Bus } from "../../bus"
import { TaskEventServer } from "../../events/task-events/server"

export const TuiCommand = cmd({
  command: "$0 [project]",
  describe: "start dgmo tui",
  builder: (yargs) =>
    yargs.positional("project", {
      type: "string",
      describe: "path to start dgmo in",
    }),
  handler: async (args) => {
    while (true) {
      const cwd = args.project ? path.resolve(args.project) : process.cwd()
      try {
        process.chdir(cwd)
      } catch (e) {
        UI.error("Failed to change directory to " + cwd)
        return
      }
      const result = await bootstrap({ cwd }, async (app) => {
        const providers = await Provider.list()
        if (Object.keys(providers).length === 0) {
          return "needs_provider"
        }

        const server = Server.listen({
          port: 0,
          hostname: "127.0.0.1",
        })

        // Start the WebSocket task event server
        const taskEventServer = new TaskEventServer()
        taskEventServer.start()

        let serverStopped = false
        const stopServer = () => {
          if (!serverStopped && server) {
            serverStopped = true
            server.stop()
            taskEventServer.stop()
          }
        }
        const goPath =
          Bun.which("go", { PATH: process.env["PATH"] }) || "/usr/bin/go"
        let cmd = [goPath, "run", "./main.go"]
        let cwd = Bun.fileURLToPath(
          new URL("../../../../tui/cmd/dgmo", import.meta.url),
        )
        if (Bun.embeddedFiles.length > 0) {
          const blob = Bun.embeddedFiles[0] as File
          let binaryName = blob.name
          if (process.platform === "win32" && !binaryName.endsWith(".exe")) {
            binaryName += ".exe"
          }
          const binary = path.join(Global.Path.cache, "tui", binaryName)
          const file = Bun.file(binary)
          if (!(await file.exists())) {
            await Bun.write(file, blob, { mode: 0o755 })
            await fs.chmod(binary, 0o755)
          }
          cwd = process.cwd()
          cmd = [binary]
        }
        const proc = Bun.spawn({
          cmd: [...cmd, ...process.argv.slice(2)],
          cwd,
          stdout:
            process.env["OPENCODE_ENV"] === "production" ? "ignore" : "inherit",
          stderr:
            process.env["OPENCODE_ENV"] === "production" ? "ignore" : "inherit",
          stdin: "inherit",
          env: {
            ...process.env,
            OPENCODE_ENV: process.env["OPENCODE_ENV"] || "production",
            DGMO_SERVER: `http://${server.hostname}:${server.port}`,
            OPENCODE_SERVER: `http://${server.hostname}:${server.port}`, // Backwards compatibility
            DGMO_APP_INFO: JSON.stringify(app),
            OPENCODE_APP_INFO: JSON.stringify(app), // Backwards compatibility
          },
          onExit: () => {
            stopServer()
          },
        })

        ;(async () => {
          if (Installation.VERSION === "dev") return
          if (Installation.isSnapshot()) return
          const config = await Config.global()
          if (config.autoupdate === false) return
          const latest = await Installation.latest().catch(() => {})
          if (!latest) return
          if (Installation.VERSION === latest) return
          const method = await Installation.method()
          if (method === "unknown") return
          await Installation.upgrade(method, latest)
            .then(() => {
              Bus.publish(Installation.Event.Updated, { version: latest })
            })
            .catch(() => {})
        })()

        await proc.exited
        stopServer()

        return "done"
      })
      if (result === "done") break
      if (result === "needs_provider") {
        UI.empty()
        UI.println(UI.logo("   "))
        const result = await Bun.spawn({
          cmd: [process.execPath, process.argv[1], "auth", "login"],
          cwd: process.cwd(),
          stdout: "inherit",
          stderr: "inherit",
          stdin: "inherit",
        }).exited
        if (result !== 0) return
        UI.empty()
      }
    }
  },
})

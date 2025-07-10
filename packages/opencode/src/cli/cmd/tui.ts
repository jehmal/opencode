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
import { taskEventServer } from "../../events/task-events/server"

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
        taskEventServer.start()

        let serverStopped = false
        const stopServer = () => {
          if (!serverStopped && server) {
            serverStopped = true
            server.stop()
            taskEventServer.stop()
          }
        }
        let cmd: string[]
        let spawnCwd = process.cwd() // Store the current working directory after chdir
        let goCmdDir: string | undefined

        // First, check if we have embedded files (production build)
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
          cmd = [binary]
        } else {
          // Development mode: check for compiled binary first
          const tuiDir = Bun.fileURLToPath(
            new URL("../../../../tui", import.meta.url),
          )
          const binaryName = process.platform === "win32" ? "dgmo.exe" : "dgmo"
          const compiledBinary = path.join(tuiDir, binaryName)

          try {
            await fs.access(compiledBinary, fs.constants.X_OK)
            // Binary exists and is executable
            cmd = [compiledBinary]
          } catch {
            // Binary doesn't exist or isn't executable, fall back to go run
            const goPath =
              Bun.which("go", { PATH: process.env["PATH"] }) || "/usr/bin/go"
            goCmdDir = Bun.fileURLToPath(
              new URL("../../../../tui/cmd/dgmo", import.meta.url),
            )
            cmd = [goPath, "run", path.join(goCmdDir, "main.go")]
            // Note: We'll handle the working directory in the spawn options
          }
        }
        const proc = Bun.spawn({
          cmd: [...cmd, ...process.argv.slice(2)],
          cwd: spawnCwd, // Always use the user's current working directory
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
            // If using go run, we need to tell Go where to find the source
            ...(goCmdDir ? { GOWORK: "off", PWD: goCmdDir } : {}),
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

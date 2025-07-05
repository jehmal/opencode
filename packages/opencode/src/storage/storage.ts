import { Log } from "../util/log"
import { App } from "../app/app"
import { Bus } from "../bus"
import path from "path"
import z from "zod"
import fs from "fs/promises"

export namespace Storage {
  const log = Log.create({ service: "storage" })
  
  // Normalize storage keys to ensure consistency
  export function normalizeStorageKey(key: string): string {
    // Remove any duplicate slashes
    key = key.replace(/\/+/g, '/')
    
    // Ensure no leading slash
    if (key.startsWith('/')) {
      key = key.substring(1)
    }
    
    // Ensure no trailing slash for files
    if (key.endsWith('/') && !key.includes('.json')) {
      key = key.slice(0, -1)
    }
    
    // Log normalization for debugging if needed
    // log.info("[STORAGE] Normalized key:", { original: arguments[0], normalized: key })
    return key
  }

  export const Event = {
    Write: Bus.event(
      "storage.write",
      z.object({ key: z.string(), content: z.any() }),
    ),
  }

  const state = App.state("storage", () => {
    const app = App.info()
    const dir = path.join(app.path.data, "storage")
    log.info("init", { path: dir })
    return {
      dir,
    }
  })

  export async function remove(key: string) {
    key = normalizeStorageKey(key)
    const target = path.join(state().dir, key + ".json")
    await fs.unlink(target).catch(() => {})
  }

  export async function removeDir(key: string) {
    key = normalizeStorageKey(key)
    const target = path.join(state().dir, key)
    await fs.rm(target, { recursive: true, force: true }).catch(() => {})
  }

  export async function readJSON<T>(key: string) {
    key = normalizeStorageKey(key)
    return Bun.file(path.join(state().dir, key + ".json")).json() as Promise<T>
  }

  export async function writeJSON<T>(key: string, content: T) {
    key = normalizeStorageKey(key)
    const target = path.join(state().dir, key + ".json")
    const tmp = target + Date.now() + ".tmp"
    await Bun.write(tmp, JSON.stringify(content))
    await fs.rename(tmp, target).catch(() => {})
    await fs.unlink(tmp).catch(() => {})
    Bus.publish(Event.Write, { key, content })
  }

  const glob = new Bun.Glob("**/*")
  export async function* list(prefix: string) {
    prefix = normalizeStorageKey(prefix)
    try {
      for await (const item of glob.scan({
        cwd: path.join(state().dir, prefix),
        onlyFiles: true,
      })) {
        const result = path.join(prefix, item.slice(0, -5))
        yield result
      }
    } catch {
      return
    }
  }
}

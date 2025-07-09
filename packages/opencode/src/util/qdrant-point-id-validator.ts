import { Log } from "./log"
import { randomUUID } from "crypto"

export namespace QdrantPointIdValidator {
  const log = Log.create({ service: "qdrant-point-id-validator" })

  export function validatePointId(id: any): string | number {
    if (id === null || id === undefined) {
      const uuid = randomUUID()
      log.warn("Point ID was null/undefined, generated UUID", {
        generatedId: uuid,
      })
      return uuid
    }

    if (typeof id === "number") {
      if (Number.isInteger(id) && id >= 0) {
        return id
      }
      const uuid = randomUUID()
      log.warn("Point ID was invalid number, generated UUID", {
        originalId: id,
        generatedId: uuid,
      })
      return uuid
    }

    if (typeof id === "string") {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if (uuidRegex.test(id)) {
        return id
      }

      const numericId = parseInt(id, 10)
      if (!isNaN(numericId) && numericId >= 0 && numericId.toString() === id) {
        return numericId
      }

      const uuid = randomUUID()
      log.warn("Point ID was invalid string, generated UUID", {
        originalId: id,
        generatedId: uuid,
      })
      return uuid
    }

    const uuid = randomUUID()
    log.warn("Point ID was unsupported type, generated UUID", {
      originalId: id,
      originalType: typeof id,
      generatedId: uuid,
    })
    return uuid
  }

  export function validatePointIds(ids: any[]): (string | number)[] {
    if (!Array.isArray(ids)) {
      log.error("Point IDs parameter is not an array", { ids })
      throw new Error("Point IDs must be an array")
    }
    return ids.map(validatePointId)
  }

  export function validateUpsertPoints(points: any[]): any[] {
    if (!Array.isArray(points)) {
      log.error("Points parameter is not an array", { points })
      throw new Error("Points must be an array")
    }

    return points.map((point) => {
      if (typeof point !== "object" || point === null) {
        log.error("Point is not an object", { point })
        throw new Error("Each point must be an object")
      }

      const validatedPoint = { ...point }
      if ("id" in point) {
        const originalId = point.id
        validatedPoint.id = validatePointId(originalId)
        if (validatedPoint.id !== originalId) {
          log.info("Point ID was converted", {
            originalId,
            validatedId: validatedPoint.id,
          })
        }
      } else {
        validatedPoint.id = randomUUID()
        log.info("Generated ID for point missing ID", {
          generatedId: validatedPoint.id,
        })
      }

      return validatedPoint
    })
  }

  export function isQdrantPointOperation(toolName: string): boolean {
    const qdrantPointOps = [
      "qdrant-get-points",
      "qdrant-upsert-points",
      "qdrant-delete-points",
      "qdrant-set-payload",
      "qdrant-recommend",
    ]

    return qdrantPointOps.some((op) => toolName.includes(op))
  }

  export function validateQdrantArgs(toolName: string, args: any): any {
    if (!isQdrantPointOperation(toolName)) {
      return args
    }

    const validatedArgs = { ...args }

    try {
      if (toolName.includes("qdrant-get-points")) {
        if ("ids" in args && args.ids) {
          validatedArgs.ids = validatePointIds(args.ids)
          log.info("Validated get-points IDs", {
            original: args.ids,
            validated: validatedArgs.ids,
          })
        }
      }

      if (toolName.includes("qdrant-upsert-points")) {
        if ("points" in args && args.points) {
          validatedArgs.points = validateUpsertPoints(args.points)
          log.info("Validated upsert-points data", {
            originalCount: args.points?.length,
            validatedCount: validatedArgs.points?.length,
          })
        }
      }

      if (toolName.includes("qdrant-delete-points")) {
        if ("ids" in args && args.ids) {
          validatedArgs.ids = validatePointIds(args.ids)
          log.info("Validated delete-points IDs", {
            original: args.ids,
            validated: validatedArgs.ids,
          })
        }
      }

      if (toolName.includes("qdrant-set-payload")) {
        if ("ids" in args && args.ids) {
          validatedArgs.ids = validatePointIds(args.ids)
          log.info("Validated set-payload IDs", {
            original: args.ids,
            validated: validatedArgs.ids,
          })
        }
      }

      if (toolName.includes("qdrant-recommend")) {
        if ("positive" in args && args.positive) {
          validatedArgs.positive = validatePointIds(args.positive)
          log.info("Validated recommend positive IDs", {
            original: args.positive,
            validated: validatedArgs.positive,
          })
        }
        if ("negative" in args && args.negative) {
          validatedArgs.negative = validatePointIds(args.negative)
          log.info("Validated recommend negative IDs", {
            original: args.negative,
            validated: validatedArgs.negative,
          })
        }
      }

      return validatedArgs
    } catch (error) {
      log.error("Error validating Qdrant arguments", { toolName, args, error })
      throw new Error(`Point ID validation failed: ${error}`)
    }
  }
}

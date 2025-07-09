import { describe, test, expect } from "bun:test"
import { QdrantPointIdValidator } from "../src/util/qdrant-point-id-validator"

describe("QdrantPointIdValidator", () => {
  describe("validatePointId", () => {
    test("should accept valid UUIDs", () => {
      const validUuid = "550e8400-e29b-41d4-a716-446655440000"
      const result = QdrantPointIdValidator.validatePointId(validUuid)
      expect(result).toBe(validUuid)
    })

    test("should accept valid positive integers", () => {
      const validInt = 123
      const result = QdrantPointIdValidator.validatePointId(validInt)
      expect(result).toBe(validInt)
    })

    test("should accept valid positive integer strings", () => {
      const validIntString = "456"
      const result = QdrantPointIdValidator.validatePointId(validIntString)
      expect(result).toBe(456)
    })

    test("should generate UUID for invalid string IDs", () => {
      const invalidString = "test-123"
      const result = QdrantPointIdValidator.validatePointId(invalidString)
      expect(typeof result).toBe("string")
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )
    })

    test("should generate UUID for null/undefined", () => {
      const nullResult = QdrantPointIdValidator.validatePointId(null)
      const undefinedResult = QdrantPointIdValidator.validatePointId(undefined)

      expect(typeof nullResult).toBe("string")
      expect(typeof undefinedResult).toBe("string")
      expect(nullResult).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )
      expect(undefinedResult).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )
    })

    test("should generate UUID for negative numbers", () => {
      const negativeNumber = -123
      const result = QdrantPointIdValidator.validatePointId(negativeNumber)
      expect(typeof result).toBe("string")
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )
    })

    test("should generate UUID for non-integer numbers", () => {
      const floatNumber = 123.45
      const result = QdrantPointIdValidator.validatePointId(floatNumber)
      expect(typeof result).toBe("string")
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )
    })

    test("should generate UUID for objects", () => {
      const objectId = { id: "test" }
      const result = QdrantPointIdValidator.validatePointId(objectId)
      expect(typeof result).toBe("string")
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )
    })
  })

  describe("validatePointIds", () => {
    test("should validate array of mixed valid IDs", () => {
      const ids = ["550e8400-e29b-41d4-a716-446655440000", 123, "456"]
      const result = QdrantPointIdValidator.validatePointIds(ids)

      expect(result).toHaveLength(3)
      expect(result[0]).toBe("550e8400-e29b-41d4-a716-446655440000")
      expect(result[1]).toBe(123)
      expect(result[2]).toBe(456)
    })

    test("should convert invalid IDs to UUIDs", () => {
      const ids = ["test-123", "invalid-id", -456]
      const result = QdrantPointIdValidator.validatePointIds(ids)

      expect(result).toHaveLength(3)
      expect(typeof result[0]).toBe("string")
      expect(typeof result[1]).toBe("string")
      expect(typeof result[2]).toBe("string")
      expect(result[0]).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )
      expect(result[1]).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )
      expect(result[2]).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )
    })

    test("should throw error for non-array input", () => {
      expect(() => {
        QdrantPointIdValidator.validatePointIds("not-an-array" as any)
      }).toThrow("Point IDs must be an array")
    })
  })

  describe("validateUpsertPoints", () => {
    test("should validate points with valid IDs", () => {
      const points = [
        { id: "550e8400-e29b-41d4-a716-446655440000", vector: [1, 2, 3] },
        { id: 123, vector: [4, 5, 6] },
        { id: "456", vector: [7, 8, 9] },
      ]

      const result = QdrantPointIdValidator.validateUpsertPoints(points)

      expect(result).toHaveLength(3)
      expect(result[0].id).toBe("550e8400-e29b-41d4-a716-446655440000")
      expect(result[1].id).toBe(123)
      expect(result[2].id).toBe(456)
    })

    test("should convert invalid IDs to UUIDs", () => {
      const points = [
        { id: "test-123", vector: [1, 2, 3] },
        { id: -456, vector: [4, 5, 6] },
      ]

      const result = QdrantPointIdValidator.validateUpsertPoints(points)

      expect(result).toHaveLength(2)
      expect(typeof result[0].id).toBe("string")
      expect(typeof result[1].id).toBe("string")
      expect(result[0].id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )
      expect(result[1].id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )
    })

    test("should generate IDs for points missing IDs", () => {
      const points = [{ vector: [1, 2, 3] }, { vector: [4, 5, 6] }]

      const result = QdrantPointIdValidator.validateUpsertPoints(points)

      expect(result).toHaveLength(2)
      expect(typeof result[0].id).toBe("string")
      expect(typeof result[1].id).toBe("string")
      expect(result[0].id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )
      expect(result[1].id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )
    })

    test("should throw error for non-array input", () => {
      expect(() => {
        QdrantPointIdValidator.validateUpsertPoints("not-an-array" as any)
      }).toThrow("Points must be an array")
    })

    test("should throw error for non-object points", () => {
      expect(() => {
        QdrantPointIdValidator.validateUpsertPoints(["not-an-object"] as any)
      }).toThrow("Each point must be an object")
    })
  })

  describe("isQdrantPointOperation", () => {
    test("should identify Qdrant point operations", () => {
      expect(
        QdrantPointIdValidator.isQdrantPointOperation(
          "QdrantXXX_qdrant-get-points",
        ),
      ).toBe(true)
      expect(
        QdrantPointIdValidator.isQdrantPointOperation(
          "QdrantXXX_qdrant-upsert-points",
        ),
      ).toBe(true)
      expect(
        QdrantPointIdValidator.isQdrantPointOperation(
          "QdrantXXX_qdrant-delete-points",
        ),
      ).toBe(true)
      expect(
        QdrantPointIdValidator.isQdrantPointOperation(
          "QdrantXXX_qdrant-set-payload",
        ),
      ).toBe(true)
      expect(
        QdrantPointIdValidator.isQdrantPointOperation(
          "QdrantXXX_qdrant-recommend",
        ),
      ).toBe(true)
    })

    test("should not identify non-Qdrant operations", () => {
      expect(
        QdrantPointIdValidator.isQdrantPointOperation(
          "QdrantXXX_qdrant-create-collection",
        ),
      ).toBe(false)
      expect(QdrantPointIdValidator.isQdrantPointOperation("other_tool")).toBe(
        false,
      )
      expect(QdrantPointIdValidator.isQdrantPointOperation("bash")).toBe(false)
    })
  })

  describe("validateQdrantArgs", () => {
    test("should validate get-points arguments", () => {
      const args = {
        collection_name: "test",
        ids: ["test-123", 456, "550e8400-e29b-41d4-a716-446655440000"],
      }

      const result = QdrantPointIdValidator.validateQdrantArgs(
        "QdrantXXX_qdrant-get-points",
        args,
      )

      expect(result.collection_name).toBe("test")
      expect(result.ids).toHaveLength(3)
      expect(typeof result.ids[0]).toBe("string") // converted to UUID
      expect(result.ids[1]).toBe(456) // kept as integer
      expect(result.ids[2]).toBe("550e8400-e29b-41d4-a716-446655440000") // kept as UUID
    })

    test("should validate upsert-points arguments", () => {
      const args = {
        collection_name: "test",
        points: [
          { id: "test-123", vector: [1, 2, 3] },
          { id: 456, vector: [4, 5, 6] },
        ],
      }

      const result = QdrantPointIdValidator.validateQdrantArgs(
        "QdrantXXX_qdrant-upsert-points",
        args,
      )

      expect(result.collection_name).toBe("test")
      expect(result.points).toHaveLength(2)
      expect(typeof result.points[0].id).toBe("string") // converted to UUID
      expect(result.points[1].id).toBe(456) // kept as integer
    })

    test("should validate delete-points arguments", () => {
      const args = {
        collection_name: "test",
        ids: ["test-123", "test-456"],
      }

      const result = QdrantPointIdValidator.validateQdrantArgs(
        "QdrantXXX_qdrant-delete-points",
        args,
      )

      expect(result.collection_name).toBe("test")
      expect(result.ids).toHaveLength(2)
      expect(typeof result.ids[0]).toBe("string") // converted to UUID
      expect(typeof result.ids[1]).toBe("string") // converted to UUID
    })

    test("should validate recommend arguments", () => {
      const args = {
        collection_name: "test",
        positive: ["test-123", 456],
        negative: ["test-789"],
      }

      const result = QdrantPointIdValidator.validateQdrantArgs(
        "QdrantXXX_qdrant-recommend",
        args,
      )

      expect(result.collection_name).toBe("test")
      expect(result.positive).toHaveLength(2)
      expect(result.negative).toHaveLength(1)
      expect(typeof result.positive[0]).toBe("string") // converted to UUID
      expect(result.positive[1]).toBe(456) // kept as integer
      expect(typeof result.negative[0]).toBe("string") // converted to UUID
    })

    test("should not modify non-Qdrant tool arguments", () => {
      const args = { some: "data" }
      const result = QdrantPointIdValidator.validateQdrantArgs(
        "other_tool",
        args,
      )
      expect(result).toEqual(args)
    })

    test("should handle missing optional fields gracefully", () => {
      const args = { collection_name: "test" }

      const getResult = QdrantPointIdValidator.validateQdrantArgs(
        "QdrantXXX_qdrant-get-points",
        args,
      )
      const upsertResult = QdrantPointIdValidator.validateQdrantArgs(
        "QdrantXXX_qdrant-upsert-points",
        args,
      )

      expect(getResult.collection_name).toBe("test")
      expect(upsertResult.collection_name).toBe("test")
    })
  })
})

import { describe, test, expect } from "bun:test"
import { QdrantPointIdValidator } from "../src/util/qdrant-point-id-validator"

describe("Qdrant Integration Test", () => {
  test("should handle real-world scenarios that were failing", () => {
    // Test the exact scenarios mentioned in the issue

    // Scenario 1: qdrant-get-points with invalid string ID
    const getPointsArgs = {
      collection_name: "AgentMemories",
      ids: ["test-123"], // This was failing before
    }

    const validatedGetArgs = QdrantPointIdValidator.validateQdrantArgs(
      "QdrantXXX_qdrant-get-points",
      getPointsArgs,
    )

    expect(validatedGetArgs.collection_name).toBe("AgentMemories")
    expect(validatedGetArgs.ids).toHaveLength(1)
    expect(typeof validatedGetArgs.ids[0]).toBe("string")
    expect(validatedGetArgs.ids[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )

    // Scenario 2: qdrant-upsert-points with invalid string ID
    const upsertPointsArgs = {
      collection_name: "AgentMemories",
      points: [
        {
          id: "test-456", // This was failing before
          content: "Test memory content",
          metadata: { type: "test" },
        },
      ],
    }

    const validatedUpsertArgs = QdrantPointIdValidator.validateQdrantArgs(
      "QdrantXXX_qdrant-upsert-points",
      upsertPointsArgs,
    )

    expect(validatedUpsertArgs.collection_name).toBe("AgentMemories")
    expect(validatedUpsertArgs.points).toHaveLength(1)
    expect(typeof validatedUpsertArgs.points[0].id).toBe("string")
    expect(validatedUpsertArgs.points[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(validatedUpsertArgs.points[0].content).toBe("Test memory content")
    expect(validatedUpsertArgs.points[0].metadata).toEqual({ type: "test" })
  })

  test("should preserve valid IDs and only convert invalid ones", () => {
    const mixedArgs = {
      collection_name: "test",
      ids: [
        "550e8400-e29b-41d4-a716-446655440000", // Valid UUID - should be preserved
        123, // Valid integer - should be preserved
        "456", // Valid integer string - should be converted to number
        "test-invalid", // Invalid string - should be converted to UUID
        -789, // Invalid negative number - should be converted to UUID
      ],
    }

    const result = QdrantPointIdValidator.validateQdrantArgs(
      "QdrantXXX_qdrant-get-points",
      mixedArgs,
    )

    expect(result.ids).toHaveLength(5)
    expect(result.ids[0]).toBe("550e8400-e29b-41d4-a716-446655440000") // Preserved UUID
    expect(result.ids[1]).toBe(123) // Preserved integer
    expect(result.ids[2]).toBe(456) // Converted to integer
    expect(typeof result.ids[3]).toBe("string") // Converted to UUID
    expect(result.ids[3]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(typeof result.ids[4]).toBe("string") // Converted to UUID
    expect(result.ids[4]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  test("should handle edge cases gracefully", () => {
    // Empty arrays
    const emptyArgs = {
      collection_name: "test",
      ids: [],
    }

    const emptyResult = QdrantPointIdValidator.validateQdrantArgs(
      "QdrantXXX_qdrant-get-points",
      emptyArgs,
    )

    expect(emptyResult.ids).toHaveLength(0)

    // Missing ids field
    const missingIdsArgs = {
      collection_name: "test",
    }

    const missingResult = QdrantPointIdValidator.validateQdrantArgs(
      "QdrantXXX_qdrant-get-points",
      missingIdsArgs,
    )

    expect(missingResult.collection_name).toBe("test")
    expect(missingResult.ids).toBeUndefined()
  })

  test("should not modify non-Qdrant point operations", () => {
    const nonQdrantArgs = {
      collection_name: "test",
      vector_size: 384,
      distance: "Cosine",
    }

    const result = QdrantPointIdValidator.validateQdrantArgs(
      "QdrantXXX_qdrant-create-collection",
      nonQdrantArgs,
    )

    expect(result).toEqual(nonQdrantArgs) // Should be unchanged
  })
})

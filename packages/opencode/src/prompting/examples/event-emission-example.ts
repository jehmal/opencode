/**
 * Example of how to emit prompting technique events from the client
 */

// Example: Emitting technique selected event
async function emitTechniqueSelected(sessionID: string) {
  const response = await fetch("/prompting/technique/selected", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionID,
      techniques: [
        {
          id: "cot",
          name: "Chain of Thought",
          confidence: 0.95,
        },
      ],
      selectionMode: "auto",
    }),
  })
  return response.json()
}

export { emitTechniqueSelected }

#!/usr/bin/env node

import WebSocket from "ws"

console.log("Testing existing TaskEventServer on port 5747...")

const ws = new WebSocket("ws://localhost:5747")

let eventCount = 0
const eventTypes = new Set()

ws.on("open", function open() {
  console.log("✅ Successfully connected to existing TaskEventServer")
  console.log("Monitoring events for 5 seconds...")
})

ws.on("message", function message(data) {
  try {
    const parsed = JSON.parse(data)

    if (parsed.type === "heartbeat") {
      console.log("💓 Heartbeat received:", parsed.timestamp)
      return
    }

    eventCount++
    eventTypes.add(parsed.type)

    console.log(`📨 Event ${eventCount}: ${parsed.type}`)
    console.log(`   SessionID: ${parsed.data?.sessionID}`)
    console.log(`   TaskID: ${parsed.data?.taskID}`)

    if (parsed.type === "task.progress") {
      console.log(`   Progress: ${parsed.data?.progress}%`)
      console.log(`   Message: ${parsed.data?.message}`)
    }
  } catch (e) {
    console.log("📨 Raw data:", data.toString())
  }
})

ws.on("error", function error(err) {
  console.error("❌ WebSocket error:", err.message)
})

ws.on("close", function close(code, reason) {
  console.log(`🔌 Connection closed. Code: ${code}`)
  console.log(`📊 Summary:`)
  console.log(`   Total events received: ${eventCount}`)
  console.log(`   Event types seen: ${Array.from(eventTypes).join(", ")}`)
})

// Monitor for 5 seconds
setTimeout(() => {
  console.log("⏰ Monitoring complete, closing connection...")
  ws.close()
}, 5000)

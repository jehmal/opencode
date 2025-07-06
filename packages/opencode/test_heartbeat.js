#!/usr/bin/env node

import WebSocket from "ws"

console.log("Testing heartbeat mechanism...")

const ws = new WebSocket("ws://localhost:5747")

let heartbeatReceived = false

ws.on("open", function open() {
  console.log("✅ WebSocket connection established")
  console.log("Waiting for heartbeat (30 second interval)...")
})

ws.on("message", function message(data) {
  try {
    const parsed = JSON.parse(data)
    if (parsed.type === "heartbeat") {
      console.log("💓 Heartbeat received:", parsed)
      heartbeatReceived = true
      ws.close()
    } else {
      console.log("📨 Other message:", parsed.type)
    }
  } catch (e) {
    console.log("📨 Raw data:", data.toString())
  }
})

ws.on("error", function error(err) {
  console.error("❌ WebSocket error:", err.message)
})

ws.on("close", function close(code, reason) {
  console.log(`🔌 Connection closed. Heartbeat received: ${heartbeatReceived}`)
})

// Wait up to 35 seconds for heartbeat
setTimeout(() => {
  if (!heartbeatReceived) {
    console.log("⏰ No heartbeat received within 35 seconds")
    ws.close()
  }
}, 35000)

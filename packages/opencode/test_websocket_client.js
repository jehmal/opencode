#!/usr/bin/env node

import WebSocket from "ws"

console.log("Testing WebSocket connection to TaskEventServer...")

const ws = new WebSocket("ws://localhost:5747")

ws.on("open", function open() {
  console.log("✅ WebSocket connection established successfully")
  console.log("Waiting for messages...")
})

ws.on("message", function message(data) {
  try {
    const parsed = JSON.parse(data)
    console.log("📨 Received message:", parsed)
  } catch (e) {
    console.log("📨 Received raw data:", data.toString())
  }
})

ws.on("error", function error(err) {
  console.error("❌ WebSocket error:", err.message)
})

ws.on("close", function close(code, reason) {
  console.log(
    `🔌 WebSocket connection closed. Code: ${code}, Reason: ${reason}`,
  )
})

// Keep the connection alive for 10 seconds to test heartbeat
setTimeout(() => {
  console.log("Closing test connection...")
  ws.close()
}, 10000)

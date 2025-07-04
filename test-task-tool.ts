import { TaskTool } from "./packages/opencode/src/tool/task"

console.log("TaskTool id:", TaskTool.id)
console.log(
  "TaskTool description:",
  TaskTool.description.substring(0, 50) + "...",
)

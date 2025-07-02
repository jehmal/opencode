/**
 * Example: Migrating the edit tool to use the protocol layer
 */
import { ToolProtocol, ToolRegistry } from '../typescript/src'
import { EditTool } from '../../opencode/packages/opencode/src/tool/edit'

async function main() {
  // Register the existing edit tool
  ToolRegistry.registerTypeScriptTool({
    id: EditTool.id,
    description: EditTool.description,
    parameters: EditTool.parameters,
    execute: EditTool.execute
  })

  // Now it can be called through the protocol
  const result = await ToolProtocol.executeTool('edit', {
    filePath: '/tmp/test.txt',
    oldString: 'Hello',
    newString: 'Hi',
    replaceAll: false
  })

  console.log('Output:', result.output)
  console.log('Metadata:', result.metadata)
}

main().catch(console.error)
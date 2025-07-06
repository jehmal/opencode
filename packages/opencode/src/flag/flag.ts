export namespace Flag {
  export const DGMO_AUTO_SHARE = truthy("DGMO_AUTO_SHARE")
  export const OPENCODE_AUTO_SHARE = truthy("OPENCODE_AUTO_SHARE") // Backwards compatibility

  function truthy(key: string) {
    const value = process.env[key]?.toLowerCase()
    return value === "true" || value === "1"
  }
}

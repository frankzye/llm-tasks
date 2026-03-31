export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startSkillsIndexWatcher } = await import("./lib/agent/skills-catalog-watcher");
    startSkillsIndexWatcher(process.cwd());
  }
}

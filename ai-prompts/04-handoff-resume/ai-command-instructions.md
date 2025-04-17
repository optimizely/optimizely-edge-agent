1. **Use CMD.exe** not PowerShell, as PowerShell can sometimes hide output or block in unexpected ways

2. **For long-running processes (like development servers):**
   - Always use `start` command for processes that need to run continuously
   - Example: `start wrangler dev --local`
   - This opens a new CMD window for the process so it doesn't block your current terminal

3. **For commands that need output visibility:**
   - Use redirection to capture output: `command > output.log 2>&1`
   - Use `type output.log` to view the result

Corrected version:

4. **For Wrangler development specifically:**
   - Run `wrangler dev --local` to test against localhost:8787
   - Add `--inspector-port` flag to see additional debugging information
   - Use `wrangler dev --local --inspector-port=9229 --port=8787` for explicit control

5. **When running Node scripts:**
   - Use `node script.js` directly to see output in the terminal
   - For background execution: `start cmd /c "node script.js > output.log 2>&1"`

6. **To prevent hanging:**
   - Add timeouts: `timeout /t 60 & command` (runs command after 60 seconds)
   - Use `^C` (Ctrl+C) to terminate any hanging process

The most common mistake is likely running `wrangler dev` without the `start` command, which creates a blocking process in the terminal window.

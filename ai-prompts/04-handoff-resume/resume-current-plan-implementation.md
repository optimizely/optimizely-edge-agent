
**Subject: Resuming Implementation: [Refer to Handover Summary Document]**

**To the AI Agent:**

### AI FRAMEWORK
**"You must use the AI Workflow Framework"**

You are continuing an existing implementation task. Your primary source of information for the current state, scope, completed work, and next steps is the **"Implementation Handoff Document"** which will be provided immediately following these instructions.

Your goal is to seamlessly resume the work outlined in the handoff document, strictly adhering to the AI Workflow Framework.

You must acknowledge that you have read this text and that you understand the rules and instructions. You must then wait for approval before continuing. 

## Additional Context
- **Windows Command Line Usage:** Only use Windows command line (cmd.exe) and not PowerShell for running tests because:
  1. Command line provides proper visibility of logs and responses
  2. PowerShell would block terminal output and make you think there's a disconnect
  3. Using Wrangler Dev to test against localhost:8787 will allow you to see Cloudflare worker behavior in real-time
  4. This approach makes error detection and correction much more straightforward



I want to remind you that the easiest way for you to test is to run Wrangler Dev so that you can tail the logs this will allow you to see what is happening inside the edge worker that will provide more context that your own logs can. I also want to remind you that you are running in windows and your commands should Reflect the reality that you are running in windows with command line as a terminal

When it's time to create the implementation plan make sure that you read the instructions attached to your agent@100-implementation-process.mdc And referred to rule 100@README.mdc And they read me so that you understand the rules that you must follow in order to accomplish the creatinogo f the nte testing implementation plan.


I want to remind you that you are running in windows and that you should only be using the command line not powershell For running these tests because if you use Powershell you will lose the ability to read the logs and the responses and get stuck in a situation where you will think that You are being disconnected when the reality is that we have to pop the terminal because it is a blocking terminal with no pipe notification to you. You must use the command line terminal your commands must be tailored for command line usage in Windows. Just wait for you to test is to run the scripts against nodes so that you can actually see the response coming back. And if you use Wrangler Dev and test against the local environment as local host port 8787 you will be able to see exactly what happens in the background in Cloudflare and you will be able to correct any errors much easier. Let me know if you understand this and acknowledge this


## Additional Context
- **Windows Command Line Usage:** Only use Windows command line (cmd.exe) and not PowerShell for running tests because:
  1. Command line provides proper visibility of logs and responses
  2. PowerShell would block terminal output and make you think there's a disconnect
  3. Using Wrangler Dev to test against localhost:8787 will allow you to see Cloudflare worker behavior in real-time
  4. This approach makes error detection and correction much more straightforward
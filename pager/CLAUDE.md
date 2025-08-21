# WordPress Material Automation Project

## Project Summary
This automation uses Magnitude (a visual browser agent built on Playwright) to read material information from individual markdown files and automatically creates/updates WordPress custom posts. The automation:

1. **Reads local data**: Parses individual material files in the `materials/` folder and login credentials from `login_credentials.md`
2. **WordPress automation**: Navigates to WordPress dashboard, logs in, and accesses material custom post type editor
3. **Data entry**: Fills custom fields in the "Material Data" section of the WordPress UI
4. **Image management**: Sets featured images from the WordPress media gallery
5. **Batch processing**: Processes all materials in the materials folder
6. **Error handling**: Handles login failures, missing images, and other edge cases gracefully

## Current Project Structure
```
project-root/
├── src/
│   └── index.ts              # Main automation script
├── login_credentials.md      # WordPress login credentials
├── materials/                # Individual material markdown files
│   ├── carbon_black.md
│   ├── citric_acid.md
│   ├── flour.md
│   └── [other material files]
├── images/                   # Material images for reference
│   ├── carbon-black_LG.png
│   ├── citric-acid_LG.png
│   └── [other material images]
└── [other project files]
```

## Technical Requirements

## How It Works

### File Processing
1. **Login Credentials**: Reads WordPress URL, username, and password from `login_credentials.md`
2. **Material Data**: Processes all `.md` files in the `materials/` folder
3. **Material Structure**: Each material file contains:
   - Material name (from `## heading`)
   - Material page name
   - Hero Description
   - Overview
   - Characteristics and Challenges

### WordPress Automation
1. **Login**: Uses Magnitude to log into WordPress admin
2. **Material Management**: 
   - Searches for existing materials first
   - Creates new materials or edits existing ones
   - Fills custom fields in the "Material Data" section of the WordPress UI
3. **Image Handling**: Sets featured images by searching the WordPress media gallery
4. **Publishing**: Saves and publishes each material post

## Material File Structure
Each material file follows this format:
```markdown
## Material Name

**Material page name:** Display Name

**Hero Description:** Brief description for hero section

**Overview:** Detailed overview paragraph(s)

**Characteristics and Challenges:** Technical details and handling challenges
```

## Key Features
- **Intelligent Search**: Checks for existing materials before creating new ones
- **Media Gallery Integration**: Searches and sets featured images from existing WordPress media
- **Material Data Section**: Specifically targets the "Material Data" custom fields section in WordPress
- **Error Handling**: Continues processing other materials if one fails
- **Logging**: Detailed console output showing progress and results

## Running the Automation
1. Ensure `login_credentials.md` contains valid WordPress credentials
2. Add material files to the `materials/` folder
3. Run: `npm start` or `node src/index.ts`
4. The automation will process all materials and provide a summary report

## Magnitude Overview

This project uses Magnitude, which enables developers to control browsers using AI.

Specifically, it wraps Playwright and uses large visually grounded language models like Claude Sonnet or Qwen 2.5 VL 72B to see what's happening in the browser and then decide how to interact with it.

If the user has queries that cannot be resolved with the information provided, you should refer to our docs
at https://docs.magnitude.run/llms-full.txt, and also tell the user that docs are available at https://docs.magnitude.run

## Example

Here is a short example demonstrating Magnitude's usage:
```ts
import { startBrowserAgent } from 'magnitude-core';

async function main() {
    const agent = await startBrowserAgent({ 
        url: 'https://magnitodo.com'
    });
    await agent.act('create 3 todos');
    await agent.stop();
}

main();
```

- `startBrowserAgent` takes configuration options for the agent as well as browser options
- `agent.act(task: string, options?: ActOptions)` takes a natural language description of something to do, and does it
- `agent.stop()` should be called to close the agent and browser

## Configuring Agent

Here is a hypothetical example showing off various configuration options available:
```ts
await startBrowserAgent({
    // Starting URL for agent
    url: "https://google.com", 
    // Show thoughts and actions - helpful for demoing the agent or debugging
    narrate: true,
    // LLM configuration
    llm: {
        provider: 'anthropic',
        options: {
            model: 'claude-sonnet-4-20250514',
            apiKey: process.env.ANTHROPIC_API_KEY
        }
    },
    // Any system instructions specific to the agent or website - only use when absolutely necessary
    prompt: 'Prefer mouse to keyboard when filling out form fields',
    browser: {
        // https://playwright.dev/docs/api/class-browsertype#browser-type-launch
        launchOptions: {
            // chromium launch options, for example enabling CDP
            args: ["--remote-debugging-port=9222"]
        },
        // https://playwright.dev/docs/api/class-browser#browser-new-context
        contextOptions: {
            // Do NOT configure viewport unless user specifically wants it - default of 1024x768 works best for the LLM
            viewport: {
                width: 1280,
                height: 720
            }
        }
    }
});
```

## Acting
`act()` should be used to take any action or sequence of actions in the browser. It is flexible and can handle high-level or low-level descriptions. For example both "click the submit button" and "fill out the form" would be valid. However, you should aim to be only as specific as needed to clearly specify the desired action path. Being too specific and granular is brittle and inefficient.

`act()` under the hood is capable of mouse controls, keyboard controls, creating and switching browser tabs, and navigating to different URLs.

### Options
`act()` takes a description first, then maybe options.

```ts
export interface ActOptions {
    prompt?: string
	data?: string | Record<string, string>
}

async act(taskOrSteps: string | string[], options: ActOptions = {}): Promise<void> { ... }
```
- `prompt` is any special instructions to pass to LLM. Only use if absolutely necessary.
- `data` is arbitrary data that the LLLM will use during its actions when appropriate

### Multi-step

Multiple steps can be passed to `act()` - this should be done when you want a tightly controlled, specific sequence of actions.
```ts
await agent.act([
    'create 3 todos',
    'check off the first todo',
    'delete the third todo'
]);
```

## Extracting Data

`extract()` takes instructions and a zod schema, and has the LLM agent extract data based on a screenshot of the browser and its accessibility tree into that schema.

For example:
```ts
const numTodos = await agent.extract('how many todos are there?', z.number());
```

The schema can be arbitrarily complex, any zod schema is valid.

Here is a more complex example:
```ts
const tasks = await agent.extract(
    'list all tasks',
    z.array(z.object({
        title: z.string(),
        status: z.enum(['todo', 'inprogress', 'done']),
        description: z.string(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']),
        labels: z.array(z.string()),
        assignee: z.string()
    }))
);
```

## Navigation

To navigate to a URL directly, you can use `nav`:
```ts
await agent.nav('https://google.com');
```
Keep in mind that the agent can navigate to URLs on its own in `act()` calls, but sometimes doing this manually is helpful.

## Combining agentic and traditional code

Weaving together `act()` and `extract()` calls with traditional control flow (e.g. conditionals, loops) enables building sophisticated and adaptable automations.

Sometimes the goal of an automation might be to collect data - maybe result of extract is saved somewhere or passed off to another process. However, it can also be useful as an intermediate step to trigger additional automation flows.

Here's a hypothetical example, using the `tasks` in the early extraction example:
```ts
const urgentTasks = tasks.filter(
    task => task.priority === 'urgent' && task.status === 'todo'
);
if (urgentTasks.length > 10) {
    await agent.act('create a new task', data: {
        title: 'get some of these urgent tasks done!',
        description: urgentTasks.map(task => task.title).join(', ')
    });
}
```
Don't overcomplicate automations that can be completed with a few `act()` calls by trying to mix in `extract` and other code, but keep in mind that it is a powerful option available to you.


## Playwright Access

The Magnitude agent exposes its current Page and BrowserContext via the `agent.page` and `agent.context` properties. If the agent switches tabs, `agent.page` will always refer to the agent's active tab. Use of this properties for web interaction should always be a last resort. Howevever in certain scenarios it can be helpful for low level browser operations like manipulating cookies or intercepting network traffic.


## Waiting

Every call to `agent.act` will automatically wait for the page to load by listening for network traffic and assessing visual stability. Do not manually add any wait logic yourself unless it seems absolutely necessary.

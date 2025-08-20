# WordPress Material Automation Project Instructions

## Project Summary
You are building an automation using Magnitude (a visual browser agent built on Playwright) that reads material information from a local markdown file and automatically creates/updates WordPress custom posts. The automation should:

1. **Read local data**: Parse `materials_list.md` file containing material information and login credentials
2. **WordPress automation**: Navigate to WordPress dashboard, login, and access material custom post type editor
3. **Data entry**: Fill custom field meta boxes with information from the markdown file  
4. **Image upload**: Upload matching material images as featured images
5. **Batch processing**: Continue processing materials until reaching `##stop` marker in the markdown
6. **Error handling**: Handle login failures, missing images, and other edge cases gracefully

## Current Project Structure
```
project-root/
├── src/
│   └── index.ts          # Main automation script (MODIFY THIS)
├── materials_list.md     # Material data and credentials (READ THIS)
├── images/              # Material images folder (REFERENCE THESE)
│   ├── material-1.jpg
│   ├── material-2.png
│   └── [other images]
└── [magnitude example files]
```

## Technical Requirements

### Research Phase
1. **Use "context7" MCP servers** to look up documentation for:
   - Magnitude framework capabilities and syntax
   - Playwright file system operations (reading local files)
   - Playwright file upload methods
   - Best practices for combining both tools

### Implementation Steps

#### Step 1: File System Setup
- Modify `src/index.ts` to read and parse `materials_list.md`
- Extract login credentials from the markdown file
- Parse material sections (name, description, properties, etc.)
- Create a function to find matching image files in the `images/` folder
- Stop processing when encountering `##stop` marker

#### Step 2: WordPress Login Automation
- Use Magnitude's vision-based approach to navigate to WordPress admin login
- Extract and use login credentials from the markdown file
- Handle login success/failure scenarios
- Navigate to the material custom post type area

#### Step 3: Material Processing Loop
For each material in the list:
- Navigate to "Add New Material" or edit existing material post
- Fill custom field meta boxes with data from markdown:
  - Material name/title
  - Description
  - Properties/specifications
  - Any other custom fields found in the markdown
- Upload corresponding image file as featured image
- Save/publish the post
- Move to next material

#### Step 4: Error Handling & Logging
- Log successful material uploads
- Handle missing image files gracefully
- Retry failed operations with reasonable limits
- Provide clear status updates during execution

### Key Technical Considerations

1. **File Reading**: Use Node.js `fs` module to read local markdown and scan images directory
2. **Markdown Parsing**: Parse structured sections between materials (likely using heading markers)
3. **Image Matching**: Match material names to image filenames (handle different extensions)
4. **Magnitude Syntax**: Use natural language commands where possible, fall back to Playwright selectors when needed
5. **WordPress Specifics**: Handle WordPress admin interface, custom post types, meta boxes, and media uploads

### Expected Markdown Structure
The `materials_list.md` likely contains:
- WordPress login credentials at the top
- Material sections with headings (## Material Name)
- Material properties/descriptions under each heading
- `##stop` marker to end processing

### Deliverables
- Modified `src/index.ts` with complete automation
- Proper error handling and logging
- Comments explaining key sections
- Instructions for running the automation

## Execution Instructions

1. First, examine `materials_list.md` to understand the data structure
2. Look at existing files in `images/` folder to understand naming conventions
3. Research Magnitude and Playwright documentation using "context7"
4. Implement the automation step by step, testing each component
5. Ensure the script can run independently and process all materials until `##stop`

Start by examining the current project files and researching the required documentation before implementing the solution.

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

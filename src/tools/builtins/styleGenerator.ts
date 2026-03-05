import type { ToolConfig, CoreContext } from '@/core/types';

const styleTemplate = `
# You are an Expert SillyTavern Frontend & Lore Architect.
Your task is to build a "World Info" and "Frontend Interaction" solution based on the provided data.

### INPUT DATA
- ** Original Text(\`{{original_text}}\`):** {{original_text_value}}
- **User Request (\`{{user_request}}\`):** {{user_request_value}}

### STRATEGY SELECTOR
Check the "Original Text":
- **CASE A (Dynamic Data):** Contains variables, emojis, stats (e.g. "Name: Alice", "HP: 100").
  -> Use **Complex Strategy**: Strict Regex Capturing + World Info.
- **CASE B (Simple Trigger):** Just a tag or keyword (e.g. "[Card]", "System Start").
  -> Use **Simple Strategy**: Simple Regex (no capturing groups needed) + No World Info needed.

### LOGIC GATES (Tag Selection)
1. **Respect User Request:** If user asks for specific tags (e.g., \`<piney>\`, \`<status>\`), USE THEM.
2. **Default Behavior (Case A Only):**
   - **For Status/HUDs (Data panels)**:
     Unless the user EXPLICITLY states "do not collapse" or "不要折叠", you MUST wrap the Status Bars/HUDs inside a collapsible structure like this:
     \`<details>\`
     \`<summary>状态栏名称</summary>\`
     \`<statusblock>\`
     \`CONTENT\`
     \`</statusblock>\`
     \`</details>\`
     **MANDATORY**: Data-heavy Status Bars/HUDs MUST use \`<details>\` and \`<summary>\` for collapsibility by default.
   - **For Non-Status elements (Decorations, Chat bubbles, Simple tooltips, Titles)**:
     DO NOT wrap them in \`<details>\`. Just output the styled HTML directly (e.g., \`<piney>CONTENT</piney>\` or \`<div class="chat-bubble">CONTENT</div>\`).
3. **Simple Trigger (Case B):** Just match the trigger keyword exactly.

### EXECUTION TASKS

1. **Design World Info (Lorebook Instruction)**
   - **Purpose**: You are writing an INSTRUCTION for the Roleplay AI on how to format its output.
   - **Three Pillars**:
     1. **Definition**: Briefly explain function (e.g. "Status Interface").
     2. **Format Template (Strict)**:
        - **If it's a Status Bar/HUD**: Output MUST be wrapped in: \`<details><summary>Title</summary><statusblock>...content...</statusblock></details>\`.
        - **If it's a Decoration, Title, Chat or other element**: DO NOT use \`<details>\`. Directly wrap it (e.g., \`<piney>...content...</piney>\`).
     3. **Logic**: Explain when/how to update values.
   - **Context**: Use \`{{user}}\` / \`{{char}}\`.
   - **Case B (Simple)**: Return \`null\`.

2. **Strict Content Preservation (ZERO TOLERANCE)**
   - **Original Text is Sacred:** If Original Text contains Emojis (e.g., "👤 姓名"), you MUST preserve them in Regex and World Info format.
   - **Line Breaks:** You MUST preserve original line breaks. Do not merge lines unless explicitly requested.
   - **ABSOLUTELY NO RENAMING:** You are FORBIDDEN from changing field names.
     - ❌ Input: "姓名: Alice" -> Output: "操作员: $1" (FORBIDDEN)
     - ✅ Input: "姓名: Alice" -> Output: "姓名: $1" (REQUIRED)
   - **Variable Safety:** NEVER modify \`{{user}}\` or \`{{char}}\`. They must remain exactly as is.
   - **Label Consistency:** In your generated HTML, the static text (labels) MUST be identical to the keys in Original Text.

3. **Create Regex Script (Regex Hardening)**
   - **Requirement**: Write a Fault-Tolerant Regex.
   - **Scope (CRITICAL)**: Your Regex MUST ONLY match the \`<statusblock>...</statusblock>\` part.
     - ❌ Bad Regex: Matches \`<details>...\`
     - ✅ Good Regex: Matches \`<statusblock>\\s*Name:(.*?)...</statusblock>\`
     - **Reasoning**: We want to keep the outer \`<details>\` from the text so the Native HTML collapse works.
   - **Whitespace**: Always assume \`\\\\s*\` around delimiters (e.g., \`Key:\\\\s*(.*?)\\\\s*\\n\`).
   - **Capturing (Case A)**: You MUST use capturing groups \`(.*?)\` for EVERY variable part.
   - **Sequence**: Ensure the order matches your HTML $1, $2 placeholders.
   - **Multiline**: MUST support \`[\\s\\S]*?\` to handle multi-line data blocks safely.

4. **Engineer Frontend Code (HTML/CSS/JS)**
   - **Quality & Aesthetics (PRO-MAX LEVEL)**:
     - DO NOT yield generic, boring, or simple styles. AVOID overly minimalistic designs.
     - Your design MUST be visually stunning, highly detailed, exquisite, and premium.
     - Embrace a "visually rich" approach: use multi-layered backgrounds, glowing elements, intricate borders, subtle animations, and complex textures.
     - MUST strictly adapt to the theme/style explicitly requested by the user. If the user doesn't specify a style, intelligently select ONE highly suitable modern UI/UX design language that is inherently rich and decorative. Do not repeatedly use the same style; ensure diversity across different generation requests.
     - Use curated, harmonious color palettes, sophisticated gradients, backdrop-filters, shadow layers, and modern typography to achieve a "fancy" and "wow-factor" look.
   - **Responsive & Mobile First**:
     - The layout MUST be fully responsive and flawlessly adapt to both desktop and mobile screens.
     - Use \`@media\` queries, percentage widths, and \`max-width\` rather than fixed pixel dimensions for containers.
     - 🚫 **CRITICAL: NEVER use \`vh\` units (especially on \`body\` or root containers). Mobile browsers have fluctuating viewport heights.** 
   - **Interactivity & JS (Mobile-friendly)**:
     - Add a considerable amount of internal JavaScript to provide meaningful dynamic interactions (e.g., switching tabs, expanding/collapsing details, triggering micro-animations, or calculating stats).
     - Because most users are on mobile, DO NOT rely on CSS \`:hover\` for crucial interactions or information display. Bind \`click\` / \`touchstart\` events via JS to execute state changes.
     - 🚫 **CRITICAL ANIMATION RULE**: STRICTLY FORBIDDEN to use the CSS \`transition\` property for dynamic effects. All animations MUST be implemented exclusively through CSS \`@keyframes\` or by toggling classes via JavaScript.
   - **CSS Isolation & Selectors**:
     - Use a unique parent class (e.g., \`.piney-hud-x3b\`) wrapping everything.
     - **Scoped Variables**: Use CSS variables for colors (e.g., \`--hud-primary: #7a15ffff\`) scoped to that class.
     - 🚫 **CRITICAL: DO NOT use SillyTavern macros (like \`{{$RANDOM}}\`) in your \`id\` attributes or JavaScript selectors.** This will crash \`document.querySelector\` in standard browser environments due to illegal characters \`{\` and \`}\`. If you need unique IDs, hardcode a random alphanumeric string (e.g., \`id="tab-main-a2f8"\`).
   - **Execution Details**:
     - The main container MUST be centered on the screen/parent unless the user explicitly requests a specific position.
     - Container: \`pointer-events: none\` (to pass clicks through to game).
     - Interactive Children: \`pointer-events: auto\` (so buttons work).
   - **Structure (MANDATORY)**:
     - **Main Wrapper**: Do NOT wrap your entire output in a root \`<details>\` tag UNLESS it is specifically a Status Bar/HUD. If it is a simple decoration, tooltip, or chat bubble, display it directly.
     - **Internal Interactions**: You CAN use \`<details>\` tags *inside* your card for nested menus/spoilers.
     - Root: A valid HTML container (div) with unique class.
       \`\`\`html
       <div class="unique-parent-class">
         <style>...</style>
         <!-- Your Content Here -->
       </div>
       \`\`\`
   - **Formatting**: Output HTML with proper indentation. DO NOT minify.

### OUTPUT FORMAT
Return ONLY a raw JSON object (STRICTLY NO MARKDOWN \`\`\`json):
{
  "worldinfo": {
    "key": "条目名称",
    "content": "中文说明内容..."
  },
  "regex": "正则表达式（双重转义反斜杠）",
  "html": "格式化的 HTML/CSS/JS 代码（正确转义 JSON）",
  "original_text": "示例输出格式",
  "formatted_original_text": "严格匹配正则的原始文本"
}
`;

export const styleGeneratorTool: ToolConfig = {
    id: 'style-generator',
    name: '美化生成',
    version: '1.0.0',
    author: '老婆宝',
    category: '酒馆脚本',
    description: '结合正则、世界书与前端界面的复合式美化排版引擎。',
    systemPrompt: styleTemplate,
    inputs: [
        {
            name: 'userInput',
            label: '样式要求',
            type: 'text',
            required: true,
            description: '描述你想要的样式表现、色彩主题或特定的渲染特效。',
            allowOptionPromptEdit: false,
        },
        {
            name: 'originalText',
            label: '原始文本 (可选)',
            type: 'text',
            required: false,
            description: '请贴入你需要被美化的参考原始输出文本结构（比如含各种变量或表情的人物面板）。',
            allowOptionPromptEdit: false,
        }
    ],
    async execute(inputs: Record<string, unknown>, context: CoreContext) {
        const userRequestValue = String(inputs.userInput || '').trim();
        const originalTextValue = String(inputs.originalText || '').trim();

        if (!userRequestValue) {
            throw new Error("请告诉我您想要的样式要求。");
        }

        const templateToUse = context.systemPrompt || styleTemplate;
        const systemPrompt = templateToUse
            .replace('{{user_request_value}}', userRequestValue)
            .replace('{{original_text_value}}', originalTextValue || 'No specific original text provided, you may invent a generic example.');

        const response = await context.llmClient.chat.completions.create({
            model: context.defaultModel || 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: "Generate the complete style solution immediately based on the above specifications. DO NOT wrap with markdown, provide RAW JSON only." }
            ],
            temperature: 0.4,
        });

        const content = response.choices[0]?.message?.content || '{}';

        // 应对一些 AI 可能仍然加上了 markdown json block 的鲁棒处理
        let cleanContent = content;
        const mdMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (mdMatch) {
            cleanContent = mdMatch[1];
        }

        try {
            // 确保能查验它是不是合法结构，不合法让前端挂掉而不是隐藏错误
            const parsed = JSON.parse(cleanContent);
            if (!parsed.html && !parsed.regex) {
                throw new Error("模型返回的JSON不满足最低要求的 HTML 结构内容。");
            }
            // 利用宏封装向外回传结构数据
            return `<<NIBBLI_STYLE_BUNDLE: ${JSON.stringify(parsed)}>>`;
        } catch (e) {
            console.error("Style Generator Parsing error:", e, content);
            throw new Error("解析生成的样式数据时失败，请重试。" + (e as Error).message);
        }
    }
};

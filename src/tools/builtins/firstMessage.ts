import type { ToolConfig } from '@/core/types';

export const firstMessageTool: ToolConfig = {
    id: 'first_message',
    name: '开场白生成',
    description: '专业的 RP 开场白生成助手，支持设定导入、人称视角切换和场景定制。',
    version: '1.0.0',
    category: '角色设定',
    author: '老婆宝',
    systemPrompt: `# Role: Expert Creative Director & RP Writer

You are an expert at crafting "Golden Openers" for roleplay scenarios. Your goal is to hook the user immediately with high-stakes atmosphere and vivid sensory details.

## Task

Write an engaging **Opening Message** for the character {{char}} to initiate a roleplay scenario with {{user}}.

## Context Data

- **Background Info**:
{{background_info}}

## User Input

- **Specific Scenario Request**: {{user_input}}
- **Target Word Count**: {{word_count}}
- **Narrative Perspective**: {{person_type}} (Valid options: 第一人称 / 第二人称 / 第三人称)

## Critical Constraints & Quality Standards (Non-Negotiable)

1. **Variable Protocol (Strict Output Rule)**:
   - **Literal Placeholders**: In your final output, you **MUST** use the exact strings \`{{char}}\` and \`{{user}}\` to refer to the character and the user.
   - **No Name Resolution**: Do NOT replace them with their actual names. Even if you know the character is named "Alice", you must write \`{{char}}\`.

2. **Perspective & Tense Enforcement (Based on \`{{person_type}}\`)**:
   - **If \`第一人称\` (First Person)**: The narrative MUST use "我" (I) to refer to {{char}}. The text should focus on {{char}}'s internal monologue and subjective view.
   - **If \`第三人称\` (Third Person)**: The narrative MUST use \`{{char}}\` or "他/她" (He/She) to refer to the character. Use a cinematic, objective camera angle.
   - **If \`第二人称\` (Second Person)**: The narrative MUST focus on describing what \`{{user}}\` ("你") sees, hears, and feels. {{char}} is described from {{user}}'s external perspective.

3. **Length Control**:
   - The output length must be within **{{word_count}} words (+/- 20%)**.

4. **Style & Content Mandates (General Principles)**:
   - **Innovation Over Convention**: Reject standard greetings or boring intros. Break expectations. Use the "In Medias Res" technique (start in the middle of the action).
   - **High Tension**: Establish immediate conflict, danger, intense desire, or unease from the very first sentence.
   - **Anti-Cliché**: Do NOT use stale tropes. Avoid boring descriptions of waking up or standing around.
   - **Show, Don't Tell**: Do not describe {{char}} as "angry" or "seductive". Describe the physical evidence (e.g., trembling hands, dilated pupils, heavy breathing).
   - **Engagement**: Leave clear "hooks" (physical or conversational) that force {{user}} to react.

## Advanced Narrative & Character Guidelines

### 1. Narrative Fidelity & Stylistic Rigor
- **Direct Sensory Engagement (The "White Drawing" Rule)**:
  - **Show, Do Not Explain**: Narrative must be driven by observable details (micro-expressions, environmental shifts, physiological reactions) rather than abstract summation. Never explain *why* a character acts; show the action and let the subtext speak.
  - **Metaphor Restriction**: Enforce a strict ban on "Simile Bridges." Avoid using connector words like "as if," "like," or "resembled" to construct comparisons. Describe the object or feeling directly via its impact on the five senses.
  - **Cliché Elimination**: Categorically reject overused metaphorical imagery regarding emotions. Instead of metaphors (like "volcanoes" or "drowning"), describe the physiological disruption (e.g., muscle tension, irregular breathing, sensory numbness, loss of motor control).
- **Objective Narrator Stance**:
  - The narrative voice must remain an invisible, neutral camera. It is strictly forbidden to analyze, judge, or comment on {{user}}'s choices. Avoid "Data-style" writing; write like a novelist, not an AI summarizing a log.

### 2. Character Sovereignty & Psychological Realism
- **Autonomous Existence**: {{char}} is a complete individual with a career, social circle, and personal ambitions that exist independently of {{user}}. Roleplay should reflect this; {{char}} must not revolve solely around {{user}}.
- **Emotional Maturity & Stability**:
  - **Anti-Fragility**: {{char}} is a functional adult with a stable emotional core. Avoid "Melodrama Mode." Do not depict sudden breakdowns, extreme rage, or despair over minor conflicts.
  - **Complex Reactions**: Emotions are rarely binary. Depict mixed states (e.g., relief mixed with lingering resentment).
  - **Input Processing**: Do not describe {{char}} as "freezing" or "statuesque" when shocked. Use realistic micro-reactions: a skipped beat in a task, a momentary lapse in focus, or a heavy ink blot from a pen.
- **No "Robotic" Perfection**: Avoid describing {{char}} using words like "precise," "calculated," or "programmatic." Even high-intelligence characters must display human biases, intuition, and errors in speech.

### 3. Egalitarian Dynamics & Anti-Trope Protocols
- **Strict Equality (Anti-Supremacy)**: Regardless of social status, race, or power, the interaction between {{char}} and {{user}} must be grounded in human equality.
- **Anti-Greasy/Anti-Domineering**:
  - **Respectful Tension**: Eliminate "CEO tropes" (e.g., forced chin-lifting, "You are playing with fire," possessive declamations). Attraction must be shown through genuine care or subtle chemistry, not harassment or objectification.
  - **Natural Friction**: Characters should not have unconditional obsession. It is realistic for {{char}} to feel annoyance, prejudice, or indifference toward {{user}} based on actions. Conflict should arise from clashing perspectives, not a "Dominant vs. Submissive" power play.
- **Benevolent Interpretation**: Unless explicitly hostile, {{char}} should interpret interactions with a baseline of decency. Avoid creating drama through forced misunderstandings.

## Negative Constraints (Strict & Zero Tolerance)

**No God-Modding**:
   - You must NOT describe {{user}}'s thoughts, feelings, or spoken dialogue. You may only describe {{user}}'s passive physical position if necessary for the scene.

## Output Process (Chain of Thought)

Before generating the final response, you must perform a self-check step-by-step inside \`<cot>\` tags:
1.  **Analyze Request**: Review \`{{user_request}}\`, \`{{world_info}}\`, and \`{{word_count}}\`.
2.  **Determine Perspective**: Check \`{{person_type}}\`.
    - If "第一人称", ensure {{char}} refers to self as "我".
    - If "第三人称", ensure {{char}} refers to self as \`{{char}}\`.
    - If "第二人称", ensure focus is on {{user}}'s perspective.
3.  **Design the Hook**: Plan the sensory details and conflict using "In Medias Res".
4.  **Vocabulary Scan**: Check your planned draft against the **Forbidden Vocabulary** list. If any banned word appears, replace it with a direct sensory description.
5.  **Final Polish**: Ensure literal \`{{char}}\` and \`{{user}}\` placeholders are present.
6.  **Dialogue Check**: STRICTLY CHECK that all spoken dialogue is enclosed in double quotes (\`""\`). If any dialogue is missing quotes, add them now.

## Output Rules

1. **Language**: Strictly **Simplified Chinese (简体中文)**.
2. **Format**:
   - First, output the \`<cot>\` block with your thinking process.
   - Then, output the final roleplay opening message in **Plain Text**.
   - NO Markdown syntax in the final message (no \`**bold**\`, no \`### headers\`).
   - **Dialogue Formatting**: All spoken dialogue MUST be enclosed in double quotes (\`""\`). Example: "这是对话内容。"

## Output

(Directly generate the response below, starting with the <cot> block)`,
    inputs: [
        {
            name: 'scenario',
            label: '场景与要求',
            type: 'text',
            required: true,
            description: '描述开场的情景、冲突点或想要发生的时间'
        },
        {
            name: 'wordCount',
            label: '字数要求',
            type: 'number',
            required: true,
            defaultValue: 800,
            description: '输入字数，例如 800 或 1500'
        },
        {
            name: 'perspective',
            label: '叙述人称模式',
            type: 'select',
            required: true,
            defaultValue: '第三人称',
            allowOptionPromptEdit: false,
            options: [
                { label: '第三人称（客观视角）', value: '第三人称' },
                { label: '第一人称（角色内心）', value: '第一人称' },
                { label: '第二人称（用户视角）', value: '第二人称' }
            ],
            description: '选择视角的叙述基调'
        },
        {
            name: 'backgroundInfo',
            label: '设定信息（角色卡）',
            type: 'file',
            accept: '.json,.png',
            required: false,
            description: '上传角色卡，支持PNG和json格式，自动提取角色设定和世界书'
        },
        {
            name: 'backgroundText',
            label: '或在此直接粘贴设定文字',
            type: 'text',
            required: false,
            description: '如果不用角色卡，可以在此直接粘贴人物设定、人设或世界观。'
        }
    ],
    execute: async (inputs, context) => {
        const scenario = inputs.scenario as string;
        const wordCount = inputs.wordCount;
        const perspective = inputs.perspective as string;
        const backgroundFile = inputs.backgroundInfo;
        const backgroundText = inputs.backgroundText as string;

        if (!scenario || !scenario.trim()) {
            throw new Error('请输入场景与要求');
        }

        if (!context.defaultModel) {
            throw new Error('请先在设置中配置默认模型');
        }

        let backgroundContent = '无。';

        // 如果用户上传了文件，走卡片解析
        if (backgroundFile && typeof backgroundFile === 'object' && 'name' in backgroundFile) {
            context.toast('正在提取角色卡背景信息...');
            try {
                const charaData = await context.parsers.parseCharaCard(backgroundFile as File);
                const basicInfo = context.parsers.extractCharaFields(charaData, 'basic');
                // 以文件提取的内容为基础
                backgroundContent = JSON.stringify(basicInfo, null, 2);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                context.toast('角色卡解析失败，已忽略文件背景: ' + msg, 'error');
            }
        }

        // 如果文本框有内容，追加或覆盖
        if (backgroundText && backgroundText.trim()) {
            if (backgroundContent !== '无。') {
                backgroundContent += '\n\n【附加文本设定】\n' + backgroundText.trim();
            } else {
                backgroundContent = backgroundText.trim();
            }
        }

        // 组装 User Content
        const promptParams = {
            '{{background_info}}': backgroundContent,
            '{{user_input}}': scenario,
            '{{word_count}}': String(wordCount),
            '{{person_type}}': perspective
        };

        let activePrompt = context.systemPrompt;
        for (const [key, val] of Object.entries(promptParams)) {
            activePrompt = activePrompt.replaceAll(key, val);
        }

        context.toast('AI开始动笔了 (耐心等待...)');

        const response = await context.llmClient.chat.completions.create({
            model: context.defaultModel,
            messages: [
                { role: 'system', content: activePrompt },
                { role: 'user', content: '现在请输出 <cot> 并生成开场白正文。' }
            ],
            temperature: 0.85
        });

        let result = response.choices[0]?.message?.content || '';
        if (!result) {
            throw new Error('AI 返回了空内容，请重试');
        }

        // 后处理：移除 <cot></cot> 之间的内容
        // (?s) 代表 DOTALL 模式在标准中不通用，JS 可用 /<cot>[\s\S]*?<\/cot>/gi
        result = result.replace(/<cot>[\s\S]*?<\/cot>\n*/gi, '').trim();

        return result;
    }
};

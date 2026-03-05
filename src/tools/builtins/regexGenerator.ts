import type { ToolConfig } from '@/core/types';

interface RegexAIResult {
    scriptName: string;
    findRegex: string;
    replaceString: string;
    description: string;
    exampleOriginal: string;
    exampleReplaced: string;
}

export const regexGeneratorTool: ToolConfig = {
    id: 'regex_generator',
    name: '正则脚本生成',
    description: '为 SillyTavern 自动生成并导出格式化的正则表达式替换脚本 (支持一键下载JSON)。',
    category: '酒馆脚本',
    author: '老婆宝',
    version: '1.0.0',
    inputs: [
        {
            name: 'userInput',
            label: '提供你的匹配要求或目的',
            type: 'text',
            required: true,
            description: '描述你希望正则脚本实现的功能（例如：匹配所有括号内的文本并删除）'
        }
    ],
    systemPrompt: `You are an expert Regular Expression developer specialized in creating Regex Replacement Scripts for "SillyTavern".
Your task is to generate precise, efficient Regex patterns and replacements based on the user's requirements.

You MUST follow these strict rules:
1. Return your output wrapped in JSON markdown blocks (\`\`\`json\n...\n\`\`\`).
2. The JSON object MUST strictly contain the following keys exactly:
   - "scriptName": A descriptive, short name for the script IN SIMPLIFIED CHINESE (e.g. "去除冗余星号").
   - "findRegex": The exact Regular Expression to find matches. Escape backslashes properly for JSON strings (e.g. "\\\\bword\\\\b").
   - "replaceString": The replacement string. Can be empty if the goal is deletion.
   - "description": A brief explanation of how it works and what it does, IN SIMPLIFIED CHINESE.
   - "exampleOriginal": An example original sentence.
   - "exampleReplaced": The sentence after applying the replacement.

DO NOT output anything outside of the JSON block. Do not provide greetings or explanations outside the JSON.`,
    async execute(inputs, context) {
        const userInput = String(inputs.userInput || '').trim();
        if (!userInput) {
            throw new Error('请输入需要生成正则脚本的要求');
        }

        if (!context.defaultModel) {
            throw new Error('未配置默认模型');
        }

        context.toast('AI正在生成正则...(需要一定时间思考)');

        let activePrompt = context.systemPrompt;
        if (context.globalPrompt) {
            activePrompt += `\n\n[全局附加指令/Global Constraints]\n${context.globalPrompt}`;
        }

        const response = await context.llmClient.chat.completions.create({
            model: context.defaultModel,
            messages: [
                { role: 'system', content: activePrompt },
                { role: 'user', content: userInput }
            ],
            temperature: 0.2, // Regex needs to be precise, lower temperature
        });

        const content = response.choices[0]?.message?.content || '';
        if (!content) {
            throw new Error('AI 返回空结果');
        }

        // 提取 JSON
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i) || content.match(/({[\s\S]*?})/);
        let aiResult: Partial<RegexAIResult> | null = null;
        if (jsonMatch) {
            try {
                aiResult = JSON.parse(jsonMatch[1]) as Partial<RegexAIResult>;
            } catch (err) {
                console.error("Failed to parse regex json:", err);
            }
        }

        if (!aiResult || !aiResult.findRegex) {
            return `AI 返回格式解析失败，请尝试重新生成。\n\n原始返回：\n${content}`;
        }

        // Generate a UUID v4
        const uuidTemplate = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
        const uuid = uuidTemplate.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });

        // Assemble the display string
        const displayMarkdown = `
### 🎯 生成结果：${aiResult.scriptName}

**简介**：${aiResult.description}

#### 匹配段 (Regex)
\`\`\`regex
${aiResult.findRegex}
\`\`\`

#### 替换为 (Replacement)
\`\`\`
${aiResult.replaceString}
\`\`\`

#### 示例
- **原文本**：\`${aiResult.exampleOriginal}\`
- **替换后**：\`${aiResult.exampleReplaced}\`

`;

        // Assemble the JSON file payload following user requirements
        const jsonPayload = {
            id: uuid,
            scriptName: aiResult.scriptName,
            findRegex: aiResult.findRegex,
            replaceString: aiResult.replaceString || "",
            trimStrings: [],
            placement: [1, 2],
            disabled: false,
            markdownOnly: true,
            promptOnly: false,
            runOnEdit: true,
            substituteRegex: 0,
            minDepth: null,
            maxDepth: null
        };

        const macroString = `\n\n<<NIBBLI_DOWNLOAD_REGEX_JSON: ${JSON.stringify(jsonPayload)}>>`;

        return displayMarkdown + macroString;
    }
};

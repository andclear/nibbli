# 小兔几插件开发规范

> 本文档是小兔几（Nibbli）平台插件系统的完整技术规范。阅读后应能编写出结构正确、无报错的插件。

## 1. 文件格式

每个插件是**单个 `.js` 文件**，包含三个注释区块：

```
/*---CONFIG---
{ JSON 配置对象 }
---END_CONFIG---*/

/*---PROMPT---
主系统提示词（纯文本 / Markdown，无需转义）
---END_PROMPT---*/

/*---PROMPT_<字段name>_<选项value>---
选项专属追加提示词（可选，可有多个）
---END_PROMPT---*/

/*---EXECUTE---
直接书写函数体代码，不要用 function 包装
---END_EXECUTE---*/
```

## 2. CONFIG 区块

JSON 对象，字段说明：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 唯一英文标识，snake_case |
| `name` | string | ✅ | 工具中文名称 |
| `description` | string | ✅ | 功能描述 |
| `version` | string | 否 | 版本号，默认 `"1.0.0"` |
| `author` | string | 否 | 作者名 |
| `inputs` | array | ✅ | 输入字段定义数组 |

### inputs 通用属性

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | 字段唯一标识（英文） |
| `label` | string | ✅ | 显示标签（中文） |
| `type` | string | ✅ | 类型，见下方 |
| `required` | boolean | 否 | 是否必填，默认 `false` |
| `description` | string | 否 | 补充说明 |
| `defaultValue` | any | 否 | 默认值 |

### inputs 类型一览

| type | 说明 | 取值类型 | 额外属性 |
|------|------|----------|----------|
| `string` | 单行文本 | `string` | `placeholder` |
| `text` | 多行文本 (textarea) | `string` | `placeholder` |
| `number` | 数字 | `number` | `min`, `max`, `step` |
| `boolean` | 开关 | `boolean` | — |
| `file` | 文件上传 | `File` 对象 | `accept`（如 `".json,.png"`） |
| `select` | 下拉选择 | `string`（选中项的 value） | `options` (必填), `allowOptionPromptEdit` |

**select.options 格式**：`[{ "label": "显示文本", "value": "编码值" }, ...]`

**select.allowOptionPromptEdit**：布尔值，是否允许用户编辑选项专属提示词，默认 `true`。

## 3. PROMPT 区块

- 位于 `/*---PROMPT---` 和 `---END_PROMPT---*/` 之间
- 纯文本 / Markdown，支持反引号、代码块等，**无需转义**
- 唯一禁止出现的字符串：`---END_PROMPT---*/`
- 此内容在运行时赋值给 `context.systemPrompt`（用户可在 UI 中覆写）

### 选项专属提示词（Option Prompts）

为 `select` 类型的某个选项追加提示词，区块格式：

```
/*---PROMPT_<input的name>_<option的value>---
当用户选中该选项时，本段文字自动追加到主 systemPrompt 末尾
---END_PROMPT---*/
```

**何时使用**：选项代表不同的生成模式 / 风格时使用。

**何时不使用**：选项仅是简单枚举值（如语言名称）时，直接在 EXECUTE 中读取 `inputs.xxx` 拼接进 prompt 即可，无需写 `PROMPT_xxx` 块。

## 4. EXECUTE 区块

- 位于 `/*---EXECUTE---` 和 `---END_EXECUTE---*/` 之间
- **直接书写函数体**，不要用 `function` 或 `export` 包装
- 隐式可用参数：`inputs`（表单值）、`context`（上下文对象）
- 使用 `return` 返回结果，推荐返回 **Markdown 字符串**
- 错误处理：直接 `throw new Error('用户可见的错误信息')`

### 编码约束

1. **使用 `var` 而非 `const/let`**（代码经 `new Function()` 执行，`var` 避免块级作用域问题）
2. **禁止 `import/export`**（沙箱环境无模块系统）
3. **支持 `await`**（执行环境是 async 函数体）

## 5. context 对象 API

| 属性 / 方法 | 类型 | 说明 |
|-------------|------|------|
| `context.llmClient` | OpenAI 实例 | 已配置的 AI 客户端，直接调用 `chat.completions.create()` |
| `context.defaultModel` | string | 用户选择的模型名称 |
| `context.systemPrompt` | string | 当前工具的系统提示词（PROMPT 区块内容，可能已被用户覆写，如有选项专属提示词已自动追加） |
| `context.globalPrompt` | string | 用户全局附加提示词（建议拼接到 system message 末尾） |
| `context.db` | Dexie 实例 | IndexedDB 数据库，可用 `context.db.keyValue.get(key)` / `.put({key, value})` |
| `context.toast(msg, type?)` | function | 弹出通知，type 可选 `'success'`（默认）或 `'error'` |
| `context.parsers` | object | 角色卡 / 聊天记录解析器（见下方） |

### context.parsers 方法

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `parseCharaCard(file)` | `File` | `Promise<CharaCardData>` | 解析角色卡（自动识别 JSON / PNG） |
| `extractCharaFields(card, mode)` | `CharaCardData`, `string` | `ExtractedCharaData` | 按模式提取精简字段，未包含的字段为 `null` |
| `parseChatHistory(file)` | `File` | `Promise<ChatHistoryData>` | 解析 JSONL 聊天记录 |
| `extractChatMessages(data, options?)` | `ChatHistoryData`, `object` | `Array<{role, name, content}>` | 提取精简消息列表 |
| `extractChatSummary(data)` | `ChatHistoryData` | `{metadata, messageCount, messages}` | 提取聊天摘要（含元数据，自动剥离思维链标签） |
| `extractJsonFromMarkdown(text)` | `string` | `string` | 从 Markdown 代码块中提取纯 JSON 字符串 |

### extractCharaFields 模式

| mode | 包含字段 | 典型场景 |
|------|----------|----------|
| `'basic'` | character + worldBook | 卡片质量评估 |
| `'withRegex'` | character + worldBook + regexScripts | 完整卡片分析 |
| `'characterOnly'` | 仅 character | 人物分析 |
| `'worldBookOnly'` | 仅 worldBook | 世界书优化 |
| `'regexOnly'` | 仅 regexScripts | 正则脚本调试 |
| `'greetingsOnly'` | 仅 first_mes + alternate_greetings | 开场白重写 |

**character 字段**：`{ name, description, personality, scenario, first_mes, mes_example, tags, alternate_greetings }`

**worldBook 字段**：`{ name, entries: [{ keys, comment, content }] }`

**regexScripts 字段**：`[{ scriptName, findRegex, replaceString, trimStrings }]`

### extractChatMessages options

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `excludeSystem` | boolean | `true` | 排除系统消息 |
| `maxMessages` | number | 全部 | 仅取最后 N 条 |
| `filterByName` | string | — | 仅取指定角色的消息 |

## 6. AI 调用模式

### 基础文本生成

```javascript
var response = await context.llmClient.chat.completions.create({
    model: context.defaultModel,
    messages: [
        { role: 'system', content: context.systemPrompt },
        { role: 'user', content: inputs.userInput }
    ],
    temperature: 0.7,
});
return response.choices[0].message.content;
```

### JSON Mode 结构化输出

```javascript
var response = await context.llmClient.chat.completions.create({
    model: context.defaultModel,
    messages: [
        { role: 'system', content: context.systemPrompt },
        { role: 'user', content: text }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3
});
var rawText = response.choices[0].message.content;
var jsonText = context.parsers.extractJsonFromMarkdown(rawText);
var result = JSON.parse(jsonText);
```

### 读取文件内容

```javascript
var file = inputs.dataFile;
var text = await new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function() { resolve(reader.result); };
    reader.onerror = reject;
    reader.readAsText(file);
});
```

### 多步骤工作流

可在一次 EXECUTE 中进行多次 AI 调用，用 `context.toast()` 提示用户当前进度。

## 7. 高级返回：建议卡片 (Suggestions)

当插件需要逐条建议修改时，返回特殊对象触发建议卡片 UI：

```javascript
return {
    _type: 'suggestions',       // 必填，触发建议卡片渲染
    summary: 'Markdown 摘要',   // 顶部总结区
    suggestions: [
        {
            id: 'unique-id',        // 唯一标识
            label: '条目名称',       // 卡片标题
            original: '原始内容',    // 可选，展示原文对比
            proposed: '建议内容',    // 用户可一键复制
            refinePrompt: '...'     // 可选，提供后显示「采纳并优化」按钮，触发二次 AI 调用
        }
    ]
};
```

**refinePrompt 说明**：当第一轮 AI 仅给出修改意见而非具体内容时，提供此字段。用户点击「采纳并优化」后，系统自动用此 prompt 发起第二次 AI 调用，生成具体的替换内容。

## 8. 完整最小示例

```javascript
/*---CONFIG---
{
    "id": "text_polisher",
    "name": "文本润色",
    "description": "对输入文本进行专业润色",
    "inputs": [
        { "name": "text", "label": "原始文本", "type": "text", "required": true }
    ]
}
---END_CONFIG---*/

/*---PROMPT---
你是一位资深中文编辑。请对用户提供的文本进行润色，保持原意，提升表达质量。直接输出润色结果。
---END_PROMPT---*/

/*---EXECUTE---
var text = inputs.text;
if (!text || !text.trim()) throw new Error('请输入需要润色的文本');
if (!context.defaultModel) throw new Error('请先配置默认模型');

var response = await context.llmClient.chat.completions.create({
    model: context.defaultModel,
    messages: [
        { role: 'system', content: context.systemPrompt },
        { role: 'user', content: text }
    ],
    temperature: 0.6
});

return response.choices[0].message.content;
---END_EXECUTE---*/
```

// ===== 解析器统一入口 =====
// 导出所有解析器的类型和函数

export {
    // 角色卡解析器
    parseCharaCard,
    parseCharaCardFromJSON,
    parseCharaCardFromPNG,
    extractCharaFields,
} from './charaCardParser';

export type {
    CharaCardData,
    ExtractedCharaData,
    ExtractedCharacter,
    ExtractedWorldBookEntry,
    ExtractedRegexScript,
    ExtractedGreetings,
    CharacterBook,
    WorldBookEntry,
    RegexScript,
    ExtractMode,
} from './charaCardParser';

export {
    // 聊天记录解析器
    parseChatHistory,
    parseChatHistoryFromString,
    extractChatMessages,
    extractChatSummary,
} from './chatHistoryParser';

export type {
    ChatHistoryData,
    ChatMessage,
    ChatMetadata,
} from './chatHistoryParser';

export {
    extractJsonFromMarkdown,
} from './common';

export {
    // 预设文件解析器
    parsePresetFile,
} from './presetParser';

export type {
    PresetEntry,
} from './presetParser';

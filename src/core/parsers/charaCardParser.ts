// ===== 角色卡解析器 =====
// 支持 JSON 和 PNG（tEXt 块）两种格式的角色卡解析
// 支持 chara_card_v2 和 chara_card_v3 规范

// ===== 类型定义 =====

/** 正则脚本条目 */
export interface RegexScript {
    id: string;
    scriptName: string;
    findRegex: string;
    replaceString: string;
    trimStrings: string[];
    placement: number[];
    disabled: boolean;
    markdownOnly: boolean;
    promptOnly: boolean;
    runOnEdit: boolean;
    substituteRegex: number;
    minDepth: number | string;
    maxDepth: number | string;
}

/** 世界书条目 */
export interface WorldBookEntry {
    id: number;
    keys: string[];
    secondary_keys: string[];
    comment: string;
    content: string;
    constant: boolean;
    selective: boolean;
    insertion_order: number;
    enabled: boolean;
    position: string;
    use_regex: boolean;
    extensions: Record<string, unknown>;
}

/** 世界书 */
export interface CharacterBook {
    entries: WorldBookEntry[];
    name: string;
}

/** 角色卡完整数据（V2/V3 合并结构） */
export interface CharaCardData {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    tags: string[];
    spec: string;
    spec_version: string;
    data: {
        name: string;
        description: string;
        personality: string;
        scenario: string;
        first_mes: string;
        mes_example: string;
        creator_notes: string;
        system_prompt: string;
        post_history_instructions: string;
        tags: string[];
        creator: string;
        character_version: string;
        alternate_greetings: string[];
        extensions: {
            talkativeness: string;
            fav: boolean;
            world: string;
            depth_prompt: {
                prompt: string;
                depth: number | string;
                role: string;
            };
            regex_scripts: RegexScript[];
            [key: string]: unknown;
        };
        group_only_greetings: string[];
        character_book?: CharacterBook;
    };
    create_date: string;
}

/** 精简后的角色字段（供插件使用） */
export interface ExtractedCharacter {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    tags: string[];
    alternate_greetings: string[];
}

/** 精简后的世界书条目（供插件使用） */
export interface ExtractedWorldBookEntry {
    keys: string[];
    comment: string;
    content: string;
}

/** 精简后的正则脚本（供插件使用） */
export interface ExtractedRegexScript {
    scriptName: string;
    findRegex: string;
    replaceString: string;
    trimStrings: string[];
}

/** 精简后的开场白（供插件使用） */
export interface ExtractedGreetings {
    first_mes: string;
    alternate_greetings: string[];
}

/** 提取结果 */
export interface ExtractedCharaData {
    character: ExtractedCharacter | null;
    worldBook: {
        name: string;
        entries: ExtractedWorldBookEntry[];
    } | null;
    regexScripts: ExtractedRegexScript[] | null;
    greetings: ExtractedGreetings | null;
}

// ===== 解析函数 =====

/**
 * 从 JSON 字符串解析角色卡
 */
export function parseCharaCardFromJSON(jsonString: string): CharaCardData {
    let parsed: CharaCardData;
    try {
        parsed = JSON.parse(jsonString);
    } catch {
        throw new Error('角色卡 JSON 格式不合法，无法解析');
    }

    // 校验基本结构
    if (!parsed.data && !parsed.name) {
        throw new Error('不是有效的角色卡文件：缺少必需的 name 或 data 字段');
    }

    // 兼容 V2 格式：如果没有 data 字段，从顶层字段构造
    if (!parsed.data) {
        parsed.data = {
            name: parsed.name || '',
            description: parsed.description || '',
            personality: parsed.personality || '',
            scenario: parsed.scenario || '',
            first_mes: parsed.first_mes || '',
            mes_example: parsed.mes_example || '',
            creator_notes: '',
            system_prompt: '',
            post_history_instructions: '',
            tags: parsed.tags || [],
            creator: '',
            character_version: '',
            alternate_greetings: [],
            extensions: {
                talkativeness: '',
                fav: false,
                world: '',
                depth_prompt: { prompt: '', depth: '', role: '' },
                regex_scripts: [],
            },
            group_only_greetings: [],
        };
    }

    return parsed;
}

/**
 * 从 PNG 文件的 tEXt 块中提取角色卡数据
 * PNG 角色卡将 JSON 数据以 base64 编码存储在 tEXt 块中，keyword 为 "chara"
 */
export async function parseCharaCardFromPNG(file: File): Promise<CharaCardData> {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // 验证 PNG 签名
    const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < 8; i++) {
        if (bytes[i] !== pngSignature[i]) {
            throw new Error('不是有效的 PNG 文件');
        }
    }

    // 遍历 PNG chunk，查找 tEXt 块
    let offset = 8; // 跳过签名
    while (offset < bytes.length) {
        // 读取 chunk 长度（4 bytes, big-endian）
        const length = (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
        offset += 4;

        // 读取 chunk 类型（4 bytes ASCII）
        const chunkType = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
        offset += 4;

        if (chunkType === 'tEXt') {
            // tEXt 格式: keyword\0text
            const chunkData = bytes.slice(offset, offset + length);

            // 找到 null 分隔符
            let nullPos = 0;
            while (nullPos < chunkData.length && chunkData[nullPos] !== 0) {
                nullPos++;
            }

            const keyword = new TextDecoder().decode(chunkData.slice(0, nullPos));

            if (keyword === 'chara') {
                // keyword 后面的数据是 base64 编码的 JSON
                const base64Data = new TextDecoder().decode(chunkData.slice(nullPos + 1));
                // atob 返回 Latin-1 字符串，需要转为 Uint8Array 再用 TextDecoder 解码 UTF-8
                const binaryString = atob(base64Data);
                const binaryBytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    binaryBytes[i] = binaryString.charCodeAt(i);
                }
                const jsonString = new TextDecoder('utf-8').decode(binaryBytes);
                return parseCharaCardFromJSON(jsonString);
            }
        }

        // 跳过 chunk data + CRC（4 bytes）
        offset += length + 4;
    }

    throw new Error('PNG 文件中未找到角色卡数据（tEXt "chara" 块）');
}

/**
 * 智能解析角色卡文件（自动识别 JSON/PNG 格式）
 */
export async function parseCharaCard(file: File): Promise<CharaCardData> {
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.png')) {
        return parseCharaCardFromPNG(file);
    }

    if (fileName.endsWith('.json')) {
        const text = await file.text();
        return parseCharaCardFromJSON(text);
    }

    // 尝试作为 JSON 解析
    try {
        const text = await file.text();
        return parseCharaCardFromJSON(text);
    } catch {
        // 尝试作为 PNG 解析
        return parseCharaCardFromPNG(file);
    }
}

/**
 * 提取模式类型
 *   - 'basic': 人物设定 + 世界书
 *   - 'withRegex': 人物设定 + 世界书 + 正则脚本
 *   - 'characterOnly': 仅人物设定
 *   - 'worldBookOnly': 仅世界书
 *   - 'regexOnly': 仅正则脚本
 *   - 'greetingsOnly': 仅开场白（first_mes + alternate_greetings）
 */
export type ExtractMode = 'basic' | 'withRegex' | 'characterOnly' | 'worldBookOnly' | 'regexOnly' | 'greetingsOnly';

/**
 * 按模式提取精简字段
 * @param card 完整角色卡数据
 * @param mode 提取模式
 */
export function extractCharaFields(
    card: CharaCardData,
    mode: ExtractMode = 'basic'
): ExtractedCharaData {
    const d = card.data;

    // 提取人物设定
    const includeCharacter = mode !== 'worldBookOnly' && mode !== 'regexOnly' && mode !== 'greetingsOnly';
    const character: ExtractedCharacter | null = includeCharacter ? {
        name: d.name || card.name || '',
        description: d.description || card.description || '',
        personality: d.personality || card.personality || '',
        scenario: d.scenario || card.scenario || '',
        first_mes: d.first_mes || card.first_mes || '',
        mes_example: d.mes_example || card.mes_example || '',
        tags: d.tags || card.tags || [],
        alternate_greetings: d.alternate_greetings || [],
    } : null;

    // 提取世界书
    const includeWorldBook = mode !== 'characterOnly' && mode !== 'regexOnly' && mode !== 'greetingsOnly';
    let worldBook: ExtractedCharaData['worldBook'] = null;
    if (includeWorldBook && d.character_book && d.character_book.entries && d.character_book.entries.length > 0) {
        worldBook = {
            name: d.character_book.name || d.extensions?.world || '',
            entries: d.character_book.entries
                .filter(entry => entry.enabled === true || String(entry.enabled).toLowerCase() === 'true')
                .map(entry => ({
                    keys: entry.keys || [],
                    comment: entry.comment || '',
                    content: entry.content || '',
                })),
        };
    }

    // 提取正则脚本
    const includeRegex = mode === 'withRegex' || mode === 'regexOnly';
    let regexScripts: ExtractedCharaData['regexScripts'] = null;
    if (includeRegex && d.extensions?.regex_scripts && d.extensions.regex_scripts.length > 0) {
        regexScripts = d.extensions.regex_scripts.map(script => ({
            scriptName: script.scriptName || '',
            findRegex: script.findRegex || '',
            replaceString: script.replaceString || '',
            trimStrings: script.trimStrings || [],
        }));
    }

    // 提取开场白
    let greetings: ExtractedCharaData['greetings'] = null;
    if (mode === 'greetingsOnly') {
        greetings = {
            first_mes: d.first_mes || card.first_mes || '',
            alternate_greetings: d.alternate_greetings || [],
        };
    }

    return { character, worldBook, regexScripts, greetings };
}


import { toolRegistry } from './registry';

// 导入所有内置工具的配置
import { defineCharacterTool } from './builtins/defineCharacter';
import { abstractContentTool } from './builtins/abstractContent';
import { firstMessageTool } from './builtins/firstMessage';
import { regexGeneratorTool } from './builtins/regexGenerator';
import { worldInfoGeneratorTool } from './builtins/worldInfoGenerator';
import { styleGeneratorTool } from './builtins/styleGenerator';
import { textOptimizerTool } from './builtins/textOptimizer';
import { doctorTool } from './builtins/doctor';
import { studentTool } from './builtins/student';
import { qrGeneratorTool } from './builtins/qrGenerator';

// 批量注册内置工具
// 当新工具开发完成后，在此处导入并加入数组即可
toolRegistry.registerAll([
    defineCharacterTool,
    firstMessageTool,
    worldInfoGeneratorTool,
    regexGeneratorTool,
    styleGeneratorTool,
    textOptimizerTool,
    doctorTool,
    studentTool,
    qrGeneratorTool,
    abstractContentTool
]);

// 导出注册中心供 UI 层使用
export { toolRegistry };

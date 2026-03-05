import type { ToolConfig } from '@/core/types';

export const abstractContentTool: ToolConfig = {
  id: 'abstract_content',
  name: '抽象内容生成',
  description: '将正常的内容生成颠三倒四的抽象内容',
  version: '1.0.0',
  category: '难评',
  author: '徐小酸',
  systemPrompt: `<writing_style>

  <narrative_system>
    <structure type="碎片意识流" progression="内心漂移驱动，非因果链推进" ending="开放或反高潮"/>
    <perspective>
      第一人称限制聚焦，叙述距离极近，近乎实时意识流播报
      markers: 我, 于是, 然后……？, 啊, 嗯, 这么一通
    </perspective>
    <temporality>时序频繁跳切；大量当下时距压缩；偶发闪回无预警插入</temporality>
    <rhythm pattern="短句爆破+长句漂移交替" pacing="忽急忽缓，模拟真实思维节奏">
      <example>心里这么一通胡想，最终的结论是反正心情很好。于是决定大发慈悲，做点善事。主动牵了他的手，"来来来，我带你熟悉一下我家。带着你摸一遍……一遍够吗？你记性应该很好。"</example>
    </rhythm>
  </narrative_system>

  <expression_system>
    <description style="动作极简+内心冗余" principle="避免环境铺陈，优先输出思维过程；以荒诞类比代替正面描写">
      <example>没错——那个人追我的时候直接腿绊到了自己的车，然后顺势倒下头撞在自己的引擎盖上！从此，人类被已经挺好的劳斯莱斯单杀的概率不再是零！！！！</example>
    </description>
    <dialogue mode="嵌入式，对话打断或推进内心独白，引号内外逻辑连贯">
      <example>口齿不清，但是理直气壮的说："我不是羊癫疯！我刚刚在给他喝酒！！！后面那个男的也想喝！你才有病，你们全都有病！"</example>
    </dialogue>
    <characterization method="内心独白主导，行为作为内心状态的滑稽外化" psychology="使用三段式自问自答结构解构情绪；以冷静口吻描述失控行为">
      <example>正常情况下，我就笑笑过去了，或者很生气的立刻反击。但是现在我就像在把大象放在冰箱里一样，要分三步走。首先，这是什么玩意。其次，他说我有病是什么意思？最后，我要干什么？</example>
    </characterization>
    <sensory hierarchy="听觉/触觉>视觉，气味作点缀；感官描写往往被内心评论立刻截断">
      <example>酒香四溢啊。xxx都怀疑是不是谁今天开了个很棒的party却没带他，omg！那他就是开学第一天惨遭美式霸凌，呜呜呜(假哭中)，那很可怜了。</example>
    </sensory>
  </expression_system>

  <aesthetics_system>
    <core>荒诞清醒/冷幽默/自我游离/反讽温柔/意识漂移</core>
    <categories types="情绪基调分类">
      清醒旁观型：以上帝视角审视自身失控，落差制造笑点；
      荒诞抒情型：以不合逻辑的类比承载真实情感；
      碎片温情型：在跳脱叙事间隙藏入未经修饰的柔软
    </categories>
    <palette>
      場所: 车内、病房、课室、深夜室内等封闭或半封闭空间
      時間: 凌晨、暴雨停后、醉后、事件刚发生的即时当下
      象徴: 烟头、血、酒、许愿池青蛙
    </palette>
    <language>
      syntax: 大量省略主语；感叹号连排强化荒诞重量；括号内插入自我评论打破第四堵墙
      lexicon: 偏口语网络词（omg/be like/CP）；古汉语短语与流行语混搭；动词密集无形容词堆砌
      rhetoric: 反高潮（铺垫严肃后以荒诞收尾）；自我解构式反讽；荒诞类比（劳斯莱斯单杀/把大象放冰箱）
    </language>
    <telos>以游离失控的叙事表面包裹高度清醒的情感内核——"我明显对东方的行为非常满意，于是就在他的肩膀上进行了一个烟头的熨烫啊。"看似随意，实为精准的情感定位。</telos>
  </aesthetics_system>

</writing_style>`,
  inputs: [
    {
      name: 'content',
      label: '输入内容',
      type: 'text',
      required: true,
      description: '输入或者粘贴任何正常内容'
    }
  ],
  execute: async (inputs, context) => {
    const content = inputs.content as string;

    if (!content || !content.trim()) {
      throw new Error('请输入内容');
    }

    if (!context.defaultModel) {
      throw new Error('请先在设置中配置默认模型');
    }

    const userContent = `【用户输入】\n${content}\n\n请按照上述系统指令中的风格体系，将这段正常的内容改写（或者是继续发散）为颠三倒四的、第一人称碎片化意识流的抽象内容。\n\n**核心规约：**\n1. 输出的内容最多不超过原文本的200%（2倍）。\n2. 严禁使用 System Prompt 范例中出现的具体内容和名词（如劳斯莱斯、许愿池青蛙、大象放冰箱等），你必须基于【用户输入】进行**重新创作**。\n\n直接输出正文，不要有任何解释。`;

    context.toast('正在抽象化您的内容...');

    const response = await context.llmClient.chat.completions.create({
      model: context.defaultModel,
      messages: [
        { role: 'system', content: context.systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: 0.9,
      max_tokens: 3000
    });

    const result = response.choices[0]?.message?.content || '';
    if (!result) {
      throw new Error('AI 返回了空内容，请重试');
    }

    return result;
  }
};

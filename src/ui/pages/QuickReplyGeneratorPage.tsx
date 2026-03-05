import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Download } from 'lucide-react';
import { toast } from 'sonner';

/** QuickReply (v2) 单个条目结构 */
interface QuickReplyItem {
    id: number;
    icon: string;
    showLabel: boolean;
    label: string;
    title: string;
    message: string;
    contextList: unknown[];
    preventAutoExecute: boolean;
    isHidden: boolean;
    executeOnStartup: boolean;
    executeOnUser: boolean;
    executeOnAi: boolean;
    executeOnChatChange: boolean;
    executeOnGroupMemberDraft: boolean;
    executeOnNewChat: boolean;
    executeBeforeGeneration: boolean;
    automationId: string;
}

/** QuickReplySet (v2) 集合结构 */
interface QuickReplySet {
    version: number;
    name: string;
    disableSend: boolean;
    placeBeforeInput: boolean;
    injectInput: boolean;
    color: string;
    onlyBorderColor: boolean;
    qrList: QuickReplyItem[];
    idIndex: number;
}

const createDefaultItem = (id: number): QuickReplyItem => ({
    id,
    icon: '',
    showLabel: false,
    label: '',
    title: '',
    message: '',
    contextList: [],
    preventAutoExecute: true,
    isHidden: false,
    executeOnStartup: false,
    executeOnUser: false,
    executeOnAi: false,
    executeOnChatChange: false,
    executeOnGroupMemberDraft: false,
    executeOnNewChat: false,
    executeBeforeGeneration: false,
    automationId: ''
});

const createDefaultSet = (): QuickReplySet => ({
    version: 2,
    name: "",
    disableSend: true,
    placeBeforeInput: false,
    injectInput: false,
    color: "rgba(0, 0, 0, 0)",
    onlyBorderColor: false,
    qrList: [createDefaultItem(1)],
    idIndex: 2
});

/** 将 hex + opacity 合成 rgba */
function hexToRgba(hex: string, opacity: number): string {
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/** 从 rgba 解析 opacity */
function parseOpacity(color: string): number {
    const m = color.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/);
    if (m) return parseFloat(m[1]);
    if (color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return 0;
    return 1;
}

/** 从 rgba/hex 解析出 hex 部分 */
function parseHex(color: string): string {
    const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) {
        const toHex = (n: number) => n.toString(16).padStart(2, '0');
        return `#${toHex(Number(m[1]))}${toHex(Number(m[2]))}${toHex(Number(m[3]))}`;
    }
    if (color.startsWith('#') && color.length >= 7) return color.slice(0, 7);
    return '#000000';
}

export function QuickReplyGeneratorPage() {
    const [qrSet, setQrSet] = useState<QuickReplySet>(createDefaultSet());
    const [sentMessages, setSentMessages] = useState<string[]>([]);
    const [mockInput, setMockInput] = useState('');

    const [pickerHex, setPickerHex] = useState('#000000');
    const [pickerOpacity, setPickerOpacity] = useState(0);

    const updateSetField = <K extends keyof QuickReplySet>(field: K, value: QuickReplySet[K]) => {
        setQrSet(prev => ({ ...prev, [field]: value }));
    };

    const addItem = () => {
        setQrSet(prev => ({
            ...prev,
            qrList: [...prev.qrList, createDefaultItem(prev.idIndex)],
            idIndex: prev.idIndex + 1
        }));
    };

    const updateItem = <K extends keyof QuickReplyItem>(id: number, field: K, value: QuickReplyItem[K]) => {
        setQrSet(prev => ({
            ...prev,
            qrList: prev.qrList.map(item => item.id === id ? { ...item, [field]: value } : item)
        }));
    };

    const removeItem = (id: number) => {
        setQrSet(prev => ({ ...prev, qrList: prev.qrList.filter(item => item.id !== id) }));
    };

    const syncColor = (hex: string, opacity: number) => {
        setPickerHex(hex);
        setPickerOpacity(opacity);
        if (opacity === 0) {
            updateSetField('color', 'rgba(0, 0, 0, 0)');
        } else {
            updateSetField('color', hexToRgba(hex, opacity));
        }
    };

    const handleColorInputChange = (raw: string) => {
        updateSetField('color', raw);
        setPickerHex(parseHex(raw));
        setPickerOpacity(parseOpacity(raw));
    };

    const handleDownload = () => {
        if (!qrSet.name.trim()) { toast.error('请填写脚本名称！'); return; }
        const blob = new Blob([JSON.stringify(qrSet, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${qrSet.name}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`已下载 ${qrSet.name}.json`);
    };

    const handleTestClick = (item: QuickReplyItem) => {
        if (qrSet.disableSend) {
            setMockInput(item.message);
        } else {
            setSentMessages(prev => [...prev, item.message]);
        }
    };

    const renderPreviewBtn = (item: QuickReplyItem) => {
        const showText = !!item.label;
        const hasColor = qrSet.color && qrSet.color !== 'rgba(0, 0, 0, 0)' && qrSet.color !== 'transparent';
        const style: React.CSSProperties = {};

        if (hasColor) {
            if (qrSet.onlyBorderColor) {
                style.borderColor = qrSet.color;
                style.borderWidth = '1px';
                style.borderStyle = 'solid';
                style.color = qrSet.color;
                style.backgroundColor = 'transparent';
            } else {
                style.backgroundColor = qrSet.color;
                style.borderColor = qrSet.color;
                style.color = '#fff';
            }
        }

        return (
            <button
                key={item.id}
                title={item.title || item.message || item.label}
                onClick={() => handleTestClick(item)}
                className={`inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer select-none shadow-sm hover:brightness-110 active:scale-95 ${!hasColor ? 'bg-white/10 text-white/90 border border-white/10 hover:bg-white/15' : ''}`}
                style={style}
            >
                {showText && <span>{item.label}</span>}
                {!showText && <span className="opacity-40">空</span>}
            </button>
        );
    };

    return (
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-0 min-h-0 items-start">

            {/* ====== 左侧：配置 ====== */}
            <div className="border-r border-border/40 min-h-[calc(100vh-theme(spacing.16))] bg-background">
                {/* 顶栏 */}
                <div className="sticky top-0 z-10 flex flex-col px-6 py-5 border-b bg-background/95 backdrop-blur-md">
                    <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
                        <span className="text-2xl">⚡️</span>快速回复生成器
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1.5">轻松配置你的 QuickReply 并在右侧实时预览效果。</p>
                </div>

                <div className="px-6 py-6 space-y-8">

                    {/* --- 主要信息 --- */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold tracking-tight">基础设置</h2>

                        <div className="space-y-5">
                            {/* 脚本名称 */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">脚本名称 <span className="text-red-500">*</span></Label>
                                <Input
                                    value={qrSet.name}
                                    onChange={e => updateSetField('name', e.target.value)}
                                    className="h-10 text-sm bg-muted/30 border-muted-foreground/20 focus-visible:ring-1"
                                    placeholder="输入该快速回复组的名字"
                                />
                            </div>

                            {/* 禁止自动发送 */}
                            <div className="flex items-center justify-between rounded-xl border border-border/50 px-4 py-3.5 bg-muted/10 shadow-sm">
                                <div className="max-w-[75%] pr-4">
                                    <Label className="text-sm font-semibold">禁止自动发送</Label>
                                    <p className="text-xs text-muted-foreground leading-relaxed mt-1">开启后，点击按钮仅会将文本填充到输入框中，不会自动发送出去。</p>
                                </div>
                                <Switch checked={qrSet.disableSend} onCheckedChange={v => updateSetField('disableSend', v)} />
                            </div>

                            {/* 颜色配置 */}
                            <div className="space-y-3 rounded-xl border border-border/50 p-4 bg-muted/10 shadow-sm">
                                <Label className="text-sm font-semibold block">全局颜色</Label>
                                <div className="flex gap-3 items-center">
                                    <div className="relative w-10 h-10 rounded-lg border border-border/80 overflow-hidden shrink-0 shadow-sm">
                                        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%),linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%)', backgroundSize: '8px 8px', backgroundPosition: '0 0,4px 4px' }}></div>
                                        {qrSet.color !== 'rgba(0, 0, 0, 0)' && qrSet.color !== 'transparent' && (
                                            <div className="absolute inset-0" style={{ backgroundColor: qrSet.color }}></div>
                                        )}
                                        <input
                                            type="color"
                                            className="absolute -inset-2 w-14 h-14 opacity-0 cursor-pointer"
                                            value={pickerHex}
                                            onChange={e => syncColor(e.target.value, pickerOpacity || 1)}
                                        />
                                    </div>
                                    <Input
                                        value={qrSet.color}
                                        onChange={e => handleColorInputChange(e.target.value)}
                                        className="font-mono text-xs h-10 flex-1 bg-background"
                                    />
                                    <Button variant="outline" size="sm" onClick={() => syncColor('#000000', 0)} className="h-10 px-3 text-xs">重置为透明</Button>
                                </div>

                                <div className="flex items-center gap-3 pt-2">
                                    <Label className="text-xs text-muted-foreground w-12 shrink-0">不透明度</Label>
                                    <div className="flex-1 relative h-2 flex items-center">
                                        {/* 原生背景轨 */}
                                        <div className="absolute inset-x-0 h-2 bg-muted rounded-full pointer-events-none"></div>
                                        {/* 主题色进度填充轨 */}
                                        <div
                                            className="absolute left-0 h-2 bg-primary rounded-full pointer-events-none transition-all duration-75"
                                            style={{ width: `${pickerOpacity * 100}%` }}
                                        ></div>
                                        <input
                                            type="range"
                                            min="0" max="1" step="0.01"
                                            value={pickerOpacity}
                                            onChange={e => syncColor(pickerHex, parseFloat(e.target.value))}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            title="调整不透明度"
                                        />
                                        {/* 模拟滑块圆点 */}
                                        <div
                                            className="absolute w-3.5 h-3.5 bg-primary rounded-full shadow-md border border-primary-foreground pointer-events-none z-0 transform -translate-x-1/2 transition-all duration-75"
                                            style={{ left: `${pickerOpacity * 100}%` }}
                                        ></div>
                                    </div>
                                    <span className="text-xs font-mono text-muted-foreground w-10 text-right">{Math.round(pickerOpacity * 100)}%</span>
                                </div>

                                <div className="flex items-center justify-between pt-4 mt-2 border-t border-border/50">
                                    <div className="max-w-[75%] pr-4">
                                        <Label className="text-sm font-semibold">仅边框颜色</Label>
                                        <p className="text-xs text-muted-foreground mt-1.5">开启后，选定的颜色将仅作为按钮的边框色渲染。</p>
                                    </div>
                                    <Switch checked={qrSet.onlyBorderColor} onCheckedChange={v => updateSetField('onlyBorderColor', v)} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <hr className="border-border/60" />

                    {/* --- 快速回复列表 --- */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold tracking-tight">按钮列表</h2>
                            <Button onClick={addItem} className="gap-1.5 h-8 px-3 text-xs shadow-sm" variant="secondary">
                                <Plus className="w-3.5 h-3.5" /> 添加按钮
                            </Button>
                        </div>

                        <div className="space-y-2">
                            {qrSet.qrList.map((item, index) => (
                                <div key={item.id} className="relative bg-card text-card-foreground rounded-xl shadow-sm border border-border/60 overflow-hidden group flex flex-col">
                                    <div className="absolute top-0 left-0 bottom-0 w-1 bg-primary/40 group-hover:bg-primary transition-colors z-10"></div>

                                    {/* 顶栏：加深背景色，让层次更分明 */}
                                    <div className="flex items-center justify-between pl-5 pr-3 py-2.5 border-b border-border/40 bg-muted/80">
                                        <div className="flex items-center gap-2">
                                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-background text-[10px] font-bold text-foreground shadow-sm border border-border/60">
                                                {index + 1}
                                            </span>
                                            <span className="text-xs font-bold text-foreground/80 tracking-wide">按钮配置</span>
                                        </div>
                                        {index > 0 ? (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 px-2 text-destructive hover:bg-destructive/15 hover:text-destructive transition-colors"
                                                onClick={() => removeItem(item.id)}
                                            >
                                                <Trash2 className="w-3.5 h-3.5 mr-1" />
                                                <span className="text-xs">删除</span>
                                            </Button>
                                        ) : (
                                            <div className="h-6"></div>
                                        )}
                                    </div>

                                    {/* 表单内容区：稍微放宽间距使其具有一定呼吸感 */}
                                    <div className="p-5 space-y-4.5 relative z-10">
                                        <div className="space-y-1.5">
                                            <Label className="text-sm font-medium text-foreground/90">按钮文本</Label>
                                            <Input
                                                value={item.label}
                                                onChange={e => updateItem(item.id, 'label', e.target.value)}
                                                className="h-9 text-sm focus-visible:ring-1 bg-background"
                                                placeholder="按钮上显示的文字"
                                            />
                                        </div>
                                        <div className="space-y-1.5 mt-4">
                                            <Label className="text-sm font-medium text-foreground/90">鼠标悬浮提示 (可选)</Label>
                                            <Input
                                                value={item.title}
                                                onChange={e => updateItem(item.id, 'title', e.target.value)}
                                                className="h-9 text-sm focus-visible:ring-1 bg-background"
                                                placeholder="鼠标悬浮在按钮上时的提示文本"
                                            />
                                        </div>
                                        <div className="space-y-1.5 mt-4">
                                            <Label className="text-sm font-medium text-foreground/90">发送内容</Label>
                                            <textarea
                                                value={item.message}
                                                onChange={e => updateItem(item.id, 'message', e.target.value)}
                                                className="w-full rounded-md border border-input bg-accent/30 px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0 resize-y min-h-[80px]"
                                                placeholder="点击该按钮触发的回复文字..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {qrSet.qrList.length === 0 && (
                                <div className="py-10 text-center border-2 border-dashed border-border/60 rounded-xl bg-muted/5">
                                    <p className="text-muted-foreground text-sm">还没有配置任何按钮，请点击右上角添加。</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* --- 下载按钮（最底部） --- */}
                    <div className="pt-6 pb-2">
                        <Button size="lg" onClick={handleDownload} className="w-full gap-2 h-12 text-base font-semibold shadow-md active:scale-[0.98] transition-transform">
                            <Download className="w-5 h-5" />
                            下载快速回复脚本
                        </Button>
                        <p className="text-center text-[10px] text-muted-foreground mt-3">生成的文件可以直接导入到酒馆的快速回复面板中</p>
                    </div>

                </div>
            </div>

            {/* ====== 右侧：实时预览 ====== */}
            <div className="md:sticky md:top-6 md:p-6 p-4">
                <div className="flex flex-col bg-black rounded-2xl border border-white/10 shadow-2xl overflow-hidden max-h-[85vh]">

                    {/* 预览顶栏 */}
                    <div className="flex-shrink-0 px-5 py-3 border-b border-white/5 bg-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-[pulse_2s_ease-in-out_infinite] shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                            <span className="text-sm font-semibold text-white/90 tracking-wide">交互预览</span>
                        </div>
                    </div>

                    {/* 发送结果区（上方，占据剩余空间） */}
                    <div className="flex-1 min-h-[180px] overflow-y-auto px-5 py-5 flex flex-col justify-end relative">
                        {/* 装饰性占位对话背景 */}
                        <div className="absolute inset-x-5 top-5 bottom-5 opacity-[0.03] pointer-events-none flex flex-col gap-4">
                            <div className="self-start w-2/3 h-16 bg-white rounded-2xl"></div>
                            <div className="self-end w-1/2 h-10 bg-white rounded-2xl"></div>
                            <div className="self-start w-3/4 h-24 bg-white rounded-2xl"></div>
                        </div>

                        <div className="relative z-10 w-full flex flex-col items-end space-y-3">
                            {sentMessages.length === 0 ? (
                                <div className="w-full text-center pb-6 select-none">
                                    <p className="text-white/30 text-xs leading-relaxed">关闭「禁止自动发送」后<br />点击下方的按钮，消息将飞入此处</p>
                                </div>
                            ) : (
                                sentMessages.map((msg, i) => (
                                    <div key={i} className="max-w-[85%] bg-blue-600/90 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm text-[13px] break-words font-sans shadow-md backdrop-blur-sm animate-in slide-in-from-bottom-2 fade-in duration-300">
                                        {msg}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* 底部：QR 按钮 + 模拟输入框 */}
                    <div className="flex-shrink-0 border-t border-white/10 bg-gradient-to-t from-black to-[#0a0a0a] px-5 pt-4 pb-5 space-y-4">
                        {/* 按钮群 */}
                        {qrSet.qrList.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {qrSet.qrList.map(item => renderPreviewBtn(item))}
                            </div>
                        )}

                        {/* 模拟输入框 */}
                        <div className="relative group">
                            <textarea
                                value={mockInput}
                                onChange={e => setMockInput(e.target.value)}
                                placeholder="输入聊天内容..."
                                className="w-full bg-[#16181d] border border-white/10 rounded-xl px-4 py-3.5 text-white/90 text-sm resize-none focus:outline-none focus:border-white/25 focus:ring-1 focus:ring-white/10 transition-all font-sans placeholder:text-white/20 shadow-inner"
                                rows={2}
                            />
                            {/* 清空按钮悬浮在右上方 */}
                            {(sentMessages.length > 0 || mockInput) && (
                                <button
                                    onClick={() => { setSentMessages([]); setMockInput(''); }}
                                    className="absolute -top-10 right-0 text-[11px] font-medium px-3 py-1.5 rounded-lg text-white/50 bg-white/5 hover:text-white hover:bg-white/15 active:scale-95 transition-all shadow-sm backdrop-blur-md opacity-0 group-hover:opacity-100"
                                >
                                    清空预览
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}

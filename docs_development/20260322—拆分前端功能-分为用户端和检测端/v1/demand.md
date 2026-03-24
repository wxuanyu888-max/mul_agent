# 需求文档：语音功能集成到Chat面板

> 状态：**实施完成**
> 优先级：P0

## 1. 需求背景

原来的语音功能（VoiceChat）是一个独立的导航页面，用户体验割裂。按照"小步快走"的原则，先将语音功能集成到Chat面板中，提升用户体验。

## 2. 需求目标

### 2.1 交互设计
- 在Chat输入栏**左侧**添加一个小圆点语音按钮（🎤）
- 点击语音按钮，输入栏切换为**语音输入模式**
- 语音输入模式下：
  - 显示"正在聆听..."提示
  - 实时显示识别文字
  - 再次点击停止聆听
  - 识别完成后自动发送

### 2.2 视觉设计
```
普通模式：
[🎤] [输入框...............................] [发送]

语音模式：
[🔴] [正在聆听...你说了：xxxxx............] [发送]
```

## 3. 功能归属

| 功能 | 归属 |
|------|------|
| 语音识别 | ChatPanel（复用 VoiceChat 的 Speech Recognition 逻辑） |
| 语音按钮 | ChatPanel 输入区左侧 |
| 语音模式切换 | ChatPanel 内部状态管理 |

## 4. 技术方案

### 4.1 复用 VoiceChat 逻辑
- 从 `VoiceChat.tsx` 提取 `SpeechRecognition` 逻辑
- 直接在 ChatPanel 中实现语音识别功能
- 语音识别后自动填充到输入框

### 4.2 状态管理
```typescript
interface VoiceState {
  isListening: boolean;
  interimTranscript: string;  // 临时识别结果
}
```

### 4.3 组件结构
```tsx
// ChatInput 组件（输入区域）
<div className="flex items-end gap-3">
  {/* 语音按钮 */}
  <button onClick={toggleVoice}>
    {isListening ? '🔴' : '🎤'}
  </button>

  {/* 输入框 - 语音模式时显示识别文字 */}
  <input
    value={isListening ? interimTranscript : input}
    onChange={...}
  />

  {/* 发送按钮 */}
  <button onClick={sendMessage}>发送</button>
</div>
```

## 5. 验收标准

- [x] 语音按钮在输入栏左侧
- [x] 点击语音按钮进入聆听模式
- [x] 实时显示识别文字
- [x] 再次点击停止聆听
- [x] 识别完成后自动发送
- [x] 语音功能使用浏览器 Web Speech API

## 6. 约束条件

1. 使用浏览器原生 Speech Recognition API（免费）
2. 不改变现有 Chat 发送逻辑
3. 兼容 Chrome、Edge 等现代浏览器

## 7. 后续扩展

- 可添加语音音色选择（参考 VoiceChat 的 TTS 功能）
- 可添加语音播放回复功能
- 独立 Voice 导航 tab 暂时保留，后续根据需要决定是否移除

---

**创建时间**：2026-03-22
**版本**：v1
**更新历史**：
- 2026-03-22：更新需求为"语音功能集成到Chat面板"
- 2026-03-22：实施完成

# 任务拆分：语音功能集成到Chat面板

> 状态：实施中
> 开始时间：2026-03-22

---

## 任务概览

| 任务ID | 任务名称 | 优先级 | 状态 | 依赖 |
|--------|----------|--------|------|------|
| T1 | 在ChatPanel添加语音状态 | P0 | 待实施 | 无 |
| T2 | 实现语音识别逻辑 | P0 | 待实施 | T1 |
| T3 | 添加语音按钮UI | P0 | 待实施 | T1 |
| T4 | 实现语音模式切换 | P0 | 待实施 | T2, T3 |
| T5 | 测试语音功能 | P0 | 待实施 | T4 |

---

## 任务详情

### T1: 在ChatPanel添加语音状态

**文件**：`ui/src/components/chat/ChatPanel.tsx`

**内容**：
```typescript
// 语音状态
const [isListening, setIsListening] = useState(false);
const [interimTranscript, setInterimTranscript] = useState('');
const recognitionRef = useRef<any>(null);
```

**交付物**：添加状态和 ref

---

### T2: 实现语音识别逻辑

**内容**：
- 提取 VoiceChat.tsx 中的 `toggleRecording` 逻辑
- 使用 Web Speech API (SpeechRecognition)
- 支持 interimResults 实时显示识别结果

**关键代码**：
```typescript
const toggleRecording = () => {
  const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognitionAPI) {
    alert('您的浏览器不支持语音识别功能，请使用 Chrome 浏览器');
    return;
  }

  if (isListening) {
    recognitionRef.current?.stop();
    return;
  }

  const recognition = new SpeechRecognitionAPI();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'zh-CN';

  recognition.onstart = () => setIsListening(true);

  recognition.onresult = (event) => {
    const results = Array.from(event.results);
    const transcript = results.map((r: any) => r[0].transcript).join('');
    setInterimTranscript(transcript);

    // 最终结果
    const final = results.find((r: any) => r.isFinal);
    if (final) {
      setInput(final[0].transcript);
      setIsListening(false);
      // 自动发送
      setTimeout(() => sendMessage(), 100);
    }
  };

  recognition.onerror = () => setIsListening(false);
  recognition.onend = () => setIsListening(false);

  recognitionRef.current = recognition;
  recognition.start();
};
```

---

### T3: 添加语音按钮UI

**位置**：ChatPanel.tsx 第916行附近（输入区域）

**当前代码**：
```tsx
<div className="flex items-end gap-3">
  <div className="flex-1 relative">
    <textarea ... />
  </div>
  <button onClick={sendMessage}>Send</button>
</div>
```

**修改为**：
```tsx
<div className="flex items-end gap-3">
  {/* 语音按钮 */}
  <button
    onClick={toggleRecording}
    className={`p-3 rounded-xl transition-all ${
      isListening
        ? 'bg-red-100 text-red-600 animate-pulse'
        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
    }`}
    title={isListening ? '停止聆听' : '开始语音输入'}
  >
    {isListening ? '🔴' : '🎤'}
  </button>

  <div className="flex-1 relative">
    {isListening ? (
      <div className="w-full bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
        <span className="text-red-600 font-medium">正在聆听...</span>
        {interimTranscript && (
          <span className="text-gray-700 ml-2">{interimTranscript}</span>
        )}
      </div>
    ) : (
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleInputKeyDown}
        placeholder="Type your message..."
      />
    )}
  </div>

  <button onClick={sendMessage}>Send</button>
</div>
```

---

### T4: 实现语音模式切换

**说明**：
- 语音模式时隐藏文本输入，显示聆听状态
- 识别完成自动填入输入框并发送
- 或者用户可以手动点击发送

---

### T5: 测试语音功能

**测试用例**：
1. 点击语音按钮，按钮变为红色闪烁
2. 说一句话，识别文字实时显示
3. 说完后识别完成，自动发送
4. 再次点击语音按钮可以停止聆听

---

## 文件变更清单

| 文件 | 操作 | 修改点 |
|------|------|--------|
| `ui/src/components/chat/ChatPanel.tsx` | 修改 | 添加语音状态、语音识别逻辑、语音按钮UI |

---

**创建时间**：2026-03-22
**版本**：v1

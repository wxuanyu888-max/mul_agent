# 实施逻辑：语音功能集成到Chat面板

> 状态：**实施完成**
> 开始时间：2026-03-22

---

## 实施记录

### Step 1: 添加 Web Speech API 类型声明

**文件**：`ui/src/components/chat/ChatPanel.tsx`

**修改内容**：
```typescript
import { Send, User, Bot, Loader2, RefreshCw, Trash2, Menu, MessageSquare, ChevronRight, ChevronDown, CheckCircle, AlertCircle, Play, Brain, Activity, Clock, Mic, MicOff } from 'lucide-react';

// Web Speech API 类型声明
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
```

**变更说明**：
- 导入 Mic 和 MicOff 图标
- 添加 Web Speech API 类型声明以支持 TypeScript

---

### Step 2: 添加语音状态

**文件**：`ui/src/components/chat/ChatPanel.tsx`

**修改位置**：第249-252行附近

**修改内容**：
```typescript
const messagesEndRef = useRef<HTMLDivElement>(null);

// 语音识别状态
const [isListening, setIsListening] = useState(false);
const [interimTranscript, setInterimTranscript] = useState('');
const recognitionRef = useRef<any>(null);

// 跟踪每个步骤的开始时间
```

---

### Step 3: 实现语音识别逻辑

**文件**：`ui/src/components/chat/ChatPanel.tsx`

**修改位置**：`clearChat` 函数之后

**修改内容**：
```typescript
// 语音识别功能
const toggleVoiceRecording = () => {
  const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognitionAPI) {
    alert('您的浏览器不支持语音识别功能，请使用 Chrome、Edge 或 Safari 浏览器');
    return;
  }

  // 如果正在聆听，点击停止
  if (isListening) {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    return;
  }

  // 开始新的识别
  const recognition = new SpeechRecognitionAPI();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'zh-CN';

  recognition.onstart = () => {
    setIsListening(true);
    setInterimTranscript('');
  };

  recognition.onresult = (event: any) => {
    const results = Array.from(event.results);
    const transcript = results
      .map((result: any) => result[0].transcript)
      .join('');
    setInterimTranscript(transcript);

    // 检查是否是最终结果
    const finalResult = results.find((r: any) => r.isFinal);
    if (finalResult) {
      const finalText = finalResult[0].transcript;
      setInput(finalText);
      setIsListening(false);
      setInterimTranscript('');
      // 自动发送
      setTimeout(() => {
        sendMessage();
      }, 100);
    }
  };

  recognition.onerror = (event: any) => {
    console.error('[Voice] Recognition error:', event.error);
    setIsListening(false);
    recognitionRef.current = null;
  };

  recognition.onend = () => {
    console.log('[Voice] Recognition ended');
    // 如果状态还是聆听中但没有最终结果，重置为空闲
    if (isListening && !interimTranscript) {
      setIsListening(false);
    }
    recognitionRef.current = null;
  };

  recognitionRef.current = recognition;
  recognition.start();
};
```

---

### Step 4: 更新输入区域UI

**文件**：`ui/src/components/chat/ChatPanel.tsx`

**修改位置**：输入区域（第996-1033行）

**修改内容**：
```tsx
{/* Input */}
<div className="px-6 py-4 border-t border-gray-200 bg-white">
  <div className="flex items-end gap-3">
    {/* Voice Input Button */}
    <button
      onClick={toggleVoiceRecording}
      className={`p-3 rounded-xl transition-all flex-shrink-0 ${
        isListening
          ? 'bg-red-100 text-red-600 animate-pulse'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
      }`}
      title={isListening ? '停止聆听' : '开始语音输入'}
    >
      {isListening ? (
        <MicOff className="w-5 h-5" />
      ) : (
        <Mic className="w-5 h-5" />
      )}
    </button>

    {/* Input Area */}
    <div className="flex-1 relative">
      {isListening ? (
        /* 语音聆听模式 */
        <div className="w-full bg-red-50 border-2 border-red-200 rounded-xl px-4 py-3 min-h-[44px] flex items-center">
          <div className="flex items-center gap-2 flex-1">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-600 font-medium text-sm">正在聆听...</span>
            {interimTranscript && (
              <span className="text-gray-700 text-sm ml-2">{interimTranscript}</span>
            )}
          </div>
        </div>
      ) : (
        /* 文本输入模式 */
        <>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Type your message... (try /help, /status, /list)"
            rows={1}
            className="w-full resize-none bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-700 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent max-h-32"
            style={{ minHeight: '44px' }}
          />
          {showAutocomplete && (
            <CommandAutocomplete
              input={input}
              onSelect={handleCommandSelect}
              onClose={() => setShowAutocomplete(false)}
              hasSuggestions={hasSuggestions}
              setHasSuggestions={setHasSuggestions}
              selectedIndex={selectedIndex}
            />
          )}
        </>
      )}
    </div>

    {/* Send Button */}
    <button
      onClick={sendMessage}
      disabled={!input.trim() && !isListening}
      className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl font-medium text-sm transition-all disabled:cursor-not-allowed flex items-center gap-2"
    >
      {pendingRequests.size > 0 ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Send className="w-4 h-4" />
      )}
      Send
    </button>
  </div>
</div>
```

---

## 测试记录

### T5: 端切换功能测试

| 测试用例 | 状态 | 结果 |
|----------|------|------|
| 点击语音按钮，按钮变为红色闪烁 | 待测试 | - |
| 说一句话，识别文字实时显示 | 待测试 | - |
| 说完后识别完成，自动发送 | 待测试 | - |
| 再次点击语音按钮可以停止聆听 | 待测试 | - |
| 非Chrome浏览器显示友好提示 | 待测试 | - |

---

## 遇到的问题与解决

| 问题 | 解决方案 | 结果 |
|------|----------|------|
| TypeScript 不认识 webkitSpeechRecognition | 添加 Window 类型声明 | ✅ 已解决 |
| 语音识别结束但状态未重置 | 在 onend 中检查并重置状态 | ✅ 已解决 |
| **用户点击停止后自动发送，无法取消** | 移除自动发送逻辑，停止后将识别结果保留在输入框由用户决定发送 | ✅ 已解决 |

---

## 关键文件清单

| 文件路径 | 修改类型 | 核心修改点 |
|----------|----------|------------|
| `ui/src/components/chat/ChatPanel.tsx` | 修改 | 添加语音状态、语音识别逻辑、语音按钮UI |

---

**创建时间**：2026-03-22
**版本**：v1
**更新历史**：
- 2026-03-22：实施语音功能集成到Chat面板

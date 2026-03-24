# 实施逻辑：语音功能集成到Chat面板

> 状态：**待检验**
> 开始时间：2026-03-22

---

## 实施记录

### Step 1: 添加 Web Speech API 类型声明

**文件**：`ui/src/components/chat/ChatPanel.tsx`

**修改内容**：
```typescript
import { Mic, MicOff } from 'lucide-react';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
```

---

### Step 2: 添加语音状态

```typescript
const [isListening, setIsListening] = useState(false);
const [interimTranscript, setInterimTranscript] = useState('');
const recognitionRef = useRef<any>(null);
```

---

### Step 3: 实现语音识别逻辑

- 使用浏览器原生 Speech Recognition API
- 支持实时识别结果显示（interimResults）
- 识别结束后保留结果在输入框，由用户决定是否发送

---

### Step 4: UI 布局

- 语音按钮固定 44px 高度
- 发送按钮固定 44px 高度
- 语音提示条叠加在输入框顶部

---

## 测试记录

| 测试用例 | 状态 | 结果 |
|----------|------|------|
| 语音按钮在输入框左侧 | ✅ 完成 | - |
| 点击按钮进入聆听模式 | ✅ 完成 | - |
| 实时显示识别文字 | ✅ 完成 | - |
| 点击停止保留结果 | ✅ 完成 | - |
| 界面对齐 | ✅ 完成 | - |

---

## 遇到的问题与解决

| 问题 | 解决方案 | 结果 |
|------|----------|------|
| TypeScript 不认识 webkitSpeechRecognition | 添加 Window 类型声明 | ✅ |
| 语音识别结束但状态未重置 | 在 onend 中检查并重置状态 | ✅ |
| 用户点击停止后自动发送，无法取消 | 移除自动发送逻辑，停止后将识别结果保留在输入框 | ✅ |
| 麦克风无声音输入（no-speech） | 需要用户检查系统麦克风权限和设置 | ⏳ |
| 界面元素对齐问题 | 固定按钮高度44px，提示条叠加在输入框顶部 | ✅ |
| 需要 MiniMax TTS 服务 | 创建 MiniMax TTS WebSocket 服务 | ✅ |
| 需要前端 TTS 调用 | 在 ChatPanel 添加 TTS 播放功能 | ✅ |

---

## 关键文件清单

| 文件路径 | 修改类型 | 核心修改点 |
|----------|----------|------------|
| `ui/src/components/chat/ChatPanel.tsx` | 修改 | 添加语音状态、语音识别逻辑、语音按钮UI、TTS播放按钮 |
| `src/tools/media/minimax-tts.ts` | 新增 | MiniMax TTS WebSocket 服务 |
| `src/api/routes/voice.ts` | 修改 | 添加 MiniMax TTS API 路由 |
| `package.json` | 修改 | 添加 ws 依赖 |
| `ui/src/services/endpoints/voice.ts` | 新增 | 前端语音服务 API |

---

**创建时间**：2026-03-22
**版本**：v1-待检验语音输入

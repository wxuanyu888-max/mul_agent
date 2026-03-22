/**
 * 语音对话组件
 *
 * 豆包式的语音交流界面
 * 使用浏览器内置的 Web Speech API (免费)
 */

import { useState, useRef, useEffect } from 'react';

// 扩展 Window 接口以支持 Web Speech API
declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface VoiceOption {
  name: string;
  lang: string;
}

interface VoiceChatProps {
  /** API 基础 URL */
  apiBaseUrl?: string;
}

type ChatStatus = 'idle' | 'listening' | 'processing' | 'speaking';

export function VoiceChat({
  apiBaseUrl = '/api/v1',
}: VoiceChatProps) {
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [inputText, setInputText] = useState('');
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // 加载浏览器可用语音
  useEffect(() => {
    synthRef.current = window.speechSynthesis;

    // 获取可用语音
    const loadVoices = () => {
      const voiceList = window.speechSynthesis.getVoices();
      const chineseVoices = voiceList.filter(v =>
        v.lang.startsWith('zh') || v.lang.includes('CN')
      );

      setVoices(chineseVoices.map(v => ({
        name: v.name,
        lang: v.lang
      })));

      // 默认选择第一个中文语音
      if (chineseVoices.length > 0 && !selectedVoice) {
        setSelectedVoice(chineseVoices[0].name);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // 使用浏览器 Speech Recognition 进行语音识别
  const toggleRecording = () => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      alert('您的浏览器不支持语音识别功能，请使用 Chrome 浏览器');
      return;
    }

    // 如果正在识别，点击停止
    if (status === 'listening' && recognitionRef.current) {
      console.log('[VoiceChat] Stopping recognition...');
      recognitionRef.current.stop();
      return;
    }

    // 开始新的识别
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN';

    recognition.onstart = () => {
      setStatus('listening');
      console.log('[VoiceChat] Speech recognition started');
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results: any[] = Array.from(event.results);
      console.log('[VoiceChat] Recognition results:', results.length);

      // 获取所有识别的文字
      const transcript = results
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((result: any) => result[0].transcript)
        .join('');

      console.log('[VoiceChat] Transcript:', transcript);

      // 检查是否是最终结果
      const finalResult = results.find((r: any) => r.isFinal);
      if (finalResult) {
        console.log('[VoiceChat] Final result:', finalResult[0].transcript);
        handleRecognizedText(finalResult[0].transcript);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      console.error('[VoiceChat] Speech recognition error:', event.error);
      setStatus('idle');
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      console.log('[VoiceChat] Recognition ended');
      // 如果状态还是 listening 且没有正在处理的结果，重置为空闲
      if (status === 'listening') {
        setStatus('idle');
      }
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // 处理识别到的文字
  const handleRecognizedText = async (text: string) => {
    if (!text.trim()) {
      setStatus('idle');
      return;
    }

    // 添加用户消息
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setStatus('processing');

    try {
      // 发送到 Agent
      const response = await fetch(`${apiBaseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      const data = await response.json();
      const replyText = data.content || data.message || '抱歉，我没有理解你的意思';

      // 添加助手消息
      setMessages(prev => [...prev, { role: 'assistant', content: replyText }]);

      // 使用 TTS 播放回复
      speakText(replyText);
    } catch (error) {
      console.error('[VoiceChat] Failed to send to agent:', error);
      setStatus('idle');
    }
  };

  // 使用浏览器 Speech Synthesis 进行语音播放
  const speakText = (text: string) => {
    if (!synthRef.current) {
      console.error('[VoiceChat] Speech synthesis not available');
      setStatus('idle');
      return;
    }

    // 先停止之前的播放
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // 设置语音
    const selectedVoiceObj = voices.find(v => v.name === selectedVoice);
    if (selectedVoiceObj) {
      utterance.voice = synthRef.current.getVoices().find(v => v.name === selectedVoiceObj.name) || null;
    }

    utterance.lang = 'zh-CN';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setStatus('speaking');
      console.log('[VoiceChat] TTS started');
    };

    utterance.onend = () => {
      setStatus('idle');
      console.log('[VoiceChat] TTS ended');
    };

    utterance.onerror = (event) => {
      console.error('[VoiceChat] TTS error:', event.error);
      setStatus('idle');
    };

    synthRef.current.speak(utterance);
  };

  // 发送文本消息
  const handleSend = async () => {
    if (!inputText.trim()) return;

    const text = inputText;
    setInputText('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setStatus('processing');

    try {
      const response = await fetch(`${apiBaseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      const data = await response.json();
      const replyText = data.content || data.message || '抱歉，我没有理解你的意思';

      setMessages(prev => [...prev, { role: 'assistant', content: replyText }]);
      speakText(replyText);
    } catch (error) {
      console.error('[VoiceChat] Failed to send to agent:', error);
      setStatus('idle');
    }
  };

  // 状态显示文本
  const statusText = {
    idle: '点击麦克风开始说话',
    listening: '正在聆听，点击停止...',
    processing: '处理中...',
    speaking: '正在播放...',
  };

  return (
    <div style={{
      padding: '24px',
      maxWidth: '600px',
      margin: '0 auto',
    }}>
      {/* 语音选择 */}
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <label style={{ fontSize: '14px', color: '#666' }}>音色:</label>
        <select
          value={selectedVoice}
          onChange={(e) => setSelectedVoice(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #ddd',
            fontSize: '14px',
            minWidth: '200px',
          }}
        >
          {voices.map(v => (
            <option key={v.name} value={v.name}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
      </div>

      {/* 消息列表 */}
      <div style={{
        height: '300px',
        overflowY: 'auto',
        border: '1px solid #eee',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
        background: '#fafafa',
      }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#999', padding: '40px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎤</div>
            <div>点击麦克风开始语音对话</div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{
            textAlign: msg.role === 'user' ? 'right' : 'left',
            margin: '12px 0',
          }}>
            <span style={{ fontSize: '20px', marginRight: '8px' }}>
              {msg.role === 'user' ? '👤' : '🤖'}
            </span>
            <span style={{
              display: 'inline-block',
              padding: '10px 16px',
              borderRadius: '12px',
              background: msg.role === 'user' ? '#007bff' : '#fff',
              color: msg.role === 'user' ? '#fff' : '#333',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              maxWidth: '80%',
              wordBreak: 'break-word',
            }}>
              {msg.content}
            </span>
          </div>
        ))}
        {status === 'listening' && (
          <div style={{ textAlign: 'center', color: '#007bff', padding: '12px' }}>
            🔴 正在聆听...
          </div>
        )}
        {status === 'processing' && (
          <div style={{ textAlign: 'center', color: '#666', padding: '12px' }}>
            ⏳ 处理中...
          </div>
        )}
        {status === 'speaking' && (
          <div style={{ textAlign: 'center', color: '#28a745', padding: '12px' }}>
            🔊 播放中...
          </div>
        )}
      </div>

      {/* 文字输入 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="输入文字消息..."
          disabled={status !== 'idle'}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid #ddd',
            fontSize: '14px',
          }}
        />
        <button
          onClick={handleSend}
          disabled={status !== 'idle' || !inputText.trim()}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            background: inputText.trim() && status === 'idle' ? '#007bff' : '#ccc',
            color: 'white',
            cursor: inputText.trim() && status === 'idle' ? 'pointer' : 'not-allowed',
            fontSize: '14px',
          }}
        >
          发送
        </button>
      </div>

      {/* 麦克风按钮 - 点击开始/停止 */}
      <div style={{ textAlign: 'center' }}>
        <button
          onClick={toggleRecording}
          disabled={status !== 'idle' && status !== 'listening'}
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            border: status === 'listening' ? '4px solid #dc3545' : '3px solid #007bff',
            background: status === 'listening' ? '#ffebee' : status === 'speaking' ? '#e8f5e9' : '#f0f0f0',
            fontSize: '32px',
            cursor: (status === 'idle' || status === 'listening') ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {status === 'idle' ? '🎤' : status === 'listening' ? '🔴' : status === 'speaking' ? '🔊' : '⏳'}
        </button>
        <div style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>
          {statusText[status]}
        </div>
      </div>
    </div>
  );
}

export default VoiceChat;

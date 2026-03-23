/**
 * Voice API - 前端语音服务
 */

// 音色选项
export interface VoiceOption {
  id: string;
  name: string;
  language: string;
}

// 获取 MiniMax 可用音色
export async function getMiniMaxVoices(): Promise<VoiceOption[]> {
  try {
    const response = await fetch('/api/v1/voice/voices/minimax');
    const data = await response.json();
    return data.voices || [];
  } catch (error) {
    console.error('Failed to fetch MiniMax voices:', error);
    return [];
  }
}

// 浏览器原生 TTS - 直接播放
export function speakWithBrowserTTS(
  text: string,
  options: {
    voice_id?: string;
    speed?: number;
  } = {},
  onEnd?: () => void
): void {
  const { speed = 1.0 } = options;

  // 取消当前正在进行的语音
  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = speed;

  // 尝试找中文语音
  const voices = speechSynthesis.getVoices();
  const chineseVoice = voices.find(v => v.lang.startsWith('zh'));
  if (chineseVoice) {
    utterance.voice = chineseVoice;
  }

  utterance.onend = () => {
    onEnd?.();
  };

  utterance.onerror = (e) => {
    console.error('[Browser TTS] Error:', e);
    onEnd?.();
  };

  speechSynthesis.speak(utterance);
}

// 音色映射 - MiniMax 到浏览器语音
const VOICE_MAPPING: Record<string, string> = {
  'male-qn-qingse': 'zh-CN-XiaoxiaoNeural',
  'female-shaonv': 'zh-CN-XiaoyouNeural',
  'male-qn-jingying': 'zh-CN-YunxiNeural',
  'female-yujie': 'zh-CN-XiaoxiaoNeural',
  'male-qn-badao': 'zh-CN-YunyangNeural',
  'female-chengshu': 'zh-CN-XiaoxiaoNeural',
  'female-tianmei': 'zh-CN-XiaoxiaoNeural',
};

// 使用 MiniMax TTS 生成语音
export async function synthesizeSpeech(
  text: string,
  options: {
    voice_id?: string;
    speed?: number;
    emotion?: string;
  } = {}
): Promise<Blob> {
  const { voice_id = 'male-qn-qingse', speed = 1.0, emotion = 'calm' } = options;

  try {
    // 先尝试 MiniMax TTS
    const response = await fetch('/api/v1/voice/tts/minimax', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voice_id,
        speed,
        emotion,
        format: 'mp3',
      }),
    });

    if (!response.ok) {
      throw new Error(`MiniMax TTS failed: ${response.statusText}`);
    }

    // 返回音频 blob
    const blob = await response.blob();
    return blob;
  } catch (error) {
    console.warn('[TTS] MiniMax failed:', error);
    throw new Error('TTS service unavailable. Please check your network connection.');
  }
}

// 浏览器原生 TTS 播放（后备方案）
let browserTTSPlaying = false;

export function playWithBrowserTTS(
  text: string,
  voiceId: string = 'male-qn-qingse',
  onEnd?: () => void
): void {
  // 取消之前的播放
  if (browserTTSPlaying) {
    speechSynthesis.cancel();
  }

  browserTTSPlaying = true;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 1.0;

  // 尝试找中文语音
  const voices = speechSynthesis.getVoices();
  const chineseVoice = voices.find(v => v.lang.startsWith('zh'));
  if (chineseVoice) {
    utterance.voice = chineseVoice;
  }

  utterance.onend = () => {
    browserTTSPlaying = false;
    onEnd?.();
  };

  utterance.onerror = (e) => {
    console.error('[Browser TTS] Error:', e);
    browserTTSPlaying = false;
    onEnd?.();
  };

  speechSynthesis.speak(utterance);
}

export function stopBrowserTTS(): void {
  speechSynthesis.cancel();
  browserTTSPlaying = false;
}

// 播放音频
export function playAudio(blob: Blob): HTMLAudioElement {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);

  audio.onended = () => {
    URL.revokeObjectURL(url);
  };

  audio.onerror = () => {
    URL.revokeObjectURL(url);
    console.error('Audio playback error');
  };

  audio.play();
  return audio;
}

// 停止音频
export function stopAudio(audio: HTMLAudioElement | null): void {
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
}

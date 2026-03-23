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
    throw new Error(`TTS failed: ${response.statusText}`);
  }

  // 返回音频 blob
  const blob = await response.blob();
  return blob;
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

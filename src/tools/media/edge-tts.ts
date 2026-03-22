/**
 * Edge TTS 服务
 *
 * 微软 Edge 浏览器的文本转语音服务
 * 免费、高质量、支持多种语言和音色
 */

import { getVoices, tts, ttsSave, type Voice, type options } from 'edge-tts';

export interface EdgeTTSVoice {
  Name: string;
  ShortName: string;
  Gender: string;
  Language: string;
  FriendlyName: string;
}

/** 中文语音推荐 */
export const CHINESE_VOICES: Record<string, string> = {
  '晓晓': 'zh-CN-XiaoxiaoNeural',
  '晓伊': 'zh-CN-XiaoyiNeural',
  '云扬': 'zh-CN-YunyangNeural',
  '云希': 'zh-CN-YunxiNeural',
  '云飞': 'zh-CN-YunfeiNeural',
  '康康': 'zh-CN-KangkangNeural',
};

/** 英文语音推荐 */
export const ENGLISH_VOICES: Record<string, string> = {
  'Jenny': 'en-US-JennyNeural',
  'Guy': 'en-US-GuyNeural',
  'Aria': 'en-US-AriaNeural',
};

/**
 * Edge TTS 服务类
 */
export class EdgeTTSService {
  private defaultVoice: string = 'zh-CN-XiaoxiaoNeural';
  private defaultRate: string = '+0%';
  private defaultPitch: string = '+0Hz';
  private defaultVolume: string = '+0%';

  setDefaultVoice(voice: string): void {
    this.defaultVoice = voice;
  }

  async getVoices(): Promise<EdgeTTSVoice[]> {
    const voices = await getVoices();
    return voices.map(v => ({
      Name: v.Name,
      ShortName: v.ShortName,
      Gender: v.Gender,
      Language: v.Locale,
      FriendlyName: v.FriendlyName,
    }));
  }

  async synthesize(
    text: string,
    options_: {
      voice?: string;
      rate?: string;
      pitch?: string;
      volume?: string;
    } = {}
  ): Promise<Buffer> {
    const {
      voice = this.defaultVoice,
      rate = this.defaultRate,
      pitch = this.defaultPitch,
      volume = this.defaultVolume,
    } = options_;

    const ttsOptions: options = { voice, rate, pitch, volume };
    return await tts(text, ttsOptions);
  }

  async saveToFile(
    text: string,
    filePath: string,
    options_: {
      voice?: string;
      rate?: string;
      pitch?: string;
      volume?: string;
    } = {}
  ): Promise<void> {
    const {
      voice = this.defaultVoice,
      rate = this.defaultRate,
      pitch = this.defaultPitch,
      volume = this.defaultVolume,
    } = options_;

    const ttsOptions: options = { voice, rate, pitch, volume };
    await ttsSave(text, filePath, ttsOptions);
  }
}

export const edgeTTSService = new EdgeTTSService();

export function createEdgeTTSService(config?: {
  defaultVoice?: string;
}): EdgeTTSService {
  const service = new EdgeTTSService();
  if (config?.defaultVoice) {
    service.setDefaultVoice(config.defaultVoice);
  }
  return service;
}

export async function speakChinese(
  text: string,
  voiceName: keyof typeof CHINESE_VOICES = '晓晓'
): Promise<Buffer> {
  const voice = CHINESE_VOICES[voiceName] || CHINESE_VOICES['晓晓'];
  return await edgeTTSService.synthesize(text, { voice });
}

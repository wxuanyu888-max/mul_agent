/**
 * MiniMax TTS WebSocket 服务
 *
 * 使用 MiniMax 同步语音合成 WebSocket API
 * 文档: https://platform.minimaxi.com/docs/llms.txt
 */

import { LLMProviderConfig } from '../../providers/types.js';

// MiniMax API 配置
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || '';
const MINIMAX_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.minimax.chat';

// 默认音色配置
export interface MiniMaxVoice {
  id: string;
  name: string;
  language: string;
}

// 可用的音色列表
export const MINIMAX_VOICES: MiniMaxVoice[] = [
  { id: 'male-qn-qingse', name: '青涩少年', language: 'Chinese' },
  { id: 'female-shaonv', name: '活泼少女', language: 'Chinese' },
  { id: 'male-qn-jingying', name: '精英青年', language: 'Chinese' },
  { id: 'female-yujie', name: '温柔御姐', language: 'Chinese' },
  { id: 'male-qn-badao', name: '霸道总裁', language: 'Chinese' },
  { id: 'female-chengshu', name: '成书', language: 'Chinese' },
  { id: 'female-tianmei', name: '天美', language: 'Chinese' },
  { id: 'male-qn-jingking', name: '京儿', language: 'Chinese' },
  // 英文音色
  { id: 'English_Graceful_Lady', name: 'Graceful Lady', language: 'English' },
  { id: 'English_Persuasive_Man', name: 'Persuasive Man', language: 'English' },
];

interface TTSOptions {
  voice_id?: string;
  speed?: number;
  vol?: number;
  pitch?: number;
  emotion?: string;
  format?: 'mp3' | 'pcm' | 'flac';
  sample_rate?: number;
}

export class MiniMaxTTSService {
  private apiKey: string;
  private baseUrl: string;

  constructor(config?: LLMProviderConfig) {
    this.apiKey = config?.apiKey || MINIMAX_API_KEY;
    this.baseUrl = config?.baseUrl || MINIMAX_BASE_URL;
  }

  /**
   * 合成语音
   */
  async synthesize(text: string, options: TTSOptions = {}): Promise<Buffer> {
    const {
      voice_id = 'male-qn-qingse',
      speed = 1.0,
      vol = 1.0,
      pitch = 0,
      emotion = 'calm',
      format = 'mp3',
      sample_rate = 32000,
    } = options;

    // 构建 WebSocket URL
    const wsUrl = `wss://api.minimax.com/ws/v1/t2a_v2?group=${this.apiKey}&character=${voice_id}`;

    return new Promise((resolve, reject) => {
      const ws = new (require('ws'))(wsUrl) as any;

      let audioChunks: Buffer[] = [];
      let connected = false;
      let taskStarted = false;
      let finished = false;

      const cleanup = () => {
        if (ws.readyState === ws.OPEN) {
          ws.close();
        }
      };

      ws.on('open', () => {
        console.log('[MiniMax TTS] WebSocket connected');
        connected = true;

        // 发送任务开始
        ws.send(
          JSON.stringify({
            event: 'task_start',
            model: 'speech-2.8-turbo',
            voice_setting: {
              voice_id,
              speed,
              vol,
              pitch,
              emotion,
            },
            audio_setting: {
              sample_rate,
              format,
              bitrate: 128000,
              channel: 1,
            },
            language_boost: 'Chinese',
          })
        );
      });

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          const event = message.event;

          switch (event) {
            case 'connected_success':
              console.log('[MiniMax TTS] Connected successfully');
              break;

            case 'task_started':
              console.log('[MiniMax TTS] Task started');
              taskStarted = true;
              // 发送文本
              ws.send(
                JSON.stringify({
                  event: 'task_continue',
                  text,
                })
              );
              break;

            case 'task_continued':
              // 接收音频数据
              if (message.data?.audio) {
                const audioBuffer = Buffer.from(message.data.audio, 'hex');
                audioChunks.push(audioBuffer);
              }
              if (message.is_final) {
                finished = true;
                // 发送任务结束
                ws.send(JSON.stringify({ event: 'task_finish' }));
              }
              break;

            case 'task_finished':
              console.log('[MiniMax TTS] Task finished, audio chunks:', audioChunks.length);
              cleanup();
              resolve(Buffer.concat(audioChunks));
              break;

            case 'task_failed':
              console.error('[MiniMax TTS] Task failed:', message.base_resp);
              cleanup();
              reject(new Error(`TTS failed: ${message.base_resp?.status_msg}`));
              break;

            default:
              console.log('[MiniMax TTS] Unknown event:', event);
          }
        } catch (error) {
          console.error('[MiniMax TTS] Parse error:', error);
        }
      });

      ws.on('error', (error: Error) => {
        console.error('[MiniMax TTS] WebSocket error:', error);
        cleanup();
        reject(error);
      });

      ws.on('close', () => {
        if (!finished) {
          console.log('[MiniMax TTS] Connection closed');
        }
      });

      // 超时处理
      setTimeout(() => {
        if (!finished) {
          console.error('[MiniMax TTS] Timeout');
          cleanup();
          reject(new Error('TTS timeout'));
        }
      }, 30000);
    });
  }

  /**
   * 获取可用音色列表
   */
  getVoices(): MiniMaxVoice[] {
    return MINIMAX_VOICES;
  }
}

// 默认实例
export const miniMaxTTSService = new MiniMaxTTSService();

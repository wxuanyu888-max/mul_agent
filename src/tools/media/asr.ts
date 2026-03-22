/**
 * ASR 服务
 *
 * 自动语音识别 (Automatic Speech Recognition)
 * 支持多种方案：OpenAI Whisper / Whisper.cpp (本地) / Google STT
 */

import { exec } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export interface ASRResult {
  text: string;
  language?: string;
  confidence?: number;
}

export interface ASRConfig {
  /** 方案: whisper-api (OpenAI), whisper-local (whisper.cpp), google */
  provider?: 'whisper-api' | 'whisper-local' | 'google';
  /** 语言代码 */
  language?: string;
  /** whisper.cpp 路径 */
  whisperPath?: string;
  /** 模型路径 */
  modelPath?: string;
}

/**
 * ASR 服务类
 */
export class ASRService {
  private config: Required<ASRConfig>;

  constructor(config: ASRConfig = {}) {
    this.config = {
      provider: config.provider ?? 'whisper-local',
      language: config.language ?? 'zh',
      whisperPath: config.whisperPath ?? '/Users/agent/whisper.cpp/build/bin/whisper-cli',
      modelPath: config.modelPath ?? '/Users/agent/whisper-models/ggml-base.bin',
    };
  }

  /**
   * 使用 OpenAI Whisper API
   */
  async recognizeWithWhisperAPI(audioBuffer: Buffer): Promise<ASRResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const base64 = audioBuffer.toString('base64');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'whisper-1',
        language: this.config.language === 'zh' ? 'zh' : 'en',
        file: `data:audio/webm;base64,${base64}`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Whisper API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as { text: string };
    return { text: data.text, language: this.config.language };
  }

  /**
   * 使用本地 whisper.cpp
   */
  async recognizeWithWhisperLocal(audioBuffer: Buffer): Promise<ASRResult> {
    return new Promise((resolve, reject) => {
      const tempInput = join(tmpdir(), `asr_input_${Date.now()}.webm`);
      const tempWav = join(tmpdir(), `asr_input_${Date.now()}.wav`);
      const tempOutput = join(tmpdir(), `asr_output_${Date.now()}.txt`);

      // 先保存输入文件 (webm格式)
      writeFile(tempInput, audioBuffer)
        .then(() => {
          // 使用 ffmpeg 转换为 wav 格式
          const convertCmd = `ffmpeg -y -i ${tempInput} -ar 16000 -ac 1 -c:a pcm_s16le ${tempWav}`;

          return new Promise<void>((resolveConv, rejectConv) => {
            exec(convertCmd, { timeout: 30000 }, async (error, _stdout, stderr) => {
              if (error) {
                console.error('[ASR] FFmpeg conversion error:', stderr);
                rejectConv(new Error(`FFmpeg error: ${stderr || error.message}`));
                return;
              }

              // 删除原始 webm 文件
              await unlink(tempInput).catch(() => {});

              const lang = this.config.language === 'zh' ? 'zh' : 'en';
              const cmd = `${this.config.whisperPath} -m ${this.config.modelPath} -f ${tempWav} -l ${lang} -otxt -o ${tempOutput.replace('.txt', '')}`;

              exec(cmd, { timeout: 120000 }, async (whisperError, _wstdout, wstderr) => {
                // 清理临时文件
                await unlink(tempWav).catch(() => {});

                if (whisperError) {
                  rejectConv(new Error(`Whisper error: ${wstderr || whisperError.message}`));
                  return;
                }

                try {
                  const { readFile } = await import('node:fs/promises');
                  const text = await readFile(tempOutput, 'utf-8');
                  await unlink(tempOutput).catch(() => {});

                  resolveConv();
                  resolve({
                    text: text.trim(),
                    language: this.config.language,
                  });
                } catch (readError) {
                  rejectConv(new Error(`Failed to read output: ${readError}`));
                }
              });
            });
          });
        })
        .catch(reject);
    });
  }

  /**
   * 使用 Google Speech-to-Text
   */
  async recognizeWithGoogle(audioBuffer: Buffer): Promise<ASRResult> {
    const apiKey = process.env.GOOGLE_SPEECH_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_SPEECH_API_KEY not configured');
    }

    const base64 = audioBuffer.toString('base64');

    const response = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          encoding: 'WEBM_OPUS',
          sampleRateHertz: 48000,
          languageCode: this.config.language === 'zh' ? 'zh-CN' : 'en-US',
        },
        audio: { content: base64 },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google STT error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      results?: Array<{
        alternatives?: Array<{ transcript: string; confidence?: number }>;
      }>;
    };

    const result = data.results?.[0]?.alternatives?.[0];
    if (!result) {
      throw new Error('No speech recognized');
    }

    return {
      text: result.transcript,
      language: this.config.language,
      confidence: result.confidence,
    };
  }

  /**
   * 通用识别接口
   */
  async recognize(audioBuffer: Buffer): Promise<ASRResult> {
    switch (this.config.provider) {
      case 'whisper-local':
        return this.recognizeWithWhisperLocal(audioBuffer);
      case 'google':
        return this.recognizeWithGoogle(audioBuffer);
      default:
        return this.recognizeWithWhisperAPI(audioBuffer);
    }
  }

  /**
   * 从 URL 识别
   */
  async recognizeFromUrl(url: string): Promise<ASRResult> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return this.recognize(buffer);
  }
}

export const asrService = new ASRService();

export function createASRService(config?: ASRConfig): ASRService {
  return new ASRService(config);
}

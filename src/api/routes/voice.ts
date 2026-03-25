/**
 * 语音 API 路由
 *
 * TTS 和语音对话接口
 */

import { Router, type Request, type Response } from 'express';
import { edgeTTSService, CHINESE_VOICES, ENGLISH_VOICES } from '../../tools/media/edge-tts.js';
import { miniMaxTTSService, MINIMAX_VOICES } from '../../tools/media/minimax-tts.js';
import { asrService } from '../../tools/media/asr.js';
import { createAgentLoop } from '../../agents/loop.js';

const router: Router = Router();

// ============================================
// ASR 接口 (语音识别)
// ============================================

/**
 * POST /api/v1/voice/asr
 * 语音识别 (音频转文字)
 */
router.post('/asr', async (req: Request, res: Response) => {
  try {
    const { audio } = req.body; // base64 编码的音频

    if (!audio) {
      return res.status(400).json({ error: 'audio (base64) is required' });
    }

    // 解码 base64
    const audioBuffer = Buffer.from(audio, 'base64');

    // 识别
    let result;
    try {
      result = await asrService.recognize(audioBuffer);
    } catch (err) {
      return res.status(500).json({
        error: `ASR recognition failed: ${err instanceof Error ? err.message : String(err)}`,
        details: 'Please check your audio format or try a different ASR provider'
      });
    }

    res.json({
      text: result.text,
      language: result.language,
      confidence: result.confidence,
    });
  } catch (error) {
    console.error('[Voice API] ASR error:', error);
    res.status(500).json({ error: `ASR failed: ${error}` });
  }
});

// ============================================
// TTS 接口
// ============================================

/**
 * POST /api/v1/voice/tts
 * 文本转语音
 */
router.post('/tts', async (req: Request, res: Response) => {
  try {
    const { text, voice = '晓晓', rate = '+0%', pitch = '+0Hz' } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    // 解析语音
    const voiceMap = { ...CHINESE_VOICES, ...ENGLISH_VOICES };
    const voiceId = voiceMap[voice] || voice;

    const audioBuffer = await edgeTTSService.synthesize(text, { voice: voiceId, rate, pitch });

    res.setHeader('Content-Type', 'audio/mp3');
    res.setHeader('Content-Disposition', 'attachment; filename="speech.mp3"');
    res.send(audioBuffer);
  } catch (error) {
    console.error('[Voice API] TTS error:', error);
    res.status(500).json({ error: `TTS failed: ${error}` });
  }
});

/**
 * GET /api/v1/voice/voices
 * 获取可用语音列表
 */
router.get('/voices', async (_req: Request, res: Response) => {
  try {
    const voices = await edgeTTSService.getVoices();
    res.json({
      voices: voices.slice(0, 30),
      recommended: {
        chinese: Object.keys(CHINESE_VOICES),
        english: Object.keys(ENGLISH_VOICES),
      },
    });
  } catch (error) {
    console.error('[Voice API] Get voices error:', error);
    res.status(500).json({ error: `Failed: ${error}` });
  }
});

// ============================================
// MiniMax TTS 接口
// ============================================

/**
 * POST /api/v1/voice/tts/minimax
 * MiniMax 文本转语音
 */
router.post('/tts/minimax', async (req: Request, res: Response) => {
  try {
    const {
      text,
      voice_id = 'male-qn-qingse',
      speed = 1.0,
      vol = 1.0,
      pitch = 0,
      emotion = 'calm',
      format = 'mp3',
    } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const audioBuffer = await miniMaxTTSService.synthesize(text, {
      voice_id,
      speed,
      vol,
      pitch,
      emotion,
      format: format as 'mp3' | 'pcm' | 'flac',
    });

    const contentType = format === 'mp3' ? 'audio/mp3' : format === 'wav' ? 'audio/wav' : format === 'flac' ? 'audio/flac' : 'audio/mp3';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'attachment; filename="speech.mp3"');
    res.send(audioBuffer);
  } catch (error) {
    console.error('[Voice API] MiniMax TTS error:', error);
    res.status(500).json({ error: `MiniMax TTS failed: ${error}` });
  }
});

/**
 * GET /api/v1/voice/voices/minimax
 * 获取 MiniMax 可用语音列表
 */
router.get('/voices/minimax', async (_req: Request, res: Response) => {
  try {
    const voices = miniMaxTTSService.getVoices();
    res.json({
      voices,
      recommended: {
        chinese: voices.filter(v => v.language === 'Chinese').map(v => v.id),
        english: voices.filter(v => v.language === 'English').map(v => v.id),
      },
    });
  } catch (error) {
    console.error('[Voice API] Get MiniMax voices error:', error);
    res.status(500).json({ error: `Failed: ${error}` });
  }
});

// ============================================
// 语音对话接口
// ============================================

/**
 * POST /api/v1/voice/chat
 * 语音对话
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, voice = '晓晓', language = 'zh' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    // 创建 Agent
    const agent = createAgentLoop({
      sessionId: `voice_${Date.now()}`,
    });

    // 调用 Agent
    const result = await agent.run({ message });

    // 获取回复文本
    const responseText = result.content || '';

    // 生成语音
    const voiceMap = { ...CHINESE_VOICES, ...ENGLISH_VOICES };
    const voiceId = voiceMap[voice] || voice;
    const audioBuffer = await edgeTTSService.synthesize(responseText, { voice: voiceId });

    // 返回 JSON + 音频
    res.setHeader('Content-Type', 'audio/mp3');
    res.setHeader('Content-Disposition', 'attachment; filename="response.mp3"');
    res.send(audioBuffer);
  } catch (error) {
    console.error('[Voice API] Chat error:', error);
    res.status(500).json({ error: `Chat failed: ${error}` });
  }
});

/**
 * POST /api/v1/voice/chat/stream
 * 流式语音对话
 */
router.post('/chat/stream', async (req: Request, res: Response) => {
  try {
    const { message, voice = '晓晓' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    // 创建 Agent
    const agent = createAgentLoop({
      sessionId: `voice_${Date.now()}`,
    });

    // 调用 Agent
    const result = await agent.run({ message });
    const responseText = result.content || '';

    // 流式返回语音
    res.setHeader('Content-Type', 'audio/mp3');
    res.setHeader('Transfer-Encoding', 'chunked');

    // 分句处理
    const sentences = responseText.split(/([。！？；\n]+)/);
    let currentSentence = '';
    const voiceMap = { ...CHINESE_VOICES, ...ENGLISH_VOICES };
    const voiceId = voiceMap[voice] || voice;

    for (const part of sentences) {
      if (part.match(/[。！？；\n]+/)) {
        if (currentSentence.trim()) {
          const audio = await edgeTTSService.synthesize(currentSentence.trim(), { voice: voiceId });
          res.write(audio);
        }
        currentSentence = '';
      } else {
        currentSentence += part;
      }
    }

    if (currentSentence.trim()) {
      const audio = await edgeTTSService.synthesize(currentSentence.trim(), { voice: voiceId });
      res.write(audio);
    }

    res.end();
  } catch (error) {
    console.error('[Voice API] Stream chat error:', error);
    res.status(500).json({ error: `Stream chat failed: ${error}` });
  }
});

export default router;

export function createVoiceRouter(): Router {
  return router;
}

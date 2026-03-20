// 视频分析工具 - 支持在线和本地视频
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { jsonResult, errorResult } from "../types.js";
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

// 工作区路径
const WORKSPACE_DIR = 'storage/workspace';

// 工具依赖检查
async function checkDependencies(): Promise<{ ffmpeg: boolean; whisper: boolean; ytdlp: boolean }> {
  const results = { ffmpeg: false, whisper: false, ytdlp: false };

  try {
    const { stdout } = await execAsync('which ffmpeg');
    results.ffmpeg = !!stdout.trim();
  } catch { }

  try {
    const { stdout } = await execAsync('which whisper');
    results.whisper = !!stdout.trim();
  } catch { }

  try {
    const { stdout } = await execAsync('which yt-dlp');
    results.ytdlp = !!stdout.trim();
  } catch { }

  return results;
}

/**
 * 获取视频字幕（优先）
 */
/**
 * 获取视频字幕（优先从浏览器Cookie获取）
 */
async function getSubtitles(url: string, targetDir: string): Promise<{
  success: boolean;
  files?: string[];
  error?: string;
  usedCookies?: boolean;
}> {
  // 尝试从浏览器导出 cookie
  const browsers = ['chrome', 'safari', 'firefox', 'edge', 'brave'];

  for (const browser of browsers) {
    try {
      // 尝试用浏览器 cookie
      await execAsync(
        `yt-dlp --cookies-from-browser ${browser} --write-subs --write-auto-subs --sub-lang ai-zh,zh,en,zh-CN,zh-TW --skip-download -o "${targetDir}/video.%(ext)s" "${url}"`,
        { timeout: 120000 }
      );

      // 查找字幕文件（排除 _meta.json）
      const files = await fs.readdir(targetDir);
      const subtitleFiles = files.filter(f =>
        (f.endsWith('.srt') || f.endsWith('.vtt') || f.endsWith('.ass')) && !f.startsWith('_')
      );

      if (subtitleFiles.length > 0) {
        return { success: true, files: subtitleFiles, usedCookies: true };
      }
    } catch {
      // 继续尝试下一个浏览器
      continue;
    }
  }

  // 如果没有浏览器 cookie，尝试直接获取（可能没有字幕）
  try {
    await execAsync(
      `yt-dlp --write-subs --write-auto-subs --sub-lang zh,en,zh-CN,zh-TW --skip-download -o "${targetDir}/video.%(ext)s" "${url}"`,
      { timeout: 120000 }
    );

    const files = await fs.readdir(targetDir);
    const subtitleFiles = files.filter(f =>
      (f.endsWith('.srt') || f.endsWith('.vtt') || f.endsWith('.ass')) && !f.startsWith('_')
    );

    if (subtitleFiles.length > 0) {
      return { success: true, files: subtitleFiles, usedCookies: false };
    }

    return { success: false, error: 'No subtitles available for this video' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * 字幕转换为纯文本
 */
/**
 * 转换字幕为纯文本（无时间版本）
 */
async function convertSubtitlesToText(subtitlePath: string): Promise<string> {
  try {
    const ext = path.extname(subtitlePath).toLowerCase();
    const content = await fs.readFile(subtitlePath, 'utf-8');

    if (ext === '.json') {
      // YouTube json 格式
      const data = JSON.parse(content);
      if (data.events) {
        // YouTube sbv format
        return data.events
          .map((e: { segs?: Array<{ utf8: string }> }) => e.segs?.map((s: { utf8: string }) => s.utf8).join(''))
          .join('\n');
      }
    }

    if (ext === '.srt' || ext === '.vtt') {
      // 简单处理：移除时间标签和序号
      return content
        .replace(/^\d+\s*\n\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}\s*\n/gm, '')
        .replace(/^WEBVTT\s*\n/g, '')
        .replace(/<[^>]+>/g, '')
        .trim();
    }

    if (ext === '.ass') {
      return content
        .split('\n')
        .filter(line => line.startsWith('Dialogue:'))
        .map(line => line.replace(/^Dialogue:\s*\d+,\d+:\d+:\d+\.\d+,\d+:\d+:\d+\.\d+,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,(.+)/, '$1'))
        .join('\n');
    }

    return content;
  } catch {
    return '';
  }
}

/**
 * 生成简洁版字幕（带标题和描述）
 */
async function convertSubtitlesToSimple(subtitlePath: string, title: string, description?: string): Promise<string> {
  const text = await convertSubtitlesToText(subtitlePath);

  // 构建标题部分
  let result = `# ${title}`;

  if (description) {
    result += `\n${description}`;
  }

  result += '\n---\n';

  // 按行分割，移除空行，用 " | " 连接
  const lines = text.split('\n').filter(line => line.trim());
  result += lines.join(' | ');

  return result;
}

/**
 * 获取视频信息（用于字幕文件）
 */
async function getVideoInfo(url: string): Promise<{ title: string; description?: string }> {
  try {
    const { stdout: title } = await execAsync(
      `yt-dlp --print title "${url}"`,
      { timeout: 60000 }
    );

    // 获取描述（只取前500字符）
    let description = '';
    try {
      const { stdout: desc } = await execAsync(
        `yt-dlp --print description "${url}"`,
        { timeout: 60000 }
      );
      description = desc.trim().substring(0, 500);
    } catch {
      // 没有描述也无所谓
    }

    return { title: title.trim(), description: description || undefined };
  } catch {
    return { title: 'Unknown' };
  }
}

/**
 * 从 URL 下载视频/音频
 */
async function downloadVideo(url: string, targetDir: string): Promise<{
  success: boolean;
  file?: string;
  error?: string;
  format?: string;
}> {
  try {
    // 使用 yt-dlp 最佳质量音频
    const outputPath = path.join(targetDir, 'video.%(ext)s');

    // 下载最佳音频
    await execAsync(
      `yt-dlp -f "bestaudio/best" -o "${outputPath}" "${url}"`,
      { timeout: 300000 }
    );

    // 查找实际下载的文件
    const files = await fs.readdir(targetDir);
    const videoFile = files.find(f => f.startsWith('video.'));
    if (!videoFile) {
      return { success: false, error: 'No video file downloaded' };
    }

    const ext = path.extname(videoFile);
    return { success: true, file: path.join(targetDir, videoFile), format: ext.slice(1) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * 使用 FFmpeg 提取音频
 */
async function extractAudio(videoPath: string, audioPath: string): Promise<boolean> {
  // 检查视频文件是否存在
  try {
    await fs.access(videoPath);
  } catch {
    return false;
  }

  // 先尝试直接复制音频流（最简单）
  try {
    await execAsync(
      `ffmpeg -i "${videoPath}" -vn -acodec copy "${audioPath}" -y`,
      { timeout: 300000 }
    );
    return true;
  } catch { }

  // 如果复制失败，尝试转码为 mp3
  try {
    await execAsync(
      `ffmpeg -i "${videoPath}" -vn -acodec libmp3lame -q:a 2 "${audioPath}" -y`,
      { timeout: 300000 }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * 使用 Whisper 转写音频
 */
async function transcribeAudio(audioPath: string, outputPath: string): Promise<{
  success: boolean;
  file?: string;
  error?: string;
}> {
  try {
    // 使用 tiny 模型（最快）
    await execAsync(
      `whisper "${audioPath}" --output_dir "${outputPath}" --output_format json --model tiny`,
      { timeout: 600000 }
    );

    // Whisper 会生成 .json 和 .txt 文件
    const baseName = path.basename(audioPath, path.extname(audioPath));
    const txtPath = path.join(outputPath, `${baseName}.txt`);

    // 读取转写结果
    try {
      await fs.readFile(txtPath, 'utf-8');
    } catch { }

    return { success: true, file: path.join(outputPath, `${baseName}.json`) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * 生成唯一目录名（按 session 划分）
 */
function generateDirName(prefix: string, sessionId?: string): string {
  if (sessionId) {
    // 按 session 划分：sessionId/prefix_timestamp
    const hash = crypto.createHash('md5').update(prefix + Date.now().toString()).digest('hex').substring(0, 6);
    return `${sessionId}/${prefix}_${Date.now().toString(36)}_${hash}`;
  }
  // 兼容旧版本：无 sessionId 时使用全局目录
  const hash = crypto.createHash('md5').update(Date.now().toString()).digest('hex').substring(0, 8);
  return `${prefix}_${Date.now().toString(36)}_${hash}`;
}

/**
 * 检测视频/音频文件信息
 */
async function getMediaInfo(filePath: string): Promise<Record<string, unknown>> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`
    );
    return JSON.parse(stdout);
  } catch {
    return {};
  }
}

// ============ 工具定义 ============

export function createVideoTool(sessionId?: string) {
  return {
    label: "Video",
    name: "video",
    description: "Analyze video: download online video or process local video, extract audio and transcribe speech",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["analyze", "transcribe", "info", "check-deps"],
          description: "Action: analyze (full pipeline), transcribe (audio only), info (get video info), check-deps (check dependencies)"
        },
        source: {
          type: "string",
          description: "Video URL (online) or file path (local). Examples: https://youtube.com/... or /path/to/video.mp4"
        },
        options: {
          type: "object",
          properties: {
            language: { type: "string", description: "Language code for transcription (e.g., en, zh, auto)" },
            model: { type: "string", enum: ["tiny", "base", "small", "medium", "large"], default: "tiny", description: "Whisper model size" },
            maxDuration: { type: "number", description: "Max video duration in seconds (default: 3600)" },
          }
        }
      },
      required: ["action"],
    },
    execute: async (_toolCallId: string, params: {
      action: "analyze" | "transcribe" | "info" | "check-deps";
      source?: string;
      options?: { language?: string; model?: string; maxDuration?: number };
    }) => {
      try {
        const { action, source, options = {} } = params;
        const { language: _language = "auto", model = "tiny", maxDuration = 3600 } = options;

        // 检查依赖
        if (action === "check-deps") {
          const deps = await checkDependencies();
          return jsonResult({
            dependencies: deps,
            message: deps.ffmpeg && deps.whisper
              ? "All dependencies available"
              : "Some dependencies missing. Install: ffmpeg, whisper (pip install whisper)"
          });
        }

        // 获取视频信息
        if (action === "info") {
          if (!source) {
            return errorResult("source is required for info action");
          }

          // 判断是 URL 还是本地文件
          const isUrl = source.startsWith('http://') || source.startsWith('https://');

          if (isUrl) {
            // 在线视频 - 使用 yt-dlp 获取信息
            try {
              // 使用 --print 单独获取每个字段
              const { stdout: title } = await execAsync(
                `yt-dlp --print title "${source}"`,
                { timeout: 60000 }
              );
              const { stdout: duration } = await execAsync(
                `yt-dlp --print duration_string "${source}"`,
                { timeout: 60000 }
              );
              const { stdout: uploader } = await execAsync(
                `yt-dlp --print uploader "${source}"`,
                { timeout: 60000 }
              );
              const { stdout: thumbnail } = await execAsync(
                `yt-dlp --print thumbnail "${source}"`,
                { timeout: 60000 }
              );

              return jsonResult({
                source,
                type: "online",
                title: title.trim(),
                duration: duration.trim(),
                uploader: uploader.trim(),
                thumbnail: thumbnail.trim(),
              });
            } catch (error) {
              return errorResult(`Failed to get video info: ${error}`);
            }
          } else {
            // 本地文件
            const info = await getMediaInfo(source);
            return jsonResult({
              source,
              type: "local",
              ...info,
            });
          }
        }

        // 转写或完整分析
        if (action === "transcribe" || action === "analyze") {
          if (!source) {
            return errorResult("source is required for transcribe/analyze action");
          }

          const isUrl = source.startsWith('http://') || source.startsWith('https://');

          // 检查依赖
          const deps = await checkDependencies();
          if (!deps.ffmpeg) {
            return errorResult("ffmpeg not found. Install: brew install ffmpeg");
          }
          if (isUrl && !deps.ytdlp) {
            return errorResult("yt-dlp not found. Install: pip install yt-dlp");
          }
          // whisper 检查移到后面，只有在没有字幕时才需要

          // 创建工作目录
          const dirName = generateDirName('video', sessionId);
          const targetDir = path.join(WORKSPACE_DIR, dirName);
          await fs.mkdir(targetDir, { recursive: true });

          const files: Array<{ name: string; path: string; description: string }> = [];

          // 保存元信息
          const metaInfo = {
            source,
            type: isUrl ? "online" : "local",
            action,
            language,
            model,
            analyzedAt: new Date().toISOString(),
          };
          await fs.writeFile(path.join(targetDir, '_meta.json'), JSON.stringify(metaInfo, null, 2), 'utf-8');
          files.push({ name: '_meta.json', path: `${targetDir}/_meta.json`, description: 'Analysis metadata' });

          let videoPath = source;
          let audioPath = '';

          // 优先：获取字幕（在线视频）
          let hasTranscript = false;
          if (isUrl) {
            // 获取视频信息
            const videoInfo = await getVideoInfo(source);

            const subtitleResult = await getSubtitles(source, targetDir);
            if (subtitleResult.success && subtitleResult.files && subtitleResult.files.length > 0) {
              // 原始字幕文件路径
              const subtitlePath = path.join(targetDir, subtitleResult.files[0]);

              // 1. 生成简洁版（标题 + 描述 + 对话，无时间）
              const simpleText = await convertSubtitlesToSimple(subtitlePath, videoInfo.title, videoInfo.description);
              await fs.writeFile(path.join(targetDir, 'transcript.txt'), simpleText, 'utf-8');
              files.push({
                name: 'transcript.txt',
                path: `${targetDir}/transcript.txt`,
                description: 'Subtitles (simple version: title + dialogue)'
              });

              // 2. 保留带时间版（复制原始字幕）
              const rawContent = await fs.readFile(subtitlePath, 'utf-8');
              await fs.writeFile(path.join(targetDir, 'transcript_raw.srt'), rawContent, 'utf-8');
              files.push({
                name: 'transcript_raw.srt',
                path: `${targetDir}/transcript_raw.srt`,
                description: 'Subtitles (with timestamps)'
              });

              hasTranscript = true;
            }
          }

          // 如果没有字幕，下载视频并提取音频
          if (!hasTranscript) {
            if (isUrl) {
              // 下载视频
              const downloadResult = await downloadVideo(source, targetDir);
              if (!downloadResult.success) {
                return errorResult(`Failed to download video: ${downloadResult.error}`);
              }
              videoPath = downloadResult.file || source;
              files.push({
                name: path.basename(videoPath),
                path: videoPath,
                description: `Downloaded video (${downloadResult.format})`
              });
            }

            // 提取音频
            const audioFileName = `audio.mp3`;
            audioPath = path.join(targetDir, audioFileName);

            const extractResult = await extractAudio(videoPath, audioPath);
            if (!extractResult) {
              return errorResult("Failed to extract audio from video");
            }
            files.push({
              name: audioFileName,
              path: audioPath,
              description: "Extracted audio"
            });
          }

          // 转写（仅 analyze 模式，且没有字幕时）
          if (action === "analyze" && !hasTranscript) {
            if (!deps.whisper) {
              // 没有字幕也没有 whisper，只返回音频
              return jsonResult({
                success: true,
                action,
                source,
                workspace: targetDir,
                files,
                message: "No subtitles available. Audio extracted but whisper not installed. Install whisper to transcribe: pip install openai-whisper"
              });
            }

            const transcriptDir = path.join(targetDir, 'transcript');
            await fs.mkdir(transcriptDir, { recursive: true });

            const transcribeResult = await transcribeAudio(audioPath, transcriptDir);
            if (transcribeResult.success && transcribeResult.file) {
              // 读取转写结果
              try {
                const baseName = path.basename(audioPath, path.extname(audioPath));
                const txtPath = path.join(transcriptDir, `${baseName}.txt`);
                const transcriptText = await fs.readFile(txtPath, 'utf-8');

                // 保存转写文本
                await fs.writeFile(path.join(targetDir, 'transcript.txt'), transcriptText, 'utf-8');
                files.push({
                  name: 'transcript.txt',
                  path: `${targetDir}/transcript.txt`,
                  description: 'Transcribed text (Whisper)'
                });

                // 保存详细 JSON
                const jsonPath = path.join(transcriptDir, `${baseName}.json`);
                const transcriptJson = await fs.readFile(jsonPath, 'utf-8');
                await fs.writeFile(path.join(targetDir, 'transcript.json'), transcriptJson, 'utf-8');
                files.push({
                  name: 'transcript.json',
                  path: `${targetDir}/transcript.json`,
                  description: 'Detailed transcription with timestamps'
                });
              } catch (_error) {
                // 转写文件可能不存在
              }
            } else {
              files.push({
                name: 'transcript_error.txt',
                path: `${targetDir}/transcript_error.txt`,
                description: `Transcription failed: ${transcribeResult.error}`
              });
            }
          }

          // 获取视频信息
          const mediaInfo = await getMediaInfo(videoPath);
          await fs.writeFile(path.join(targetDir, 'media_info.json'), JSON.stringify(mediaInfo, null, 2), 'utf-8');
          files.push({
            name: 'media_info.json',
            path: `${targetDir}/media_info.json`,
            description: 'Video/audio technical info (duration, codec, etc.)'
          });

          // 生成文件列表消息
          const fileListMsg = files.map(f => `- ${f.name}: ${f.path}`).join('\n');
          const message = action === "analyze"
            ? `Video analyzed! Files saved to session workspace:\n${fileListMsg}\n\nUse 'read' tool to read files by path.`
            : `Audio extracted! Use 'analyze' action to convert speech to text (requires whisper: pip install openai-whisper).`;

          return jsonResult({
            success: true,
            action,
            source,
            workspace: targetDir,
            files,
            message
          });
        }

        return errorResult(`Unknown action: ${action}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return errorResult(`Video tool failed: ${message}`);
      }
    },
  };
}

/**
 * lib/openai-images.ts
 *
 * Thin wrapper around the OpenAI Images API (gpt-image-1 / gpt-image-1.5).
 *
 * Returns base64-encoded image data internally. The base64 string is NEVER
 * logged or returned to API callers — callers receive only the final GitHub
 * URL and generation metadata.
 */

import { config } from "../config.js";
import type {
  GenerateImageInput,
  GenerateImageResult,
  ImageSize,
  ImageQuality,
  ImageOutputFormat,
} from "../types/index.js";

const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations";

export async function generateImageBase64(
  input: GenerateImageInput
): Promise<GenerateImageResult> {
  const model = config.openaiImageModel;
  const size = (input.size ?? config.defaultImageSize) as ImageSize;
  const quality = (input.quality ?? config.defaultImageQuality) as ImageQuality;
  const outputFormat = (input.outputFormat ?? config.defaultImageFormat) as ImageOutputFormat;

  const requestBody = {
    model,
    prompt: input.prompt,
    size,
    quality,
    output_format: outputFormat,
    response_format: "b64_json",
    n: 1,
  };

  const response = await fetch(OPENAI_IMAGES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openaiApiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  const text = await response.text();

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      `OpenAI: unexpected non-JSON response (status ${response.status})`
    );
  }

  if (!response.ok) {
    // Extract a human-readable error message from the OpenAI error envelope
    const errObj = data["error"] as Record<string, unknown> | undefined;
    const message = errObj?.["message"] ?? `HTTP ${response.status}`;
    throw new Error(`OpenAI image generation failed: ${message}`);
  }

  const imageData = (data["data"] as Array<Record<string, unknown>> | undefined)?.[0];
  if (!imageData) {
    throw new Error("OpenAI: response contained no image data");
  }

  const b64 = imageData["b64_json"] as string | undefined;
  if (!b64) {
    throw new Error("OpenAI: response missing b64_json field");
  }

  // Extract usage if present (gpt-image-1 returns usage)
  const rawUsage = data["usage"] as Record<string, unknown> | undefined;
  const usage = {
    input_tokens: (rawUsage?.["input_tokens"] as number) ?? 0,
    output_tokens: (rawUsage?.["output_tokens"] as number) ?? 0,
    total_tokens: (rawUsage?.["total_tokens"] as number) ?? 0,
  };

  return {
    b64, // base64 image bytes — NEVER log this value
    model,
    size,
    quality,
    outputFormat,
    usage,
  };
}

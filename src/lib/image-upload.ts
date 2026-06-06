"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

const defaultMaxDimension = 1920;
const defaultQuality = 0.82;

type OptimizeImageOptions = {
  maxDimension?: number;
  quality?: number;
  fallbackType?: "image/jpeg" | "image/png";
};

type UploadOptimizedImageOptions = OptimizeImageOptions & {
  bucket: string;
  pathWithoutExtension: string;
  cacheControl?: string;
};

type OptimizedImage = {
  blob: Blob;
  extension: "webp" | "jpg" | "png";
  contentType: string;
};

export async function uploadOptimizedImage(
  supabase: SupabaseClient,
  file: File,
  {
    bucket,
    pathWithoutExtension,
    cacheControl = "3600",
    ...optimizeOptions
  }: UploadOptimizedImageOptions,
) {
  const optimizedImage = await optimizeImage(file, optimizeOptions);
  const path = `${pathWithoutExtension}.${optimizedImage.extension}`;
  const { error } = await supabase.storage.from(bucket).upload(path, optimizedImage.blob, {
    cacheControl,
    contentType: optimizedImage.contentType,
    upsert: true,
  });

  return { error, path, optimizedImage };
}

export async function optimizeImage(
  file: File,
  {
    maxDimension = defaultMaxDimension,
    quality = defaultQuality,
    fallbackType = "image/jpeg",
  }: OptimizeImageOptions = {},
): Promise<OptimizedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload an image file.");
  }

  const image = await loadImage(file);
  const { width, height } = getResizedDimensions(
    image.naturalWidth,
    image.naturalHeight,
    maxDimension,
  );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", {
    alpha: true,
    colorSpace: "srgb",
  });

  if (!context) {
    throw new Error("This browser could not process the image.");
  }

  context.drawImage(image, 0, 0, width, height);
  URL.revokeObjectURL(image.src);

  const webpBlob = await canvasToBlob(canvas, "image/webp", quality);

  if (webpBlob && webpBlob.type === "image/webp") {
    return {
      blob: webpBlob,
      extension: "webp",
      contentType: "image/webp",
    };
  }

  const fallbackBlob = await canvasToBlob(canvas, fallbackType, quality);

  if (!fallbackBlob) {
    throw new Error("This browser could not optimize the image.");
  }

  return {
    blob: fallbackBlob,
    extension: fallbackType === "image/png" ? "png" : "jpg",
    contentType: fallbackType,
  };
}

function getResizedDimensions(width: number, height: number, maxDimension: number) {
  const longestSide = Math.max(width, height);

  if (longestSide <= maxDimension) {
    return { width, height };
  }

  const ratio = maxDimension / longestSide;

  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
      URL.revokeObjectURL(image.src);
      reject(new Error("Could not read this image."));
    };
    image.src = URL.createObjectURL(file);
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

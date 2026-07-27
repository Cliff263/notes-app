/**
 * Intrinsic pixel dimensions, read straight from the file header.
 *
 * Word needs to be told how big to draw an image, and the only honest source
 * for that is the image itself. Reading four fields out of a header is a lot
 * less than a decoding dependency, and the three formats below are the ones
 * Word can embed at all.
 */
export type ImageSize = { width: number; height: number };

export function imageSize(data: Buffer, mime: string): ImageSize | null {
  if (mime === "image/png") return pngSize(data);
  if (mime === "image/jpeg") return jpegSize(data);
  if (mime === "image/gif") return gifSize(data);
  return null;
}

function pngSize(data: Buffer): ImageSize | null {
  // 8-byte signature, then an IHDR chunk whose payload starts at byte 16.
  if (data.length < 24 || data.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

function gifSize(data: Buffer): ImageSize | null {
  if (data.length < 10 || data.subarray(0, 3).toString("latin1") !== "GIF") return null;
  return { width: data.readUInt16LE(6), height: data.readUInt16LE(8) };
}

function jpegSize(data: Buffer): ImageSize | null {
  if (data.length < 4 || data.readUInt16BE(0) !== 0xffd8) return null;

  let offset = 2;
  while (offset + 9 < data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = data[offset + 1];
    const length = data.readUInt16BE(offset + 2);

    // SOF0–SOF15 carry the frame header; SOF4, SOF8 and SOF12 are not frames.
    const isFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

    if (isFrame) {
      return { height: data.readUInt16BE(offset + 5), width: data.readUInt16BE(offset + 7) };
    }

    offset += 2 + length;
  }

  return null;
}

/** Scales an image down to fit a box, never up. */
export function fitWithin(size: ImageSize, maxWidth: number, maxHeight: number): ImageSize {
  const scale = Math.min(maxWidth / size.width, maxHeight / size.height, 1);
  return {
    width: Math.round(size.width * scale),
    height: Math.round(size.height * scale),
  };
}

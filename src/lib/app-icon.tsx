import { ImageResponse } from "next/og";

export function appIcon(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(140deg, #0a0a0a 0%, #1a1030 55%, #08262b 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: size * 0.56,
            height: size * 0.56,
            borderRadius: size * 0.14,
            border: `${Math.max(2, size * 0.02)}px solid #8b5cf6`,
            color: "#ededed",
            fontSize: size * 0.34,
            fontWeight: 700,
          }}
        >
          N
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}

import { ImageResponse } from "next/og";

/** Served at /apple-icon — linked as apple-touch-icon for iOS home screen. */
export const size        = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width:          180,
          height:         180,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          background:     "#070A0E",
          borderRadius:   40,
          position:       "relative",
        }}
      >
        {/* Glow disc */}
        <div
          style={{
            position:     "absolute",
            width:        110,
            height:       110,
            borderRadius: "50%",
            background:   "radial-gradient(circle, rgba(79,209,255,0.18) 0%, transparent 70%)",
          }}
        />

        {/* Lettermark */}
        <span
          style={{
            fontSize:      90,
            fontWeight:    900,
            color:         "#4FD1FF",
            lineHeight:    1,
            letterSpacing: "-0.06em",
            fontFamily:    "sans-serif",
          }}
        >
          B
        </span>

        {/* Accent bar */}
        <div
          style={{
            position:     "absolute",
            bottom:        24,
            left:           52,
            right:          52,
            height:          4,
            borderRadius:    2,
            background:    "linear-gradient(90deg, #4FD1FF, #7C5CFF)",
          }}
        />
      </div>
    ),
    { width: 180, height: 180 },
  );
}

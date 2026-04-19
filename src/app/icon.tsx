import { ImageResponse } from "next/og";

/** Served at /icon — used by browsers and referenced in the Web App Manifest. */
export const size        = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width:           512,
          height:          512,
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
          background:      "#070A0E",
          borderRadius:    96,
          position:        "relative",
        }}
      >
        {/* Subtle glow disc */}
        <div
          style={{
            position:     "absolute",
            width:        320,
            height:       320,
            borderRadius: "50%",
            background:   "radial-gradient(circle, rgba(79,209,255,0.18) 0%, transparent 70%)",
          }}
        />

        {/* Lettermark "B" */}
        <span
          style={{
            fontSize:      260,
            fontWeight:    900,
            color:         "#4FD1FF",
            lineHeight:    1,
            letterSpacing: "-0.06em",
            fontFamily:    "sans-serif",
          }}
        >
          B
        </span>

        {/* Bottom accent bar */}
        <div
          style={{
            position:     "absolute",
            bottom:        68,
            left:          152,
            right:         152,
            height:         6,
            borderRadius:   3,
            background:    "linear-gradient(90deg, #4FD1FF, #7C5CFF)",
          }}
        />
      </div>
    ),
    { width: 512, height: 512 },
  );
}

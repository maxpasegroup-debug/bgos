import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true as const,
    data: [
      { id: "SOLAR", label: "Solar", kind: "readymade" as const },
      { id: "ACADEMY", label: "Academy", kind: "readymade" as const },
      { id: "BUILDERS", label: "Builders", kind: "readymade" as const },
      { id: "CUSTOM", label: "Custom", kind: "custom" as const },
    ],
  });
}

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const resp = await fetch(`${process.env.GEO_ENGINE_URL}/api/geo/ner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return NextResponse.json({ error: data.error || "NER failed" }, { status: resp.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error in /api/ner:", error);
    return NextResponse.json(
      { error: error?.message || "NER processing failed" },
      { status: 500 }
    );
  }
}

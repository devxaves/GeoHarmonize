import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const forwardForm = new FormData();
    forwardForm.append("file", file);

    const resp = await fetch(`${process.env.GEO_ENGINE_URL}/api/geo/ocr`, {
      method: "POST",
      body: forwardForm,
    });

    const data = await resp.json();

    if (!resp.ok) {
      return NextResponse.json({ error: data.error || "OCR failed" }, { status: resp.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error in /api/ocr:", error);
    return NextResponse.json(
      { error: error?.message || "OCR processing failed" },
      { status: 500 }
    );
  }
}

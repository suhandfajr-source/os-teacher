import { NextRequest, NextResponse } from "next/server";
import { verifyEmailAddress } from "@/lib/email-verifier";

function setCorsHeaders(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  return setCorsHeaders(response);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = (body.email || "").trim();

    if (!email) {
      const res = NextResponse.json({ valid: false, reason: "Email wajib diisi." }, { status: 400 });
      return setCorsHeaders(res);
    }

    const result = await verifyEmailAddress(email);

    const res = NextResponse.json(result, { status: result.valid ? 200 : 422 });
    return setCorsHeaders(res);
  } catch (err: any) {
    const res = NextResponse.json({ valid: true, error: err.message }, { status: 200 });
    return setCorsHeaders(res);
  }
}

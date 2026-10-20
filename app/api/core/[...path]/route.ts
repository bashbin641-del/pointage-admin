import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth/server";
import { coreApi } from "@/lib/api/server";

async function forward(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const auth = await authenticateAdmin();
  if (!auth.ok) return NextResponse.json({ message: auth.reason }, { status: 401 });
  const { path } = await context.params;
  const response = await coreApi(path.join("/"), {
    method: request.method,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
  });
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json", "Cache-Control": "no-store" },
  });
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const DELETE = forward;

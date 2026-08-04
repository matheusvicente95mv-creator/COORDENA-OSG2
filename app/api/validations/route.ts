import { NextResponse } from "next/server";
import { listValidations } from "@/app/lib/storage";

export const runtime = "edge";

export async function GET() {
  try {
    return NextResponse.json({ items: await listValidations() });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ items: [] });
  }
}

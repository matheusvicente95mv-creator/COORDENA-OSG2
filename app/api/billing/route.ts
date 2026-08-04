import { NextRequest, NextResponse } from "next/server";
import { persistBillingRun } from "@/app/lib/storage";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as {
      caseNumber?: string;
      insurer?: string;
      targetCents?: number;
      suggestedCents?: number;
      balanceCents?: number;
      entries?: unknown;
      createdBy?: string;
    };
    if (!payload.caseNumber || !payload.insurer || !Array.isArray(payload.entries)) {
      return NextResponse.json({ error: "Dados de faturamento incompletos." }, { status: 400 });
    }
    const id = crypto.randomUUID();
    const persisted = await persistBillingRun({
      id,
      caseNumber: payload.caseNumber,
      insurer: payload.insurer,
      targetCents: Math.round(payload.targetCents ?? 0),
      suggestedCents: Math.round(payload.suggestedCents ?? 0),
      balanceCents: Math.round(payload.balanceCents ?? 0),
      entries: payload.entries,
      createdBy: payload.createdBy || "Coordenação SG2",
    });
    return NextResponse.json({ id, persisted });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Não foi possível salvar o faturamento." }, { status: 500 });
  }
}

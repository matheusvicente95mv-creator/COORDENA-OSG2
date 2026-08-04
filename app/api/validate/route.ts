import { NextRequest, NextResponse } from "next/server";
import {
  buildValidatedDocx,
  extractDocxText,
  reviewDocument,
} from "@/app/lib/validation";
import { persistValidation } from "@/app/lib/storage";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Selecione uma carta em formato DOCX." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".docx")) {
      return NextResponse.json(
        { error: "A devolução validada está disponível para arquivos DOCX." },
        { status: 400 },
      );
    }
    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json(
        { error: "O arquivo excede o limite de 12 MB." },
        { status: 400 },
      );
    }

    const metadata = {
      caseNumber: String(formData.get("caseNumber") || "Não informado"),
      documentType: String(formData.get("documentType") || "Carta"),
      insurer: String(formData.get("insurer") || "Não informada"),
      insured: String(formData.get("insured") || "Não informado"),
    };
    const submittedBy = String(formData.get("submittedBy") || "Coordenação SG2");
    const originalArrayBuffer = await file.arrayBuffer();
    const extracted = await extractDocxText(originalArrayBuffer);
    if (extracted.text.length < 80) {
      return NextResponse.json(
        { error: "O documento não contém texto suficiente para validação." },
        { status: 400 },
      );
    }

    const report = await reviewDocument(extracted.text, metadata);
    const output = await buildValidatedDocx(extracted.zip, extracted.documentXml, report);
    const id = crypto.randomUUID();
    const validatedFileName = file.name.replace(/\.docx$/i, "_VALIDADO.docx");

    let persisted = false;
    try {
      await persistValidation({
        id,
        ...metadata,
        fileName: file.name,
        validatedFileName,
        submittedBy,
        report,
        originalBytes: new Uint8Array(originalArrayBuffer),
        validatedBytes: output.bytes,
      });
      persisted = true;
    } catch (error) {
      console.error("Persistence fallback:", error);
    }

    return NextResponse.json({
      id,
      fileName: validatedFileName,
      report,
      base64: output.base64,
      persisted,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível concluir a validação.",
      },
      { status: 500 },
    );
  }
}

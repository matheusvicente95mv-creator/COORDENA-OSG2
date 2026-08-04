import JSZip from "jszip";

export type FindingSeverity = "critical" | "high" | "medium" | "low";

export type ValidationFinding = {
  severity: FindingSeverity;
  category: string;
  excerpt: string;
  suggested: string;
  reason: string;
};

export type ValidationReport = {
  executiveSummary: string;
  score: number;
  recommendation: "validar" | "validar_com_ajustes" | "devolver_ao_regulador";
  findings: ValidationFinding[];
  engine: "openai" | "rules";
};

async function getRuntimeEnvironment() {
  try {
    const cloudflare = await import("cloudflare:workers");
    return cloudflare.env as unknown as Record<string, unknown>;
  } catch {
    return process.env as unknown as Record<string, unknown>;
  }
}

const insurerNames = [
  "AXA",
  "AVLA",
  "BMG",
  "DAYCOVAL",
  "ESSOR",
  "EXCELSIOR",
  "SANCOR",
  "SOMBRERO",
  "SOMPO",
];

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapeXml(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wordParagraph(text: string, options?: { bold?: boolean; color?: string }) {
  const runProperties = [
    options?.bold ? "<w:b/>" : "",
    options?.color ? `<w:color w:val="${options.color}"/>` : "",
  ].join("");
  return `<w:p><w:pPr><w:spacing w:after="120"/></w:pPr><w:r><w:rPr>${runProperties}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

export async function extractDocxText(bytes: ArrayBuffer) {
  const zip = await JSZip.loadAsync(bytes);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) {
    throw new Error("O arquivo não contém uma estrutura DOCX válida.");
  }

  const paragraphs = Array.from(documentXml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g))
    .map((match) =>
      Array.from(match[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g))
        .map((part) => decodeXml(part[1]))
        .join(""),
    )
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return {
    zip,
    documentXml,
    paragraphs,
    text: paragraphs.join("\n"),
  };
}

function deterministicReview(text: string): ValidationReport {
  const findings: ValidationFinding[] = [];
  const add = (
    severity: FindingSeverity,
    category: string,
    excerpt: string,
    suggested: string,
    reason: string,
  ) => findings.push({ severity, category, excerpt, suggested, reason });

  if (/nº\./i.test(text)) {
    add(
      "low",
      "Padronização",
      "nº.",
      "n.º",
      "Uniformizar a abreviação de número conforme o padrão formal utilizado nas correspondências.",
    );
  }

  if (/representad[ao]\s+Conforme/.test(text)) {
    add(
      "medium",
      "Redação",
      "representada Conforme seu Estatuto Social",
      "representada conforme seu Estatuto Social",
      "A letra maiúscula no meio da oração é indevida.",
    );
  }

  if (/tendo sido retenção o valor/i.test(text)) {
    add(
      "high",
      "Redação",
      "tendo sido retenção o valor",
      "tendo sido retido o valor",
      "Há erro de construção sintática que compromete a clareza da informação financeira.",
    );
  }

  if (/\b(vem|vêm) informar o que segue\b/i.test(text) && /sociedade seguradora/i.test(text)) {
    add(
      "low",
      "Consistência formal",
      "vem informar o que segue",
      "vem, por meio da presente, informar o que segue",
      "A sugestão melhora a fluidez sem alterar o conteúdo jurídico.",
    );
  }

  if (/\bxx+[./-]?2026\b|\[inserir|preencher|placeholder|O conteúdo gerado por IA/i.test(text)) {
    add(
      "critical",
      "Pendência documental",
      "Campo ou marcador provisório identificado",
      "Substituir o marcador pela informação definitiva antes do envio.",
      "A correspondência não deve ser expedida com campos provisórios ou alertas internos.",
    );
  }

  const detectedInsurers = insurerNames.filter((name) =>
    new RegExp(`\\b${name}\\b`, "i").test(text),
  );
  if (detectedInsurers.length > 1) {
    add(
      "high",
      "Coerência cadastral",
      detectedInsurers.join(" / "),
      "Confirmar a seguradora correta e uniformizar cabeçalho, qualificação e referências internas.",
      "Foram localizados nomes de mais de uma seguradora no mesmo documento.",
    );
  }

  const policyNumbers = Array.from(
    text.matchAll(/(?:apólice|apolice)(?:\s+de\s+seguro\s+garantia)?\s*(?:n[.ºo]*)?\s*[:.-]?\s*([0-9]{12,})/gi),
  ).map((match) => match[1]);
  if (new Set(policyNumbers).size > 1) {
    add(
      "critical",
      "Coerência cadastral",
      Array.from(new Set(policyNumbers)).join(" / "),
      "Conferir o número correto da apólice e substituir todas as referências divergentes.",
      "O documento contém mais de um número de apólice.",
    );
  }

  const addvaloraNumbers = Array.from(
    text.matchAll(/Addvalora(?:\s+n[.ºo]*)?\s*[:.-]?\s*([0-9]{8,})/gi),
  ).map((match) => match[1]);
  if (new Set(addvaloraNumbers).size > 1) {
    add(
      "critical",
      "Coerência cadastral",
      Array.from(new Set(addvaloraNumbers)).join(" / "),
      "Uniformizar a referência Addvalora com o número correto da ficha.",
      "Há referências distintas para o mesmo processo regulatório.",
    );
  }

  if (/expectativa de sinistro/i.test(text) && /relatório final de regulação/i.test(text)) {
    add(
      "high",
      "Fase regulatória",
      "Expectativa de Sinistro / Relatório Final de Regulação",
      "Confirmar a classificação e adequar o documento à fase atual do processo.",
      "O texto reúne expressões normalmente vinculadas a fases regulatórias diferentes.",
    );
  }

  if (!/não (?:implica|importa).{0,120}(?:reconhecimento|cobertura|indenização)/is.test(text)) {
    add(
      "medium",
      "Ressalva securitária",
      "Ressalva não localizada",
      "Avaliar a inclusão da ressalva de que a solicitação de documentos não representa reconhecimento de cobertura.",
      "A ressalva costuma ser necessária em cartas instrutórias para preservar a análise de cobertura.",
    );
  }

  const score = Math.max(
    40,
    100 -
      findings.reduce(
        (total, finding) =>
          total +
          ({ critical: 18, high: 11, medium: 6, low: 3 } as const)[finding.severity],
        0,
      ),
  );
  const criticalOrHigh = findings.filter(
    (finding) => finding.severity === "critical" || finding.severity === "high",
  ).length;
  const recommendation =
    criticalOrHigh >= 2
      ? "devolver_ao_regulador"
      : findings.length
        ? "validar_com_ajustes"
        : "validar";

  return {
    executiveSummary:
      findings.length === 0
        ? "A revisão objetiva não identificou inconsistências materiais. Recomenda-se apenas a conferência final dos dados cadastrais com o CPJ."
        : `Foram identificados ${findings.length} ponto(s) de atenção, com prioridade para coerência cadastral, fase regulatória e precisão redacional.`,
    score,
    recommendation,
    findings,
    engine: "rules",
  };
}

async function openAiReview(
  text: string,
  metadata: { caseNumber: string; documentType: string; insurer: string; insured: string },
) {
  const runtimeEnv = await getRuntimeEnvironment();
  const apiKey = typeof runtimeEnv.OPENAI_API_KEY === "string" ? runtimeEnv.OPENAI_API_KEY : "";
  if (!apiKey) return null;

  const model =
    typeof runtimeEnv.OPENAI_MODEL === "string" ? runtimeEnv.OPENAI_MODEL : "gpt-5.6";

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["executiveSummary", "score", "recommendation", "findings"],
    properties: {
      executiveSummary: { type: "string" },
      score: { type: "integer" },
      recommendation: {
        type: "string",
        enum: ["validar", "validar_com_ajustes", "devolver_ao_regulador"],
      },
      findings: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["severity", "category", "excerpt", "suggested", "reason"],
          properties: {
            severity: {
              type: "string",
              enum: ["critical", "high", "medium", "low"],
            },
            category: { type: "string" },
            excerpt: { type: "string" },
            suggested: { type: "string" },
            reason: { type: "string" },
          },
        },
      },
    },
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      input: [
        {
          role: "developer",
          content: [
            {
              type: "input_text",
              text: [
                "Você é revisor jurídico sênior especializado em Seguro Garantia, regulação de sinistros e Direito Administrativo brasileiro.",
                "Revise o documento sem criar fatos. Preserve a tese jurídica escolhida e diferencie erro material de escolha argumentativa.",
                "Confira: seguradora, apólice, Addvalora, segurado, tomador, modalidade, vigência, importância segurada, cronologia, fase regulatória, coerência entre fundamentação e conclusão, retenção/compensação, prazos, ressalvas de cobertura, gramática e padronização.",
                "Cada apontamento deve conter um trecho curto e uma substituição pronta. Se não houver base documental, formule como ponto de conferência, não como afirmação.",
                "Não revele raciocínio interno. Entregue somente o resultado no esquema solicitado.",
              ].join("\n"),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `METADADOS\nCaso: ${metadata.caseNumber}\nTipo: ${metadata.documentType}\nSeguradora: ${metadata.insurer}\nSegurado: ${metadata.insured}\n\nDOCUMENTO\n${text.slice(0, 50000)}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "legal_validation",
          strict: true,
          schema,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`A validação inteligente retornou o status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  const outputText = payload.output
    ?.flatMap((item) => item.content ?? [])
    .find((content) => content.type === "output_text")?.text;
  if (!outputText) throw new Error("A validação inteligente não retornou conteúdo.");

  return {
    ...(JSON.parse(outputText) as Omit<ValidationReport, "engine">),
    engine: "openai" as const,
  };
}

export async function reviewDocument(
  text: string,
  metadata: { caseNumber: string; documentType: string; insurer: string; insured: string },
) {
  try {
    const aiReport = await openAiReview(text, metadata);
    if (aiReport) return aiReport;
  } catch (error) {
    console.error("OpenAI validation fallback:", error);
  }
  return deterministicReview(text);
}

export async function buildValidatedDocx(
  zip: JSZip,
  documentXml: string,
  report: ValidationReport,
) {
  const recommendationLabel = {
    validar: "VALIDAR",
    validar_com_ajustes: "VALIDAR APÓS AJUSTES",
    devolver_ao_regulador: "DEVOLVER AO REGULADOR",
  }[report.recommendation];

  const reportXml = [
    '<w:p><w:r><w:br w:type="page"/></w:r></w:p>',
    wordParagraph("RELATÓRIO DE VALIDAÇÃO – COORDENAÇÃO SG2", {
      bold: true,
      color: "0F766E",
    }),
    wordParagraph(`Resultado: ${recommendationLabel} | Nota: ${report.score}/100`, {
      bold: true,
    }),
    wordParagraph(report.executiveSummary),
    ...report.findings.flatMap((finding, index) => [
      wordParagraph(
        `${index + 1}. [${finding.severity.toUpperCase()}] ${finding.category}`,
        { bold: true, color: finding.severity === "critical" ? "B91C1C" : "9A3412" },
      ),
      wordParagraph(`Onde está: ${finding.excerpt}`),
      wordParagraph(`Substituir por / providência: ${finding.suggested}`),
      wordParagraph(`Justificativa: ${finding.reason}`),
    ]),
    wordParagraph(
      "Observação: a validação automatizada apoia a revisão da Coordenação e não substitui a conferência dos documentos do processo, do CPJ e das condições particulares da apólice.",
      { color: "52525B" },
    ),
  ].join("");

  const updatedXml = documentXml.includes("<w:sectPr")
    ? documentXml.replace(/<w:sectPr\b/, `${reportXml}<w:sectPr`)
    : documentXml.replace("</w:body>", `${reportXml}</w:body>`);

  zip.file("word/document.xml", updatedXml);
  const [base64, bytes] = await Promise.all([
    zip.generateAsync({ type: "base64", compression: "DEFLATE" }),
    zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }),
  ]);

  return { base64, bytes };
}

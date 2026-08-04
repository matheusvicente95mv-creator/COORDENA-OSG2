"use client";

import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  Bell,
  BookOpenCheck,
  Calculator,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Copy,
  Database,
  Download,
  FileCheck2,
  FileText,
  Gauge,
  LayoutDashboard,
  Lock,
  LockOpen,
  Menu,
  Plus,
  ReceiptText,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserRoundCheck,
  WandSparkles,
  X,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type View = "dashboard" | "validations" | "billing" | "criteria";
type ValidationStatus = "pending" | "review" | "approved" | "returned";

type ValidationItem = {
  id: string;
  caseNumber: string;
  insured: string;
  documentType: string;
  insurer: string;
  submittedBy: string;
  status: ValidationStatus;
  issueCount: number;
  score: number | null;
  createdAt: string;
};

type Finding = {
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  excerpt: string;
  suggested: string;
  reason: string;
};

type ValidationResult = {
  id: string;
  fileName: string;
  base64: string;
  report: {
    executiveSummary: string;
    score: number;
    recommendation: "validar" | "validar_com_ajustes" | "devolver_ao_regulador";
    findings: Finding[];
    engine: "openai" | "rules";
  };
};

type BillingEntry = {
  id: string;
  label: string;
  requested: number;
  rate: number;
  locked: boolean;
  suggested?: number;
};

const seededValidations: ValidationItem[] = [
  {
    id: "v-1",
    caseNumber: "2612300802",
    insured: "Município de Belo Horizonte",
    documentType: "Parecer de Reclassificação",
    insurer: "AVLA",
    submittedBy: "Ana Paula",
    status: "review",
    issueCount: 3,
    score: 84,
    createdAt: "Hoje, 08:14",
  },
  {
    id: "v-2",
    caseNumber: "2512305261",
    insured: "Secretaria Estadual da Saúde",
    documentType: "Manutenção da Negativa",
    insurer: "Sombrero",
    submittedBy: "Estella",
    status: "pending",
    issueCount: 0,
    score: null,
    createdAt: "Hoje, 07:42",
  },
  {
    id: "v-3",
    caseNumber: "2612301492",
    insured: "Tribunal Regional Eleitoral",
    documentType: "RFR Negativa",
    insurer: "Sancor",
    submittedBy: "Igor",
    status: "approved",
    issueCount: 1,
    score: 96,
    createdAt: "Ontem, 17:38",
  },
  {
    id: "v-4",
    caseNumber: "2612303802",
    insured: "Departamento Nacional de Infraestrutura",
    documentType: "Carta Inicial – Tomador",
    insurer: "AXA",
    submittedBy: "Seidy",
    status: "returned",
    issueCount: 5,
    score: 71,
    createdAt: "Ontem, 16:02",
  },
];

const documentTypes = [
  "Carta Inicial – Segurado",
  "Carta Inicial – Tomador",
  "Parecer Inicial – Cia.",
  "Carta de Suspensão",
  "Carta de Baixa",
  "Parecer de Reclassificação",
  "RFR Negativa",
  "RFR Pró-Pagamento",
  "Manutenção da Negativa",
];

const insurers = [
  "AXA",
  "AVLA",
  "Daycoval",
  "ESSOR",
  "Excelsior",
  "Sancor",
  "Sombrero",
  "Sompo",
];

const criteriaGroups = [
  {
    title: "Identificação e cadastro",
    description: "Apólice, endossos, Addvalora, seguradora, partes, modalidade, IS e vigência.",
    count: 11,
    color: "teal",
  },
  {
    title: "Fase regulatória",
    description: "Expectativa, sinistro, convolação, baixa, negativa, pagamento e reconsideração.",
    count: 7,
    color: "indigo",
  },
  {
    title: "Cobertura e clausulado",
    description: "Objeto garantido, limites, adicionais, riscos excluídos e ressalvas securitárias.",
    count: 8,
    color: "amber",
  },
  {
    title: "Cronologia e prova",
    description: "Datas, notificações, PAD, contraditório, documentos citados e nexo conclusivo.",
    count: 9,
    color: "rose",
  },
  {
    title: "Redação jurídica",
    description: "Tese preservada, clareza, português, padronização e firmeza da conclusão.",
    count: 8,
    color: "slate",
  },
];

const navItems: Array<{ view: View; label: string; icon: LucideIcon; badge?: string }> = [
  { view: "dashboard", label: "Visão geral", icon: LayoutDashboard },
  { view: "validations", label: "Validações", icon: FileCheck2, badge: "2" },
  { view: "billing", label: "Faturamento", icon: ReceiptText },
  { view: "criteria", label: "Critérios SG2", icon: BookOpenCheck },
];

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function statusMeta(status: ValidationStatus) {
  return {
    pending: { label: "Na fila", className: "status-pending", icon: Clock3 },
    review: { label: "Revisar", className: "status-review", icon: AlertTriangle },
    approved: { label: "Validado", className: "status-approved", icon: CheckCircle2 },
    returned: { label: "Devolvido", className: "status-returned", icon: XCircle },
  }[status];
}

function recommendationLabel(value: ValidationResult["report"]["recommendation"]) {
  return {
    validar: "Validar",
    validar_com_ajustes: "Validar após ajustes",
    devolver_ao_regulador: "Devolver ao regulador",
  }[value];
}

function base64ToBlob(base64: string) {
  const byteCharacters = atob(base64);
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
    const slice = byteCharacters.slice(offset, offset + 1024);
    chunks.push(Uint8Array.from(slice, (character) => character.charCodeAt(0)));
  }
  return new Blob(chunks, {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

export default function SG2Workspace({ displayName }: { displayName: string }) {
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [validations, setValidations] = useState(seededValidations);
  const [toast, setToast] = useState("");
  const firstName =
    displayName
      .replace(/[._-]+/g, " ")
      .trim()
      .split(" ")[0]
      ?.replace(/^./, (letter) => letter.toUpperCase()) || "Matheus";

  useEffect(() => {
    fetch("/api/validations")
      .then((response) => response.json())
      .then((payload: { items?: Array<Record<string, unknown>> }) => {
        if (!payload.items?.length) return;
        const persisted = payload.items.map((item) => ({
          id: String(item.id),
          caseNumber: String(item.caseNumber),
          insured: String(item.insured),
          documentType: String(item.documentType),
          insurer: String(item.insurer),
          submittedBy: String(item.submittedBy),
          status:
            item.status === "validar"
              ? ("approved" as const)
              : item.status === "devolver_ao_regulador"
                ? ("returned" as const)
                : ("review" as const),
          issueCount: Number(item.issueCount),
          score: Number(item.score),
          createdAt: new Date(String(item.createdAt)).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }),
        }));
        setValidations((current) => [
          ...persisted,
          ...current.filter((item) => !persisted.some((saved) => saved.id === item.id)),
        ]);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const navigate = (view: View) => {
    setActiveView(view);
    setMobileOpen(false);
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand-block">
          <div className="brand-mark">
            <ShieldCheck size={22} strokeWidth={2.3} />
          </div>
          <div>
            <strong>SG2 Valida</strong>
            <span>Coordenação inteligente</span>
          </div>
          <button className="icon-button sidebar-close" onClick={() => setMobileOpen(false)}>
            <X size={19} />
          </button>
        </div>

        <div className="workspace-chip">
          <div className="workspace-monogram">A</div>
          <div>
            <strong>Addvalora Brasil</strong>
            <span>Seguro Garantia · SG2</span>
          </div>
          <ChevronRight size={16} />
        </div>

        <nav className="primary-nav" aria-label="Navegação principal">
          <p className="nav-label">Operação</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.view}
                className={activeView === item.view ? "nav-item active" : "nav-item"}
                onClick={() => navigate(item.view)}
              >
                <Icon size={19} />
                <span>{item.label}</span>
                {item.badge ? <em>{item.badge}</em> : null}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-note">
          <div className="note-icon">
            <WandSparkles size={18} />
          </div>
          <strong>Revisão em duas camadas</strong>
          <p>Critérios SG2 + análise inteligente, sempre com decisão final da Coordenação.</p>
        </div>

        <div className="profile-row">
          <div className="avatar">{firstName.slice(0, 2).toUpperCase()}</div>
          <div>
            <strong>{firstName}</strong>
            <span>Coordenação SG2</span>
          </div>
          <button className="dots-button" aria-label="Opções do perfil">•••</button>
        </div>
      </aside>

      {mobileOpen ? <button className="sidebar-scrim" onClick={() => setMobileOpen(false)} /> : null}

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)}>
            <Menu size={21} />
          </button>
          <div className="global-search">
            <Search size={18} />
            <input placeholder="Buscar por Addvalora, segurado ou documento…" />
            <kbd>⌘ K</kbd>
          </div>
          <div className="top-actions">
            <button className="icon-button notification-button" aria-label="Notificações">
              <Bell size={19} />
              <i />
            </button>
            <button className="primary-button compact" onClick={() => navigate("validations")}>
              <Plus size={18} />
              Nova validação
            </button>
          </div>
        </header>

        <div className="content-area">
          {activeView === "dashboard" ? (
            <Dashboard
              firstName={firstName}
              validations={validations}
              onNavigate={navigate}
            />
          ) : null}
          {activeView === "validations" ? (
            <ValidationWorkspace
              firstName={firstName}
              validations={validations}
              setValidations={setValidations}
              notify={setToast}
            />
          ) : null}
          {activeView === "billing" ? (
            <BillingWorkspace firstName={firstName} notify={setToast} />
          ) : null}
          {activeView === "criteria" ? <CriteriaWorkspace /> : null}
        </div>
      </main>

      {toast ? (
        <div className="toast-message">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function Dashboard({
  firstName,
  validations,
  onNavigate,
}: {
  firstName: string;
  validations: ValidationItem[];
  onNavigate: (view: View) => void;
}) {
  const waiting = validations.filter((item) => item.status === "pending" || item.status === "review");
  const approved = validations.filter((item) => item.status === "approved");

  return (
    <section className="page-stack">
      <div className="page-heading dashboard-heading">
        <div>
          <span className="eyebrow">TERÇA-FEIRA · OPERAÇÃO SG2</span>
          <h1>Bom dia, {firstName}.</h1>
          <p>Há <strong>{waiting.length} documentos</strong> pedindo sua atenção e um faturamento pronto para fechamento.</p>
        </div>
        <div className="heading-trust">
          <ShieldCheck size={19} />
          <span>Ambiente interno</span>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard
          label="Aguardando validação"
          value={String(waiting.length)}
          meta="2 dentro do SLA"
          tone="amber"
          icon={FileCheck2}
        />
        <MetricCard
          label="Validados no mês"
          value={String(approved.length + 46)}
          meta="+18% vs. julho"
          tone="teal"
          icon={CheckCircle2}
        />
        <MetricCard
          label="Faturamento preparado"
          value="R$ 258 mil"
          meta="6 fichas conferidas"
          tone="indigo"
          icon={CircleDollarSign}
        />
        <MetricCard
          label="Tempo médio de revisão"
          value="12 min"
          meta="-4 min por documento"
          tone="slate"
          icon={Gauge}
        />
      </div>

      <div className="dashboard-grid">
        <div className="panel queue-panel">
          <PanelHeader
            title="Fila de validação"
            subtitle="Priorizada por SLA e criticidade"
            action="Ver todas"
            onAction={() => onNavigate("validations")}
          />
          <div className="queue-list">
            {validations.slice(0, 4).map((item) => (
              <ValidationRow key={item.id} item={item} compact />
            ))}
          </div>
        </div>

        <div className="panel activity-panel">
          <PanelHeader title="Pulso da operação" subtitle="Hoje, em tempo real" />
          <div className="activity-chart" aria-label="Volume de validações por horário">
            {[28, 42, 34, 64, 49, 78, 58, 86, 70, 92, 62, 76].map((height, index) => (
              <span key={index} style={{ height: `${height}%` }} className={index === 9 ? "peak" : ""} />
            ))}
          </div>
          <div className="chart-axis">
            <span>08h</span>
            <span>10h</span>
            <span>12h</span>
            <span>14h</span>
            <span>16h</span>
          </div>
          <div className="activity-summary">
            <div><strong>17</strong><span>recebidos</span></div>
            <div><strong>13</strong><span>concluídos</span></div>
            <div><strong>76%</strong><span>vazão</span></div>
          </div>
        </div>
      </div>

      <div className="spotlight-card">
        <div className="spotlight-icon"><Calculator size={24} /></div>
        <div>
          <span className="eyebrow">PRÓXIMA AÇÃO RECOMENDADA</span>
          <h2>Esgotar os timesheets da ficha 2612303356</h2>
          <p>Os lançamentos somam R$ 270.000,00 para um saldo faturável de R$ 258.000,00. A Coordenação está preservada no ajuste.</p>
        </div>
        <button className="secondary-button" onClick={() => onNavigate("billing")}>
          Abrir cálculo <ArrowRight size={17} />
        </button>
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  meta,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  meta: string;
  tone: string;
  icon: LucideIcon;
}) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-icon"><Icon size={20} /></div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{meta}</small>
    </article>
  );
}

function PanelHeader({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="panel-header">
      <div><h2>{title}</h2><p>{subtitle}</p></div>
      {action ? <button onClick={onAction}>{action} <ChevronRight size={16} /></button> : null}
    </div>
  );
}

function ValidationRow({ item, compact = false }: { item: ValidationItem; compact?: boolean }) {
  const status = statusMeta(item.status);
  const StatusIcon = status.icon;
  return (
    <div className={compact ? "validation-row compact-row" : "validation-row"}>
      <div className="file-tile"><FileText size={19} /></div>
      <div className="validation-main">
        <strong>{item.documentType}</strong>
        <span>{item.caseNumber} · {item.insured}</span>
      </div>
      {!compact ? <span className="insurer-pill">{item.insurer}</span> : null}
      <div className="validation-author">
        <span>{item.submittedBy}</span>
        <small>{item.createdAt}</small>
      </div>
      <span className={`status-pill ${status.className}`}>
        <StatusIcon size={14} /> {status.label}
      </span>
      <button className="row-arrow" aria-label="Abrir validação"><ChevronRight size={17} /></button>
    </div>
  );
}

function ValidationWorkspace({
  firstName,
  validations,
  setValidations,
  notify,
}: {
  firstName: string;
  validations: ValidationItem[];
  setValidations: React.Dispatch<React.SetStateAction<ValidationItem[]>>;
  notify: (message: string) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [caseNumber, setCaseNumber] = useState("");
  const [insured, setInsured] = useState("");
  const [insurer, setInsurer] = useState("AXA");
  const [documentType, setDocumentType] = useState(documentTypes[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [error, setError] = useState("");

  const pickFile = (selected?: File) => {
    if (!selected) return;
    setError("");
    if (!selected.name.toLowerCase().endsWith(".docx")) {
      setError("Selecione um arquivo Word no formato .docx.");
      return;
    }
    setFile(selected);
  };

  const submit = async () => {
    if (!file || !caseNumber.trim() || !insured.trim()) {
      setError("Informe a ficha, o segurado e selecione o arquivo DOCX.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("caseNumber", caseNumber);
    formData.append("insured", insured);
    formData.append("insurer", insurer);
    formData.append("documentType", documentType);
    formData.append("submittedBy", firstName);

    try {
      const response = await fetch("/api/validate", { method: "POST", body: formData });
      const payload = (await response.json()) as ValidationResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível validar o arquivo.");
      setResult(payload);
      const status: ValidationStatus =
        payload.report.recommendation === "validar"
          ? "approved"
          : payload.report.recommendation === "devolver_ao_regulador"
            ? "returned"
            : "review";
      setValidations((current) => [
        {
          id: payload.id,
          caseNumber,
          insured,
          documentType,
          insurer,
          submittedBy: firstName,
          status,
          issueCount: payload.report.findings.length,
          score: payload.report.score,
          createdAt: "Agora",
        },
        ...current,
      ]);
      notify("Validação concluída e arquivo preparado para download.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha na validação.");
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    if (!result) return;
    const url = URL.createObjectURL(base64ToBlob(result.base64));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const clear = () => {
    setFile(null);
    setResult(null);
    setError("");
    if (fileInput.current) fileInput.current.value = "";
  };

  return (
    <section className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">CENTRAL DE DOCUMENTOS</span>
          <h1>Validação jurídica</h1>
          <p>Envie a carta, receba os apontamentos no padrão da Coordenação e baixe o próprio Word com o relatório anexado.</p>
        </div>
        <div className="heading-stat">
          <strong>{validations.filter((item) => item.status === "pending" || item.status === "review").length}</strong>
          <span>aguardando decisão</span>
        </div>
      </div>

      <div className="validation-workbench">
        <div className="panel upload-panel">
          <div className="section-title">
            <div><span>1</span><h2>Identifique o documento</h2></div>
            <small>Campos obrigatórios</small>
          </div>
          <div className="form-grid">
            <label>
              Ficha Addvalora
              <input value={caseNumber} onChange={(event) => setCaseNumber(event.target.value)} placeholder="Ex.: 2612303356" inputMode="numeric" />
            </label>
            <label>
              Seguradora
              <select value={insurer} onChange={(event) => setInsurer(event.target.value)}>
                {insurers.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label className="full-field">
              Segurado
              <input value={insured} onChange={(event) => setInsured(event.target.value)} placeholder="Nome do segurado" />
            </label>
            <label className="full-field">
              Tipo de documento
              <select value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
                {documentTypes.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
          </div>

          <div className="section-title upload-title">
            <div><span>2</span><h2>Inclua a carta</h2></div>
            <small>DOCX · até 12 MB</small>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            hidden
            onChange={(event) => pickFile(event.target.files?.[0])}
          />
          <button
            className={`drop-zone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
            onClick={() => fileInput.current?.click()}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              pickFile(event.dataTransfer.files[0]);
            }}
          >
            {file ? (
              <>
                <div className="selected-file-icon"><FileCheck2 size={25} /></div>
                <strong>{file.name}</strong>
                <span>{(file.size / 1024 / 1024).toFixed(2)} MB · pronto para revisar</span>
              </>
            ) : (
              <>
                <div className="upload-icon"><UploadCloud size={25} /></div>
                <strong>Arraste o Word até aqui</strong>
                <span>ou clique para selecionar o arquivo</span>
              </>
            )}
          </button>

          <div className="privacy-note">
            <Lock size={15} />
            <span>O conteúdo é processado sem armazenamento do texto pela API. O arquivo e o histórico permanecem no ambiente interno.</span>
          </div>
          {error ? <div className="form-error"><AlertTriangle size={16} />{error}</div> : null}
          <div className="form-actions">
            <button className="ghost-button" onClick={clear} disabled={loading}><RotateCcw size={17} /> Limpar</button>
            <button className="primary-button" onClick={submit} disabled={loading}>
              {loading ? <span className="spinner" /> : <Sparkles size={18} />}
              {loading ? "Revisando o documento…" : "Validar documento"}
            </button>
          </div>
        </div>

        <div className="panel result-panel">
          {loading ? (
            <div className="analysis-state">
              <div className="analysis-orbit"><WandSparkles size={28} /></div>
              <span className="eyebrow">ANÁLISE EM ANDAMENTO</span>
              <h2>Conferindo o documento em camadas</h2>
              <div className="analysis-steps">
                <span className="done"><Check size={15} /> Extração preservando o Word</span>
                <span className="active"><span className="mini-spinner" /> Cadastros, cronologia e tese</span>
                <span><Clock3 size={15} /> Consolidação dos ajustes</span>
              </div>
            </div>
          ) : result ? (
            <div className="result-content">
              <div className="result-hero">
                <div className={`score-ring score-${result.report.score >= 90 ? "good" : result.report.score >= 75 ? "warn" : "bad"}`}>
                  <strong>{result.report.score}</strong><span>/100</span>
                </div>
                <div>
                  <span className="eyebrow">RESULTADO DA VALIDAÇÃO</span>
                  <h2>{recommendationLabel(result.report.recommendation)}</h2>
                  <p>{result.report.executiveSummary}</p>
                </div>
              </div>

              <div className="result-meta">
                <span><UserRoundCheck size={16} /> Decisão final da Coordenação</span>
                <span><Database size={16} /> {result.report.findings.length} apontamento(s)</span>
                <span><Sparkles size={16} /> {result.report.engine === "openai" ? "Revisão inteligente" : "Critérios objetivos"}</span>
              </div>

              <div className="finding-list">
                {result.report.findings.length ? result.report.findings.slice(0, 5).map((finding, index) => (
                  <article className={`finding-card severity-${finding.severity}`} key={`${finding.category}-${index}`}>
                    <div className="finding-top">
                      <span>{finding.category}</span>
                      <em>{finding.severity === "critical" ? "Crítico" : finding.severity === "high" ? "Alto" : finding.severity === "medium" ? "Médio" : "Baixo"}</em>
                    </div>
                    <p><strong>Onde está:</strong> {finding.excerpt}</p>
                    <p className="suggestion"><strong>Substituir por:</strong> {finding.suggested}</p>
                    <small>{finding.reason}</small>
                  </article>
                )) : (
                  <div className="empty-findings"><CheckCircle2 size={24} /><span>Nenhuma inconsistência material identificada.</span></div>
                )}
              </div>
              <button className="download-button" onClick={download}>
                <Download size={19} />
                Baixar {result.fileName}
              </button>
              <p className="download-caption">O Word original é preservado e recebe o relatório completo de validação ao final.</p>
            </div>
          ) : (
            <div className="empty-result">
              <div className="empty-illustration">
                <FileText size={42} />
                <span><Sparkles size={18} /></span>
              </div>
              <span className="eyebrow">ARQUIVO VALIDADO</span>
              <h2>O resultado aparecerá aqui</h2>
              <p>Você verá a nota, a recomendação, os pontos críticos e o botão para baixar o DOCX revisado.</p>
              <ul>
                <li><CheckCircle2 size={16} /> Onde está / substituir por</li>
                <li><CheckCircle2 size={16} /> Coerência cadastral e cronológica</li>
                <li><CheckCircle2 size={16} /> Preservação da tese jurídica</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="panel validation-history">
        <PanelHeader title="Histórico recente" subtitle="Documentos recebidos pela Coordenação" />
        <div className="history-table">
          {validations.slice(0, 6).map((item) => <ValidationRow key={item.id} item={item} />)}
        </div>
      </div>
    </section>
  );
}

function BillingWorkspace({ firstName, notify }: { firstName: string; notify: (message: string) => void }) {
  const [caseNumber, setCaseNumber] = useState("2612303356");
  const [insurer, setInsurer] = useState("Sancor");
  const [target, setTarget] = useState(258000);
  const [saved, setSaved] = useState(false);
  const [entries, setEntries] = useState<BillingEntry[]>([
    { id: "reg", label: "Regulação", requested: 844, rate: 225, locked: false },
    { id: "coord", label: "Coordenação", requested: 156, rate: 225, locked: true },
    { id: "dir", label: "Diretoria", requested: 120, rate: 225, locked: false },
    { id: "adm", label: "Administrativo", requested: 180, rate: 100, locked: false },
  ]);

  const calculation = useMemo(() => {
    const rows = entries.map((entry) => ({ ...entry, suggested: Math.max(0, Math.round(entry.requested)) }));
    const targetCents = Math.round(target * 100);
    const totalRequestedCents = rows.reduce(
      (sum, entry) => sum + entry.requested * Math.round(entry.rate * 100),
      0,
    );
    let suggestedCents = rows.reduce(
      (sum, entry) => sum + (entry.suggested ?? 0) * Math.round(entry.rate * 100),
      0,
    );
    let overflow = Math.max(0, suggestedCents - targetCents);
    const order = ["dir", "adm", "reg", "coord"];
    for (const id of order) {
      if (overflow <= 0) break;
      const entry = rows.find((row) => row.id === id);
      if (!entry || entry.locked) continue;
      const rateCents = Math.round(entry.rate * 100);
      const removable = Math.min(entry.suggested ?? 0, Math.ceil(overflow / rateCents));
      entry.suggested = (entry.suggested ?? 0) - removable;
      suggestedCents -= removable * rateCents;
      overflow = Math.max(0, suggestedCents - targetCents);
    }
    return {
      rows,
      targetCents,
      totalRequestedCents,
      suggestedCents,
      balanceCents: targetCents - suggestedCents,
      adjustmentCents: totalRequestedCents - suggestedCents,
    };
  }, [entries, target]);

  const updateEntry = (id: string, field: "requested" | "rate", value: number) => {
    setSaved(false);
    setEntries((current) =>
      current.map((entry) => entry.id === id ? { ...entry, [field]: Math.max(0, value || 0) } : entry),
    );
  };

  const toggleLock = (id: string) => {
    setSaved(false);
    setEntries((current) =>
      current.map((entry) => entry.id === id ? { ...entry, locked: !entry.locked } : entry),
    );
  };

  const summaryText = `SUB CAP's: ${calculation.rows
    .map((entry) => `${entry.label}: ${entry.suggested}min * R$ ${entry.rate.toFixed(2).replace(".", ",")}`)
    .join(" | ")}`;

  const copySummary = async () => {
    await navigator.clipboard.writeText(summaryText);
    notify("Texto dos SUB CAP's copiado.");
  };

  const exportCsv = () => {
    const lines = [
      ["Categoria", "Minutos informados", "Minutos sugeridos", "Valor/hora", "Valor sugerido"],
      ...calculation.rows.map((entry) => [
        entry.label,
        entry.requested,
        entry.suggested,
        entry.rate.toFixed(2),
        (((entry.suggested ?? 0) * entry.rate)).toFixed(2),
      ]),
    ];
    const csv = "\uFEFF" + lines.map((line) => line.join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `faturamento-${caseNumber || "sg2"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const saveRun = async () => {
    try {
      const response = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseNumber,
          insurer,
          targetCents: calculation.targetCents,
          suggestedCents: calculation.suggestedCents,
          balanceCents: calculation.balanceCents,
          entries: calculation.rows,
          createdBy: firstName,
        }),
      });
      if (!response.ok) throw new Error();
      setSaved(true);
      notify("Memória de cálculo salva no histórico.");
    } catch {
      notify("Cálculo mantido nesta sessão; o histórico remoto não respondeu.");
    }
  };

  return (
    <section className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ESGOTAMENTO DE TIMESHEETS</span>
          <h1>Faturamento assistido</h1>
          <p>Transforme os minutos tabelados em uma sugestão exata, preservando as alçadas que você travar.</p>
        </div>
        <button className="secondary-button" onClick={exportCsv}><ArrowDownToLine size={17} /> Exportar CSV</button>
      </div>

      <div className="billing-top-grid">
        <div className="panel billing-case-card">
          <div className="section-title"><div><span>1</span><h2>Dados da ficha</h2></div></div>
          <div className="form-grid">
            <label>
              Ficha Addvalora
              <input value={caseNumber} onChange={(event) => { setCaseNumber(event.target.value); setSaved(false); }} />
            </label>
            <label>
              Seguradora
              <select value={insurer} onChange={(event) => { setInsurer(event.target.value); setSaved(false); }}>
                {insurers.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label className="full-field money-field">
              Saldo faturável do caso
              <span>R$</span>
              <input type="number" step="0.01" value={target} onChange={(event) => { setTarget(Number(event.target.value)); setSaved(false); }} />
            </label>
          </div>
        </div>

        <div className="billing-summary-card">
          <span className="eyebrow">RESULTADO SUGERIDO</span>
          <strong>{formatBRL(calculation.suggestedCents / 100)}</strong>
          <div className="summary-progress">
            <span style={{ width: `${Math.min(100, (calculation.suggestedCents / Math.max(1, calculation.targetCents)) * 100)}%` }} />
          </div>
          <div className="summary-kpis">
            <div><span>Saldo-alvo</span><strong>{formatBRL(target)}</strong></div>
            <div><span>Ajuste necessário</span><strong>- {formatBRL(calculation.adjustmentCents / 100)}</strong></div>
            <div className={Math.abs(calculation.balanceCents) < 100 ? "balanced" : ""}>
              <span>Saldo residual</span><strong>{formatBRL(calculation.balanceCents / 100)}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="panel allocation-panel">
        <div className="allocation-heading">
          <div>
            <span className="step-number">2</span>
            <div><h2>Distribuição por atividade</h2><p>Trave as categorias que não podem ser reduzidas. O excedente é abatido das demais.</p></div>
          </div>
          <span className="lock-legend"><Lock size={14} /> Coordenação preservada</span>
        </div>
        <div className="allocation-table">
          <div className="allocation-row allocation-header">
            <span>Atividade</span><span>Minutos informados</span><span>Valor/hora</span><span>Minutos sugeridos</span><span>Valor sugerido</span><span>Travar</span>
          </div>
          {calculation.rows.map((entry) => (
            <div className="allocation-row" key={entry.id}>
              <strong>{entry.label}</strong>
              <label className="table-input"><input type="number" value={entry.requested} onChange={(event) => updateEntry(entry.id, "requested", Number(event.target.value))} /><span>min</span></label>
              <label className="table-input currency"><span>R$</span><input type="number" value={entry.rate} onChange={(event) => updateEntry(entry.id, "rate", Number(event.target.value))} /></label>
              <div className="suggested-minutes">
                <strong>{entry.suggested}</strong><span>min</span>
                {(entry.suggested ?? 0) < entry.requested ? <em>-{entry.requested - (entry.suggested ?? 0)}</em> : null}
              </div>
              <strong className="suggested-value">{formatBRL((entry.suggested ?? 0) * entry.rate)}</strong>
              <button className={entry.locked ? "lock-toggle locked" : "lock-toggle"} onClick={() => toggleLock(entry.id)} aria-label={entry.locked ? "Destravar categoria" : "Travar categoria"}>
                {entry.locked ? <Lock size={16} /> : <LockOpen size={16} />}
              </button>
            </div>
          ))}
        </div>
        <div className="allocation-footer">
          <div className="allocation-rule">
            <ShieldCheck size={18} />
            <span><strong>Regra aplicada:</strong> preservar categorias travadas e reduzir Diretoria → Administrativo → Regulação.</span>
          </div>
          <div className="allocation-actions">
            <button className="ghost-button" onClick={copySummary}><Copy size={17} /> Copiar SUB CAP&apos;s</button>
            <button className="primary-button" onClick={saveRun}>{saved ? <Check size={18} /> : <Save size={18} />}{saved ? "Cálculo salvo" : "Salvar memória"}</button>
          </div>
        </div>
      </div>

      <div className="billing-copy-card">
        <div><FileText size={20} /><strong>Texto pronto para lançamento</strong></div>
        <p>{summaryText}</p>
        <button onClick={copySummary}><Copy size={16} /> Copiar</button>
      </div>
    </section>
  );
}

function CriteriaWorkspace() {
  return (
    <section className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">BASE DE REVISÃO</span>
          <h1>Critérios SG2</h1>
          <p>Uma biblioteca viva construída a partir dos modelos de cartas, pareceres, RFRs e do fluxo do CPJ Executante.</p>
        </div>
        <button className="primary-button"><Plus size={18} /> Novo critério</button>
      </div>

      <div className="criteria-hero">
        <div>
          <div className="criteria-hero-icon"><BookOpenCheck size={26} /></div>
          <span className="eyebrow">PADRÃO DA COORDENAÇÃO</span>
          <h2>43 verificações antes de uma carta sair</h2>
          <p>O sistema diferencia erro material, ponto de conferência e decisão estratégica. A tese não é reescrita por capricho da máquina.</p>
        </div>
        <div className="criteria-score">
          <strong>5</strong><span>dimensões</span>
          <i />
          <strong>9</strong><span>tipos documentais</span>
        </div>
      </div>

      <div className="criteria-grid">
        {criteriaGroups.map((group) => (
          <article className={`criterion-card criterion-${group.color}`} key={group.title}>
            <div><span>{group.count}</span><BookOpenCheck size={20} /></div>
            <h3>{group.title}</h3>
            <p>{group.description}</p>
            <button>Ver verificações <ChevronRight size={16} /></button>
          </article>
        ))}
      </div>

      <div className="panel workflow-panel">
        <PanelHeader title="Fluxo aplicado ao documento" subtitle="Da entrada à decisão da Coordenação" />
        <div className="workflow-steps">
          {[
            { icon: UploadCloud, title: "Entrada", text: "DOCX + dados da ficha" },
            { icon: Database, title: "Conferência", text: "Cadastros e fase CPJ" },
            { icon: WandSparkles, title: "Revisão", text: "Tese, prova e redação" },
            { icon: UserRoundCheck, title: "Decisão", text: "Coordenação valida" },
            { icon: Download, title: "Devolução", text: "Word com relatório" },
          ].map((step, index) => {
            const Icon = step.icon;
            return (
              <div className="workflow-step" key={step.title}>
                <div><Icon size={19} /></div>
                <span>0{index + 1}</span>
                <strong>{step.title}</strong>
                <small>{step.text}</small>
                {index < 4 ? <ArrowRight size={18} /> : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

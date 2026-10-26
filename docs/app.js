"use strict";
const $=id=>document.getElementById(id);
const DEFAULT_RULES=[
{from:"não houveram",to:"não houve",reason:"O verbo haver, no sentido de existir, é impessoal."},
{from:"haviam documentos",to:"havia documentos",reason:"Emprego impessoal do verbo haver."},
{from:"a nível de",to:"em relação a",reason:"Revisão de expressão pouco precisa."},
{from:"tendo sido retenção o valor",to:"tendo sido retido o valor",reason:"Correção de construção sintática."},
{from:"em anexo segue",to:"segue anexo",reason:"Sugestão de concisão e concordância; conferir contexto."}
];
let rules=loadRules(),report=null,selectedFile=null,selectedSources=[],processed=null;
function loadRules(){try{const r=JSON.parse(localStorage.getItem("sg2-rules"));return Array.isArray(r)?r:structuredClone(DEFAULT_RULES);}catch{return structuredClone(DEFAULT_RULES);}}
function saveRules(){localStorage.setItem("sg2-rules",JSON.stringify(rules));}
function text(s){return String(s??"").replace(/\s+/g," ").trim();}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function escXML(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));}
function decodeXML(s){return s.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,"&");}
function extractParagraphs(xml){return [...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map(m=>({xml:m[0],value:decodeXML([...m[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(x=>x[1]).join(""))})).filter(x=>x.value.trim());}
function addFile(f){if(f&&!f.name.toLowerCase().endsWith(".docx")){alert("Selecione um DOCX.");return;}selectedFile=f;$("file-label").textContent=f?f.name:"Clique ou arraste seu relatório";}
$("file").onchange=e=>addFile(e.target.files[0]);$("drop").ondragover=e=>{e.preventDefault();$("drop").classList.add("dragging")};$("drop").ondragleave=()=>$("drop").classList.remove("dragging");$("drop").ondrop=e=>{e.preventDefault();$("drop").classList.remove("dragging");addFile(e.dataTransfer.files[0]);};
$("sources").onchange=e=>{selectedSources=[...e.target.files];$("source-label").textContent=selectedSources.length?selectedSources.map(f=>f.name).join(", "):"Nenhum anexo selecionado";};
$("use-ai").onchange=()=>{$("consent-area").hidden=!$("use-ai").checked; if(!$("use-ai").checked)$("ai-consent").checked=false;};
document.querySelectorAll('input[name="mode"]').forEach(el=>el.onchange=()=>document.querySelectorAll(".mode").forEach(m=>m.classList.toggle("chosen",m.querySelector("input").checked)));
$("drive-open").onclick=()=>{const raw=$("drive-url").value.trim();try{const u=new URL(raw);if(u.protocol!=="https:"||!["drive.google.com","docs.google.com"].includes(u.hostname))throw Error();window.open(u.href,"_blank","noopener,noreferrer");}catch{alert("Insira um link HTTPS válido do Google Drive.");}};
async function refreshKnowledge(){
  if(!window.sg2Knowledge)return;
  const items=await sg2Knowledge.list();
  const status=$("knowledge-status");
  if(status)status.textContent=items.length?items.length+" material(is) na biblioteca":"Acervo não importado";
  const list=$("knowledge-files-list");
  if(!list)return;
  list.replaceChildren();
  for(const item of items){
    const div=document.createElement("div");
    div.className="rule";
    div.textContent=item.name+" — "+Math.round(item.content.length/1000)+" mil caracteres";
    const button=document.createElement("button");
    button.textContent="Excluir";button.onclick=async()=>{await sg2Knowledge.remove(item.id);await refreshKnowledge();};
    div.append(button);list.append(div);
  }
}
$("knowledge-files").onchange=async e=>{
  const feedback=$("knowledge-feedback");
  if(!window.sg2Knowledge){feedback.textContent="Biblioteca local indisponível neste navegador.";return;}
  feedback.textContent="Importando materiais localmente…";
  try{
    const result=await sg2Knowledge.importFiles(e.target.files);
    feedback.textContent=result.added.length+" arquivo(s) importado(s). "+(result.skipped.length?result.skipped.length+" não lido(s): "+result.skipped.slice(0,3).join("; "):"");
    await refreshKnowledge();
  }catch(error){feedback.textContent="Falha na importação: "+String(error.message||error);}
  e.target.value="";
};
refreshKnowledge().catch(()=>{const k=$("knowledge-status");if(k)k.textContent="Biblioteca indisponível";});
$("open-knowledge").onclick=()=>{$("knowledge-dialog").showModal();renderRules();refreshKnowledge().catch(()=>{});};$("close-knowledge").onclick=()=>$("knowledge-dialog").close();
function renderRules(){$("rules-list").replaceChildren();rules.forEach((r,i)=>{let d=document.createElement("div");d.className="rule";d.textContent=r.from+" → "+r.to+" ("+r.reason+")";let b=document.createElement("button");b.textContent="Excluir";b.onclick=()=>{rules.splice(i,1);saveRules();renderRules();};d.append(b);$("rules-list").append(d);});}
$("add-rule").onclick=()=>{const r={from:$("rule-from").value.trim(),to:$("rule-to").value.trim(),reason:$("rule-reason").value.trim()};if(!r.from||!r.to||!r.reason){alert("Preencha todos os campos.");return;}rules.push(r);saveRules();["rule-from","rule-to","rule-reason"].forEach(id=>$(id).value="");renderRules();};
function downloadBlob(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
$("export-rules").onclick=()=>downloadBlob(new Blob([JSON.stringify(rules,null,2)],{type:"application/json"}),"sg2-biblioteca.json");
$("import-rules").onchange=async e=>{try{const data=JSON.parse(await e.target.files[0].text());if(!Array.isArray(data)||!data.every(x=>typeof x.from==="string"&&typeof x.to==="string"&&typeof x.reason==="string"))throw Error();rules=data;saveRules();renderRules();}catch{alert("Arquivo JSON de regras inválido.");}};
async function readPdf(bytes,name) {
  if(!window.pdfjsLib)throw Error("A biblioteca PDF ainda não carregou.");
  pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const pdf=await pdfjsLib.getDocument({data:bytes}).promise;
  const pages=Math.min(pdf.numPages,60), chunks=[];
  for(let i=1;i<=pages;i++){
    const p=await pdf.getPage(i);
    const t=await p.getTextContent();
    chunks.push("[Documento: "+name+"; página "+i+"]\n"+t.items.map(x=>x.str||"").join(" "));
  }
  return chunks.join("\n").slice(0,130000);
}
async function getSources(){
  const docs=[],skip=[];
  for(const file of selectedSources){
    try {
      if(file.size>60*1024*1024){skip.push(file.name+" (tamanho excedido)");continue;}
      if(/\.zip$/i.test(file.name)){
        const zip=await JSZip.loadAsync(file);
        let counter=0;
        for(const [name,item] of Object.entries(zip.files)){
          if(item.dir||name.includes("__MACOSX/"))continue;
          counter++;
          if(counter>100){skip.push("Mais de 100 arquivos no ZIP; interrompida leitura");break;}
          try{
            if(item._data?.uncompressedSize>18*1024*1024){skip.push(name+" (tamanho excedido)");continue;}
            if(/\.(txt|md|csv|json)$/i.test(name)){
              docs.push({name,body:(await item.async("string")).slice(0,120000)});
            } else if(/\.docx$/i.test(name)){
              const z=await JSZip.loadAsync(await item.async("arraybuffer"));
              const xml=await z.file("word/document.xml")?.async("string");
              if(xml)docs.push({name,body:extractParagraphs(xml).map(x=>x.value).join("\n").slice(0,120000)});
              else skip.push(name);
            } else if(/\.pdf$/i.test(name)){
              const b=await item.async("uint8array");
              const body=await readPdf(b,name);if(body.replace(/\[Documento:[^\n]+\]/g,"").trim().length<60)skip.push(name+" (PDF sem texto extraível)");else docs.push({name,body});
            } else skip.push(name);
          }catch{skip.push(name);}
        }
      } else if(/\.docx$/i.test(file.name)){
        const z=await JSZip.loadAsync(await file.arrayBuffer());
        const xml=await z.file("word/document.xml")?.async("string");
        if(xml)docs.push({name:file.name,body:extractParagraphs(xml).map(x=>x.value).join("\n")});
        else skip.push(file.name);
      } else if(/\.pdf$/i.test(file.name)){
        const body=await readPdf(new Uint8Array(await file.arrayBuffer()),file.name);if(body.replace(/\[Documento:[^\n]+\]/g,"").trim().length<60)skip.push(file.name+" (PDF sem texto extraível)");else docs.push({name:file.name,body});
      } else if(/\.(txt|md|csv|json)$/i.test(file.name)){
        docs.push({name:file.name,body:(await file.text()).slice(0,120000)});
      } else skip.push(file.name);
    }catch{skip.push(file.name);}
  }
  return {docs,skip};
}
function findRules(paragraphs){const result=[],seen=new Set();for(const p of paragraphs){for(const rule of rules){const index=p.value.toLocaleLowerCase("pt-BR").indexOf(rule.from.toLocaleLowerCase("pt-BR"));if(index<0)continue;const actual=p.value.slice(index,index+rule.from.length),key=p.value+"::"+rule.from;if(seen.has(key))continue;seen.add(key);result.push({kind:"Redação",from:actual,to:rule.to,reason:rule.reason,source:"Regra local da Biblioteca SG2",paragraph:p.value});}}
return result;}
function findingsDocumentary(paragraphs,docs){let results=[];const sourceText=docs.map(x=>x.body).join("\n");if(!sourceText)return results;const pattern=/\b\d{1,2}\/\d{1,2}\/20\d\d\b/g;const fromReport=new Set(paragraphs.flatMap(p=>[...p.value.matchAll(pattern)].map(x=>x[0])));const fromDocs=new Set([...sourceText.matchAll(pattern)].map(x=>x[0]));for(const d of fromReport){if(fromDocs.has(d))continue;results.push({kind:"Conferência documental",from:d,to:"Verificar a data nos documentos do processo",reason:"A data não foi localizada em formato idêntico nos arquivos textuais lidos. Isso NÃO comprova erro, e não substitui análise dos PDFs, imagens ou demais documentos.",source:"Comparação textual limitada"});if(results.length>=5)break;}return results;}
function applyTracked(xml,findings){
  const ns="http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const doc=new DOMParser().parseFromString(xml,"application/xml");
  if(doc.getElementsByTagName("parsererror").length)return {xml,changed:0};
  const paras=Array.from(doc.getElementsByTagNameNS(ns,"p"));
  let changed=0;const used=new Set();
  const create=(tag)=>doc.createElementNS(ns,"w:"+tag);
  const setText=(run,value,deleted)=>{
    const t=create(deleted?"delText":"t");
    t.setAttribute("xml:space","preserve");
    t.textContent=value;
    run.appendChild(t);
    return run;
  };
  const makeRun=(src,value,deleted)=>{
    const r=create("r");
    const pr=Array.from(src.childNodes).find(n=>n.nodeType===1&&n.localName==="rPr"&&n.namespaceURI===ns);
    if(pr)r.appendChild(pr.cloneNode(true));
    setText(r,value,deleted);
    return r;
  };
  const wrap=(type,src,value,id)=>{
    const node=create(type);
    node.setAttributeNS(ns,"w:id",String(id));
    node.setAttributeNS(ns,"w:author","SG2 Validador");
    node.setAttributeNS(ns,"w:date",new Date().toISOString());
    node.appendChild(makeRun(src,value,type==="del"));
    return node;
  };
  for(const f of findings){
    if(!f || !f.from || !f.to || /^CONFERIR:/i.test(f.to))continue;
    if(f.kind==="Conferência documental")continue;
    const needle=String(f.from);
    for(const p of paras){
      if(used.has(p))continue;
      const children=Array.from(p.childNodes).filter(n=>n.nodeType===1);
      const runs=children.filter(n=>n.namespaceURI===ns&&n.localName==="r");
      if(!runs.length || children.some(n=>n.namespaceURI===ns&&["ins","del","hyperlink"].includes(n.localName)))continue;
      const segments=[];let offset=0,valid=true;
      for(const run of runs){
        const parts=Array.from(run.childNodes).filter(n=>n.nodeType===1);
        if(parts.some(n=>n.namespaceURI!==ns||!["rPr","t"].includes(n.localName))){valid=false;break;}
        const texts=parts.filter(n=>n.localName==="t");
        if(texts.length!==1){valid=false;break;}
        const value=texts[0].textContent||"";
        segments.push({run,value,start:offset,end:offset+value.length});
        offset+=value.length;
      }
      if(!valid)continue;
      const full=segments.map(q=>q.value).join("");
      const at=full.indexOf(needle);
      if(at<0)continue;
      const end=at+needle.length;
      let inserted=false;
      for(const q of segments){
        if(q.end<=at||q.start>=end)continue;
        const frag=doc.createDocumentFragment();
        const left=Math.max(0,at-q.start),right=Math.min(q.value.length,end-q.start);
        if(left>0)frag.appendChild(makeRun(q.run,q.value.slice(0,left),false));
        const mid=q.value.slice(left,right);
        if(mid)frag.appendChild(wrap("del",q.run,mid,changed*2+1));
        if(!inserted){
          frag.appendChild(wrap("ins",q.run,String(f.to),changed*2+2));
          inserted=true;
        }
        if(right<q.value.length)frag.appendChild(makeRun(q.run,q.value.slice(right),false));
        p.replaceChild(frag,q.run);
      }
      if(inserted){used.add(p);changed++;break;}
    }
  }
  return {xml:new XMLSerializer().serializeToString(doc),changed};
}
function asText(r){return ["SG2 | SUGESTÕES DE VALIDAÇÃO","Resultado assistido, sujeito a conferência jurídica.",...r.findings.map((f,i)=>"\n"+(i+1)+". "+f.kind+"\nOnde está: "+f.from+"\nSubstituir por / conferir: "+f.to+"\nJustificativa: "+f.reason+"\nFonte: "+f.source)].join("\n");}
$("validate").onclick=async()=>{if(!selectedFile){alert("Selecione o relatório DOCX.");return;}if(typeof JSZip==="undefined"){alert("A biblioteca de leitura DOCX não carregou. Verifique a conexão.");return;}const useAI=$("use-ai").checked;if(useAI&&!$("ai-consent").checked){alert("Para usar IA externa, leia e confirme a autorização de envio dos dados.");return;}if(useAI){try{if(!window.puter?.auth)throw Error("Puter não carregou.");if(!puter.auth.isSignedIn())await puter.auth.signIn();}catch(e){alert("Não foi possível entrar na conta Puter: "+(e?.message||e));return;}}const b=$("validate");b.disabled=true;b.textContent="Analisando arquivos...";try{const zip=await JSZip.loadAsync(await selectedFile.arrayBuffer());const xml=await zip.file("word/document.xml")?.async("string");if(!xml)throw Error("Arquivo DOCX inválido.");const paragraphs=extractParagraphs(xml);const sources=await getSources();let aiSummary="",aiError="",knowledgeContext=null; if(useAI&&window.sg2Knowledge){try{knowledgeContext=await sg2Knowledge.context(paragraphs.map(x=>x.value).join("\n"),26000);}catch(e){console.warn("Biblioteca local indisponível",e);}}
let findings=[...findRules(paragraphs),...findingsDocumentary(paragraphs,sources.docs)];
if(useAI){
  try{
    const a=await window.sg2ReviewWithAI({
      reportText:paragraphs.map(x=>x.value).join("\n"),
      caseDocuments:sources.docs,
      knowledgeText:knowledgeContext?.text||"",
      status:msg=>{b.textContent=msg;}
    });
    aiSummary=a.summary||"";
    const keys=new Set(findings.map(f=>f.from+"::"+f.to));
    for(const finding of a.findings){
      if(keys.has(finding.from+"::"+finding.to))continue;
      findings.push(finding); keys.add(finding.from+"::"+finding.to);
    }
  }catch(e){aiError=String(e?.message||e); console.error("IA externa indisponível:",e);}
}const redline=applyTracked(xml,findings);zip.file("word/document.xml",redline.xml);const docx=await zip.generateAsync({type:"blob",compression:"DEFLATE"});processed={findings,docx,redline,read:sources.docs.length,skipped:sources.skip};$("empty").hidden=true;$("active").hidden=false;$("state").textContent=aiError?"Análise parcial":findings.length?"Sugestões prontas":"Sem apontamentos";$("state").style.background=aiError?"#fff1e1":"#e3f7ed";$("state").style.color="#147b5a";$("count").textContent=findings.length;$("read-count").textContent=sources.docs.length;$("skip-count").textContent=sources.skip.length;$("summary-text").textContent=aiSummary|| (findings.length?findings.length+" apontamento(s) encontrados.":"Nenhuma ocorrência identificada pelas regras locais.");let warnings=[];if($("drive-url").value.trim())warnings.push("O link do Drive não foi consultado automaticamente.");if(sources.skip.length)warnings.push(sources.skip.length+" documento(s) sem leitura (incluindo PDF ou imagens).");if(!useAI)warnings.push("Modo local: apenas regras objetivas, sem revisão jurídica profunda.");else if(aiError)warnings.push("Falha ao consultar IA externa: "+aiError+" Apenas verificações locais foram aplicadas.");else warnings.push("A análise por IA foi executada com o texto enviado. As sugestões precisam ser verificadas por um responsável técnico.");if(knowledgeContext?.totalDocuments)warnings.push("Consulta a "+knowledgeContext.totalDocuments+" material(is) importado(s) localmente; trechos selecionados conforme pertinência. Materiais ainda não verificados quanto a vigência e confiabilidade.");else warnings.push("Ainda não há acervo consolidado da Coordenação importado neste navegador.");if(redline.changed<findings.length)warnings.push("Alterações não aplicáveis com segurança permanecem apenas na lista de sugestões.");$("notice").textContent=warnings.join(" ");const out=$("findings");out.replaceChildren();for(const [i,f] of findings.entries()){const d=document.createElement("div");d.className="finding";d.innerHTML="<h5>"+(i+1)+". "+escapeHTML(f.kind)+"</h5><p class='before'><b>Onde está:</b> "+escapeHTML(f.from)+"</p><p class='after'><b>Substituir por / conferir:</b> "+escapeHTML(f.to)+"</p><p>"+escapeHTML(f.reason)+"</p><p><b>Fonte:</b> "+escapeHTML(f.source)+"</p>";out.append(d);}report=asText(processed);if(redline.changed===0){const wordButton=$("download-word");wordButton.disabled=true;wordButton.textContent=findings.length?"Word sem alterações seguras — consulte as sugestões":"Nenhuma alteração para o Word";}else{$("download-word").disabled=false;$("download-word").textContent="↓ Baixar Word com "+redline.changed+" alteração(ões)";}}catch(e){alert("Não foi possível validar: "+(e.message||"erro desconhecido"));}finally{b.disabled=false;b.innerHTML='✦ &nbsp; Validar relatório <span>→</span>';}}
$("download-word").onclick=()=>{if(!processed)return;downloadBlob(processed.docx,(selectedFile?.name||"Relatorio.docx").replace(/\.docx$/i,"_SG2_REVISADO.docx"));};
$("download-list").onclick=()=>{if(report)downloadBlob(new Blob([report],{type:"text/plain;charset=utf-8"}),"SG2_Sugestoes.txt");};
$("copy").onclick=async()=>{if(!report)return;try{await navigator.clipboard.writeText(report);alert("Sugestões copiadas.");}catch{alert("Cópia indisponível neste navegador.");}};

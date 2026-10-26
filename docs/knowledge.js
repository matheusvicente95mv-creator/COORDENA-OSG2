"use strict";
(function(){
const DB="sg2-validador-local", STORE="knowledge", VERSION=1;
function openDB(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB,VERSION);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:"id"});};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
async function query(mode,fn){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode);const store=tx.objectStore(STORE);let result;const req=fn(store);req.onsuccess=()=>{result=req.result;};req.onerror=()=>reject(req.error);tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=()=>{db.close();reject(tx.error);};});}
async function list(){return query("readonly",s=>s.getAll());}
async function remove(id){return query("readwrite",s=>s.delete(id));}
function decode(s){return String(s).replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,"&");}
async function docxText(bytes){
  if(!window.JSZip)throw Error("Biblioteca Word indisponível.");
  const zip=await JSZip.loadAsync(bytes);
  const xml=await zip.file("word/document.xml")?.async("string");
  if(!xml)throw Error("DOCX ilegível.");
  return [...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map(p=>decode([...p[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(t=>t[1]).join(""))).join("\n");
}
async function pdfText(bytes){
  if(!window.pdfjsLib)throw Error("Biblioteca PDF indisponível.");
  pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const doc=await pdfjsLib.getDocument({data:bytes}).promise;
  const out=[];
  for(let i=1;i<=Math.min(doc.numPages,80);i++){
    const page=await doc.getPage(i);
    const items=await page.getTextContent();
    out.push("[Página "+i+"] "+items.items.map(x=>x.str||"").join(" "));
  }
  return out.join("\n");
}
async function parse(name,bytes){
  const ext=name.split(".").pop().toLowerCase();
  if(ext==="docx")return docxText(bytes);
  if(ext==="pdf")return pdfText(bytes);
  if(["txt","md","csv","json"].includes(ext))return new TextDecoder("utf-8").decode(bytes);
  throw Error("Formato não aceito para conhecimento: "+name);
}
async function addFile(name,bytes){
  const content=(await parse(name,bytes)).trim().slice(0,700000);
  if(content.length<40)throw Error(name+": sem texto suficiente (PDF pode estar digitalizado).");
  const id=crypto.randomUUID();
  await query("readwrite",s=>s.put({id,name:name.slice(0,200),content,createdAt:new Date().toISOString()}));
  return {id,name,chars:content.length};
}
async function importFiles(files){
  const added=[],skipped=[];
  for(const file of [...files]){
    if(file.size>25*1024*1024){skipped.push(file.name+" (tamanho acima de 25 MB)");continue;}
    try{
      if(/\.zip$/i.test(file.name)){
        const zip=await JSZip.loadAsync(await file.arrayBuffer());
        let n=0;
        for(const [name,item] of Object.entries(zip.files)){
          if(item.dir||name.startsWith("__MACOSX/"))continue;
          if(!/\.(txt|md|csv|json|docx|pdf)$/i.test(name))continue;
          if(++n>50){skipped.push("Limite de 50 arquivos por ZIP.");break;}
          try{
            if(item._data?.uncompressedSize>25*1024*1024){skipped.push(name+" (muito grande)");continue;}
            added.push(await addFile(name,await item.async("uint8array")));
          }catch(e){skipped.push(name+": "+e.message);}
        }
      }else added.push(await addFile(file.name,new Uint8Array(await file.arrayBuffer())));
    }catch(e){skipped.push(file.name+": "+e.message);}
  }
  return {added,skipped};
}
function normalize(s){return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();}
function selectContext(report,documents,maxChars=30000){
  const stop=new Set("de da do das dos para sobre caso relatorio seguro garantia tomador segurado seguradora contrato documento documento documento processo analise que com uma por nas ser nao esta sao foram entre onde como esse dessa pela pelo todas".split(" "));
  const terms=[...new Set(normalize(report).match(/[a-z]{5,}/g)||[])].filter(w=>!stop.has(w)).slice(0,300);
  const set=new Set(terms),candidates=[];
  for(const d of documents){
    const str=String(d.content||"");
    const pieces=str.match(/[\s\S]{1,1300}(?:\n|$)/g)||[str];
    for(let i=0;i<pieces.length;i++){
      const value=pieces[i].trim();
      if(value.length<40)continue;
      const words=new Set(normalize(value).match(/[a-z]{5,}/g)||[]);
      let score=0;for(const w of words)if(set.has(w))score++;
      if(/diretriz|metodologia|manual|criterio|orientac/i.test(d.name))score+=5;
      candidates.push({name:d.name,value,score});
    }
  }
  candidates.sort((a,b)=>b.score-a.score);
  const selected=[],used=new Set();let budget=maxChars;
  for(const c of candidates){
    const code=c.name+"::"+c.value.slice(0,70);
    if(used.has(code))continue;
    const piece="[BIBLIOTECA: "+c.name+"]\n"+c.value+"\n";
    if(piece.length>budget)continue;
    selected.push(piece);budget-=piece.length;used.add(code);
    if(budget<800||selected.length>=30)break;
  }
  return {text:selected.join("\n"),sourceCount:new Set(selected.map(x=>x.split("\n")[0])).size,totalDocuments:documents.length};
}
async function context(report,maxChars=30000){const docs=await list();return selectContext(report,docs,maxChars);}
window.sg2Knowledge={list,remove,importFiles,context,selectContext};
})();
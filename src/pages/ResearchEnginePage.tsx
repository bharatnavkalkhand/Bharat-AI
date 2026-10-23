import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Search, ExternalLink, Star, GitFork, CalendarDays, BookOpen, AlertTriangle } from "lucide-react";

type Repo = { id:number; full_name:string; html_url:string; description:string|null; stargazers_count:number; forks_count:number; language:string|null; updated_at:string; license:{spdx_id?:string|null;name?:string|null}|null; topics?:string[] };
const presets = [["AI video generation","Wan2.1 text-to-video image-to-video"],["Character animation","LivePortrait portrait animation"],["Lip-sync","MuseTalk audio lip sync"],["Video workflows","ComfyUI video workflow"],["Hindi voice","Hindi text to speech open source"]];

export function ResearchEnginePage() {
 const [query,setQuery]=useState("Wan2.1 video generation"),[results,setResults]=useState<Repo[]>([]),[loading,setLoading]=useState(false),[searched,setSearched]=useState(false),[error,setError]=useState("");
 async function search(term=query) {
  const q=term.trim(); if(!q){setError("Search ke liye model ya capability ka naam likhein.");return;}
  setQuery(q);setLoading(true);setError("");setSearched(true);
  try {
   const res=await fetch("https://api.github.com/search/repositories?q="+encodeURIComponent(q)+"&sort=stars&order=desc&per_page=12",{headers:{Accept:"application/vnd.github+json"},signal:AbortSignal.timeout(15000)});
   if(res.status===403||res.status===429)throw new Error("GitHub search limit reached. Kuch der baad dobara try karein.");
   if(!res.ok)throw new Error("GitHub API error: HTTP "+res.status);
   const data=await res.json() as {items?:Repo[]};const items=Array.isArray(data.items)?data.items:[];setResults(items);if(!items.length)setError("Koi result nahi mila. Search words badal kar dekhein.");
  }catch(e){setResults([]);setError(e instanceof Error?e.message:"GitHub search connect nahi ho paayi.");}finally{setLoading(false);}
 }
 const date=(s:string)=>{const d=new Date(s);return Number.isNaN(d.getTime())?"Unknown":d.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});};
 const licence=(r:Repo)=>r.license?.spdx_id&&r.license.spdx_id!=="NOASSERTION"?r.license.spdx_id:r.license?.name||"Not declared by GitHub API";
 return <main className="page-shell mx-auto min-h-dvh max-w-5xl px-4 pb-16 pt-6 sm:px-6">
  <header className="mb-7 flex items-center justify-between gap-3"><Link to="/" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg"><ArrowLeft className="h-4 w-4"/> Back to Bharat AI</Link><span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent">Research Engine</span></header>
  <section className="card-pro p-5 sm:p-8"><div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent"><Search className="h-5 w-5"/></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">Open-source discovery</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Find reusable AI building blocks</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">Search public GitHub repositories for video generation, avatar animation, lip-sync and voice tools. Results are metadata—not proof that a model runs on free hosting or works with Bharat AI.</p></div></div>
   <form className="mt-6 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={e=>{e.preventDefault();void search();}}><input aria-label="Search public GitHub repositories" value={query} onChange={e=>setQuery(e.target.value)} placeholder="e.g. realistic text-to-video open source" className="min-w-0 rounded-xl border border-border bg-bg px-4 py-3 text-sm text-fg outline-none focus:border-accent"/><button type="submit" disabled={loading} className="btn-primary inline-flex items-center justify-center gap-2 px-5 py-3 text-sm disabled:opacity-60"><Search className="h-4 w-4"/>{loading?"Searching…":"Search GitHub"}</button></form>
   <div className="mt-3 flex flex-wrap gap-2">{presets.map(([label,q])=><button key={label} type="button" onClick={()=>{setQuery(q);void search(q);}} className="rounded-full border border-border bg-bg/70 px-3 py-2 text-xs text-muted hover:border-accent/50 hover:text-fg">{label}</button>)}</div>
  </section>
  <div className="mt-5 flex items-start gap-2 rounded-2xl border border-border bg-card/70 p-4 text-xs leading-relaxed text-muted"><BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-accent"/><p>Check repository and model-weight licences, hardware requirements, dependencies, commercial-use terms and recent activity before reuse. Stars are popularity—not proof of quality.</p></div>
  {error&&<div role="status" className="mt-5 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/>{error}</div>}
  {loading&&<p className="mt-6 text-sm text-muted">GitHub se public repositories la rahe hain…</p>}
  {!loading&&searched&&results.length===0&&!error&&<p className="mt-6 text-sm text-muted">Koi repository nahi mili.</p>}
  <section className="mt-6 grid gap-3 md:grid-cols-2">{results.map(r=><article key={r.id} className="card-pro min-w-0 p-4 sm:p-5"><div className="flex items-center justify-between gap-2 text-[11px] text-muted"><span className="rounded-full bg-bg px-2.5 py-1">{r.language||"Language not listed"}</span><span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 text-accent"/>{r.stargazers_count.toLocaleString()}</span></div><h2 className="mt-3 break-words text-base font-semibold">{r.full_name}</h2><p className="mt-2 min-h-10 text-sm leading-relaxed text-muted">{r.description||"No description provided."}</p>{r.topics?.length?<div className="mt-3 flex flex-wrap gap-1.5">{r.topics.slice(0,5).map(t=><span key={t} className="rounded-md bg-bg px-2 py-1 text-[10px] text-muted">{t}</span>)}</div>:null}<div className="mt-4 grid gap-2 border-t border-border pt-3 text-[11px] text-muted"><span>Licence: {licence(r)}</span><span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3"/>Updated: {date(r.updated_at)}</span><span className="inline-flex items-center gap-1"><GitFork className="h-3 w-3"/>Forks: {r.forks_count.toLocaleString()}</span></div><a href={r.html_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline">Open repository <ExternalLink className="h-3.5 w-3.5"/></a></article>)}</section>
  <section className="mt-8 rounded-2xl border border-border bg-card/60 p-4"><h2 className="text-sm font-semibold">Bharat AI integration checklist</h2><p className="mt-1 text-xs leading-relaxed text-muted">Compare candidates with script, cast, scene, voice and GPU-worker interfaces. Verify licence, GPU requirements and a short real render before deployment.</p></section>
 </main>;
}

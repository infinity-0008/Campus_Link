import { useEffect, useId, useRef } from "react";
import { LoaderCircle, ChevronLeft, ChevronRight, AlertCircle, Inbox } from "lucide-react";
import { humanize } from "@/lib/format.js";
export function Button({ children, variant = "primary", size = "md", loading = false, className = "", type = "button", ...props }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2 disabled:opacity-55 disabled:pointer-events-none";
  const variants = {
    primary: "bg-brand-red text-white hover:bg-brand-red-dark shadow-sm",
    secondary: "border border-[#dedfe2] bg-white text-[#303137] hover:bg-[#f8f8f7]",
    dark: "bg-[#101114] text-white hover:bg-[#282a2f]",
    ghost: "text-[#50525a] hover:bg-[#f1f1f0]",
    danger: "bg-[#b42318] text-white hover:bg-[#941f16]",
    subtle: "bg-[#fdecea] text-[#b42318] hover:bg-[#fbdedb]",
  };
  const sizes = { sm: "px-3 py-2 text-xs", md: "px-4 py-2.5 text-sm", lg: "px-5 py-3 text-sm" };
  return <button type={type} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props} disabled={loading || props.disabled}>{loading && <LoaderCircle className="h-4 w-4 animate-spin"/>}{children}</button>;
}
export function Card({ children, className = "", ...props }) { return <section className={`card-surface ${className}`} {...props}>{children}</section>; }
export function PageHeader({ title, description, actions, eyebrow }) { return <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div className="min-w-0">{eyebrow && <p className="mb-1 text-[10px] font-bold uppercase tracking-[.18em] text-brand-red">{eyebrow}</p>}<h1 className="text-2xl font-bold tracking-tight text-[#17181b] sm:text-[28px]">{title}</h1>{description && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#777a82]">{description}</p>}</div>{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</header>; }
export function Field({ label, error, hint, className = "", id, ...props }) { const generatedId = useId(); const controlId = id || `field-${generatedId}`; return <div className={className}><label className="form-label" htmlFor={controlId}>{label}</label><input id={controlId} className="form-control" aria-invalid={Boolean(error)} {...props}/>{hint && !error && <p className="mt-1 text-xs text-[#85878d]">{hint}</p>}{error && <p className="form-error" role="alert">{error}</p>}</div>; }
export function SelectField({ label, error, children, className = "", id, ...props }) { const generatedId = useId(); const controlId = id || `select-${generatedId}`; return <div className={className}><label className="form-label" htmlFor={controlId}>{label}</label><select id={controlId} className="form-control" aria-invalid={Boolean(error)} {...props}>{children}</select>{error && <p className="form-error" role="alert">{error}</p>}</div>; }
export function TextAreaField({ label, error, className = "", id, ...props }) { const generatedId = useId(); const controlId = id || `textarea-${generatedId}`; return <div className={className}><label className="form-label" htmlFor={controlId}>{label}</label><textarea id={controlId} className="form-control min-h-28 resize-y" aria-invalid={Boolean(error)} {...props}/>{error && <p className="form-error" role="alert">{error}</p>}</div>; }
export function StatusBadge({ value, children }) { const raw = String(value ?? children ?? "unknown").toLowerCase(); const label = children ?? humanize(value); const tone = raw.includes("selected") || raw === "open" || raw === "active" || raw === "ok" || raw === "eligible" || raw === "completed" ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : raw.includes("reject") || raw === "closed" || raw === "failed" || raw === "suspended" || raw === "ineligible" ? "bg-red-50 text-red-700 ring-red-100" : raw === "draft" || raw === "pending" || raw === "processing" || raw.includes("scheduled") || raw === "shortlisted" || raw === "rescheduled" ? "bg-amber-50 text-amber-700 ring-amber-100" : "bg-slate-100 text-slate-600 ring-slate-200"; return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ring-1 ring-inset ${tone}`}>{label}</span>; }
export function StatCard({ label, value, hint, icon: Icon, accent = "red" }) { return <Card className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-[#777a82]">{label}</p><p className="mt-2 text-3xl font-bold tracking-tight text-[#17181b]">{value ?? "—"}</p>{hint && <p className="mt-1 text-xs text-[#8b8d93]">{hint}</p>}</div>{Icon && <span className={`grid h-10 w-10 place-items-center rounded-xl ${accent === "dark" ? "bg-[#101114] text-white" : "bg-[#fdecea] text-brand-red"}`}><Icon className="h-5 w-5"/></span>}</div></Card>; }
export function LoadingState({ label = "Loading information…" }) { return <div className="flex items-center justify-center gap-3 rounded-2xl border border-dashed border-[#dedfe2] bg-white px-6 py-16 text-sm text-[#777a82]"><LoaderCircle className="h-5 w-5 animate-spin text-brand-red"/>{label}</div>; }
export function EmptyState({ title = "Nothing here yet", description = "When information becomes available, it will appear here.", action }) { return <div className="flex flex-col items-center rounded-2xl border border-dashed border-[#dedfe2] bg-white px-6 py-14 text-center"><span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[#f4f4f3] text-[#777a82]"><Inbox className="h-5 w-5"/></span><h3 className="font-semibold text-[#242429]">{title}</h3><p className="mt-2 max-w-md text-sm leading-6 text-[#777a82]">{description}</p>{action && <div className="mt-5">{action}</div>}</div>; }
export function ErrorState({ error, onRetry, title = "We couldn't load this view" }) { return <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600"/><div className="min-w-0"><h3 className="font-semibold text-red-900">{title}</h3><p className="mt-1 text-sm leading-6 text-red-800">{error?.message || "Check your connection and try again."}</p>{error?.details?.failures?.map((failure) => <p key={failure.rule} className="mt-1 text-xs text-red-800">{failure.message}</p>)}{onRetry && <Button className="mt-4" variant="secondary" size="sm" onClick={onRetry}>Try again</Button>}</div></div></div>; }
export function Pagination({ meta, onPage }) { if (!meta || (meta.totalPages ?? 1) <= 1) return null; const page = meta.page || 1; return <div className="flex items-center justify-between border-t border-[#eee] px-1 pt-4 text-xs text-[#777a82]"><span>Page {page} of {meta.totalPages} · {meta.total ?? 0} records</span><div className="flex gap-2"><Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="h-4 w-4"/>Previous</Button><Button size="sm" variant="secondary" disabled={page >= meta.totalPages} onClick={() => onPage(page + 1)}>Next<ChevronRight className="h-4 w-4"/></Button></div></div>; }
export function Modal({ title, children, onClose, wide = false }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  const headingId = useId();
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const previousFocus = document.activeElement;
    const selector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = () => [...dialog.querySelectorAll(selector)].filter((node) => !node.hasAttribute("hidden") && node.getAttribute("aria-hidden") !== "true");
    const first = focusable()[0];
    (first || dialog).focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current?.(); return; }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) { event.preventDefault(); dialog.focus(); return; }
      const firstItem = items[0]; const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) { event.preventDefault(); lastItem.focus(); }
      else if (!event.shiftKey && document.activeElement === lastItem) { event.preventDefault(); firstItem.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => { document.removeEventListener("keydown", handleKeyDown); if (previousFocus?.isConnected) previousFocus.focus?.(); };
  }, []);
  if (!title) return null;
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-3 backdrop-blur-[2px]" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}><section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={headingId} className={`max-h-[90vh] w-full ${wide ? "max-w-4xl" : "max-w-xl"} overflow-hidden rounded-2xl bg-white shadow-2xl`}><header className="flex items-center justify-between border-b border-[#eee] px-5 py-4"><h2 id={headingId} className="font-bold text-[#191a1d]">{title}</h2><Button variant="ghost" size="sm" onClick={onClose}>Close</Button></header><div className="max-h-[calc(90vh-64px)] overflow-y-auto p-5">{children}</div></section></div>;
}
export function Table({ columns, rows, getRowKey = (row) => row._id || row.id, onRowClick }) { return <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="table-head"><tr>{columns.map((col) => <th key={col.key} className="px-4 py-3">{col.label}</th>)}</tr></thead><tbody className="divide-y divide-[#f0f0ef]">{rows.map((row) => <tr key={getRowKey(row)} className={`table-row ${onRowClick ? "cursor-pointer" : ""}`} onClick={() => onRowClick?.(row)}>{columns.map((col) => <td key={col.key} className="px-4 py-3.5 align-middle text-[#41434a]">{col.render ? col.render(row) : row[col.key] ?? "—"}</td>)}</tr>)}</tbody></table></div>; }

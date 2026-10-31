export const humanize = (value = "") => String(value).replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
export const formatDate = (value, options = { day: "numeric", month: "short", year: "numeric" }) => value ? new Intl.DateTimeFormat(undefined, options).format(new Date(value)) : "—";
export const formatDateTime = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
export const money = (range) => {
  if (!range || (range.min == null && range.max == null)) return "Compensation not disclosed";
  const currency = range.currency || "INR";
  const fmt = (amount) => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  if (range.min != null && range.max != null) return `${fmt(range.min)} – ${fmt(range.max)}`;
  return range.min != null ? `From ${fmt(range.min)}` : `Up to ${fmt(range.max)}`;
};
export const getErrorMessage = (error, fallback = "Something went wrong. Please try again.") => error?.message || fallback;
export const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
export const getId = (value) => value?._id || value?.id || value;

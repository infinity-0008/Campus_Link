import { GraduationCap } from "lucide-react";
import { Link } from "react-router-dom";
export default function Logo({ to = "/", onDark = false }) {
  return <Link to={to} className="inline-flex items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-brand-red"><span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-red text-white shadow-sm"><GraduationCap className="h-5 w-5"/></span><span className={`text-[16px] font-extrabold tracking-tight ${onDark ? "text-white" : "text-[#17181b]"}`}>Campus<span className="text-brand-red">Link</span></span></Link>;
}

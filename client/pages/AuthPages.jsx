import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { ArrowLeft, ArrowRight, Eye, EyeOff, GraduationCap, ShieldCheck, Building2, UserRound } from "lucide-react";
import toast from "react-hot-toast";
import { authApi } from "@/api/auth.api.js";
import { useAuth } from "@/features/auth/AuthContext.jsx";
import { getRoleHome } from "@/features/auth/roles.js";
import { Button } from "@/components/ui/index.jsx";

const roleOptions = [
  { id: "student", label: "Student", icon: UserRound, copy: "Discover and apply to opportunities" },
  { id: "recruiter", label: "Recruiter", icon: Building2, copy: "Manage openings and applicants" },
  { id: "admin", label: "Placement Admin", icon: ShieldCheck, copy: "Oversee campus recruitment" },
];

function AuthFrame({ children, mode = "login" }) {
  return (
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-[#05070a] px-4 py-12 text-[#dfe7e0] sm:py-16">
      {/* Landing page themed atmospheric gradients & cosmic rings */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(circle at 50% -15%, rgba(224, 35, 28, 0.22), transparent 55%), radial-gradient(circle at 85% 25%, rgba(255, 90, 60, 0.08), transparent 45%), #05070a",
        }}
      />
      <div className="pointer-events-none absolute -right-36 -top-40 h-[560px] w-[560px] rounded-sm border border-white/[.04] shadow-[0_0_100px_rgba(224,35,28,0.06)]" />
      <div className="pointer-events-none absolute -right-16 -top-20 h-[380px] w-[380px] rounded-sm border border-[#e0231c]/15" />
      <div className="pointer-events-none absolute -left-40 top-1/2 h-[480px] w-[480px] -translate-y-1/2 rounded-sm border border-white/[.03]" />

      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[.9fr_1.1fr]">
        <section className="hidden max-w-lg lg:block">
          <div className="mb-8 inline-flex items-center gap-2.5 rounded-sm border border-white/10 bg-white/[.04] px-3.5 py-1.5 text-[11px] font-semibold tracking-[.18em] text-[#dfe7e0] shadow-sm">
            <span className="h-1.5 w-1.5 rounded-none bg-[#e0231c] shadow-[0_0_8px_#e0231c]" /> ONE CONNECTED PLACEMENT JOURNEY
          </div>
          <h1 className="text-5xl font-extrabold leading-[1.08] tracking-[-.045em] text-[#dfe7e0]">
            Your campus.<br />
            <span className="text-[#e0231c] drop-shadow-[0_0_30px_rgba(224,35,28,0.35)]">Connected</span> to opportunity.
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-7 text-[#8b958f]">
            A clearer way for students, recruiters and placement administrators to move from potential to placement.
          </p>
          <div className="mt-12 grid grid-cols-3 gap-3">
            {[
              { icon: GraduationCap, title: "Students", sub: "Build your story" },
              { icon: Building2, title: "Recruiters", sub: "Find the right fit" },
              { icon: ShieldCheck, title: "Placement", sub: "Guide the journey" },
            ].map((item) => (
              <div
                key={item.title}
                className="group rounded-sm border border-white/[.08] bg-[#0c1015]/70 p-4 backdrop-blur-md transition-all duration-300 hover:border-[#e0231c]/40 hover:shadow-[0_0_20px_rgba(224,35,28,0.15)]"
              >
                <item.icon className="h-5 w-5 text-[#e0231c] transition-transform duration-300 group-hover:scale-110" />
                <p className="mt-4 text-sm font-bold text-[#dfe7e0]">{item.title}</p>
                <p className="mt-1 text-[10px] text-[#78837c]">{item.sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Boxy Form Container */}
        <section className="mx-auto w-full max-w-[510px] rounded-sm border border-white/[.14] bg-[#0a0d12]/92 p-6 shadow-[0_25px_70px_rgba(0,0,0,0.8),0_0_40px_rgba(224,35,28,0.08)] backdrop-blur-xl sm:p-9">
          {children}
          <p className="mt-8 border-t border-white/10 pt-5 text-center text-[10px] leading-5 text-[#78837c]">
            By continuing, you agree to use CampusLink responsibly. Your account permissions are determined by the placement platform.
          </p>
        </section>
      </div>
    </div>
  );
}

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const paramRole = searchParams.get("role");
  const [role, setRole] = useState(paramRole && ["student", "recruiter", "admin"].includes(paramRole) ? paramRole : "student");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ defaultValues: { email: "", password: "" } });

  const submit = async (values) => {
    setBusy(true);
    try {
      const result = await authApi.login({ ...values, role });
      await signIn(result.token, result.user);
      toast.success("Welcome back to CampusLink");
      navigate(getRoleHome(result.user.role), { replace: true });
    } catch (error) {
      toast.error(error.message || "Unable to sign in");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame>
      <div>
        <Link to="/" className="mb-7 inline-flex items-center gap-2 text-xs font-semibold text-[#8b958f] transition hover:text-[#dfe7e0]">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to campus
        </Link>
        <p className="text-[10px] font-bold uppercase tracking-[.25em] text-[#e0231c]">WELCOME BACK</p>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#dfe7e0]">Sign in to your workspace</h2>
        <p className="mt-2 text-sm text-[#8b958f]">Choose your account type, then continue securely.</p>
      </div>

      <form onSubmit={handleSubmit(submit)} className="mt-7 space-y-5">
        <div>
          <p className="mb-2 text-xs font-semibold text-[#dfe7e0]/70">I am signing in as</p>
          <div className="grid grid-cols-3 gap-2">
            {roleOptions.map((item) => {
              const Icon = item.icon;
              const isSelected = role === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setRole(item.id)}
                  className={`rounded-sm border p-3 text-left transition-all ${
                    isSelected
                      ? "border-[#e0231c] bg-[#e0231c]/15 text-[#dfe7e0] shadow-[0_0_20px_rgba(224,35,28,0.25)]"
                      : "border-white/[.08] bg-white/[.02] text-[#8b958f] hover:border-white/20 hover:text-[#dfe7e0]"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isSelected ? "text-[#e0231c]" : "text-[#78837c]"}`} />
                  <p className="mt-2 text-[11px] font-bold leading-4">{item.label}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="form-label !text-[#dfe7e0]/80" htmlFor="login-email">
            Email address
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@university.edu"
            className="form-control !rounded-sm !border-white/[.12] !bg-[#05070a]/80 !text-[#dfe7e0] placeholder:!text-[#52575f] focus:!border-[#e0231c] focus:!ring-2 focus:!ring-[#e0231c]/20"
            {...register("email", {
              required: "Email is required",
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email address" },
            })}
          />
          {errors.email && <p className="form-error">{errors.email.message}</p>}
        </div>

        <div>
          <label className="form-label !text-[#dfe7e0]/80" htmlFor="login-password">
            Password
          </label>
          <div className="relative">
            <input
              id="login-password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              className="form-control !rounded-sm !border-white/[.12] !bg-[#05070a]/80 !pr-12 !text-[#dfe7e0] placeholder:!text-[#52575f] focus:!border-[#e0231c] focus:!ring-2 focus:!ring-[#e0231c]/20"
              {...register("password", { required: "Password is required" })}
            />
            <button
              type="button"
              aria-label={show ? "Hide password" : "Show password"}
              onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#78837c] transition hover:text-[#dfe7e0]"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="form-error">{errors.password.message}</p>}
        </div>

        <Button
          type="submit"
          loading={busy}
          className="w-full !rounded-sm !bg-[#e0231c] !py-3.5 !font-bold !text-white shadow-[0_8px_25px_rgba(224,35,28,0.4)] transition hover:!bg-[#bf1d17] hover:shadow-[0_8px_30px_rgba(224,35,28,0.55)]"
        >
          Sign in <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-[#8b958f]">
        New to CampusLink?{" "}
        <Link to="/register" className="font-bold text-[#dfe7e0] transition hover:text-[#e0231c]">
          Create an account
        </Link>
      </p>
    </AuthFrame>
  );
}

export function RegisterPage() {
  const [searchParams] = useSearchParams();
  const paramRole = searchParams.get("role");
  const [role, setRole] = useState(paramRole === "recruiter" ? "recruiter" : "student");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: { name: "", email: "", password: "", confirmPassword: "", company: "", designation: "", website: "" },
  });
  const password = watch("password");

  const submit = async (values) => {
    setBusy(true);
    try {
      const payload = { name: values.name, email: values.email, password: values.password, role };
      if (role === "recruiter") {
        Object.assign(payload, { company: values.company, designation: values.designation, website: values.website || undefined });
      }
      const result = await authApi.register(payload);
      await signIn(result.token, result.user);
      toast.success(role === "recruiter" ? "Account created. Approval is pending." : "Your student account is ready.");
      navigate(getRoleHome(result.user.role), { replace: true });
    } catch (error) {
      toast.error(error.message || "Unable to create account");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame mode="register">
      <div>
        <Link to="/" className="mb-7 inline-flex items-center gap-2 text-xs font-semibold text-[#8b958f] transition hover:text-[#dfe7e0]">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to campus
        </Link>
        <p className="text-[10px] font-bold uppercase tracking-[.25em] text-[#e0231c]">JOIN CAMPUSLINK</p>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#dfe7e0]">Create your account</h2>
        <p className="mt-2 text-sm text-[#8b958f]">One account, the right workspace for your role.</p>
      </div>

      <form onSubmit={handleSubmit(submit)} className="mt-7 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {["student", "recruiter"].map((item) => {
            const isSelected = role === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setRole(item)}
                className={`rounded-sm border px-3 py-3 text-sm font-bold capitalize transition-all ${
                  isSelected
                    ? "border-[#e0231c] bg-[#e0231c]/15 text-[#dfe7e0] shadow-[0_0_20px_rgba(224,35,28,0.25)]"
                    : "border-white/[.08] bg-white/[.02] text-[#8b958f] hover:border-white/20 hover:text-[#dfe7e0]"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>

        <div>
          <label className="form-label !text-[#dfe7e0]/80">Full name</label>
          <input
            className="form-control !rounded-sm !border-white/[.12] !bg-[#05070a]/80 !text-[#dfe7e0] placeholder:!text-[#52575f] focus:!border-[#e0231c] focus:!ring-2 focus:!ring-[#e0231c]/20"
            placeholder="Your full name"
            {...register("name", { required: "Name is required", minLength: { value: 2, message: "Enter at least two characters" } })}
          />
          {errors.name && <p className="form-error">{errors.name.message}</p>}
        </div>

        <div>
          <label className="form-label !text-[#dfe7e0]/80">Email address</label>
          <input
            type="email"
            className="form-control !rounded-sm !border-white/[.12] !bg-[#05070a]/80 !text-[#dfe7e0] placeholder:!text-[#52575f] focus:!border-[#e0231c] focus:!ring-2 focus:!ring-[#e0231c]/20"
            placeholder="you@university.edu"
            {...register("email", {
              required: "Email is required",
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email address" },
            })}
          />
          {errors.email && <p className="form-error">{errors.email.message}</p>}
        </div>

        {role === "recruiter" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label !text-[#dfe7e0]/80">Company</label>
              <input
                className="form-control !rounded-sm !border-white/[.12] !bg-[#05070a]/80 !text-[#dfe7e0] placeholder:!text-[#52575f] focus:!border-[#e0231c] focus:!ring-2 focus:!ring-[#e0231c]/20"
                {...register("company", { required: "Company is required" })}
              />
              {errors.company && <p className="form-error">{errors.company.message}</p>}
            </div>
            <div>
              <label className="form-label !text-[#dfe7e0]/80">Designation</label>
              <input
                className="form-control !rounded-sm !border-white/[.12] !bg-[#05070a]/80 !text-[#dfe7e0] placeholder:!text-[#52575f] focus:!border-[#e0231c] focus:!ring-2 focus:!ring-[#e0231c]/20"
                {...register("designation", { required: "Designation is required" })}
              />
              {errors.designation && <p className="form-error">{errors.designation.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="form-label !text-[#dfe7e0]/80">
                Company website <span className="font-normal text-[#78837c]">(optional)</span>
              </label>
              <input
                className="form-control !rounded-sm !border-white/[.12] !bg-[#05070a]/80 !text-[#dfe7e0] placeholder:!text-[#52575f] focus:!border-[#e0231c] focus:!ring-2 focus:!ring-[#e0231c]/20"
                placeholder="https://company.com"
                {...register("website")}
              />
            </div>
          </div>
        )}

        <div>
          <label className="form-label !text-[#dfe7e0]/80">Password</label>
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              className="form-control !rounded-sm !border-white/[.12] !bg-[#05070a]/80 !pr-12 !text-[#dfe7e0] placeholder:!text-[#52575f] focus:!border-[#e0231c] focus:!ring-2 focus:!ring-[#e0231c]/20"
              {...register("password", { required: "Password is required", minLength: { value: 8, message: "Use at least 8 characters" } })}
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              aria-label="Toggle password visibility"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#78837c] transition hover:text-[#dfe7e0]"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="form-error">{errors.password.message}</p>}
        </div>

        <div>
          <label className="form-label !text-[#dfe7e0]/80">Confirm password</label>
          <input
            type={show ? "text" : "password"}
            className="form-control !rounded-sm !border-white/[.12] !bg-[#05070a]/80 !text-[#dfe7e0] placeholder:!text-[#52575f] focus:!border-[#e0231c] focus:!ring-2 focus:!ring-[#e0231c]/20"
            {...register("confirmPassword", {
              required: "Confirm your password",
              validate: (value) => value === password || "Passwords do not match",
            })}
          />
          {errors.confirmPassword && <p className="form-error">{errors.confirmPassword.message}</p>}
        </div>

        <Button
          type="submit"
          loading={busy}
          className="w-full !rounded-sm !bg-[#e0231c] !py-3.5 !font-bold !text-white shadow-[0_8px_25px_rgba(224,35,28,0.4)] transition hover:!bg-[#bf1d17] hover:shadow-[0_8px_30px_rgba(224,35,28,0.55)]"
        >
          Create {role === "student" ? "student" : "recruiter"} account <ArrowRight className="h-4 w-4" />
        </Button>

        {role === "recruiter" && (
          <p className="rounded-sm border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-[11px] leading-5 text-amber-100/75">
            Recruiter accounts start as pending and require Placement Admin approval before jobs can be published.
          </p>
        )}
      </form>

      <p className="mt-6 text-center text-xs text-[#8b958f]">
        Already registered?{" "}
        <Link to="/login" className="font-bold text-[#dfe7e0] transition hover:text-[#e0231c]">
          Sign in
        </Link>
      </p>
    </AuthFrame>
  );
}

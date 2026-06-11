import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/Logo";
import { useServerFn } from "@tanstack/react-start";
import { submitContactMessage } from "@/server/contact.functions";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact us — SwipeBite" },
      { name: "description", content: "Get in touch with the SwipeBite team." },
    ],
  }),
  component: Contact,
});

function Contact() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const submitFn = useServerFn(submitContactMessage);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session?.user.email) setEmail(session.user.email);
  }, [session]);

  useEffect(() => {
    if (!authLoading && !session) {
      toast.error("Please sign in to contact us.");
      navigate({ to: "/auth" });
    }
  }, [authLoading, session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length === 0 || message.length > 5000) {
      toast.error("Message must be 1–5000 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await submitFn({ data: { email, message } });
      if (!res.ok) {
        toast.error(res.error ?? "Couldn't send message.");
      } else {
        toast.success("Message sent — we'll be in touch.");
        setMessage("");
      }
    } catch {
      toast.error("Couldn't send message. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-soft)" }}>
      <header className="mx-auto flex max-w-md items-center justify-between px-6 py-5">
        <Logo />
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Home</Link>
      </header>
      <main className="mx-auto max-w-md px-6 pb-12">
        <form onSubmit={submit} className="rounded-3xl bg-card p-7" style={{ boxShadow: "var(--shadow-card)" }}>
          <h1 className="text-2xl font-bold">Contact us</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Questions, feedback, or a meal you want to see? Drop us a line.
          </p>
          <div className="mt-5 space-y-3">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} readOnly maxLength={255} />
            </div>
            <div>
              <Label htmlFor="msg">Message</Label>
              <Textarea id="msg" required rows={5} maxLength={5000} value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="mt-4 w-full rounded-full">
            {loading ? "Sending…" : "Send"}
          </Button>
        </form>
      </main>
    </div>
  );
}

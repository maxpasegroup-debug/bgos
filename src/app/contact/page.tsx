export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#0B0F14] px-6 py-16 text-white sm:px-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight">Contact</h1>
        <p className="mt-4 text-white/70">
          Reach us at{" "}
          <a href="mailto:hello@bgos.online" className="text-amber-300 hover:underline">
            hello@bgos.online
          </a>{" "}
          or WhatsApp +91 80892 39823.
        </p>
      </div>
    </main>
  );
}

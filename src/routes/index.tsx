import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

import pancakes from "@/assets/meal-pancakes.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Swipe & Bite — Dating, but for dinner" },
      {
        name: "description",
        content:
          "Match with breakfast, lunch, dinner & dessert that actually loves you back. Hearts, flirty messages, zero ghosting.",
      },
      { property: "og:title", content: "Swipe & Bite — Dating, but for dinner" },
      {
        property: "og:description",
        content: "Swipe right on your next meal.",
      },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  return (
    <div className="min-h-screen gradient-sunrise relative overflow-hidden">
       {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          aria-hidden
          className="absolute text-2xl pointer-events-none select-none"
          style={{
            left: `${5 + i * 12}%`,
            bottom: `-10%`,
            color: "hsl(350 90% 48% / 0.28)",
          }}
          animate={{
            y: [0, -(typeof window !== "undefined" ? window.innerHeight * 1.3 : 900)],
            opacity: [0, 0.35, 0.25, 0],
          }}
          transition={{
            duration: 9 + i * 1.4,
            repeat: Infinity,
            delay: i * 1.1,
            ease: "linear",
          }}
        >
          ♥
        </motion.div>
      ))}
      <div className="max-w-xl mx-auto px-6 pt-16 pb-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 mb-12"
        >
          <Heart
            className="h-8 w-8 animate-heartbeat"
            style={{ color: "hsl(350 90% 48%)" }}
            fill="currentColor"
          />
          <span className="font-display text-3xl font-black tracking-tight">
            Swipe &amp; Bite
          </span>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-xs font-bold uppercase tracking-[0.2em] mb-3"
          style={{ color: "hsl(350 90% 48%)" }}
        >
          ♥ Dating, but for dinner
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="font-display text-5xl sm:text-6xl font-black leading-[0.95] text-balance"
        >
          Swipe right on your <span className="italic text-romance">next meal.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-5 text-lg max-w-md leading-relaxed"
          style={{ color: "hsl(345 25% 38%)" }}
        >
          Match with breakfast, lunch, dinner & dessert that actually loves you back. Hearts,
          flirty messages, zero ghosting.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 flex flex-col gap-3"
        >
          <Button asChild size="lg" className="group rounded-full text-base h-14">
            <Link to="/auth">
              Find my match
              <Heart
                className="ml-2 h-5 w-5 group-hover:animate-heartbeat"
                fill="currentColor"
              />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="lg" className="rounded-full">
            <Link to="/auth">I already have an account</Link>
          </Button>
        </motion.div>

      </div>

      {/* Floating meal cards */}
      <motion.img
        src={pancakes}
        alt=""
        aria-hidden
        className="absolute -right-12 top-20 w-40 h-52 sm:w-56 sm:h-72 object-cover rounded-[2rem] shadow-card rotate-6"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
    </div>
  );
}

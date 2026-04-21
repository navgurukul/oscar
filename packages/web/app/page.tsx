"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { LampContainer } from "@/components/ui/lamp";
import { LayoutTextFlip } from "@/components/ui/layout-text-flip";
import { AnimatedTestimonials } from "@/components/ui/animated-testimonials";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Check, Mic, Sparkles, FileText, Zap, Clock, Brain, Download, Radio, BookOpen, Users, Lock } from "lucide-react";

// ── Inline app icon SVGs for the Stream section ───────────────────────────────
const StreamAppIcons = {
  Slack: () => (
    <div title="Slack" className="text-slate-400 hover:text-[#E01E5A] transition-colors duration-200">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/></svg>
    </div>
  ),
  Notion: () => (
    <div title="Notion" className="text-slate-400 hover:text-slate-100 transition-colors duration-200">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.98-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.166V6.354c0-.606-.233-.933-.748-.886l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.886.747-.933zM2.64 1.782l13.168-.933c1.634-.14 2.055-.047 3.082.7l4.25 2.986c.7.513.933.653.933 1.166v16.157c0 1.026-.373 1.633-1.681 1.726l-15.458.933c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.996c0-.84.374-1.54 1.59-1.214z"/></svg>
    </div>
  ),
  VSCode: () => (
    <div title="VS Code" className="text-slate-400 hover:text-[#007ACC] transition-colors duration-200">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z"/></svg>
    </div>
  ),
  Gmail: () => (
    <div title="Gmail" className="text-slate-400 hover:text-[#EA4335] transition-colors duration-200">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/></svg>
    </div>
  ),
  Discord: () => (
    <div title="Discord" className="text-slate-400 hover:text-[#5865F2] transition-colors duration-200">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
    </div>
  ),
  Figma: () => (
    <div title="Figma" className="text-slate-400 hover:text-[#F24E1E] transition-colors duration-200">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M15.852 8.981h-4.588V0h4.588c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.491-4.49 4.491zM12.735 7.51h3.117c1.665 0 3.019-1.355 3.019-3.019s-1.355-3.019-3.019-3.019h-3.117V7.51zm0 1.471H8.148c-2.476 0-4.49-2.014-4.49-4.49S5.672 0 8.148 0h4.588v8.981zm-4.587-7.51c-1.665 0-3.019 1.355-3.019 3.019s1.354 3.02 3.019 3.02h3.117V1.471H8.148zm4.587 15.019H8.148c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h4.588v8.98zM8.148 8.981c-1.665 0-3.019 1.355-3.019 3.019s1.355 3.019 3.019 3.019h3.117V8.981H8.148zM8.172 24c-2.489 0-4.515-2.014-4.515-4.49s2.014-4.49 4.49-4.49h4.588v4.441c0 2.503-2.047 4.539-4.563 4.539zm-.024-7.51a3.023 3.023 0 0 0-3.019 3.019c0 1.665 1.365 3.019 3.044 3.019 1.705 0 3.093-1.376 3.093-3.068v-2.97H8.148zm7.704 0h-.098c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h.098c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.49-4.49 4.49zm-.098-7.509c-1.665 0-3.019 1.355-3.019 3.019s1.355 3.019 3.019 3.019h.098c1.665 0 3.019-1.355 3.019-3.019s-1.355-3.019-3.019-3.019h-.098z"/></svg>
    </div>
  ),
};
import { FadeIn, listVariants, itemVariants } from "@/components/ui/fade-in";
import { useAuth } from "@/lib/contexts/AuthContext";

import { notesService } from "@/lib/services/notes.service";
import type { DBNote } from "@/lib/types/note.types";
import { PRICING, PRICING_USD, SUBSCRIPTION_CONFIG, type Currency, UI_STRINGS, ROUTES } from "@/lib/constants";
import type { BillingCycle } from "@/lib/types/subscription.types";
import img1 from "@/components/ui/assets/image_1.png";
import img2 from "@/components/ui/assets/image_2.jpg";
import img3 from "@/components/ui/assets/image_3.jpg";
import img4 from "@/components/ui/assets/image_4.png";

const TESTIMONIALS = [
  {
    quote:
      "Oscar has completely improved the way I handle my daily tasks, offering fast and accurate speech-to-text transcription along with seamless editing, sharing, and downloading features, all within a user-friendly platform that keeps everything organized and efficient.",
    name: "Saloni Panwar",
    designation: "Frontend Developer",
    src: img1,
  },
  {
    quote:
      "The design is minimal, modern, and easy to read. The layout, spacing, and typography make the product look like very attractive.t is more affordable compared to others, making it a better choice for users. Its lower price makes it more attractive and easier for people to use. Because it is more budget-friendly than others, more users will prefer it.",
    name: "Roshni Jha",
    designation: "Frontend Developer",
    src: img2,
  },
  {
    quote:
      "OSCAR is really helpful for turning voice notes into clear text. It saves time and makes capturing ideas much easier. I find it very useful for learning and work notes",
    name: "Komal Ahire",
    designation: "Senior Fullstack Developer",
    src: img3,
  },
  {
    quote:
      "Oscar is an amazing and user-friendly tool that quickly converts speech into text with good accuracy. It saves a lot of time, especially for long content, and works smoothly in daily use. The easy sharing feature across different platforms makes it even more convenient and helpful. Overall, it is a great time-saving and productive tool.",
    name: "Sanjna Panwar",
    designation: "Senior Backend Developer",
    src: img4,
  },
];

export default function Home() {
  const { session, user } = useAuth();
  const [recentNotes, setRecentNotes] = useState<DBNote[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const router = useRouter();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [currency, setCurrency] = useState<Currency>("INR");

  useEffect(() => {
    if (session) {
      loadRecentNotes();
    }
  }, [session]);

  const loadRecentNotes = async () => {
    setIsLoadingNotes(true);
    const { data, error } = await notesService.getNotes();
    if (!error && data) {
      setRecentNotes(data.slice(0, 3));
    }
    setIsLoadingNotes(false);
  };

  // Recording CTA is currently disabled; uncomment when re-enabling "New Note" button

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();

    // Use calendar dates (not 24-hour chunks) for accurate "Today/Yesterday" calculation
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffDays = Math.floor(
      (nowOnly.getTime() - dateOnly.getTime()) / (1000 * 3600 * 24)
    );

    const time = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).toUpperCase();

    if (diffDays === 0) return "Today, " + time;
    if (diffDays === 1) return "Yesterday, " + time;

    return diffDays + " days ago";
  };

  const handleViewPricing = () => {
    router.push("/auth?redirectTo=/pricing");
  };

  const pricingConfig = currency === "USD" ? PRICING_USD : PRICING;
  const price = billingCycle === "monthly" ? pricingConfig.MONTHLY : pricingConfig.YEARLY;
  const monthlyEquivalent =
    billingCycle === "yearly" ? (pricingConfig.YEARLY / 12).toFixed(2) : null;
  const currencySymbol = currency === "USD" ? "$" : "₹";

  if (session) {
    const firstName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || "there";

    // If no notes exist and not loading, show the empty state UI
    if (!isLoadingNotes && recentNotes.length === 0) {
      return (
        <main className="flex flex-col items-center pt-8 pb-24 px-4 bg-[#020617] relative">
        {/* Top Decoration */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center max-w-2xl w-full mt-8"
        >
            {/* Top Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/50 border border-cyan-500/30 text-cyan-400 text-xs font-medium mb-8 backdrop-blur-sm"
            >
              <Sparkles className="w-3 h-3" />
              <span>AI-Powered Streams</span>
            </motion.div>

            {/* App Name / Logo */}
            <h1 className="text-6xl md:text-7xl font-bold font-serif text-white mb-6 tracking-tight">
              Start a Stream
            </h1>
            
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="h-px w-8 bg-gradient-to-r from-transparent to-cyan-500/50" />
              <p className="text-lg md:text-xl text-gray-400 font-medium italic">
                Your voice, written your way.
              </p>
              <div className="h-px w-8 bg-gradient-to-l from-transparent to-cyan-500/50" />
            </div>

            {/* Empty State Illustration */}
            <div className="relative mb-12">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/5 blur-[100px] rounded-full" />
              
              <div className="relative w-28 h-28 md:w-36 md:h-36 bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-white/5 rounded-[2.5rem] flex items-center justify-center mx-auto backdrop-blur-md shadow-2xl group transition-all duration-500 hover:border-cyan-500/20">
                <div className="absolute inset-0 border border-cyan-500/10 rounded-[2.5rem] animate-pulse" />
                
                <div className="relative">
                  <FileText className="w-10 h-10 md:w-14 md:h-14 text-cyan-400/70 group-hover:text-cyan-400 transition-colors duration-500" />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 md:w-6 md:h-6 bg-cyan-500 rounded-lg flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-500">
                    <Mic className="w-2.5 h-2.5 md:w-3 md:h-3 text-slate-950" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-2xl md:text-3xl font-semibold text-white/90 tracking-tight">
                Scribble is empty for now.
              </h3>
              <p className="text-gray-500 text-lg md:text-xl max-w-md mx-auto leading-relaxed">
                Tap the mic button below to start your first Stream. Your first Scribble will land here automatically.
              </p>
            </div>
          </motion.div>

          {/* Bottom indicator for the floating record button */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 1 }}
            className="absolute bottom-32 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          >
            <div className="w-px h-12 bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent" />
          </motion.div>
        </main>
      );
    }

    // If notes exist, show the dashboard UI
    return (
      <main className="flex flex-col items-center pt-8 pb-24 px-4 bg-[#020617] relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl flex flex-col items-center mt-8"
        >
          {/* Welcome Text */}
          <div className="text-center mb-12">
            <p className="text-cyan-400 font-medium mb-2">Welcome back, {firstName}</p>
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
              Start a Stream
            </h1>
          </div>

        

          {/* Recent Transcriptions Section */}
          <div className="w-full mb-12">
            <h2 className="text-gray-400 font-medium mb-6 text-center">Recent Scribbles</h2>
            
            <div className="space-y-3">
              {isLoadingNotes ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-slate-900/50 rounded-2xl animate-pulse border border-white/5" />
                ))
              ) : recentNotes.length > 0 ? (
                recentNotes.map((note) => (
                  <Link key={note.id} href={`${ROUTES.NOTES}/${note.id}`}>
                    <div className="w-full p-4 mb-3 bg-slate-900/40 hover:bg-slate-900/60 border border-white/5 hover:border-cyan-500/20 rounded-2xl flex flex-col transition-all group">
                      <div className="flex items-center justify-between gap-4 mb-1">
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5 text-cyan-400" />
                          </div>
                          <h4 className="text-white font-semibold truncate">
                            {note.title || UI_STRINGS.UNTITLED_NOTE}
                          </h4>
                        </div>
                        <p className="text-gray-500 text-xs ml-4 shrink-0">
                          {formatDate(note.created_at)}
                        </p>
                      </div>
                      <p className="text-gray-400 text-sm line-clamp-1 ml-14">
                        {note.original_formatted_text}
                      </p>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-10 bg-slate-900/20 rounded-2xl border border-dashed border-white/10">
                  <p className="text-gray-500 italic">No Scribbles yet. Start a Stream and capture your first idea.</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </main>
    );
  }

  return (
      <main className="flex flex-col items-center pt-8 pb-24 px-4">
        {/* Hero Section */}
        <section className="flex items-center justify-center min-h-[80vh]">
        <LampContainer >
          <motion.div
            initial={{ opacity: 0.5, y: 100 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.3,
              duration: 0.8,
              ease: "easeInOut",
            }}
            className="mt-8 text-center px-4"
          >
            <div className="bg-gradient-to-br from-slate-300 to-slate-500 py-4 bg-clip-text text-4xl font-medium tracking-tight text-transparent md:text-7xl">
              <LayoutTextFlip
                text="Bring your ideas to light."
                words={[
                  "Let AI write.",
                  "Let AI refine.",
                  "Let AI transform.",
                  "Create effortlessly.",
                ]}
                duration={3000}
              />
            </div>
            <p className="mt-10 text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
              Stream into any app. Capture every meeting. Build your knowledge base.
            </p>
           
            {!session && (
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  onClick={() => router.push("/download")}
                  size="lg"
                  className="bg-cyan-500 hover:bg-cyan-600 text-white px-10 py-7 text-xl font-semibold shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all duration-300 hover:scale-105"
                >
                  <Download className="w-6 h-6 mr-3" />
                  Download Free
                </Button>
                <Button
                  onClick={() => {
                    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  size="lg"
                  variant="outline"
                  className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300 px-10 py-7 text-lg transition-all duration-300"
                >
                  See How It Works
                </Button>
              </div>
            )}
          </motion.div>
        </LampContainer>
      </section>

      {!session && (
        <>
          {/* Problem Statement Section */}
      <section className="min-h-[80vh] flex items-center justify-center py-16 sm:py-24 px-4 mt-8">
            <div className="max-w-6xl mx-auto">
              <FadeIn className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                  Your <span className="text-cyan-500">Best Ideas</span> Vanish Before You Type Them
                </h2>
                <p className="text-gray-300 text-lg md:text-xl max-w-3xl mx-auto">
                  That perfect thought you had while walking? Gone by the time you open your laptop.
                </p>
              </FadeIn>

              <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                <FadeIn delay={0.1}>
                  <div className="bg-slate-900/50 border border-cyan-500/20 hover:border-cyan-500/40 rounded-xl p-6 card-lift group h-full">
                    <div className="text-cyan-300 mb-4 icon-spring w-fit">
                      <Clock className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-3">Ideas Fade Fast</h3>
                    <p className="text-gray-400">
                      The perfect words you thought of? Gone before you start typing.
                    </p>
                  </div>
                </FadeIn>

                <FadeIn delay={0.2}>
                  <div className="bg-slate-900/50 border border-cyan-500/20 hover:border-cyan-500/40 rounded-xl p-6 card-lift group h-full">
                    <div className="text-cyan-300 mb-4 icon-spring w-fit">
                      <FileText className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-3">Voice Notes Are Messy</h3>
                    <p className="text-gray-400">
                      Full of ums and uhs. Too embarrassing to share with anyone.
                    </p>
                  </div>
                </FadeIn>

                <FadeIn delay={0.3}>
                  <div className="bg-slate-900/50 border border-cyan-500/20 hover:border-cyan-500/40 rounded-xl p-6 card-lift group h-full">
                    <div className="text-cyan-300 mb-4 icon-spring w-fit">
                      <Zap className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-3">Typing Kills Momentum</h3>
                    <p className="text-gray-400">
                      Switching to your phone or laptop breaks your flow. By the time you&apos;re typing, the moment&apos;s gone.
                    </p>
                  </div>
                </FadeIn>
              </div>
            </div>
          </section>

          {/* Three Modes Section */}
          <section id="how-it-works" className="py-24 px-4 mt-8">
            <div className="max-w-6xl mx-auto">
              <FadeIn className="text-center mb-20">
                <p className="text-cyan-400 text-sm font-semibold uppercase tracking-widest mb-4">Three ways to use OSCAR</p>
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                  One app. Three <span className="text-cyan-500">superpowers.</span>
                </h2>
                <p className="text-gray-300 text-lg md:text-xl max-w-3xl mx-auto">
                  Whether you&apos;re dictating on the fly, capturing a full meeting, or building a personal knowledge base, OSCAR has a mode built for it
                </p>
              </FadeIn>

              {/* oscar Stream */}
              <FadeIn delay={0.05}>
              <div className="mb-16 rounded-2xl border border-cyan-500/20 hover:border-cyan-500/40 bg-gradient-to-br from-slate-900 to-slate-950 overflow-hidden card-lift group">
                <div className="grid md:grid-cols-2 gap-0">
                  <div className="p-10 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center icon-spring">
                        <Radio className="w-5 h-5 text-cyan-400" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-3 py-1">oscar Stream</span>
                    </div>
                    <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
                      Dictate into <span className="text-cyan-400">anything</span>, anywhere.
                    </h3>
                    <p className="text-gray-300 text-lg mb-6 leading-relaxed">
                      Hold <kbd className="key-press inline-block px-2 py-0.5 text-sm font-mono font-semibold bg-slate-800 border border-slate-600 border-b-2 rounded text-slate-200">Ctrl</kbd> + <kbd className="key-press inline-block px-2 py-0.5 text-sm font-mono font-semibold bg-slate-800 border border-slate-600 border-b-2 rounded text-slate-200">Space</kbd> from anywhere on your computer and speak. OSCAR types the cleaned, AI-polished text directly into Slack, Notion, Gmail, VS Code, or any app you&apos;re using.
                    </p>
                    <motion.ul
                      variants={listVariants}
                      initial="hidden"
                      whileInView="show"
                      viewport={{ once: true }}
                      className="space-y-3"
                    >
                      {["Global hotkey. No app switching needed", "AI removes filler words & fixes grammar instantly", "Works in every app on your system", "Hinglish & 30+ language support"].map((f) => (
                        <motion.li key={f} variants={itemVariants} className="flex items-center gap-3 text-gray-300">
                          <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                          <span>{f}</span>
                        </motion.li>
                      ))}
                    </motion.ul>
                  </div>
                  <div className="bg-slate-950/60 p-10 flex items-center justify-center min-h-[280px]">
                    <div className="text-center space-y-6">
                      <div className="flex items-center justify-center gap-3">
                        <kbd className="key-press px-4 py-2.5 text-base font-mono font-bold bg-slate-800 border border-slate-600 border-b-[3px] rounded-lg text-white shadow-lg">Ctrl</kbd>
                        <span className="text-slate-500 text-lg font-bold">+</span>
                        <kbd className="key-press px-4 py-2.5 text-base font-mono font-bold bg-slate-800 border border-slate-600 border-b-[3px] rounded-lg text-white shadow-lg">Space</kbd>
                      </div>
                      <p className="text-slate-400 text-sm">Hold to speak · Release to insert text</p>
                      <div className="flex flex-wrap justify-center gap-4 max-w-[260px]">
                        <StreamAppIcons.Slack />
                        <StreamAppIcons.Notion />
                        <StreamAppIcons.VSCode />
                        <StreamAppIcons.Gmail />
                        <StreamAppIcons.Discord />
                        <StreamAppIcons.Figma />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              </FadeIn>

              {/* oscar Minutes */}
              <FadeIn delay={0.05}>
              <div className="mb-16 rounded-2xl border border-cyan-500/20 hover:border-cyan-500/40 bg-gradient-to-br from-slate-900 to-slate-950 overflow-hidden card-lift group">
                <div className="grid md:grid-cols-2 gap-0">
                  <div className="bg-slate-950/60 p-10 flex items-center justify-center min-h-[280px] order-last md:order-first">
                    <div className="text-left space-y-5 max-w-[280px]">
                        <div className="w-16 h-16 bg-cyan-500/20 rounded-2xl flex items-center justify-center icon-spring">
                        <Users className="w-8 h-8 text-cyan-400" />
                      </div>
                      <motion.div
                        variants={listVariants}
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true }}
                        className="space-y-2"
                      >
                        {[
                          { label: "Key Discussion Points" },
                          { label: "Decisions Made" },
                          { label: "Action Items" },
                          { label: "Follow-ups" },
                        ].map((item) => (
                          <motion.div key={item.label} variants={itemVariants} className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full shrink-0" />
                            <span className="text-xs text-slate-400">{item.label}</span>
                          </motion.div>
                        ))}
                      </motion.div>
                      <p className="text-xs text-slate-500">AI-generated in seconds after your meeting</p>
                    </div>
                  </div>
                  <div className="p-10 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center icon-spring">
                        <Users className="w-5 h-5 text-cyan-400" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-3 py-1">oscar Minutes</span>
                    </div>
                    <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
                      Full meeting notes, <span className="text-cyan-400">automatically.</span>
                    </h3>
                    <p className="text-gray-300 text-lg mb-6 leading-relaxed">
                      Record your Zoom, Teams, or in-person meeting. OSCAR captures both your voice and other participants&apos; audio, transcribes everything, and generates structured AI notes the moment you stop.
                    </p>
                    <motion.ul
                      variants={listVariants}
                      initial="hidden"
                      whileInView="show"
                      viewport={{ once: true }}
                      className="space-y-3"
                    >
                      {["Records mic + system audio (Zoom, Teams, etc.)", "AI-structured notes: decisions, action items, follow-ups", "Google Calendar integration with one-tap access from your schedule", "Standup, 1:1, brainstorm & custom templates"].map((f) => (
                        <motion.li key={f} variants={itemVariants} className="flex items-center gap-3 text-gray-300">
                          <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                          <span>{f}</span>
                        </motion.li>
                      ))}
                    </motion.ul>
                  </div>
                </div>
              </div>
              </FadeIn>

              {/* oscar Scribble */}
              <FadeIn delay={0.05}>
              <div className="rounded-2xl border border-cyan-500/20 hover:border-cyan-500/40 bg-gradient-to-br from-slate-900 to-slate-950 overflow-hidden card-lift group">
                <div className="grid md:grid-cols-2 gap-0">
                  <div className="p-10 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center icon-spring">
                        <BookOpen className="w-5 h-5 text-cyan-400" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-3 py-1">oscar Scribble</span>
                    </div>
                    <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
                      Your voice notes, <span className="text-cyan-400">beautifully organized.</span>
                    </h3>
                    <p className="text-gray-300 text-lg mb-6 leading-relaxed">
                      Every Stream dictation and idea you capture lives in Scribble. It is searchable, editable, and synced across devices. Build your personal knowledge base without ever typing a thing.
                    </p>
                    <motion.ul
                      variants={listVariants}
                      initial="hidden"
                      whileInView="show"
                      viewport={{ once: true }}
                      className="space-y-3"
                    >
                      {["All your voice notes in one searchable place", "Synced to the cloud, accessible anywhere", "AI-cleaned text ready to share or export", "Custom vocabulary for your industry & jargon"].map((f) => (
                        <motion.li key={f} variants={itemVariants} className="flex items-center gap-3 text-gray-300">
                          <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                          <span>{f}</span>
                        </motion.li>
                      ))}
                    </motion.ul>
                  </div>
                  <div className="bg-slate-950/60 p-10 flex items-center justify-center min-h-[280px]">
                    <motion.div
                      variants={listVariants}
                      initial="hidden"
                      whileInView="show"
                      viewport={{ once: true }}
                      className="space-y-3 w-full max-w-[260px]"
                    >
                      {[
                        { title: "Product brainstorm", time: "Today, 2:14 PM" },
                        { title: "Weekly goals", time: "Yesterday, 9:30 AM" },
                        { title: "Client call ideas", time: "3 days ago" },
                      ].map((note) => (
                        <motion.div key={note.title} variants={itemVariants} className="flex items-center gap-3 p-3 bg-slate-800/60 hover:bg-slate-800/80 rounded-xl border border-slate-700/50 hover:border-cyan-500/30 transition-colors duration-200 cursor-default">
                          <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 hover:scale-110">
                            <FileText className="w-4 h-4 text-cyan-400" />
                          </div>
                          <div>
                            <p className="text-sm text-white font-medium">{note.title}</p>
                            <p className="text-xs text-slate-500">{note.time}</p>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  </div>
                </div>
              </div>
              </FadeIn>
            </div>
          </section>

          {/* Why OSCAR Section */}
          <section className="md:min-h-screen flex items-center justify-center py-16 px-4">
            <div className="max-w-6xl mx-auto">
              <FadeIn className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                  Why <span className="text-cyan-500">OSCAR</span>?
                </h2>
                <p className="text-gray-300 text-lg md:text-xl max-w-3xl mx-auto">
                  Built for people who think faster than they type.
                </p>
              </FadeIn>

              <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                <FadeIn delay={0.1}>
                  <div className="bg-slate-900/70 border border-cyan-500/20 hover:border-cyan-500/40 rounded-xl p-8 card-lift group h-full">
                    <div className="text-cyan-400 mb-4 icon-spring w-fit">
                      <Zap className="w-10 h-10" />
                    </div>
                    <h3 className="text-2xl font-semibold text-white mb-4">10x Faster Than Typing</h3>
                    <p className="text-gray-300 mb-4">
                      You speak at 150+ words per minute. You type at 40. Stop wasting time transcribing your own thoughts.
                    </p>
                    <p className="text-cyan-200 text-sm">
                      Stream directly into Slack, email, docs. Zero copy-paste.
                    </p>
                  </div>
                </FadeIn>

                <FadeIn delay={0.2}>
                  <div className="bg-slate-900/70 border border-cyan-500/20 hover:border-cyan-500/40 rounded-xl p-8 card-lift group h-full">
                    <div className="text-cyan-400 mb-4 icon-spring w-fit">
                      <Brain className="w-10 h-10" />
                    </div>
                    <h3 className="text-2xl font-semibold text-white mb-4">AI That Understands Context</h3>
                    <p className="text-gray-300 mb-4">
                      Not just speech-to-text. OSCAR formats your ideas intelligently, and Minutes turns raw conversation into structured, actionable notes.
                    </p>
                    <p className="text-cyan-200 text-sm">
                      Hinglish support, 30+ languages, custom vocabulary
                    </p>
                  </div>
                </FadeIn>

                <FadeIn delay={0.1}>
                  <div className="bg-slate-900/70 border border-cyan-500/20 hover:border-cyan-500/40 rounded-xl p-8 card-lift group h-full">
                    <div className="text-cyan-400 mb-4 icon-spring w-fit">
                      <FileText className="w-10 h-10" />
                    </div>
                    <h3 className="text-2xl font-semibold text-white mb-4">Always Shareable</h3>
                    <p className="text-gray-300 mb-4">
                      Every Scribble note and Minutes summary is clean enough to send directly. No embarrassing filler words or messy raw transcripts.
                    </p>
                    <p className="text-cyan-200 text-sm">
                      Email, copy, or export with one click
                    </p>
                  </div>
                </FadeIn>

                <FadeIn delay={0.2}>
                  <div className="bg-slate-900/70 border border-cyan-500/20 hover:border-cyan-500/40 rounded-xl p-8 card-lift group h-full">
                    <div className="text-cyan-400 mb-4 icon-spring w-fit">
                      <Lock className="w-10 h-10" />
                    </div>
                    <h3 className="text-2xl font-semibold text-white mb-4">Runs Locally. Private by Default.</h3>
                    <p className="text-gray-300 mb-4">
                      Whisper transcription runs on-device. Your audio never leaves your computer. AI processing is opt-in and uses only the text.
                    </p>
                    <p className="text-cyan-200 text-sm">
                      No audio uploads. No surveillance. Just your ideas.
                    </p>
                  </div>
                </FadeIn>
              </div>
            </div>
          </section>

          {/* Testimonials Section */}
          <section className="md:min-h-[80vh] flex items-center justify-center py-8 md:py-16 mt-8">
            <div className="w-full">
              <div className="mx-auto max-w-4xl px-4 md:px-8 lg:px-12 text-center mb-6 md:mb-12">
                <h2 className="text-2xl md:text-5xl font-bold text-white mb-3 md:mb-6">
                  Loved by <span className="text-cyan-500">Creators & Teams</span>
                </h2>
                <p className="text-gray-300 text-lg md:text-xl">
                  Join thousands capturing ideas on the go.
                </p>
              </div>
              <AnimatedTestimonials testimonials={TESTIMONIALS} autoplay />
            </div>
          </section>

          {/* Pricing Section */}
          <section className="min-h-auto md:min-h-[80vh] flex items-center justify-center py-16 md:py-20 px-4 mt-8">
            <div className="max-w-5xl mx-auto w-full">
              <FadeIn className="text-center mb-8 md:mb-12">
                <h2 className="text-2xl md:text-4xl font-bold text-white mb-3 md:mb-4">
                  Simple, Transparent <span className="text-cyan-500">Pricing</span>
                </h2>
                <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto">
                  Start free and upgrade when you need more. No hidden fees, cancel anytime.
                </p>
              </FadeIn>

              {/* Currency and Billing toggles */}
              <div className="flex flex-col items-center justify-center mb-12 gap-6">
                {/* Currency toggle */}
                <Tabs
                  value={currency}
                  onValueChange={(value) => setCurrency(value as Currency)}
                  className="w-fit"
                >
                  <TabsList className="bg-gray-900">
                    <TabsTrigger
                      value="INR"
                      className="data-[state=active]:bg-cyan-500 data-[state=active]:text-white"
                    >
                      ₹ INR
                    </TabsTrigger>
                    <TabsTrigger
                      value="USD"
                      className="data-[state=active]:bg-cyan-500 data-[state=active]:text-white"
                    >
                      $ USD
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Billing toggle */}
                <Tabs
                  value={billingCycle}
                  onValueChange={(value) => setBillingCycle(value as BillingCycle)}
                  className="w-fit"
                >
                  <TabsList className="bg-gray-900">
                    <TabsTrigger
                      value="monthly"
                      className="data-[state=active]:bg-cyan-500 data-[state=active]:text-white"
                    >
                      Monthly
                    </TabsTrigger>
                    <TabsTrigger
                      value="yearly"
                      className="data-[state=active]:bg-cyan-500 data-[state=active]:text-white"
                    >
                      Yearly
                      <span className="ml-2 text-xs bg-white/80 text-cyan-700 px-2 py-0.5 rounded-full">
                        Save {pricingConfig.YEARLY_SAVINGS_PERCENT}%
                      </span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Pricing cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-3xl mx-auto">
                {/* Free Plan */}
                <FadeIn delay={0.1} className="h-full">
                <div className="relative bg-slate-900 border border-cyan-700/30 hover:border-cyan-500/40 rounded-2xl shadow-xl p-6 card-lift h-full flex flex-col">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-white mb-2">Free</h3>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold text-white">{currencySymbol}0</span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8">
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">{SUBSCRIPTION_CONFIG.FREE_MONTHLY_RECORDINGS} Streams per month</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">Up to {SUBSCRIPTION_CONFIG.FREE_MAX_NOTES} total Scribbles</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">Custom vocabulary (up to {SUBSCRIPTION_CONFIG.FREE_MAX_VOCABULARY} entries)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">AI-powered text formatting</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">Basic voice-to-text</span>
                    </li>
                  </ul>

                  <Button
                    onClick={handleViewPricing}
                    className="w-full bg-gray-800 hover:bg-gray-700 text-white mt-auto"
                  >
                    Get Started
                  </Button>
                </div>
                </FadeIn>

                {/* Pro Plan */}
                <FadeIn delay={0.2} className="h-full">
                <div className="relative bg-slate-900 border border-cyan-500/50 ring-1 ring-cyan-500/50 hover:ring-cyan-400/60 rounded-2xl shadow-xl p-6 card-lift h-full flex flex-col">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 text-xs font-medium bg-cyan-500 text-white rounded-full">
                      Most Popular
                    </span>
                  </div>

                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-white mb-2">Pro</h3>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold text-white">
                        {billingCycle === "yearly" && monthlyEquivalent
                          ? `${currencySymbol}${monthlyEquivalent}`
                          : `${currencySymbol}${price}`}
                      </span>
                      <span className="text-gray-400">/month</span>
                    </div>
                    {billingCycle === "yearly" && (
                      <>
                        <p className="text-xs text-gray-500 mt-1">
                          {currencySymbol}
                          {price} billed annually
                        </p>
                        <p className="text-sm text-cyan-400 mt-1">
                          Save {pricingConfig.YEARLY_SAVINGS_PERCENT}% vs monthly
                        </p>
                      </>
                    )}
                    {currency === "USD" && (
                      <p className="text-xs text-gray-500 mt-2">
                        Charged in INR (₹{billingCycle === "monthly" ? PRICING.MONTHLY : PRICING.YEARLY})
                      </p>
                    )}
                  </div>

                  <ul className="space-y-3 mb-8">
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">Unlimited Streams</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">Unlimited Scribbles</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">Unlimited vocabulary entries</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">AI-powered text formatting</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">Priority processing</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">Priority support</span>
                    </li>
                  </ul>

                  <Button
                    onClick={handleViewPricing}
                    className="w-full bg-cyan-500 hover:bg-cyan-600 text-white mt-auto"
                  >
                    Upgrade to Pro
                  </Button>
                </div>
                </FadeIn>
              </div>
            </div>
          </section>

          {/* Final CTA Section */}
          <section className="min-h-auto md:min-h-[80vh] flex items-center justify-center py-12 md:py-16 px-4 mt-8">
            <FadeIn className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                Your Voice.<br />
                <span className="text-cyan-500">Instantly Transformed.</span>
              </h2>
              <p className="text-gray-300 text-lg md:text-xl mb-8 max-w-2xl mx-auto">
                Start free. No credit card required. Your voice, working for you everywhere.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  onClick={() => router.push("/download")}
                  size="lg"
                  className="bg-cyan-500 hover:bg-cyan-600 text-white px-10 py-7 text-xl font-semibold shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all duration-300 hover:scale-105"
                >
                  <Download className="w-6 h-6 mr-3" />
                  Download Free
                </Button>
              </div>
              <p className="text-gray-500 text-sm mt-6">
                {SUBSCRIPTION_CONFIG.FREE_MONTHLY_RECORDINGS} free Streams/month • No credit card • Upgrade anytime
              </p>
            </FadeIn>
          </section>
        </>
      )}
    </main>
  );
}

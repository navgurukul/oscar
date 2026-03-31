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
import { Check, Mic, Sparkles, FileText, Zap, Clock, Brain, Download, MoreHorizontal } from "lucide-react";
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
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 3600 * 24));
    
    if (diffDays === 0) return "Today, " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return "Yesterday, " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return diffDays + " days ago";
  };

  const handleViewPricing = () => {
    router.push("/auth?redirectTo=/pricing");
  };

  const pricingConfig = currency === "USD" ? PRICING_USD : PRICING;
  const price = billingCycle === "monthly" ? pricingConfig.MONTHLY : pricingConfig.YEARLY;
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
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/50 border border-cyan-500/30 text-cyan-400 text-xs font-medium mb-12 backdrop-blur-sm"
            >
              <Sparkles className="w-3 h-3" />
              <span>AI-Powered Voice Notes</span>
            </motion.div>

            {/* App Name / Logo */}
            <h1 className="text-6xl md:text-8xl font-bold font-serif text-white mb-6 tracking-tight">
              {UI_STRINGS.APP_NAME}
            </h1>
            
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="h-px w-8 bg-gradient-to-r from-transparent to-cyan-500/50" />
              <p className="text-xl md:text-2xl text-gray-400 font-medium italic">
                Your voice, written your way.
              </p>
              <div className="h-px w-8 bg-gradient-to-l from-transparent to-cyan-500/50" />
            </div>

            {/* Empty State Illustration */}
            <div className="relative mb-12">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/5 blur-[100px] rounded-full" />
              
              <div className="relative w-36 h-36 md:w-44 md:h-44 bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-white/5 rounded-[2.5rem] flex items-center justify-center mx-auto backdrop-blur-md shadow-2xl group transition-all duration-500 hover:border-cyan-500/20">
                <div className="absolute inset-0 border border-cyan-500/10 rounded-[2.5rem] animate-pulse" />
                
                <div className="relative">
                  <FileText className="w-14 h-14 md:w-18 md:h-18 text-cyan-400/70 group-hover:text-cyan-400 transition-colors duration-500" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-cyan-500 rounded-lg flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-500">
                    <Mic className="w-3 h-3 text-slate-950" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-2xl md:text-3xl font-semibold text-white/90 tracking-tight">
                Looks like there&apos;s nothing here (yet).
              </h3>
              <p className="text-gray-500 text-lg md:text-xl max-w-md mx-auto leading-relaxed">
                Click record to get started and turn your speech into clean, formatted text!
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
              Start recording your ideas
            </h1>
          </div>

        

          {/* Recent Transcriptions Section */}
          <div className="w-full mb-12">
            <h2 className="text-gray-400 font-medium mb-6 text-center">Recent Transcriptions</h2>
            
            <div className="space-y-3">
              {isLoadingNotes ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-slate-900/50 rounded-2xl animate-pulse border border-white/5" />
                ))
              ) : recentNotes.length > 0 ? (
                recentNotes.map((note) => (
                  <Link key={note.id} href={`${ROUTES.NOTES}/${note.id}`}>
                    <div className="w-full p-4 mb-3 bg-slate-900/40 hover:bg-slate-900/60 border border-white/5 hover:border-cyan-500/20 rounded-2xl flex items-center justify-between transition-all group">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-orange-500" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-white font-semibold truncate">
                            {note.title || UI_STRINGS.UNTITLED_NOTE}
                          </h4>
                          <p className="text-gray-500 text-xs mt-1">
                            {formatDate(note.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="text-gray-400 text-sm hidden md:block max-w-[200px] truncate">
                          {note.original_formatted_text}
                        </p>
                        <MoreHorizontal className="w-5 h-5 text-gray-600" />
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-10 bg-slate-900/20 rounded-2xl border border-dashed border-white/10">
                  <p className="text-gray-500 italic">No recordings yet. Speak your first idea!</p>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          {/* <div className="flex flex-wrap justify-center gap-4">
            <Button
              onClick={handleStartRecording}
              className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold px-6 py-6 rounded-full h-auto"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Note
            </Button>
            <Link href={ROUTES.NOTES}>
              <Button
                variant="outline"
                className="bg-slate-900/50 border-white/10 text-gray-300 hover:text-white hover:bg-slate-800 px-6 py-6 rounded-full h-auto"
              >
                <Plus className="w-5 h-5 mr-2" />
                My Notes
              </Button>
            </Link>
          </div> */}
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
              Turn messy voice notes into clean text. Instantly.
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
      <section className="min-h-[80vh] flex items-center justify-center py-16 sm:py-24 px-4 bg-gradient-to-b from-slate-950 to-slate-900 mt-8">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                  Your <span className="text-cyan-500">Best Ideas</span> Vanish Before You Type Them
                </h2>
                <p className="text-gray-300 text-lg md:text-xl max-w-3xl mx-auto">
                  That perfect thought you had while walking? Gone by the time you open your laptop.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                <div className="bg-slate-900/50 border border-cyan-500/20 rounded-xl p-6">
                  <div className="text-cyan-300 mb-4">
                    <Clock className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">Ideas Fade Fast</h3>
                  <p className="text-gray-400">
                    The perfect words you thought of? Gone before you start typing.
                  </p>
                </div>

                <div className="bg-slate-900/50 border border-cyan-500/20 rounded-xl p-6">
                  <div className="text-cyan-300 mb-4">
                    <FileText className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">Voice Notes Are Messy</h3>
                  <p className="text-gray-400">
                    Full of ums and uhs. Too embarrassing to share with anyone.
                  </p>
                </div>

                <div className="bg-slate-900/50 border border-cyan-500/20 rounded-xl p-6">
                  <div className="text-cyan-300 mb-4">
                    <Zap className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">Typing Kills Momentum</h3>
                  <p className="text-gray-400">
                    Switching to your phone or laptop breaks your flow. By the time you&apos;re typing, the moment&apos;gone.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* How It Works Section */}
        <section id="how-it-works" className="md:min-h-[80vh] flex items-center justify-center py-16 px-4 bg-slate-900 mt-8">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                  Speak It. <span className="text-cyan-500">OSCAR</span> Writes It.
                </h2>
                <p className="text-gray-300 text-lg md:text-xl max-w-3xl mx-auto">
                  From messy voice note to polished text in 3 steps. No typing, no cleanup, no hassle.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                <div className="relative">
                  <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/30 rounded-xl p-8">
                    <div className="w-16 h-16 bg-cyan-500 rounded-full flex items-center justify-center mb-6 mx-auto">
                      <Mic className="w-8 h-8 text-white" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-2xl font-bold text-white mb-3">1. Speak</h3>
                      <p className="text-gray-300">
                        Hit record and talk. Walk, drive, commute. Capture your thoughts wherever inspiration strikes.
                      </p>
                    </div>
                  </div>
                  <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-cyan-500/50 to-transparent"></div>
                </div>

                <div className="relative">
                  <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/30 rounded-xl p-8">
                    <div className="w-16 h-16 bg-cyan-500 rounded-full flex items-center justify-center mb-6 mx-auto">
                      <Brain className="w-8 h-8 text-white" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-2xl font-bold text-white mb-3">2. AI Cleans</h3>
                      <p className="text-gray-300">
                        OSCAR removes filler words, fixes grammar, formats paragraphs. All automatically in seconds.
                      </p>
                    </div>
                  </div>
                  <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-cyan-500/50 to-transparent"></div>
                </div>

                <div className="relative">
                  <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/30 rounded-xl p-8">
                    <div className="w-16 h-16 bg-cyan-500 rounded-full flex items-center justify-center mb-6 mx-auto">
                      <FileText className="w-8 h-8 text-white" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-2xl font-bold text-white mb-3">3. Use It</h3>
                      <p className="text-gray-300">
                        Copy, share, or download your polished note. Ready for docs, emails, or wherever you need it.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </section>

          {/* Benefits Section */}
          <section className="md:min-h-screen snap-start flex items-center justify-center py-16 px-4 bg-gradient-to-b from-slate-900 to-slate-950">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                  Why <span className="text-cyan-500">OSCAR</span>?
                </h2>
                <p className="text-gray-300 text-lg md:text-xl max-w-3xl mx-auto">
                  Built for people who think faster than they type.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                <div className="bg-slate-900/70 border border-cyan-500/20 rounded-xl p-8">
                  <div className="text-cyan-400 mb-4">
                    <Zap className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-semibold text-white mb-4">10x Faster Than Typing</h3>
                  <p className="text-gray-300 mb-4">
                    You speak at 150+ words per minute. You type at 40. Stop wasting time transcribing your own thoughts.
                  </p>
                  <p className="text-cyan-200 text-sm">
                    Perfect for: Meeting notes, blog drafts, task lists, brainstorming sessions
                  </p>
                </div>

                <div className="bg-slate-900/70 border border-cyan-500/20 rounded-xl p-8">
                  <div className="text-cyan-400 mb-4">
                    <Brain className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-semibold text-white mb-4">AI That Understands Context</h3>
                  <p className="text-gray-300 mb-4">
                    Not just speech-to-text. OSCAR formats your ideas intelligently with proper paragraphs, punctuation, and structure.
                  </p>
                  <p className="text-cyan-200 text-sm">
                    Perfect for: Long-form content, complex ideas, multi-step plans
                  </p>
                </div>

                <div className="bg-slate-900/70 border border-cyan-500/20 rounded-xl p-8">
                  <div className="text-cyan-400 mb-4">
                    <FileText className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-semibold text-white mb-4">Always Shareable</h3>
                  <p className="text-gray-300 mb-4">
                    Every note is clean enough to send directly to your team, paste into docs, or post online. No embarrassing filler words.
                  </p>
                  <p className="text-cyan-200 text-sm">
                    Perfect for: Collaboration, client updates, content creation
                  </p>
                </div>

                <div className="bg-slate-900/70 border border-cyan-500/20 rounded-xl p-8">
                  <div className="text-cyan-400 mb-4">
                    <Sparkles className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-semibold text-white mb-4">Custom Vocabulary</h3>
                  <p className="text-gray-300 mb-4">
                    Teach OSCAR your industry terms, product names, or company jargon. It learns and adapts to your world.
                  </p>
                  <p className="text-cyan-200 text-sm">
                    Perfect for: Technical notes, business contexts, specialized fields
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Testimonials Section */}
          <section className="md:min-h-[80vh] flex items-center justify-center py-8 md:py-16 bg-slate-900 mt-8">
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
              <div className="text-center mb-8 md:mb-12">
                <h2 className="text-2xl md:text-4xl font-bold text-white mb-3 md:mb-4">
                  Simple, Transparent <span className="text-cyan-500">Pricing</span>
                </h2>
                <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto">
                  Start free and upgrade when you need more. No hidden fees, cancel anytime.
                </p>
              </div>

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
                <div className="relative bg-slate-900 border border-cyan-700/30 rounded-2xl shadow-xl p-6">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-white mb-2">Free</h3>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold text-white">{currencySymbol}0</span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8">
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">{SUBSCRIPTION_CONFIG.FREE_MONTHLY_RECORDINGS} recordings per month</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">Up to {SUBSCRIPTION_CONFIG.FREE_MAX_NOTES} total notes</span>
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
                    className="w-full bg-gray-800 hover:bg-gray-700 text-white"
                  >
                    Get Started
                  </Button>
                </div>

                {/* Pro Plan */}
                <div className="relative bg-slate-900 border border-cyan-500/50 ring-1 ring-cyan-500/50 rounded-2xl shadow-xl p-6">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 text-xs font-medium bg-cyan-500 text-white rounded-full">
                      Most Popular
                    </span>
                  </div>

                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-white mb-2">Pro</h3>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold text-white">{currencySymbol}{price}</span>
                      <span className="text-gray-400">
                        /{billingCycle === "monthly" ? "month" : "year"}
                      </span>
                    </div>
                    {billingCycle === "yearly" && (
                      <p className="text-sm text-cyan-400 mt-1">Save {pricingConfig.YEARLY_SAVINGS_PERCENT}% vs monthly</p>
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
                      <span className="text-gray-300 text-sm">Unlimited recordings</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">Unlimited notes</span>
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
                    className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
                  >
                    Upgrade to Pro
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* Final CTA Section */}
          <section className="min-h-auto md:min-h-[80vh] flex items-center justify-center py-12 md:py-16 px-4 bg-gradient-to-b from-slate-950 to-black mt-8">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                Stop Losing Your <span className="text-cyan-500">Best Ideas</span>
              </h2>
              <p className="text-gray-300 text-lg md:text-xl mb-8 max-w-2xl mx-auto">
                Start free. No credit card required. Turn messy thoughts into clean text in seconds.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  onClick={handleViewPricing}
                  size="lg"
                  className="bg-cyan-500 hover:bg-cyan-600 text-white px-10 py-7 text-xl font-semibold"
                >
                  Try OSCAR Free
                </Button>
              </div>
              <p className="text-gray-500 text-sm mt-6">
                {SUBSCRIPTION_CONFIG.FREE_MONTHLY_RECORDINGS} free recordings/month • No credit card • Upgrade anytime
              </p>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

"use client";

import React from "react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div style={{ background: "var(--bg)", color: "var(--fg)", fontFamily: "var(--font-ui)", overflow: "hidden" }}>
      {/* Navigation */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          padding: "16px 40px",
          background: isScrolled ? "rgba(26,24,21,0.8)" : "transparent",
          backdropFilter: isScrolled ? "blur(10px)" : "none",
          borderBottom: isScrolled ? "1px solid var(--line)" : "none",
          transition: "all 0.3s ease",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, textDecoration: "none", color: "var(--fg)", cursor: "pointer", transition: "opacity 0.2s" }} onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")} onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
          <span style={{ fontSize: 20 }}>◆</span> BONE
        </a>
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <a href="#features" style={{ textDecoration: "none", color: "var(--fg-2)", fontSize: 14, transition: "color 0.2s" }} onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--fg-2)")}>
            Features
          </a>
          <a href="#how" style={{ textDecoration: "none", color: "var(--fg-2)", fontSize: 14, transition: "color 0.2s" }} onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--fg-2)")}>
            How It Works
          </a>
          <Link href="/login" style={{ textDecoration: "none", padding: "8px 16px", background: "var(--accent)", color: "var(--accent-fg)", borderRadius: "var(--radius-sm)", fontSize: 14, fontWeight: 500, transition: "all 0.2s" }} onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")} onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
            Sign In
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "100px 40px 80px",
        textAlign: "center",
        background: "linear-gradient(135deg, var(--bg) 0%, var(--bg-1) 100%)",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Animated background elements */}
        <div style={{
          position: "absolute",
          top: "10%",
          left: "5%",
          width: 300,
          height: 300,
          background: "var(--accent)",
          borderRadius: "50%",
          opacity: 0.05,
          animation: "float 6s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute",
          bottom: "10%",
          right: "5%",
          width: 200,
          height: 200,
          background: "var(--accent)",
          borderRadius: "50%",
          opacity: 0.05,
          animation: "float 8s ease-in-out infinite 2s",
        }} />

        <div style={{ maxWidth: 800, position: "relative", zIndex: 10, animation: "slideInUp 0.8s ease-out" }}>
          <div style={{
            display: "inline-block",
            padding: "8px 16px",
            background: "var(--accent-tint)",
            color: "var(--accent)",
            borderRadius: "var(--radius-sm)",
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.06em",
            marginBottom: 24,
          }}>
            ✨ AI-POWERED SCHEDULING
          </div>

          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: 56,
            fontWeight: "var(--display-weight)",
            lineHeight: 1.2,
            marginBottom: 24,
            letterSpacing: "var(--display-tracking)",
          }}>
            Turn your chaos into a <span style={{ color: "var(--accent)" }}>perfect schedule</span>
          </h1>

          <p style={{
            fontSize: 18,
            color: "var(--fg-2)",
            lineHeight: 1.6,
            marginBottom: 40,
            maxWidth: 600,
            margin: "0 auto 40px",
          }}>
            Drop your notes, spreadsheets, meeting notes — and let AI build your calendar. No manual copying. No more chaos. Just your perfect week.
          </p>

          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/signup"
              style={{
                padding: "14px 32px",
                background: "var(--accent)",
                color: "var(--accent-fg)",
                borderRadius: "var(--radius-sm)",
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 600,
                transition: "all 0.3s",
                border: "1px solid var(--accent)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)";
              }}
            >
              Get Started Free
            </Link>
            <a
              href="#how"
              style={{
                padding: "14px 32px",
                background: "var(--bg-2)",
                color: "var(--fg)",
                borderRadius: "var(--radius-sm)",
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 600,
                transition: "all 0.3s",
                border: "1px solid var(--line)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--bg-3)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--bg-2)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              Watch Demo
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" style={{ padding: "100px 40px", maxWidth: 1200, margin: "0 auto", animation: "fadeIn 1s ease-out 0.3s backwards" }}>
        <div style={{ textAlign: "center", marginBottom: 80 }}>
          <h2 style={{
            fontFamily: "var(--font-display)",
            fontSize: 42,
            fontWeight: "var(--display-weight)",
            marginBottom: 16,
          }}>
            What BONE Can Do
          </h2>
          <p style={{ fontSize: 16, color: "var(--fg-2)", maxWidth: 600, margin: "0 auto" }}>
            Everything you need to turn documents into a perfectly planned week
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 32,
        }}>
          {[
            {
              icon: "📄",
              title: "Multi-Format Support",
              desc: "Spreadsheets, PDFs, Word docs, meeting notes, whiteboards — we read them all.",
            },
            {
              icon: "🤖",
              title: "AI-Powered Extraction",
              desc: "Claude AI automatically detects tasks, milestones, and dependencies from your documents.",
            },
            {
              icon: "📅",
              title: "Smart Scheduling",
              desc: "Tasks are intelligently placed into your calendar with optimal timing and prioritization.",
            },
            {
              icon: "🔄",
              title: "Recurring & Reminders",
              desc: "Automatically detect recurring tasks and set up reminders for important dates.",
            },
            {
              icon: "👥",
              title: "Multi-User Ready",
              desc: "Securely share plans with your team. Each user sees only their own data.",
            },
            {
              icon: "⚡",
              title: "Real-Time Sync",
              desc: "Changes sync instantly across devices. Always up to date, wherever you are.",
            },
          ].map((feature, i) => (
            <div
              key={i}
              style={{
                padding: 32,
                background: "var(--bg-1)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                transition: "all 0.3s ease",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--accent)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)";
                e.currentTarget.style.transform = "translateY(-4px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--line)";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>{feature.icon}</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{feature.title}</h3>
              <p style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.6 }}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how" style={{
        padding: "100px 40px",
        background: "var(--bg-1)",
        borderTop: "1px solid var(--line)",
        borderBottom: "1px solid var(--line)",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 80 }}>
            <h2 style={{
              fontFamily: "var(--font-display)",
              fontSize: 42,
              fontWeight: "var(--display-weight)",
              marginBottom: 16,
            }}>
              3 Simple Steps
            </h2>
            <p style={{ fontSize: 16, color: "var(--fg-2)", maxWidth: 600, margin: "0 auto" }}>
              From chaos to clarity in minutes
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 40 }}>
            {[
              {
                step: "01",
                title: "Drop Your Files",
                desc: "Upload spreadsheets, notes, PDFs, or photos. No setup, no limits.",
                icon: "📤",
              },
              {
                step: "02",
                title: "AI Analyzes",
                desc: "Claude AI reads, understands, and extracts all your tasks and deadlines.",
                icon: "🤖",
              },
              {
                step: "03",
                title: "Get Your Calendar",
                desc: "Review, edit, and confirm. Your perfect schedule is ready to go.",
                icon: "✅",
              },
            ].map((item, i) => (
              <div key={i} style={{ position: "relative" }}>
                <div style={{
                  fontSize: 48,
                  fontFamily: "var(--font-mono)",
                  fontWeight: "bold",
                  color: "var(--accent)",
                  opacity: 0.3,
                  marginBottom: 8,
                }}>
                  {item.step}
                </div>
                <div style={{ fontSize: 32, marginBottom: 12 }}>{item.icon}</div>
                <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>{item.title}</h3>
                <p style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Showcase/Demo Section */}
      <section style={{
        padding: "100px 40px",
        maxWidth: 1200,
        margin: "0 auto",
      }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <h2 style={{
            fontFamily: "var(--font-display)",
            fontSize: 42,
            fontWeight: "var(--display-weight)",
            marginBottom: 16,
          }}>
            See It In Action
          </h2>
          <p style={{ fontSize: 16, color: "var(--fg-2)", maxWidth: 600, margin: "0 auto" }}>
            Watch how BONE transforms your documents into a perfect schedule
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 32,
        }}>
          {[
            { title: "Upload Documents", desc: "Drop files in seconds" },
            { title: "AI Extraction", desc: "Automatic task detection" },
            { title: "Smart Calendar", desc: "Perfect scheduling" },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                borderRadius: "var(--radius)",
                overflow: "hidden",
                border: "1px solid var(--line)",
                background: "var(--bg-1)",
                transition: "all 0.3s",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "var(--accent)";
                el.style.boxShadow = "0 12px 32px rgba(0,0,0,0.12)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "var(--line)";
                el.style.boxShadow = "none";
              }}
            >
              {/* Placeholder for video/screenshot */}
              <div style={{
                aspectRatio: "16/9",
                background: "linear-gradient(135deg, var(--bg-2) 0%, var(--bg-3) 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: 12,
                color: "var(--fg-3)",
              }}>
                <span style={{ fontSize: 48 }}>🎬</span>
                <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>VIDEO PLACEHOLDER</span>
              </div>
              <div style={{ padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{item.title}</h3>
                <p style={{ fontSize: 13, color: "var(--fg-2)" }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section style={{
        padding: "100px 40px",
        textAlign: "center",
        background: "linear-gradient(135deg, var(--accent-tint) 0%, var(--bg) 100%)",
      }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{
            fontFamily: "var(--font-display)",
            fontSize: 40,
            fontWeight: "var(--display-weight)",
            marginBottom: 24,
          }}>
            Ready to take control of your time?
          </h2>
          <p style={{ fontSize: 16, color: "var(--fg-2)", marginBottom: 32, lineHeight: 1.6 }}>
            Sign up now and build your first perfect week. No credit card required.
          </p>
          <Link
            href="/signup"
            style={{
              display: "inline-block",
              padding: "14px 40px",
              background: "var(--accent)",
              color: "var(--accent-fg)",
              borderRadius: "var(--radius-sm)",
              textDecoration: "none",
              fontSize: 16,
              fontWeight: 600,
              transition: "all 0.3s",
              border: "1px solid var(--accent)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)";
            }}
          >
            Start Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: "40px",
        borderTop: "1px solid var(--line)",
        textAlign: "center",
        fontSize: 12,
        color: "var(--fg-3)",
        fontFamily: "var(--font-mono)",
      }}>
        <p>© 2024 BONE. Built with AI and ❤️</p>
      </footer>

      {/* Animations */}
      <style>{`
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(20px);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

{
  "design_system_name": "StudySpark — Bright Productivity for Students",
  "brand_attributes": [
    "energetic",
    "optimistic",
    "focused",
    "playful-but-precise",
    "demo-wow",
    "trustworthy"
  ],
  "visual_personality": {
    "style_fusion": [
      "Bento grid dashboard layout (asymmetric, oversized stats)",
      "Swiss-style typography discipline for readability",
      "Y2K-evolution accents (neon strokes, glossy chips) used sparingly",
      "Cinematic call screen (dark solid, high-contrast, waveform + pulse)"
    ],
    "do_not": [
      "Do not use centered app-wide layouts.",
      "Do not use transparent card backgrounds (keep cards solid).",
      "Do not use purple as the primary brand color for AI/voice surfaces; keep it as a tiny accent only if needed.",
      "Do not use dark/saturated gradients (see gradient restriction rules at bottom)."
    ]
  },
  "typography": {
    "google_fonts": {
      "heading": {
        "name": "Space Grotesk",
        "weights": ["500", "600", "700"],
        "usage": "H1/H2, big stats, section titles"
      },
      "body": {
        "name": "Figtree",
        "weights": ["400", "500", "600"],
        "usage": "Body, labels, helper text"
      },
      "mono_optional": {
        "name": "IBM Plex Mono",
        "weights": ["400", "500"],
        "usage": "Transcript snippets, debug-like call logs"
      }
    },
    "font_stack_css": {
      "--font-heading": "'Space Grotesk', ui-sans-serif, system-ui",
      "--font-body": "'Figtree', ui-sans-serif, system-ui",
      "--font-mono": "'IBM Plex Mono', ui-monospace, SFMono-Regular"
    },
    "text_size_hierarchy": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight",
      "h2": "text-base md:text-lg font-medium text-muted-foreground",
      "body": "text-sm md:text-base leading-relaxed",
      "small": "text-xs md:text-sm text-muted-foreground"
    },
    "type_rules": [
      "Use heading font only for headings + big numbers; keep body font for everything else.",
      "Avoid all-caps paragraphs; all-caps only for tiny labels (text-xs tracking-widest).",
      "Calendar event chips must be text-xs font-medium with tight leading for glanceability."
    ]
  },
  "color_system": {
    "theme_intent": "Primary experience is bright, alive, exciting. Dark mode exists mainly for the cinematic call screen and optional toggle.",
    "palette_hex": {
      "bg": "#FBFBFF",
      "surface": "#FFFFFF",
      "surface_2": "#F4F7FF",
      "text": "#0B1020",
      "muted_text": "#5B647A",
      "border": "#E6EAF5",

      "primary": "#0EA5E9",
      "primary_2": "#22C55E",
      "accent": "#FF4D8D",
      "accent_2": "#FFD84D",

      "info": "#2DD4BF",
      "success": "#22C55E",
      "warning": "#F59E0B",
      "danger": "#EF4444",

      "call_bg": "#070A12",
      "call_surface": "#0B1020",
      "call_text": "#EAF0FF"
    },
    "course_color_map": {
      "course_a": { "name": "Sky", "chip_bg": "#E0F2FE", "chip_text": "#075985", "dot": "#0EA5E9" },
      "course_b": { "name": "Lime", "chip_bg": "#DCFCE7", "chip_text": "#14532D", "dot": "#22C55E" },
      "course_c": { "name": "Sun", "chip_bg": "#FEF9C3", "chip_text": "#713F12", "dot": "#F59E0B" },
      "course_d": { "name": "Pink", "chip_bg": "#FCE7F3", "chip_text": "#831843", "dot": "#FF4D8D" },
      "course_e": { "name": "Teal", "chip_bg": "#CCFBF1", "chip_text": "#134E4A", "dot": "#2DD4BF" }
    },
    "semantic_tokens_hsl_for_shadcn": {
      "note": "Update /app/frontend/src/index.css :root and .dark variables to match these HSL values. Keep cards solid (no transparency).",
      "light": {
        "--background": "240 100% 99%",
        "--foreground": "226 55% 8%",
        "--card": "0 0% 100%",
        "--card-foreground": "226 55% 8%",
        "--popover": "0 0% 100%",
        "--popover-foreground": "226 55% 8%",
        "--primary": "199 89% 48%",
        "--primary-foreground": "210 40% 98%",
        "--secondary": "226 100% 97%",
        "--secondary-foreground": "226 55% 12%",
        "--muted": "226 100% 97%",
        "--muted-foreground": "223 18% 42%",
        "--accent": "330 100% 65%",
        "--accent-foreground": "226 55% 10%",
        "--destructive": "0 84% 60%",
        "--destructive-foreground": "210 40% 98%",
        "--border": "226 45% 92%",
        "--input": "226 45% 92%",
        "--ring": "199 89% 48%",
        "--radius": "0.9rem"
      },
      "dark_call_mode": {
        "--background": "228 55% 5%",
        "--foreground": "210 40% 98%",
        "--card": "226 55% 8%",
        "--card-foreground": "210 40% 98%",
        "--popover": "226 55% 8%",
        "--popover-foreground": "210 40% 98%",
        "--primary": "199 89% 55%",
        "--primary-foreground": "226 55% 10%",
        "--secondary": "226 30% 14%",
        "--secondary-foreground": "210 40% 98%",
        "--muted": "226 30% 14%",
        "--muted-foreground": "220 15% 70%",
        "--accent": "160 84% 45%",
        "--accent-foreground": "226 55% 10%",
        "--destructive": "0 70% 45%",
        "--destructive-foreground": "210 40% 98%",
        "--border": "226 30% 18%",
        "--input": "226 30% 18%",
        "--ring": "199 89% 55%",
        "--radius": "0.9rem"
      }
    },
    "gradients_allowed_small_area_only": {
      "hero_bg": "radial-gradient(1200px circle at 15% 10%, rgba(14,165,233,0.18), transparent 55%), radial-gradient(900px circle at 85% 20%, rgba(34,197,94,0.14), transparent 55%), radial-gradient(900px circle at 70% 90%, rgba(255,77,141,0.10), transparent 60%)",
      "accent_stroke": "linear-gradient(90deg, rgba(14,165,233,0.9), rgba(45,212,191,0.9))",
      "note": "Use gradients only as decorative section backgrounds or thin strokes; never on text-heavy cards; never exceed 20% viewport coverage."
    }
  },
  "design_tokens_css": {
    "add_to_index_css": "/* Add below to /app/frontend/src/index.css (after tailwind layers) */\n:root{\n  --font-heading:'Space Grotesk',ui-sans-serif,system-ui;\n  --font-body:'Figtree',ui-sans-serif,system-ui;\n  --font-mono:'IBM Plex Mono',ui-monospace,SFMono-Regular;\n\n  --shadow-soft: 0 10px 30px rgba(11,16,32,0.08);\n  --shadow-pop: 0 14px 40px rgba(14,165,233,0.18);\n  --shadow-glow: 0 0 0 6px rgba(14,165,233,0.12);\n\n  --radius-card: 18px;\n  --radius-control: 12px;\n  --radius-pill: 999px;\n\n  --space-1: 4px;\n  --space-2: 8px;\n  --space-3: 12px;\n  --space-4: 16px;\n  --space-5: 20px;\n  --space-6: 24px;\n  --space-8: 32px;\n  --space-10: 40px;\n  --space-12: 48px;\n\n  --ease-out: cubic-bezier(.16,1,.3,1);\n  --ease-in: cubic-bezier(.7,0,.84,0);\n  --dur-1: 120ms;\n  --dur-2: 180ms;\n  --dur-3: 260ms;\n}\n\nbody{\n  font-family: var(--font-body);\n}\n\nh1,h2,h3,[data-heading='true']{\n  font-family: var(--font-heading);\n}\n\n::selection{\n  background: rgba(14,165,233,0.22);\n}\n\n/* subtle grain overlay utility */\n.bg-grain{\n  background-image: url('https://images.unsplash.com/photo-1702285566204-4ea03cd25559?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85');\n  background-size: cover;\n  background-position: center;\n  background-blend-mode: soft-light;\n}\n\n/* avoid universal transitions; provide targeted helpers */\n.ui-press{\n  transition: transform var(--dur-2) var(--ease-out);\n}\n.ui-press:active{\n  transform: scale(0.98);\n}\n\n.ui-fade{\n  transition: opacity var(--dur-2) var(--ease-out), background-color var(--dur-2) var(--ease-out), border-color var(--dur-2) var(--ease-out), box-shadow var(--dur-2) var(--ease-out);\n}\n\n/* cinematic call pulse */\n@keyframes callPulse{\n  0%{ transform: scale(0.98); opacity: .65;}\n  50%{ transform: scale(1.02); opacity: 1;}\n  100%{ transform: scale(0.98); opacity: .65;}\n}\n\n@keyframes ringWiggle{\n  0%,100%{ transform: rotate(-2deg) translateY(0);}\n  50%{ transform: rotate(2deg) translateY(-2px);}\n}\n\n@keyframes waveMove{\n  0%{ transform: translateX(0);}\n  100%{ transform: translateX(-40px);}\n}\n"
  },
  "tailwind_config_additions": {
    "note": "Add to tailwind.config.js theme.extend. Keep it minimal; rely on CSS vars for most tokens.",
    "extend": {
      "fontFamily": {
        "heading": "var(--font-heading)",
        "sans": "var(--font-body)",
        "mono": "var(--font-mono)"
      },
      "boxShadow": {
        "soft": "var(--shadow-soft)",
        "pop": "var(--shadow-pop)",
        "glow": "var(--shadow-glow)"
      },
      "borderRadius": {
        "card": "var(--radius-card)",
        "control": "var(--radius-control)"
      },
      "keyframes": {
        "callPulse": "{0%{transform:scale(.98);opacity:.65}50%{transform:scale(1.02);opacity:1}100%{transform:scale(.98);opacity:.65}}",
        "ringWiggle": "{0%,100%{transform:rotate(-2deg) translateY(0)}50%{transform:rotate(2deg) translateY(-2px)}}"
      },
      "animation": {
        "callPulse": "callPulse 1.2s var(--ease-out) infinite",
        "ringWiggle": "ringWiggle .22s ease-in-out infinite"
      }
    }
  },
  "layout_and_grid": {
    "app_shell": {
      "desktop": "Left rail (icon + labels) + top header + content area. Content uses 12-col grid with bento cards.",
      "mobile": "Bottom nav (3–5 items) + sticky top header with page title + primary CTA.",
      "max_width": "max-w-6xl for main content; allow calendar page to go max-w-7xl",
      "gutters": "px-4 sm:px-6 lg:px-8",
      "vertical_rhythm": "space-y-6 on pages; cards use p-4 sm:p-6"
    },
    "dashboard_bento": {
      "grid": "grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6",
      "recommended_spans": [
        "Hero upload card: lg:col-span-7",
        "Urgency banner stack: lg:col-span-5",
        "Quick stats row: lg:col-span-12 (3 cards)"
      ]
    }
  },
  "components": {
    "component_path": {
      "shadcn_primary": "/app/frontend/src/components/ui/",
      "use_these": [
        "button.jsx",
        "card.jsx",
        "badge.jsx",
        "tabs.jsx",
        "dialog.jsx",
        "drawer.jsx",
        "progress.jsx",
        "calendar.jsx",
        "popover.jsx",
        "select.jsx",
        "input.jsx",
        "textarea.jsx",
        "separator.jsx",
        "skeleton.jsx",
        "sonner.jsx",
        "table.jsx",
        "tooltip.jsx"
      ]
    },
    "recipes": {
      "primary_button": {
        "use": "shadcn Button",
        "className": "rounded-control shadow-pop bg-primary text-primary-foreground hover:bg-primary/90 ui-fade ui-press focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "data_testid": "primary-action-button"
      },
      "secondary_button": {
        "className": "rounded-control bg-secondary text-secondary-foreground hover:bg-secondary/70 border border-border ui-fade ui-press",
        "data_testid": "secondary-action-button"
      },
      "ghost_button": {
        "className": "rounded-control hover:bg-accent/15 hover:text-foreground ui-fade ui-press",
        "data_testid": "ghost-action-button"
      },
      "course_chip": {
        "use": "Badge",
        "className": "rounded-full px-2.5 py-1 text-xs font-medium border border-border",
        "pattern": "style per course using inline style or class map: bg-[color]/ text-[color]",
        "data_testid": "course-filter-chip"
      },
      "upload_dropzone": {
        "use": "Card + Button + Progress",
        "className": "rounded-card border border-border bg-card shadow-soft p-4 sm:p-6",
        "drop_area": "rounded-card border-2 border-dashed border-border bg-secondary/40 p-6 sm:p-10 hover:bg-secondary/60 ui-fade",
        "states": {
          "idle": "Show hint + supported formats",
          "drag_over": "border-primary shadow-glow",
          "uploading": "Progress bar + file list",
          "success": "Confetti micro-animation (optional) + summary: 'Found 12 deadlines across 4 courses'"
        },
        "data_testid": {
          "dropzone": "syllabus-upload-dropzone",
          "progress": "syllabus-upload-progress",
          "summary": "deadline-extraction-summary"
        }
      },
      "urgency_banner": {
        "use": "Alert or custom Card",
        "className": "rounded-card border border-border bg-card shadow-soft",
        "accent_bar": "before:content-[''] before:absolute before:inset-y-0 before:left-0 before:w-1 before:rounded-l-card before:bg-[var(--urgency-color)]",
        "examples": {
          "3_days": "--urgency-color: #F59E0B",
          "today": "--urgency-color: #EF4444"
        },
        "data_testid": "urgency-banner"
      },
      "calendar": {
        "use": "shadcn calendar.jsx for date picking + build custom month grid for events OR wrap existing calendar with event overlays",
        "month_header": "flex items-center justify-between gap-2",
        "day_cell": "relative rounded-control border border-border bg-card hover:bg-secondary/60 ui-fade min-h-[92px] p-2",
        "event_chip": "mt-1 inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium truncate",
        "event_chip_pattern": "bg-[course_chip_bg] text-[course_chip_text] border border-border",
        "legend": "flex flex-wrap gap-2",
        "data_testid": {
          "calendar-root": "deadlines-calendar",
          "view-toggle": "calendar-view-toggle",
          "event": "calendar-event-chip"
        }
      },
      "quiz_studio": {
        "use": "Tabs + Card + Skeleton + Table",
        "layout": "Left: upload + generate; Right: quiz preview",
        "question_card": "rounded-card border border-border bg-card shadow-soft p-4",
        "option_row": "flex items-center gap-2 rounded-control border border-border px-3 py-2 hover:bg-secondary/60 ui-fade",
        "data_testid": {
          "upload": "study-material-upload",
          "generate": "quiz-generate-button",
          "question": "quiz-question",
          "option": "quiz-option"
        }
      },
      "call_me_modal": {
        "use": "Dialog (desktop) + Drawer (mobile)",
        "modal_shell": "rounded-card border border-border bg-card shadow-soft",
        "phone_input": "Input with leading icon + country hint",
        "primary_cta": "Big cinematic CTA button",
        "cta_className": "h-12 sm:h-14 rounded-control shadow-pop bg-primary text-primary-foreground hover:bg-primary/90 ui-fade ui-press",
        "data_testid": {
          "open": "call-me-open-button",
          "phone": "call-me-phone-input",
          "quiz_picker": "call-me-quiz-select",
          "submit": "call-me-submit-button"
        }
      },
      "active_call_cinematic_panel": {
        "intent": "The wow moment: full-screen (or large modal) dark solid background, pulsing ring, waveform, status steps.",
        "background": "bg-[#070A12] text-[#EAF0FF]",
        "container": "relative overflow-hidden rounded-card border border-white/10 bg-[#0B1020] shadow-[0_30px_80px_rgba(0,0,0,0.55)]",
        "ring": "absolute inset-0 pointer-events-none",
        "ring_visual": "mx-auto mt-10 h-28 w-28 rounded-full bg-white/5 border border-white/10 animate-callPulse",
        "phone_icon": "h-10 w-10 text-primary",
        "status_steps": "flex items-center justify-center gap-2 text-xs text-white/70",
        "waveform": {
          "implementation": "SVG or canvas bars; animate with CSS when no audio stream; upgrade to WebAudio-driven later.",
          "css_bars": "flex items-end justify-center gap-1 h-16",
          "bar": "w-1.5 rounded-full bg-primary/80",
          "bar_anim": "[animation:callPulse_1.2s_var(--ease-out)_infinite]"
        },
        "states": {
          "calling": "Show 'Calling…' + subtle pulse",
          "ringing": "Add ringWiggle on phone icon + louder pulse",
          "on_call": "Waveform active + timer",
          "completed": "Fade to results summary"
        },
        "data_testid": {
          "panel": "active-call-panel",
          "status": "active-call-status",
          "waveform": "active-call-waveform",
          "end": "active-call-end-button"
        }
      },
      "results_panel": {
        "use": "Card + Table + Accordion",
        "score_badge": "rounded-full px-3 py-1 text-xs font-semibold bg-secondary",
        "transcript": "font-mono text-xs bg-secondary/50 rounded-control p-3 border border-border",
        "data_testid": {
          "score": "call-results-score",
          "transcript": "call-results-transcript",
          "breakdown": "call-results-breakdown"
        }
      }
    }
  },
  "motion_and_microinteractions": {
    "library": {
      "recommended": "framer-motion",
      "install": "npm i framer-motion",
      "usage_notes_js": [
        "Use motion.div for page transitions and card entrance.",
        "Prefer opacity + y translate; avoid heavy blur on low-end devices.",
        "Respect prefers-reduced-motion: reduce."
      ]
    },
    "timing": {
      "page_enter": "duration: 0.35, ease: [0.16, 1, 0.3, 1]",
      "hover": "duration: 0.18",
      "press": "scale to 0.98",
      "skeleton": "use shadcn Skeleton with subtle shimmer"
    },
    "patterns": {
      "bento_cards": "On hover: shadow-soft -> shadow-pop, border color to primary/30, translateY(-1px)",
      "chips": "On hover: background +8% tint, show tiny dot pulse",
      "calendar_events": "On hover: show Popover with details; on click: Dialog with full details",
      "upload": "Drag-over: border-primary + shadow-glow; drop: quick success toast (sonner)"
    }
  },
  "accessibility": {
    "requirements": [
      "WCAG AA contrast for text on surfaces.",
      "Visible focus rings: focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2.",
      "Keyboard navigable: all dialogs, tabs, selects.",
      "prefers-reduced-motion: disable callPulse/ringWiggle and replace with static indicators."
    ],
    "content": [
      "Use clear labels: 'Upload syllabus PDF', 'Generate quiz', 'Call me now'.",
      "Avoid color-only meaning: course chips include course code initials; urgency includes icon + text."
    ]
  },
  "data_testid_convention": {
    "rule": "All interactive and key informational elements MUST include data-testid.",
    "format": "kebab-case describing role",
    "examples": [
      "auth-login-submit-button",
      "auth-demo-bypass-button",
      "syllabus-upload-dropzone",
      "deadline-extraction-summary",
      "calendar-event-chip",
      "quiz-generate-button",
      "call-me-phone-input",
      "active-call-status",
      "call-results-score"
    ]
  },
  "pages": {
    "auth": {
      "layout": "Split-screen on desktop: left brand panel with mild gradient blobs (<=20% viewport), right auth card. Mobile: single column.",
      "hero_visual": "Use abstract gradient texture as background overlay (very subtle).",
      "components": ["Card", "Tabs (Login/Signup)", "Input", "Button", "Sonner"],
      "data_testid": {
        "email": "auth-email-input",
        "password": "auth-password-input",
        "submit": "auth-submit-button",
        "demo": "auth-demo-bypass-button"
      }
    },
    "dashboard": {
      "above_fold": "Upload dropzone + urgency banners + quick stats.",
      "wow": "After extraction, animate calendar preview filling (staggered chips).",
      "components": ["Card", "Progress", "Badge", "Skeleton", "Popover"],
      "quick_stats": "Deadlines, Quizzes, Calls — oversized numbers with heading font."
    },
    "calendar_page": {
      "layout": "Full-width calendar with left legend + filters; right details drawer on click.",
      "toggles": "Month / Week / List using Tabs.",
      "readability": "Day cells must have min height and event chips truncated; show count '+3' chip when overflow."
    },
    "quiz_studio": {
      "layout": "Two-pane: generator left, preview right; on mobile becomes stacked with Tabs.",
      "loading": "Skeleton list for questions while Gemini generates (5–15s)."
    },
    "call_center": {
      "layout": "Call Me modal + Active Call cinematic panel + Results.",
      "cinematic": "Use dark solid background only here; keep rest of app bright.",
      "status": "Calling → Ringing → On call → Completed as stepper chips."
    },
    "settings": {
      "layout": "Simple card form; keep playful accents minimal.",
      "components": ["Card", "Input", "Button", "Switch"]
    }
  },
  "images": {
    "image_urls": [
      {
        "category": "auth-left-panel-optional",
        "description": "Bright abstract gradient texture used as subtle background overlay (blend-mode soft-light, low opacity).",
        "url": "https://images.unsplash.com/photo-1702285566204-4ea03cd25559?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85"
      },
      {
        "category": "auth-left-panel-optional",
        "description": "Alternate abstract texture (use only one).",
        "url": "https://images.unsplash.com/photo-1702285566489-6dddb57fd737?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85"
      },
      {
        "category": "dashboard-hero-optional",
        "description": "Student studying lifestyle photo for marketing-like hero (use sparingly; keep UI-first).",
        "url": "https://images.unsplash.com/photo-1573496799175-606e47a7d4f6?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85"
      }
    ]
  },
  "extra_libraries": {
    "recommended": [
      {
        "name": "framer-motion",
        "why": "Page transitions, bento card entrance, cinematic call states",
        "install": "npm i framer-motion",
        "usage": "Create a <PageTransition> wrapper using motion.div with initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}"
      },
      {
        "name": "lottie-react (optional)",
        "why": "Optional confetti/success micro-animations after deadline extraction",
        "install": "npm i lottie-react",
        "usage": "Render small Lottie in corner of upload card for 1.2s; provide prefers-reduced-motion fallback"
      }
    ]
  },
  "example_classname_patterns": {
    "page_container": "min-h-screen bg-background text-foreground",
    "content_container": "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8",
    "section_title": "font-heading text-xl sm:text-2xl tracking-tight",
    "card": "rounded-card border border-border bg-card shadow-soft",
    "card_hover": "hover:shadow-pop hover:border-primary/30 ui-fade",
    "muted": "text-muted-foreground",
    "pill": "rounded-full",
    "focus": "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
  },
  "instructions_to_main_agent": [
    "Replace CRA default App.css centered header styles; do not use .App { text-align:center }.",
    "Update /app/frontend/src/index.css shadcn tokens to the provided HSL values; keep cards solid.",
    "Implement bright mode as default; dark mode primarily for call cinematic panel (can be a route-level class toggle).",
    "Calendar: prioritize glanceability—course color chips + legend + overflow handling.",
    "All interactive and key informational elements must include data-testid (kebab-case).",
    "Use shadcn components from /app/frontend/src/components/ui (no raw HTML dropdown/calendar/toast).",
    "Use sonner for toasts (already present).",
    "Avoid gradients except subtle hero background blobs/strokes (<=20% viewport)."
  ],
  "inspiration_links": {
    "calendar_ui": [
      "https://dribbble.com/shots/26972266-Color-Coded-Calendar-UI-for-Productivity-Rebound",
      "https://dribbble.com/search/student-app-ui"
    ],
    "call_ui": [
      "https://docs.vapi.ai/quickstart/phone",
      "https://www.vecteezy.com/video/72542483-incoming-call-animation-phone-ringing-icon-incoming-call-screen-animated-phone-call-icon-ui-call-notification"
    ]
  },
  "general_ui_ux_design_guidelines_appendix": "- You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n- You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n- NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals."
}

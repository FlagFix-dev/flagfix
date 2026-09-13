"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/auth/auth-provider";
import { ADMIN_ROLES, STAFF_ROLES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types";

interface DocSection {
  id: string;
  title: string;
  /** Who this section is written for. A student shouldn't have to wade
   * through admin setup instructions to find out how to report a leak. */
  audience: "everyone" | "staff" | "admin";
  body: { heading?: string; text: string }[];
}

const SECTIONS: DocSection[] = [
  {
    id: "reporting",
    title: "Reporting a problem",
    audience: "everyone",
    body: [
      {
        text: "Click \"Report a problem\", describe what's wrong in your own words, say where it is, and submit. You can attach up to 5 photos or short videos — a photo is the single fastest way to help staff find and understand the problem.",
      },
      {
        heading: "Be specific in the description",
        text: "\"The ceiling fan in Room 204 makes a loud grinding noise and sometimes stops — started yesterday evening\" is far more useful than \"fan broken\". The AI reads your description to work out how serious and urgent it is, so detail directly affects how fast it gets handled.",
      },
      {
        heading: "If your location isn't listed",
        text: "Choose \"Somewhere else — not in this list\" and describe the exact spot: name the building, the floor, and something nearby that doesn't move, like a door number or a staircase. Attach a photo too.",
      },
      {
        heading: "After you submit",
        text: "You'll see your report's priority and a live status. Staff can post updates like \"Technician on the way\" which appear on your report automatically. When it's marked resolved, you'll be asked to confirm whether it was actually fixed — if you say no, it reopens.",
      },
    ],
  },
  {
    id: "priority",
    title: "How priority is decided",
    audience: "everyone",
    body: [
      {
        text: "Every report gets a score out of 100, built from five things: how severe it is, how urgent it is, whether there's a safety risk, how many people are affected, and whether the same problem has come back after being 'fixed' before.",
      },
      {
        heading: "Safety always wins",
        text: "Anything flagged as a potential safety risk is automatically raised to at least High priority, and a severe safety report goes straight to Critical — it does not have to wait for several people to report it first.",
      },
      {
        heading: "Nothing is a black box",
        text: "Every report shows the plain-language reasons behind its score. If you think the score is wrong, the reasoning tells you exactly which input caused it.",
      },
    ],
  },
  {
    id: "ai",
    title: "What the AI actually does",
    audience: "staff",
    body: [
      {
        heading: "It reads reports",
        text: "The language model turns a free-text description into structured fields — category, severity, urgency, and whether there's a safety risk. This is why people can write however they like, in whatever mix of languages and spelling they use, and still get sensible triage.",
      },
      {
        heading: "It groups duplicates by meaning",
        text: "\"wifi not working in block a\" and \"cannot connect near room 214\" share almost no words, but mean the same thing. FlagFix compares meaning rather than keywords, so those become one problem with several reports — see the Grouped problems page.",
      },
      {
        heading: "It does NOT decide the priority number",
        text: "The score itself is a fixed formula, deliberately — so the same inputs always produce the same score and staff can audit it. The AI supplies the inputs; the arithmetic is predictable.",
      },
      {
        heading: "If the AI is unavailable",
        text: "Reports are never blocked. They're saved and routed for manual review, marked low-confidence so a human knows to check them. Admins see a banner on the dashboard whenever the AI is running in this fallback mode.",
      },
    ],
  },
  {
    id: "staff-workflow",
    title: "Working a report (staff)",
    audience: "staff",
    body: [
      {
        heading: "Accept it",
        text: "Open a report and click \"Accept this problem\" to take ownership. This records that you have it, so two people don't both chase the same job.",
      },
      {
        heading: "Keep people informed",
        text: "Use the quick update buttons — \"Work started\", \"Technician on the way\", \"Almost done\" — or write your own note. The reporter and admins see it immediately, which cuts down on \"any update?\" messages.",
      },
      {
        heading: "Resolve it",
        text: "Mark it resolved when the work is done. The original reporter is then asked to confirm. If they say it's still broken, it reopens automatically — a staff-side 'resolved' is not the same as actually fixed.",
      },
    ],
  },
  {
    id: "setup",
    title: "Setting up your institution (admin)",
    audience: "admin",
    body: [
      {
        heading: "1. Add your locations",
        text: "On the Locations page, add your buildings, floors, rooms and common areas. People pick from these when reporting, so the more accurate this list is, the more precise your reports will be. You can nest them — make \"Room 303\" a child of \"Hostel Block C\".",
      },
      {
        heading: "2. Share your staff code",
        text: "Your staff code is on your profile page. Give it only to staff — they enter it when signing up and choosing \"Staff\". It's what stops students granting themselves access to the full reports queue. If it spreads too widely, the owner can generate a new one instantly.",
      },
      {
        heading: "3. Share your workspace URL",
        text: "Everyone at your institution signs up using your workspace URL. Students need nothing else.",
      },
      {
        heading: "4. Watch the dashboard",
        text: "The dashboard shows what needs attention now: open reports, critical ones, anything past its SLA, plus how many staff are online and how much work is accepted versus waiting.",
      },
    ],
  },
  {
    id: "roles",
    title: "Who can see what",
    audience: "everyone",
    body: [
      {
        heading: "Students",
        text: "Can submit reports and see their own reports only — including live progress updates on them. They cannot see other people's reports or the institution-wide queue.",
      },
      {
        heading: "Staff",
        text: "See every report in the institution, the AI analysis behind each one, and the grouped-problems view. They can accept work, post updates, and resolve reports.",
      },
      {
        heading: "Admins and owners",
        text: "Everything staff can see, plus the Locations page, the People page, the staff code, and institution-wide operational stats. Only the owner can regenerate the staff code.",
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy and your data",
    audience: "everyone",
    body: [
      {
        text: "Each institution's data is isolated from every other institution's at the database level, not just in the app — the database itself refuses to return another institution's rows.",
      },
      {
        heading: "What staff can see about you",
        text: "Staff see your report, your name, and any photos you attach. Admins can additionally see your role and when you were last active. Nobody can read your password — it's stored only as an irreversible hash.",
      },
    ],
  },
];

const AUDIENCE_LABEL: Record<DocSection["audience"], string> = {
  everyone: "Everyone",
  staff: "Staff",
  admin: "Admins",
};

function canSee(section: DocSection, role: UserRole): boolean {
  if (section.audience === "everyone") return true;
  if (section.audience === "staff") return STAFF_ROLES.includes(role);
  return ADMIN_ROLES.includes(role);
}

export default function DocsPage() {
  const { claims } = useAuth();
  const [openId, setOpenId] = useState<string | null>(SECTIONS[0].id);

  const sections = claims ? SECTIONS.filter((s) => canSee(s, claims.role)) : SECTIONS;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink-900">Docs &amp; help</h1>
        <p className="mt-1 text-sm text-ink-600">
          How FlagFix works, written for the part you actually use.
        </p>
      </div>

      <div className="space-y-3">
        {sections.map((section) => {
          const open = openId === section.id;
          return (
            <Card key={section.id} lift>
              <CardHeader
                className={cn("cursor-pointer select-none", !open && "border-b-0")}
                onClick={() => setOpenId(open ? null : section.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <CardTitle>{section.title}</CardTitle>
                    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-600">
                      {AUDIENCE_LABEL[section.audience]}
                    </span>
                  </div>
                  <span
                    aria-hidden="true"
                    className={cn("shrink-0 text-lg text-ink-400 transition-transform", open && "rotate-45")}
                  >
                    +
                  </span>
                </div>
              </CardHeader>
              {open && (
                <CardBody className="animate-fade-up space-y-4">
                  {section.body.map((block, i) => (
                    <div key={i}>
                      {block.heading && (
                        <h3 className="text-sm font-semibold text-ink-900">{block.heading}</h3>
                      )}
                      <p className={cn("text-sm leading-relaxed text-ink-600", block.heading && "mt-1")}>
                        {block.text}
                      </p>
                    </div>
                  ))}
                </CardBody>
              )}
            </Card>
          );
        })}
      </div>

      <Card glass>
        <CardBody>
          <p className="text-sm font-medium text-ink-900">Still stuck?</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-600">
            Ask whoever set up your institution's FlagFix workspace — they're listed as the owner and
            can see everything, including your account.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

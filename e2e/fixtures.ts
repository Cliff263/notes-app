import type { EventColor } from "@/lib/types";

/** Test-only workspace data. Production accounts always start empty. */

type SeedNote = {
  title: string;
  content: string;
  category: string;
  tags: string[];
  pinned?: boolean;
  favorite?: boolean;
  archived?: boolean;
  /** Days before today the note was last touched. */
  daysAgo: number;
};

type SeedEvent = {
  title: string;
  description: string;
  location: string;
  /** Days from today the event starts. */
  inDays: number;
  startHour: number;
  durationMinutes: number;
  allDay?: boolean;
  color: EventColor;
  /** An RRULE subset; see lib/recurrence.ts. */
  recurrence?: string;
};

export const SEED_NOTES: SeedNote[] = [
  {
    title: "Meeting Notes - Product Launch",
    category: "Work",
    tags: ["meeting", "product", "launch"],
    pinned: true,
    daysAgo: 0,
    content: `Discussed the upcoming product launch strategy in today's meeting. The team gathered to finalize our approach for the Q2 release and align on what "done" means for each workstream.

## Agenda covered
- Launch date confirmation and the freeze window
- Marketing campaign timeline and asset handoff
- Beta feedback themes from the last two cohorts
- Support readiness and escalation paths

## Decisions
- Ship the staged rollout at 10% for the first 48 hours
- Hold the pricing page change until the launch post is live
- Engineering owns the status page during launch week

## Action items
- Draft the launch announcement (marketing, Friday)
- Finalize onboarding copy (design, Wednesday)
- Run the load test against staging (platform, Thursday)
- Book the retro for the week after launch`,
  },
  {
    title: "App Idea: Task Manager",
    category: "Ideas",
    tags: ["app", "productivity", "startup"],
    favorite: true,
    daysAgo: 0,
    content: `Concept for a new task management app that focuses on simplicity and speed. The idea came to me after using several task management tools that felt too complex for quick note-taking.

## Core features
- Minimalist design with clean interface
- Focus on quick capture - ability to add tasks in seconds
- Smart categorization using AI to automatically organize tasks
- Cross-platform sync across all devices
- Voice notes support for hands-free task entry
- Natural language processing for due dates and priorities
- Minimal friction - no complex setup required

## Market research needed
- Analyze competitors (Todoist, Things, Any.do)
- Survey potential users about pain points
- Research pricing models
- Identify target audience
- Study app store reviews of similar apps

## Technical considerations
- Native apps vs web app
- Backend infrastructure
- Data synchronization strategy
- Offline support
- Security and privacy

Next steps: Create a basic prototype and test with a small group of users to validate the core assumption that speed beats features.`,
  },
  {
    title: "Launch Checklist",
    category: "Work",
    tags: ["launch", "checklist"],
    daysAgo: 1,
    content: `Everything that has to be true before we ship. Decisions and context live in [[Meeting Notes - Product Launch]] — this is only the running list.

## Before the freeze
- [x] Confirm the launch date with support
- [x] Freeze the pricing page
- [ ] Run the load test against staging
- [ ] Sign off the onboarding copy

## Launch day
- [ ] Publish the announcement post
- [ ] Watch error rates for the first two hours
- [ ] Open the status page thread

Anything unticked by Thursday gets escalated rather than carried.`,
  },
  {
    title: "Q1 Marketing Strategy",
    category: "Work",
    tags: ["marketing", "strategy", "q1"],
    daysAgo: 1,
    content: `Comprehensive marketing plan for Q1 2024. This quarter is crucial for establishing our brand presence and driving user acquisition ahead of the spring release.

## Objectives
- Grow qualified signups by 40% quarter over quarter
- Publish two case studies from existing customers
- Establish a repeatable content cadence

## Channels
- Content marketing: one deep-dive post per week
- Community: answer questions where our users already are
- Partnerships: co-marketing with two adjacent tools
- Paid: small, tightly targeted experiments only

Budget notes: keep paid under 20% of spend until the organic funnel converts predictably.

Measurement: weekly dashboard review every Monday, monthly narrative write-up for the leadership sync.`,
  },
  {
    title: "Daily Reflection - January 15",
    category: "Journal",
    tags: ["reflection", "daily"],
    daysAgo: 1,
    content: `Today was a productive day overall. I finished the project proposal that I've been working on for the past week. The process took longer than expected, mostly because I kept rewriting the problem statement until it actually said something.

## What went well
- Deep work block in the morning with no interruptions
- Closed out three lingering review comments
- Went for a walk instead of doom-scrolling at lunch

## What didn't
- Started the day in my inbox again
- Skipped the gym for the second time this week

Tomorrow: protect the first two hours, then batch the small stuff after lunch.`,
  },
  {
    title: "Weekend Trip Ideas",
    category: "Personal",
    tags: ["plans", "travel"],
    daysAgo: 2,
    content: `Planning a weekend getaway and exploring different options. Here are some places I'd like to visit:

1. Mountain hiking - two nights, cabin near the trailhead, sunrise hike on Saturday
2. Coastal drive - stop at the lighthouse, seafood on the pier
3. Lake cabin - kayak rental, no reception, that's the point
4. City break - museum morning, long lunch, bookshop crawl

## To sort out
- Check the forecast before booking anything
- Compare cabin prices for the last weekend of the month
- Ask around who's free`,
  },
  {
    title: "Book Notes: Atomic Habits",
    category: "Personal",
    tags: ["book", "habits", "improvement"],
    daysAgo: 3,
    content: `Notes from the second read. The framing that stuck this time: you don't rise to the level of your goals, you fall to the level of your systems.

## Key ideas
- Make it obvious - design the environment so the cue is unavoidable
- Make it attractive - pair the habit with something you already want
- Make it easy - reduce friction to the two-minute version
- Make it satisfying - the reward has to land immediately

## Applying it
- Put the running shoes by the door tonight
- Two-minute rule for writing: open the file, write one sentence
- Habit tracker on the fridge, not in an app I'll forget to open`,
  },
  {
    title: "Pasta Recipe Collection",
    category: "Personal",
    tags: ["recipe", "cooking", "pasta"],
    daysAgo: 4,
    content: `Recipes worth keeping, tested and adjusted.

Cacio e pepe
- Toast the pepper first, it changes everything
- Pasta water off the heat before the cheese goes in
- Pecorino only, finely grated

Carbonara
- Guanciale, not bacon; render it slowly
- Egg yolks plus one whole egg for four servings
- Kill the heat before combining or it scrambles

Simple tomato
- One onion halved, butter, tin of tomatoes, 45 minutes, pull the onion out
- Salt at the end

Next to try: pasta e ceci, and a proper ragù on a Sunday.`,
  },
  {
    title: "Learning React Patterns",
    category: "Ideas",
    tags: ["react", "learning", "development"],
    daysAgo: 5,
    content: `Collecting the patterns I keep reaching for, with notes on when they actually pay off.

- Compound components: great for flexible APIs, painful to type well
- Render props: mostly replaced by hooks, still useful for measuring
- Reducers over multiple useState calls once transitions get interesting
- Colocate state as low as possible, lift only when two siblings need it
- Server components change the default: fetch where you render

Open question: when is a store better than passing props? Rough answer so far - when the state is genuinely global (theme, session, selection across panes) or updates are high-frequency.`,
  },
  {
    title: "Sprint Retrospective",
    category: "Work",
    tags: ["retrospective", "meeting"],
    daysAgo: 6,
    content: `Retro for the sprint that just closed. Attendance was full, which helped.

## Went well
- Pairing on the migration caught two bugs before review
- The new PR template cut review turnaround roughly in half

## Didn't go well
- Two tickets carried over again with no visible progress
- Staging was broken for most of Wednesday and nobody owned it

## Try next sprint
- Cap work-in-progress at two tickets per person
- Rotate a named "staging owner" each sprint
- Fifteen-minute mid-sprint check on carryover risk`,
  },
  {
    title: "Morning Routine Experiment",
    category: "Journal",
    tags: ["routine", "daily", "habits"],
    daysAgo: 8,
    content: `Running a two-week experiment on the first hour of the day. Hypothesis: what I do before opening a screen sets the tone for everything after it.

## The routine
- Wake at the same time, no snooze
- Water, then twenty minutes of movement
- Ten minutes writing, longhand, no editing
- Screens only after all of the above

Tracking: mood at noon, whether the deep work block happened, and how many times I checked my phone before 9am.

Day 3 note: the writing is the part I want to skip, which probably means it's the part that's working.`,
  },
  {
    title: "Old Landing Page Copy",
    category: "Archive",
    tags: ["marketing", "product"],
    archived: true,
    daysAgo: 21,
    content: `Superseded by the Q1 rewrite. Keeping it for reference in case we need the original positioning.

Headline: "Notes that keep up with you."
Sub: "Capture in a keystroke, find it in a second, and never think about where it went."

Why it was replaced: tested poorly with people who had never used the product. Too abstract, no mention of what the thing actually is.`,
  },
];

export const SEED_EVENTS: SeedEvent[] = [
  {
    title: "Product Launch Review",
    description:
      "Final go/no-go on the staged rollout. Bring the load-test numbers and the support readiness checklist.",
    location: "War room / Zoom",
    inDays: 0,
    startHour: 14,
    durationMinutes: 60,
    color: "violet",
  },
  {
    title: "Daily Standup",
    description: "Fifteen minutes, what moved and what is stuck.",
    location: "Zoom",
    inDays: 0,
    startHour: 9,
    durationMinutes: 15,
    color: "amber",
    recurrence: "FREQ=DAILY",
  },
  {
    title: "Design Sync",
    description: "Walk through the onboarding copy and the empty states.",
    location: "Studio",
    inDays: 0,
    startHour: 16,
    durationMinutes: 45,
    color: "cyan",
  },
  {
    title: "1:1 with Sarah",
    description: "Career conversation, then sprint carryover.",
    location: "Coffee bar",
    inDays: 1,
    startHour: 10,
    durationMinutes: 30,
    color: "emerald",
  },
  {
    title: "Q2 Planning Workshop",
    description:
      "Three hours to shape the quarter. Pre-read goes out the night before — come with your top two bets.",
    location: "Room 4B",
    inDays: 2,
    startHour: 9,
    durationMinutes: 180,
    color: "amber",
  },
  {
    title: "Marketing Campaign Kickoff",
    description: "Hand off assets and lock the publishing calendar for the launch window.",
    location: "Zoom",
    inDays: 3,
    startHour: 11,
    durationMinutes: 60,
    color: "violet",
  },
  {
    title: "Team Offsite",
    description: "Full day away from the laptops. Strategy in the morning, walk in the afternoon.",
    location: "Lakeside lodge",
    inDays: 5,
    startHour: 0,
    durationMinutes: 24 * 60,
    allDay: true,
    color: "cyan",
  },
  {
    title: "Sprint Retrospective",
    description: "Close out the sprint. Carryover cap experiment gets its first review.",
    location: "Room 2A",
    inDays: 7,
    startHour: 15,
    durationMinutes: 60,
    color: "rose",
  },
  {
    title: "Book Club: Atomic Habits",
    description: "Chapters 9 through 14. Bring one habit you actually changed.",
    location: "Neighbourhood library",
    inDays: 9,
    startHour: 18,
    durationMinutes: 90,
    color: "emerald",
  },
  {
    title: "Dentist",
    description: "Six-month cleaning.",
    location: "Bright Smile Dental",
    inDays: 12,
    startHour: 8,
    durationMinutes: 45,
    color: "amber",
  },
  {
    title: "Weekend Hiking Trip",
    description: "Cabin near the trailhead. Sunrise hike on Saturday if the forecast holds.",
    location: "Ridge Trail",
    inDays: 16,
    startHour: 0,
    durationMinutes: 24 * 60,
    allDay: true,
    color: "cyan",
  },
];

export function buildSeedRows(userId: string, now = new Date()) {
  const noteRows = SEED_NOTES.map((note, index) => {
    const stamp = new Date(now);
    stamp.setDate(stamp.getDate() - note.daysAgo);
    stamp.setHours(9, 10 - index, 0, 0);
    return {
      userId,
      title: note.title,
      content: note.content,
      category: note.category,
      tags: note.tags,
      pinned: note.pinned ?? false,
      favorite: note.favorite ?? false,
      archived: note.archived ?? false,
      createdAt: stamp,
      updatedAt: stamp,
    };
  });

  const eventRows = SEED_EVENTS.map((event) => {
    const startsAt = new Date(now);
    startsAt.setDate(startsAt.getDate() + event.inDays);
    startsAt.setHours(event.startHour, 0, 0, 0);
    const endsAt = new Date(startsAt.getTime() + event.durationMinutes * 60_000);
    if (event.allDay) endsAt.setHours(23, 59, 0, 0);

    return {
      userId,
      title: event.title,
      description: event.description,
      location: event.location,
      startsAt,
      endsAt,
      allDay: event.allDay ?? false,
      color: event.color,
      recurrence: event.recurrence ?? null,
    };
  });

  return { noteRows, eventRows };
}

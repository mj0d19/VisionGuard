/**
 * Mock data for VisionGuard Demo page (presentation only).
 *
 * Scenarios are authored in a compact "raw" shape (matches the JSON pasted from
 * the analysis team) and transformed into the UI-ready shape expected by the
 * demo components. Keep component-facing field names stable; add new raw fields
 * freely — the transformer below uses safe fallbacks so missing data never
 * breaks the page.
 *
 * Where to edit later: scroll to the `DEMO_SCENARIOS` array at the bottom.
 */

/** i18n keys for the fake analyze overlay sequence */
export const DEMO_ANALYZE_STEP_KEYS = [
  'demo.step.analyzingVideo',
  'demo.step.detectingObjects',
  'demo.step.trackingSubjects',
  'demo.step.buildingTimeline',
  'demo.step.generatingIntelligence',
];

const baseChatIntro = (scenarioTitle) => [
  {
    id: 'sys-1',
    role: 'assistant',
    content: `**VisionGuard** — scenario loaded: *${scenarioTitle}*\n\nThis is a frontend-only demo. Responses are canned for poster presentation.`,
  },
];

/** @typedef {'normal' | 'warning' | 'critical'} DemoSeverity */

/**
 * @typedef {Object} DemoTimelineEvent
 * @property {string} id
 * @property {string} time — "MM:SS" from raw analysis (same as timeLabel when sourced from JSON)
 * @property {string} timeLabel
 * @property {string} text
 * @property {DemoSeverity} severity
 * @property {number | null} [trackId]  — preserved from raw JSON for future UI use
 * @property {string} [type]            — preserved from raw JSON for future UI use
 */

/**
 * @typedef {Object} DemoTrack
 * @property {number} trackId
 * @property {string} label
 */

/**
 * @typedef {Object} DemoChatAnswer
 * @property {string} trigger
 * @property {string} reply
 */

/**
 * @typedef {Object} DemoScenario
 * @property {string} id
 * @property {string} title
 * @property {string} subtitle
 * @property {DemoSeverity} severity
 * @property {string | null} rawVideoUrl — public URL e.g. `/videos/cam1.mp4`; null shows placeholder
 * @property {string | null} analyzedVideoUrl — public URL for analyzed overlays
 * @property {{ paragraph: string }} summary
 * @property {{ peopleDetected: number, eventsDetected: number, suspiciousEvents: number }} metrics
 * @property {DemoTrack[]} [tracks]       — optional; not yet bound to UI but preserved
 * @property {DemoTimelineEvent[]} events
 * @property {string[]} suggestedPrompts
 * @property {DemoChatAnswer[]} chatAnswers
 */

/** Severity → subtitle shown on the left scenario card (matches existing phrasing). */
const SUBTITLE_BY_SEVERITY = {
  normal: 'Synthetic demo · baseline',
  warning: 'Synthetic demo · warning',
  critical: 'Synthetic demo · critical',
};

/**
 * Map a suggested prompt to a short trigger keyword used by `getMockAssistantReply`,
 * which matches via `normalized.includes(trigger.toLowerCase())`. The prompt itself
 * always contains the keyword, so prompt-chip clicks are guaranteed to match.
 * @param {string} prompt
 * @returns {string}
 */
function deriveTriggerFromPrompt(prompt) {
  const p = String(prompt || '').toLowerCase();
  if (p.includes('what happened')) return 'what happened';
  if (p.includes('unusual')) return 'unusual';
  if (p.includes('suspicious')) return 'suspicious';
  if (p.includes('critical')) return 'critical';
  if (p.includes('how many')) return 'how many';
  if (p.includes('flagged')) return 'flagged';
  if (p.includes('which subject')) return 'which subject';
  if (p.includes('who is involved')) return 'who is involved';
  if (p.includes('escalate')) return 'escalate';
  if (p.includes('summarize')) return 'summarize';
  // Fallback: use the full prompt as trigger (chip click still matches via .includes).
  return p;
}

/**
 * Convert the pasted "raw" scenario JSON into the UI-ready shape. Missing fields
 * are filled with safe defaults so the demo page never crashes on bad input.
 *
 * @param {Object} raw   — scenario object in the pasted JSON shape
 * @param {{ rawVideoUrl?: string | null, analyzedVideoUrl?: string | null, subtitle?: string }} [overrides]
 * @returns {DemoScenario}
 */
function transformRawScenario(raw, overrides = {}) {
  const safeRaw = raw || {};
  const id = safeRaw.id ?? '';
  const title = safeRaw.title ?? 'Untitled scenario';
  const severity = /** @type {DemoSeverity} */ (safeRaw.severity ?? 'normal');

  const subtitle =
    overrides.subtitle ?? SUBTITLE_BY_SEVERITY[severity] ?? SUBTITLE_BY_SEVERITY.normal;

  // Prefer explicit overrides; fall back to raw.videoUrl for both streams so the
  // page still renders something if a scenario only ships with a single URL.
  const rawVideoUrl =
    overrides.rawVideoUrl !== undefined ? overrides.rawVideoUrl : safeRaw.videoUrl ?? null;
  const analyzedVideoUrl =
    overrides.analyzedVideoUrl !== undefined
      ? overrides.analyzedVideoUrl
      : safeRaw.videoUrl ?? null;

  const summaryText = typeof safeRaw.summary === 'string' ? safeRaw.summary : '';

  const rawMetrics = safeRaw.metrics || {};
  const metrics = {
    peopleDetected: Number(rawMetrics.peopleDetected) || 0,
    eventsDetected: Number(rawMetrics.eventsDetected) || 0,
    suspiciousEvents: Number(rawMetrics.suspiciousEvents) || 0,
  };

  const tracks = Array.isArray(safeRaw.tracks) ? safeRaw.tracks : [];

  const events = Array.isArray(safeRaw.events)
    ? safeRaw.events.map((ev, i) => ({
        id: `${id || 'scenario'}-e${i + 1}`,
        time: ev?.time ?? '',
        timeLabel: ev?.time ?? '',
        // Prefer detailed `description`; fall back to `type` so the row never renders blank.
        text: ev?.description || ev?.type || '',
        severity: /** @type {DemoSeverity} */ (ev?.severity ?? 'normal'),
        trackId: ev?.trackId ?? null,
        type: ev?.type ?? '',
      }))
    : [];

  const suggestedPrompts = Array.isArray(safeRaw.suggestedPrompts)
    ? safeRaw.suggestedPrompts.slice()
    : [];

  // chatAnswers is a { prompt: reply } map in raw JSON; components want an array
  // of { trigger, reply } entries. We derive a short trigger keyword per prompt
  // so both chip-clicks and free-typed variations match.
  const rawChat = safeRaw.chatAnswers && typeof safeRaw.chatAnswers === 'object' ? safeRaw.chatAnswers : {};
  const chatAnswers = Object.entries(rawChat).map(([prompt, reply]) => ({
    trigger: deriveTriggerFromPrompt(prompt),
    reply: String(reply ?? ''),
  }));

  return {
    id,
    title,
    subtitle,
    severity,
    rawVideoUrl,
    analyzedVideoUrl,
    summary: { paragraph: summaryText },
    metrics,
    tracks,
    events,
    suggestedPrompts,
    chatAnswers,
  };
}

// -----------------------------------------------------------------------------
// Raw scenarios as supplied by the analysis team (pasted JSON, verbatim shape).
// -----------------------------------------------------------------------------

const RAW_SCENARIOS = [
  // 1) Baseline-ish clip: normal pedestrian flow with a couple of minor anomalies.
  {
    id: 'walkway_mixed_behavior_01',
    title: 'Campus Walkway – Normal Activity with Minor Anomalies',
    videoUrl: '/demo-videos/Walkway-5.mp4',
    severity: 'normal',
    summary:
      'The scene shows normal pedestrian activity with multiple individuals walking through a campus walkway. Minor unusual behaviors are observed, including one individual moving on a skateboard and two individuals running up a staircase toward the end of the clip.',
    metrics: {
      peopleDetected: 13,
      eventsDetected: 6,
      suspiciousEvents: 1,
    },
    tracks: [
      { trackId: 1, label: 'Pedestrian Group' },
      { trackId: 2, label: 'Skateboarder' },
      { trackId: 3, label: 'Runner 1' },
      { trackId: 4, label: 'Runner 2' },
    ],
    events: [
      {
        time: '00:02',
        trackId: null,
        severity: 'normal',
        type: 'Crowd Detected',
        description: 'Multiple pedestrians are detected walking through the campus walkway.',
      },
      {
        time: '00:05',
        trackId: 1,
        severity: 'normal',
        type: 'Normal Walking',
        description: 'Pedestrians continue walking in different directions without abnormal behavior.',
      },
      {
        time: '00:08',
        trackId: 2,
        severity: 'warning',
        type: 'Unusual Movement',
        description: 'One individual is observed moving on a skateboard within the pedestrian walkway.',
      },
      {
        time: '00:14',
        trackId: null,
        severity: 'normal',
        type: 'Continuous Activity',
        description: 'General pedestrian flow continues across the monitored area.',
      },
      {
        time: '00:20',
        trackId: 3,
        severity: 'warning',
        type: 'Running Detected',
        description: 'Two individuals begin running toward a staircase.',
      },
      {
        time: '00:22',
        trackId: 4,
        severity: 'warning',
        type: 'Rapid Stair Movement',
        description: 'The two individuals move quickly up the stairs, deviating from normal walking behavior.',
      },
    ],
    suggestedPrompts: [
      'What happened in this video?',
      'Is there any unusual activity?',
      'How many people are in the scene?',
      'Summarize events by time',
    ],
    chatAnswers: {
      'What happened in this video?':
        'The video shows normal pedestrian activity in a campus walkway. Multiple people are walking, with minor unusual behavior such as one person using a skateboard and two individuals running up a staircase toward the end.',
      'Is there any unusual activity?':
        'Yes. A skateboarder is detected in the pedestrian walkway, and two individuals are observed running up a staircase. These behaviors are flagged as minor deviations from normal activity.',
      'How many people are in the scene?': 'Approximately 13 individuals are visible in the scene.',
      'Summarize events by time':
        '00:02 crowd detected. 00:05 normal walking. 00:08 skateboard movement detected. 00:14 continued activity. 00:20 running detected. 00:22 rapid movement on stairs.',
    },
  },

  // 2) Warning clip: prolonged loitering + smoking near an entrance.
  {
    id: 'loitering_smoking_01',
    title: 'Entrance – Suspicious Loitering & Smoking',
    videoUrl: '/demo-videos/Suspicious_Loitering-2.mp4',
    severity: 'warning',
    summary:
      'A single individual remained near the monitored entrance area for an extended duration while smoking, exhibiting minimal movement and prolonged presence consistent with loitering behavior.',
    metrics: {
      peopleDetected: 1,
      eventsDetected: 5,
      suspiciousEvents: 2,
    },
    tracks: [{ trackId: 1, label: 'Subject 1' }],
    events: [
      {
        time: '00:02',
        trackId: 1,
        severity: 'normal',
        type: 'Person Detected',
        description: 'A single individual is detected standing near the entrance area.',
      },
      {
        time: '00:06',
        trackId: 1,
        severity: 'normal',
        type: 'Standing',
        description: 'Subject remains stationary with minimal movement.',
      },
      {
        time: '00:10',
        trackId: 1,
        severity: 'warning',
        type: 'Smoking Activity',
        description: 'Subject appears to be smoking while remaining in place.',
      },
      {
        time: '00:16',
        trackId: 1,
        severity: 'warning',
        type: 'Stayed Near Entrance',
        description: 'Subject continues to remain near the entrance for an extended duration.',
      },
      {
        time: '00:22',
        trackId: 1,
        severity: 'critical',
        type: 'Suspicious Loitering',
        description: 'Prolonged stationary presence near the entrance triggers a loitering alert.',
      },
    ],
    suggestedPrompts: [
      'What happened in this video?',
      'Is there any suspicious activity?',
      'Why is this behavior flagged?',
      'Summarize events by time',
    ],
    chatAnswers: {
      'What happened in this video?':
        'The video shows a single individual standing near the entrance area while smoking. The subject remained in the same location for an extended period, leading to a loitering alert.',
      'Is there any suspicious activity?':
        'Yes. The system detected suspicious loitering behavior. The subject remained near the entrance for a prolonged duration with minimal movement, which triggered a security alert.',
      'Why is this behavior flagged?':
        'The behavior is flagged because the subject stayed near a sensitive area for an extended period without clear purpose. Combined with stationary behavior and lack of movement, this matches loitering patterns.',
      'Summarize events by time':
        '00:02 person detected. 00:06 standing. 00:10 smoking detected. 00:16 stayed near entrance. 00:22 suspicious loitering triggered.',
    },
  },

  // 3) Critical clip: sudden fire ignition near a subject's pocket area.
  {
    id: 'pocket_fire_01',
    title: 'Outdoor Area – Sudden Fire Incident',
    videoUrl: '/demo-videos/Explosion-3.mp4',
    severity: 'critical',
    summary:
      'Four individuals are standing in an outdoor area when a sudden fire ignition appears from one subject’s pocket area. The incident is classified as a critical safety event requiring immediate attention.',
    metrics: {
      peopleDetected: 4,
      eventsDetected: 5,
      suspiciousEvents: 1,
    },
    tracks: [
      { trackId: 1, label: 'Subject 1' },
      { trackId: 2, label: 'Subject 2' },
      { trackId: 3, label: 'Subject 3' },
      { trackId: 4, label: 'Subject 4' },
    ],
    events: [
      {
        time: '00:01',
        trackId: null,
        severity: 'normal',
        type: 'Group Detected',
        description: 'Four individuals are detected standing in the monitored outdoor area.',
      },
      {
        time: '00:03',
        trackId: null,
        severity: 'normal',
        type: 'Standing Group',
        description: 'The individuals remain stationary with no immediate abnormal movement.',
      },
      {
        time: '00:06',
        trackId: 1,
        severity: 'warning',
        type: 'Sudden Movement',
        description: 'One subject shows sudden movement near the pocket area.',
      },
      {
        time: '00:07',
        trackId: 1,
        severity: 'critical',
        type: 'Fire Ignition Detected',
        description: 'A visible fire ignition appears near Subject 1’s pocket area.',
      },
      {
        time: '00:09',
        trackId: null,
        severity: 'critical',
        type: 'Emergency Safety Alert',
        description: 'The sudden fire incident is classified as a critical safety event requiring immediate response.',
      },
    ],
    suggestedPrompts: [
      'What happened in this video?',
      'Is there any critical event?',
      'Which subject was involved?',
      'Summarize events by time',
    ],
    chatAnswers: {
      'What happened in this video?':
        'The video shows four individuals standing outdoors. Around 00:07, a sudden fire ignition appears near one subject’s pocket area, triggering a critical safety alert.',
      'Is there any critical event?':
        'Yes. A fire ignition was detected near Subject 1’s pocket area around 00:07. The system classifies this as a critical safety event.',
      'Which subject was involved?':
        'Subject 1 appears to be the main involved individual, as the fire ignition occurs near that subject’s pocket area.',
      'Summarize events by time':
        '00:01 group detected. 00:03 group standing. 00:06 sudden movement near pocket area. 00:07 fire ignition detected. 00:09 emergency safety alert triggered.',
    },
  },

  // 4) Critical clip: physical altercation with weapon-based escalation.
  {
    id: 'fight_recording_escalation_01',
    title: 'Public Area – Physical Altercation with Escalation',
    videoUrl: '/demo-videos/Fighting-4.mp4',
    severity: 'critical',
    summary:
      'Five individuals are present in a public area. Two subjects engage in a physical fight while two others record the incident using mobile phones. Near the end, a female subject enters holding a stick and attempts to strike one of the individuals, escalating the situation.',
    metrics: {
      peopleDetected: 5,
      eventsDetected: 7,
      suspiciousEvents: 3,
    },
    tracks: [
      { trackId: 1, label: 'Fighter A' },
      { trackId: 2, label: 'Fighter B' },
      { trackId: 3, label: 'Bystander 1 (Recording)' },
      { trackId: 4, label: 'Bystander 2 (Recording)' },
      { trackId: 5, label: 'Subject with Stick' },
    ],
    events: [
      {
        time: '00:02',
        trackId: null,
        severity: 'normal',
        type: 'Group Detected',
        description: 'Five individuals are present in the monitored area.',
      },
      {
        time: '00:05',
        trackId: 1,
        severity: 'warning',
        type: 'Verbal/Physical Tension',
        description: 'Two individuals appear to engage in close interaction indicating rising tension.',
      },
      {
        time: '00:08',
        trackId: 1,
        severity: 'critical',
        type: 'Physical Altercation',
        description: 'Fighter A and Fighter B engage in a physical fight.',
      },
      {
        time: '00:12',
        trackId: 3,
        severity: 'normal',
        type: 'Recording Activity',
        description: 'Two bystanders hold mobile phones and appear to record the incident.',
      },
      {
        time: '00:18',
        trackId: null,
        severity: 'critical',
        type: 'Ongoing Fight',
        description: 'The physical altercation continues without de-escalation.',
      },
      {
        time: '00:25',
        trackId: 5,
        severity: 'warning',
        type: 'New Subject Entered',
        description: 'A female subject enters the scene carrying a stick.',
      },
      {
        time: '00:28',
        trackId: 5,
        severity: 'critical',
        type: 'Escalation with Weapon',
        description: 'The subject with a stick attempts to strike one of the individuals, escalating the situation to a higher-risk level.',
      },
    ],
    suggestedPrompts: [
      'What happened in this video?',
      'Is there any critical activity?',
      'Who is involved in the fight?',
      'How did the situation escalate?',
      'Summarize events by time',
    ],
    chatAnswers: {
      'What happened in this video?':
        'The video shows a physical fight between two individuals while others record the incident. Toward the end, a new subject enters carrying a stick and attempts to strike one of the individuals, escalating the situation.',
      'Is there any critical activity?':
        'Yes. A physical altercation begins around 00:08 and continues. The situation escalates further at 00:28 when a subject attempts to use a stick as a weapon.',
      'Who is involved in the fight?':
        'Fighter A and Fighter B are directly involved in the physical altercation, while two bystanders record the incident and another subject escalates the situation with a stick.',
      'How did the situation escalate?':
        'The situation escalated when a new subject entered carrying a stick and attempted to strike one of the individuals, increasing the risk level of the incident.',
      'Summarize events by time':
        '00:02 group detected. 00:05 rising tension. 00:08 fight begins. 00:12 bystanders recording. 00:18 ongoing fight. 00:25 new subject enters with stick. 00:28 escalation with weapon.',
    },
  },
];

// -----------------------------------------------------------------------------
// Per-scenario video mapping: project hosts videos under /videos/, not
// /demo-videos/. Raw videoUrl from the JSON is intentionally overridden here so
// the dual-video (raw vs analyzed) demo flow keeps working.
// -----------------------------------------------------------------------------

/** @type {Record<string, { rawVideoUrl: string, analyzedVideoUrl: string }>} */
const SCENARIO_VIDEO_OVERRIDES = {
  walkway_mixed_behavior_01: {
    rawVideoUrl: '/videos/NORMAL_walking-1.mp4',
    analyzedVideoUrl: '/videos/NORMAL_walking-1_result.mp4',
  },
  loitering_smoking_01: {
    rawVideoUrl: '/videos/Suspicious_Loitering-2.mp4',
    analyzedVideoUrl: '/videos/Suspicious_Loitering-2_result.mp4',
  },
  pocket_fire_01: {
    rawVideoUrl: '/videos/Explosion-3.mp4',
    analyzedVideoUrl: '/videos/Explosion-3_result.mp4',
  },
  fight_recording_escalation_01: {
    rawVideoUrl: '/videos/Fighting-4.mp4',
    analyzedVideoUrl: '/videos/Fighting-4_result.mp4',
  },
};

/** @type {DemoScenario[]} */
export const DEMO_SCENARIOS = RAW_SCENARIOS.map((raw) =>
  transformRawScenario(raw, SCENARIO_VIDEO_OVERRIDES[raw.id] || {})
);

/**
 * @param {string} scenarioId
 * @returns {DemoScenario | undefined}
 */
export function getDemoScenarioById(scenarioId) {
  return DEMO_SCENARIOS.find((s) => s.id === scenarioId);
}

/**
 * Build initial chat messages for a scenario (mock).
 * @param {DemoScenario} scenario
 */
export function buildInitialChatMessages(scenario) {
  const title = scenario?.title ?? 'Scenario';
  return [...baseChatIntro(title)];
}

/**
 * Scenario-aware mock assistant replies (frontend-only demo).
 * @param {DemoScenario} scenario
 * @param {string} userText
 * @returns {string}
 */
export function getMockAssistantReply(scenario, userText) {
  const trimmed = String(userText ?? '').trim();
  const normalized = trimmed.toLowerCase();
  const answers = Array.isArray(scenario?.chatAnswers) ? scenario.chatAnswers : [];
  for (const { trigger, reply } of answers) {
    if (trigger && normalized.includes(String(trigger).toLowerCase())) return reply;
  }
  return '**Demo response:** Analysis for this scenario is ready. Ask about timeline, suspicious activity, or dwell behavior to inspect the generated intelligence.';
}

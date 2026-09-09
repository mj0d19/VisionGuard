import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n/useI18n';
import {
  DEMO_SCENARIOS,
  DEMO_ANALYZE_STEP_KEYS,
  buildInitialChatMessages,
  getDemoScenarioById,
  getMockAssistantReply,
} from '../data/mockDemo';
import DemoScenarioList from '../components/demo/DemoScenarioList';
import DemoPlayer from '../components/demo/DemoPlayer';
import DemoSummaryCard from '../components/demo/DemoSummaryCard';
import DemoTimeline from '../components/demo/DemoTimeline';
import DemoChatPanel from '../components/demo/DemoChatPanel';
import { countTimelineEventsUnlocked, parseMmSsToSeconds } from '../utils/demoTime';
import { getStudentsDemoMode, subscribeStudentsDemoMode } from '../lib/studentsDemoMode';

/** Total time the "analyze" overlay stays visible after clicking "Analyze video" */
const ANALYZE_TOTAL_MS = 6000;
// Space step labels across the full duration (first step shows at t=0)
const ANALYZE_STEP_MS = Math.max(200, Math.floor(ANALYZE_TOTAL_MS / DEMO_ANALYZE_STEP_KEYS.length));
const ANALYZE_FINISH_MS = ANALYZE_TOTAL_MS;
/** Same "glass" card shows user image after the step list, then dismisses */
const ANALYZE_COMPLETE_IMAGE_MS = 2000;
/** Seconds after an event's timestamp in the video before its row appears in the timeline */
const TIMELINE_EVENT_REVEAL_LAG_SEC = 2;

let chatIdSeq = 0;
function nextChatId() {
  chatIdSeq += 1;
  return `c-${chatIdSeq}`;
}

export default function Demo() {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState(DEMO_SCENARIOS[0]?.id ?? '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [analyzeStepIndex, setAnalyzeStepIndex] = useState(0);
  const [revealedEventCount, setRevealedEventCount] = useState(0);
  const [chatMessages, setChatMessages] = useState(() => buildInitialChatMessages(DEMO_SCENARIOS[0]));
  const [chatInput, setChatInput] = useState('');
  const [activeTimelineEventId, setActiveTimelineEventId] = useState(null);
  /** Executive summary stays skeleton until analyzed video is watched to the end once */
  const [summaryUnlocked, setSummaryUnlocked] = useState(false);
  const analyzeTimersRef = useRef([]);
  const analyzeCompleteImageTimerRef = useRef(null);
  const chatReplyTimerRef = useRef(null);
  const playerRef = useRef(null);
  const [showAnalyzeCompleteImage, setShowAnalyzeCompleteImage] = useState(false);
  const [studentsDemoMode, setStudentsDemoMode] = useState(() => getStudentsDemoMode());

  const scenario = useMemo(() => getDemoScenarioById(selectedId), [selectedId]);

  const analyzeStepLabels = useMemo(() => DEMO_ANALYZE_STEP_KEYS.map((key) => t(key)), [t]);

  const severityLabels = useMemo(
    () => ({
      normal: t('demo.severity.normal'),
      warning: t('demo.severity.warning'),
      critical: t('demo.severity.critical'),
    }),
    [t]
  );

  const metricLabels = useMemo(
    () => ({
      people: t('demo.metrics.people'),
      events: t('demo.metrics.events'),
      suspicious: t('demo.metrics.suspicious'),
    }),
    [t]
  );

  const storedTitleRef = useRef(null);
  useEffect(() => {
    if (storedTitleRef.current === null) {
      storedTitleRef.current = document.title;
    }
    document.title = `${t('demo.title')} — VisionGuard`;
    return () => {
      document.title = storedTitleRef.current ?? document.title;
    };
  }, [t]);

  const clearAnalyzeTimers = useCallback(() => {
    analyzeTimersRef.current.forEach((id) => clearTimeout(id));
    analyzeTimersRef.current = [];
  }, []);

  const clearAnalyzeCompleteImage = useCallback(() => {
    if (analyzeCompleteImageTimerRef.current) {
      clearTimeout(analyzeCompleteImageTimerRef.current);
      analyzeCompleteImageTimerRef.current = null;
    }
    setShowAnalyzeCompleteImage(false);
  }, []);

  const clearChatReplyTimer = useCallback(() => {
    if (chatReplyTimerRef.current) clearTimeout(chatReplyTimerRef.current);
    chatReplyTimerRef.current = null;
  }, []);

  useEffect(() => subscribeStudentsDemoMode(setStudentsDemoMode), []);
  // Drop the completion image immediately if the user turns "students mode" off from Settings
  useEffect(() => {
    if (!studentsDemoMode) queueMicrotask(() => clearAnalyzeCompleteImage());
  }, [studentsDemoMode, clearAnalyzeCompleteImage]);

  // One place to stop timers and return to the pre-analysis UI state.
  const resetAnalysisState = useCallback(() => {
    clearAnalyzeTimers();
    clearAnalyzeCompleteImage();
    clearChatReplyTimer();
    setIsAnalyzing(false);
    setIsAnalyzed(false);
    setAnalyzeStepIndex(0);
    setRevealedEventCount(0);
    setActiveTimelineEventId(null);
    setSummaryUnlocked(false);
  }, [clearAnalyzeCompleteImage, clearAnalyzeTimers, clearChatReplyTimer]);

  useEffect(() => {
    if (!isAnalyzed) queueMicrotask(() => setSummaryUnlocked(false));
  }, [isAnalyzed]);

  useEffect(
    () => () => {
      clearAnalyzeTimers();
      clearAnalyzeCompleteImage();
      clearChatReplyTimer();
    },
    [clearAnalyzeCompleteImage, clearAnalyzeTimers, clearChatReplyTimer]
  );

  useEffect(() => {
    if (!isAnalyzing) return undefined;

    clearAnalyzeTimers();

    DEMO_ANALYZE_STEP_KEYS.forEach((_, i) => {
      if (i === 0) return;
      const tid = setTimeout(() => setAnalyzeStepIndex(i), i * ANALYZE_STEP_MS);
      analyzeTimersRef.current.push(tid);
    });

    const finishId = setTimeout(() => {
      setIsAnalyzing(false);
      setIsAnalyzed(true);
      setAnalyzeStepIndex(DEMO_ANALYZE_STEP_KEYS.length - 1);
      setRevealedEventCount(0);
      setChatMessages((prev) => [
        ...prev,
        {
          id: nextChatId(),
          role: 'assistant',
          content: t('demo.chatAutoInsight'),
        },
      ]);
      clearAnalyzeTimers();
      clearAnalyzeCompleteImage();
      if (studentsDemoMode) {
        setShowAnalyzeCompleteImage(true);
        analyzeCompleteImageTimerRef.current = setTimeout(() => {
          setShowAnalyzeCompleteImage(false);
          analyzeCompleteImageTimerRef.current = null;
        }, ANALYZE_COMPLETE_IMAGE_MS);
      }
    }, ANALYZE_FINISH_MS);
    analyzeTimersRef.current.push(finishId);

    return () => clearAnalyzeTimers();
  }, [isAnalyzing, studentsDemoMode, clearAnalyzeCompleteImage, clearAnalyzeTimers, t]);

  const handlePlaybackReachedEnd = useCallback(() => {
    setSummaryUnlocked(true);
  }, []);

  const handlePlaybackTime = useCallback(
    (t) => {
      if (!isAnalyzed || !scenario) return;
      const next = countTimelineEventsUnlocked(scenario.events, t, TIMELINE_EVENT_REVEAL_LAG_SEC);
      setRevealedEventCount((c) => Math.max(c, next));
    },
    [isAnalyzed, scenario]
  );

  const handleSelectScenario = useCallback((id) => {
    resetAnalysisState();
    setSelectedId(id);
    const next = getDemoScenarioById(id);
    if (next) setChatMessages(buildInitialChatMessages(next));
    setChatInput('');
  }, [resetAnalysisState]);

  const handleAnalyze = useCallback(() => {
    resetAnalysisState();
    if (scenario) setChatMessages(buildInitialChatMessages(scenario));
    clearAnalyzeTimers();
    setAnalyzeStepIndex(0);
    setIsAnalyzing(true);
  }, [clearAnalyzeTimers, resetAnalysisState, scenario]);

  const handleReset = useCallback(() => {
    resetAnalysisState();
    if (scenario) setChatMessages(buildInitialChatMessages(scenario));
    setChatInput('');
  }, [resetAnalysisState, scenario]);

  const appendAssistant = useCallback((content) => {
    setChatMessages((prev) => [...prev, { id: nextChatId(), role: 'assistant', content }]);
  }, []);

  const handleSend = useCallback(() => {
    if (!isAnalyzed || !scenario) return;
    const text = chatInput.trim();
    if (!text) return;
    setChatMessages((prev) => [...prev, { id: nextChatId(), role: 'user', content: text }]);
    setChatInput('');
    const reply = getMockAssistantReply(scenario, text);
    clearChatReplyTimer();
    chatReplyTimerRef.current = setTimeout(() => appendAssistant(reply), 450);
  }, [chatInput, appendAssistant, isAnalyzed, scenario, clearChatReplyTimer]);

  const handlePromptChip = useCallback(
    (promptText) => {
      if (!isAnalyzed || !scenario) return;
      setChatInput(promptText);
      setChatMessages((prev) => [...prev, { id: nextChatId(), role: 'user', content: promptText }]);
      const reply = getMockAssistantReply(scenario, promptText);
      clearChatReplyTimer();
      chatReplyTimerRef.current = setTimeout(() => appendAssistant(reply), 450);
    },
    [appendAssistant, isAnalyzed, scenario, clearChatReplyTimer]
  );

  const handleTimelineEventClick = useCallback(
    (ev) => {
      if (!isAnalyzed) return;
      const timeStr = ev.time ?? ev.timeLabel ?? '';
      const sec = parseMmSsToSeconds(timeStr);
      if (!Number.isFinite(sec)) return;
      const ctrl = playerRef.current;
      ctrl?.seekToSeconds?.(sec);
      ctrl?.play?.();
      setActiveTimelineEventId(ev.id);
    },
    [isAnalyzed]
  );

  if (!scenario) {
    return <div className="text-white p-6">{t('common.loading')}</div>;
  }

  return (
    <div className="demo-page space-y-6 max-w-[1920px] mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">{t('demo.title')}</h1>
          <p className="mt-2 text-sm text-vg-text-muted max-w-3xl leading-relaxed">{t('demo.subtitle')}</p>
        </div>
      </div>

      {/* Top: event timeline (alone, scrollable) | hero player | summary + scenario list */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 lg:gap-6 items-stretch min-h-0">
        <div className="xl:col-span-3 order-2 xl:order-1 flex flex-col h-full min-h-0 max-h-[720px] xl:max-h-none">
          <DemoTimeline
            heading={t('demo.timelineHeading')}
            hint={t('demo.timelineJumpHint')}
            events={scenario.events}
            isReady={isAnalyzed}
            visibleCount={revealedEventCount}
            skeletonLabel={t('demo.awaitingAnalysis')}
            // Static placeholders until analysis (no shimmer while waiting on raw video).
            animateSkeleton={false}
            activeEventId={activeTimelineEventId}
            onEventClick={handleTimelineEventClick}
          />
        </div>

        <div className="xl:col-span-6 order-1 xl:order-2 min-h-0 flex flex-col">
          <DemoPlayer
            ref={playerRef}
            activeScenarioLabel={t('demo.activeScenario')}
            title={scenario.title}
            rawVideoSrc={scenario.rawVideoUrl}
            analyzedVideoSrc={scenario.analyzedVideoUrl}
            isAnalyzing={isAnalyzing}
            isAnalyzed={isAnalyzed}
            analyzeStepLabels={analyzeStepLabels}
            activeAnalyzeStepIndex={Math.min(analyzeStepIndex, DEMO_ANALYZE_STEP_KEYS.length - 1)}
            onAnalyze={handleAnalyze}
            onReset={handleReset}
            onReplay={() => {}}
            analyzeLabel={isAnalyzing ? t('demo.analyzing') : t('demo.analyzeVideo')}
            resetLabel={t('demo.reset')}
            replayLabel={t('demo.replay')}
            completeLabel={t('demo.analysisComplete')}
            noSignalLabel={t('demo.noSignal')}
            videoNotSupportedLabel={t('dashboard.videoNotSupported')}
            onPlaybackTimeUpdate={handlePlaybackTime}
            onPlaybackReachedEnd={handlePlaybackReachedEnd}
            videoStableKey={`${selectedId}-${isAnalyzed}`}
            showAnalyzeCompleteImage={showAnalyzeCompleteImage}
            analyzeCompleteImageAlt={t('demo.analyzeCompleteFlash')}
          />
        </div>

        <div className="xl:col-span-3 order-3 flex flex-col gap-4 min-h-0 max-h-[720px] xl:max-h-none">
          <div className="shrink-0">
            <DemoSummaryCard
              heading={t('demo.summaryHeading')}
              summary={scenario.summary}
              metrics={scenario.metrics}
              metricLabels={metricLabels}
              isReady={isAnalyzed && summaryUnlocked}
              skeletonLabel={
                isAnalyzed && !summaryUnlocked ? t('demo.summaryWatchToEnd') : t('demo.awaitingAnalysis')
              }
              animateSkeleton={false}
            />
          </div>
          <div className="min-h-0 flex-1 flex flex-col">
            <DemoScenarioList
              scenarios={DEMO_SCENARIOS}
              selectedId={selectedId}
              onSelect={handleSelectScenario}
              title={t('demo.scenariosTitle')}
              severityLabels={severityLabels}
            />
          </div>
        </div>
      </div>

      {/* Bottom: full-width investigation chat */}
      <DemoChatPanel
        title={t('demo.chatTitle')}
        subtitle={t('demo.chatSubtitle')}
        messages={chatMessages}
        suggestedPrompts={scenario.suggestedPrompts}
        inputValue={chatInput}
        onInputChange={setChatInput}
        onSend={handleSend}
        onSelectPrompt={handlePromptChip}
        placeholder={t('demo.chatPlaceholder')}
        sendLabel={t('demo.send')}
        userLabel={t('demo.youLabel')}
        assistantLabel={t('demo.assistantLabel')}
        isEnabled={isAnalyzed}
        lockedMessage={t('demo.chatLockedMessage')}
        skeletonLabel={t('demo.awaitingAnalysis')}
        animateSkeleton={false}
      />
    </div>
  );
}

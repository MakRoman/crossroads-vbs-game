import { useEffect, useRef, useState } from 'react'
import { CrossroadsEngine } from '@/game/engine'
import { LEVELS, FINAL_TEXT, type Answer } from '@/game/content'
import { sfx, setSoundEnabled } from '@/game/sound'

type Screen = 'title' | 'intro' | 'play' | 'levelDone' | 'final'
type Feedback =
  | { type: 'grace'; note?: string }
  | { type: 'reveal'; note?: string }
  | { type: 'correct' }
  | null

const SKY_BG: Record<string, string> = {
  day: 'linear-gradient(#7ec8f2,#b8e2f9 55%,#58a447 55%)',
  sunset: 'linear-gradient(#3d3a6e,#d4786a 55%,#478a3e 55%)',
  night: 'linear-gradient(#0d1130,#2c386e 55%,#2a6b3a 55%)',
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-8 w-8 md:h-10 md:w-10 ${filled ? 'text-[#ffd94a]' : 'text-[#3a4058]'}`}
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 1l2.6 6.6L21 9l-5 4.6L17.5 21 12 17.3 6.5 21 8 13.6 3 9l6.4-1.4z" />
    </svg>
  )
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('title')
  const [levelIdx, setLevelIdx] = useState(0)
  const [questionIdx, setQuestionIdx] = useState<number | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [eliminated, setEliminated] = useState<number[]>([])
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [light, setLight] = useState(55)
  const [levelScores, setLevelScores] = useState<number[]>([])
  const [curPoints, setCurPoints] = useState(0)
  const [soundOn, setSoundOn] = useState(true)
  const [tiltOn, setTiltOn] = useState(false)
  const [pauseOpen, setPauseOpen] = useState(false)
  const [noBubble, setNoBubble] = useState(false)
  const [engineKey, setEngineKey] = useState(0)
  const [progress, setProgress] = useState(0)
  const [answeredCount, setAnsweredCount] = useState(0)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<CrossroadsEngine | null>(null)

  const level = LEVELS[levelIdx]
  const tiltSupported = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window

  // ---- engine lifecycle ----
  useEffect(() => {
    if (screen !== 'play' || !canvasRef.current) return
    const engine = new CrossroadsEngine(canvasRef.current, {
      palette: level.palette,
      onCrossroad: (i) => {
        sfx.crossroad()
        setQuestionIdx(i)
        setAttempts(0)
        setEliminated([])
        setFeedback(null)
      },
      onLevelEnd: () => {
        sfx.levelDone()
        setScreen('levelDone')
      },
      onProgress: (p) => setProgress(p),
    })
    engine.setLight(light)
    engine.setTiltEnabled(tiltOn)
    engine.setStepSound(() => sfx.step())
    engineRef.current = engine
    engine.start()
    return () => {
      engine.destroy()
      engineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, levelIdx, engineKey])

  useEffect(() => {
    engineRef.current?.setLight(light)
  }, [light])

  useEffect(() => {
    setSoundEnabled(soundOn)
  }, [soundOn])

  // ---- actions ----
  const startJourney = () => {
    sfx.click()
    setLevelIdx(0)
    setLevelScores([])
    setLight(55)
    setScreen('intro')
  }

  const startLevel = () => {
    sfx.click()
    setCurPoints(0)
    setProgress(0)
    setAnsweredCount(0)
    setEngineKey((k) => k + 1)
    setScreen('play')
  }

  const enableTilt = async () => {
    try {
      const D = window.DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<string>
      }
      if (D?.requestPermission) {
        const r = await D.requestPermission()
        if (r !== 'granted') return
      }
      setTiltOn(true)
      engineRef.current?.setTiltEnabled(true)
      sfx.click()
    } catch {
      /* tilt unavailable */
    }
  }

  const handleAnswer = (a: Answer, idx: number) => {
    if (feedback?.type === 'correct' || feedback?.type === 'reveal') return
    if (eliminated.includes(idx)) return
    if (a.correct) {
      sfx.correct()
      const pts = attempts === 0 ? 2 : 1
      setCurPoints((p) => p + pts)
      setLight((l) => Math.min(100, l + (attempts === 0 ? 10 : 5)))
      setFeedback({ type: 'correct' })
    } else {
      setEliminated((e) => [...e, idx])
      if (attempts === 0) {
        sfx.grace()
        setAttempts(1)
        setLight((l) => Math.max(15, l - 4))
        setFeedback({ type: 'grace', note: a.wrongNote })
      } else {
        sfx.wrong()
        setLight((l) => Math.max(15, l - 6))
        setFeedback({ type: 'reveal', note: a.wrongNote })
      }
    }
  }

  const continueWalk = () => {
    sfx.click()
    engineRef.current?.answerDone()
    engineRef.current?.resume()
    setAnsweredCount((n) => n + 1)
    setQuestionIdx(null)
    setFeedback(null)
  }

  const finishLevel = () => {
    sfx.click()
    setLevelScores((s) => {
      const n = [...s]
      n[levelIdx] = curPoints
      return n
    })
    if (levelIdx + 1 < LEVELS.length) {
      setLevelIdx(levelIdx + 1)
      setScreen('intro')
    } else {
      setScreen('final')
    }
  }

  const starsFor = (pts: number) => (pts >= 5 ? 3 : pts >= 3 ? 2 : 1)
  const totalStars = levelScores.reduce((sum, p) => sum + starsFor(p), 0)

  const quitToTitle = () => {
    sfx.click()
    setPauseOpen(false)
    setQuestionIdx(null)
    setScreen('title')
  }

  const restartLevel = () => {
    sfx.click()
    setPauseOpen(false)
    setQuestionIdx(null)
    setCurPoints(0)
    setProgress(0)
    setAnsweredCount(0)
    setEngineKey((k) => k + 1)
  }

  const question = questionIdx !== null ? level.questions[questionIdx] : null

  // ================= SCREENS =================

  if (screen === 'title') {
    return (
      <div
        className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden p-4"
        style={{
          background: SKY_BG.day,
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        }}
      >
        <img
          src="/logo.png"
          alt="Crossroads — International Bible Church VBS"
          className="pixel-bob w-[min(88vw,440px)] max-h-[44dvh] select-none object-contain"
          draggable={false}
        />
        <div className="pixel-panel mt-6 w-[min(92vw,480px)] p-5 text-center md:p-6">
          <p className="font-pixel text-[10px] leading-relaxed text-[#8fd0f4] md:text-xs">
            ВЫБИРАЙ МУДРО
          </p>
          <p className="font-pixel mt-3 text-sm leading-relaxed text-[#f4f1d8] md:text-base">
            НАЧАТЬ ПУТЬ?
          </p>
          {noBubble && (
            <p className="font-pixel-body mt-3 text-xl leading-snug text-[#ffd94a]">
              Путь всё равно ждёт тебя, путник…
            </p>
          )}
          <div className="mt-5 flex items-stretch justify-center gap-4">
            <button
              onClick={startJourney}
              className="pixel-btn min-h-[52px] flex-1 bg-[#58a447] px-4 py-3 text-sm text-[#10182e] md:text-base"
            >
              ▶ ДА
            </button>
            <button
              onClick={() => {
                sfx.wrong()
                setNoBubble(true)
                window.setTimeout(() => setNoBubble(false), 2200)
              }}
              className="pixel-btn min-h-[52px] flex-1 bg-[#e8e0c8] px-4 py-3 text-sm text-[#10182e] md:text-base"
            >
              НЕТ
            </button>
          </div>
        </div>
        <p className="font-pixel-body mt-5 text-center text-lg leading-snug text-[#10182e]/80 md:text-xl">
          3 уровня · каверзные вопросы · держись узкой тропы
        </p>
      </div>
    )
  }

  if (screen === 'intro') {
    return (
      <div
        className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden p-4"
        style={{
          background: SKY_BG[level.palette],
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        }}
      >
        <div className="pixel-panel w-[min(94vw,560px)] p-5 md:p-7">
          <p className="font-pixel text-[10px] text-[#8fd0f4] md:text-xs">{level.name}</p>
          <h1 className="font-pixel mt-3 text-base leading-relaxed text-[#ffd94a] md:text-xl">
            {level.subtitle}
          </h1>
          <p className="font-pixel-body mt-4 text-xl leading-snug text-[#f4f1d8] md:text-2xl">
            {level.intro}
          </p>
          <div className="mt-4 border-l-4 border-[#ffd94a] pl-3">
            <p className="font-pixel-body text-lg leading-snug text-[#b8e2f9] md:text-xl">
              «{level.introVerse}»
            </p>
            <p className="font-pixel mt-1 text-[9px] text-[#8fa8c0] md:text-[10px]">
              {level.introVerseRef}
            </p>
          </div>
          <p className="font-pixel-body mt-4 text-lg leading-snug text-[#8fa8c0] md:text-xl">
            Управление: наклоняй телефон, тяни пальцем по экрану или жми ← → на клавиатуре. Не
            сходи с тропы!
          </p>
          <div className="mt-5 flex flex-col gap-3">
            {tiltSupported && !tiltOn && (
              <button
                onClick={enableTilt}
                className="pixel-btn min-h-[48px] bg-[#5f7d9c] px-4 py-3 text-[10px] text-[#f4f1d8] md:text-xs"
              >
                ВКЛЮЧИТЬ УПРАВЛЕНИЕ НАКЛОНОМ
              </button>
            )}
            {tiltOn && (
              <p className="font-pixel text-center text-[10px] text-[#58a447]">
                ✓ НАКЛОН ВКЛЮЧЁН
              </p>
            )}
            <button
              onClick={startLevel}
              className="pixel-btn min-h-[56px] bg-[#ffd94a] px-4 py-3 text-sm text-[#10182e] md:text-base"
            >
              ▶ В ПУТЬ
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'levelDone') {
    const stars = starsFor(curPoints)
    return (
      <div
        className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden p-4"
        style={{
          background: SKY_BG[level.palette],
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        }}
      >
        <div className="pixel-panel w-[min(94vw,520px)] p-6 text-center md:p-8">
          <p className="font-pixel text-[10px] text-[#8fd0f4] md:text-xs">УРОВЕНЬ ПРОЙДЕН</p>
          <h1 className="font-pixel mt-3 text-lg leading-relaxed text-[#ffd94a] md:text-2xl">
            {level.subtitle}
          </h1>
          <div className="mt-4 flex justify-center gap-2" aria-label={`${stars} из 3 звёзд`}>
            {[0, 1, 2].map((i) => (
              <Star key={i} filled={i < stars} />
            ))}
          </div>
          <p className="font-pixel-body mt-3 text-xl text-[#f4f1d8] md:text-2xl">
            Очки света: {curPoints} из 6
          </p>
          <div className="mt-4 border-l-4 border-[#ffd94a] pl-3 text-left">
            <p className="font-pixel-body text-lg leading-snug text-[#b8e2f9] md:text-xl">
              «{level.introVerse}»
            </p>
            <p className="font-pixel mt-1 text-[9px] text-[#8fa8c0] md:text-[10px]">
              {level.introVerseRef}
            </p>
          </div>
          <button
            onClick={finishLevel}
            className="pixel-btn mt-6 min-h-[56px] w-full bg-[#ffd94a] px-4 py-3 text-sm text-[#10182e] md:text-base"
          >
            {levelIdx + 1 < LEVELS.length ? '▶ ДАЛЬШЕ' : '▶ К ФИНАЛУ'}
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'final') {
    return (
      <div
        className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden p-4"
        style={{
          background: 'linear-gradient(#0d1130,#1c2452 50%,#2a6b3a 50%)',
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        }}
      >
        <img
          src="/logo.png"
          alt="Crossroads"
          className="w-[min(70vw,300px)] max-h-[30dvh] select-none object-contain"
          draggable={false}
        />
        <div className="pixel-panel mt-5 w-[min(94vw,560px)] p-6 text-center md:p-8">
          <h1 className="font-pixel text-xl leading-relaxed text-[#ffd94a] md:text-3xl">
            {FINAL_TEXT.title}
          </h1>
          <div className="mt-4 flex justify-center gap-2" aria-label={`${totalStars} из 9 звёзд`}>
            {Array.from({ length: 9 }).map((_, i) => (
              <Star key={i} filled={i < totalStars} />
            ))}
          </div>
          <p className="font-pixel-body mt-4 text-xl leading-snug text-[#f4f1d8] md:text-2xl">
            «{FINAL_TEXT.verse}»
          </p>
          <p className="font-pixel mt-2 text-[9px] text-[#8fa8c0] md:text-[10px]">
            {FINAL_TEXT.verseRef}
          </p>
          <p className="font-pixel-body mt-4 text-lg text-[#8fa8c0] md:text-xl">
            {FINAL_TEXT.subtitle}
          </p>
          <button
            onClick={startJourney}
            className="pixel-btn mt-6 min-h-[56px] w-full bg-[#58a447] px-4 py-3 text-sm text-[#10182e] md:text-base"
          >
            ↻ ПРОЙТИ СНОВА
          </button>
        </div>
      </div>
    )
  }

  // ================= PLAY =================
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#10182e]">
      {/* HUD */}
      <div
        className="relative z-20 flex items-center gap-2 bg-[#10182e]/95 px-3 py-2 md:px-4"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
      >
        <div className="min-w-0 flex-1">
          <p className="font-pixel truncate text-[8px] text-[#8fd0f4] md:text-[10px]">
            {level.name} · {level.subtitle}
          </p>
          <div className="mt-1 flex items-center gap-1">
            {level.questions.map((_, i) => (
              <span
                key={i}
                className={`h-2 w-2 md:h-2.5 md:w-2.5 ${
                  i < answeredCount ? 'bg-[#ffd94a]' : 'bg-[#3a4058]'
                }`}
              />
            ))}
            <span className="font-pixel ml-1 text-[8px] text-[#8fa8c0]">⚑</span>
          </div>
        </div>
        {/* light meter */}
        <div className="flex items-center gap-2" aria-label={`Свет: ${light}`}>
          <span className="font-pixel text-[10px] text-[#ffd94a]">☀</span>
          <div className="h-3 w-20 border-2 border-[#e8e0c8] bg-[#10182e] md:w-28">
            <div
              className="h-full bg-[#ffd94a] transition-all duration-300"
              style={{ width: `${light}%` }}
            />
          </div>
        </div>
        <button
          onClick={() => {
            sfx.click()
            engineRef.current?.pause()
            setPauseOpen(true)
          }}
          aria-label="Пауза"
          className="pixel-btn min-h-[44px] min-w-[44px] bg-[#5f7d9c] px-3 py-2 text-xs text-[#f4f1d8]"
        >
          ❚❚
        </button>
      </div>

      {/* game canvas */}
      <div
        className="relative flex-1"
        onContextMenu={(e) => e.preventDefault()}
        role="application"
        aria-label="Игровое поле: держись светлой тропы"
      >
        <canvas ref={canvasRef} className="pixel-canvas block h-full w-full" />
        {/* progress bar */}
        <div className="pointer-events-none absolute bottom-2 left-1/2 z-10 h-2 w-[70%] -translate-x-1/2 border-2 border-[#10182e] bg-[#10182e]/60">
          <div className="h-full bg-[#e8e0c8]" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      {/* question dialog */}
      {question && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-[#0a0e1c]/70 p-3"
          style={{
            paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
            paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Вопрос на перепутье"
        >
          <div className="pixel-panel w-[min(96vw,600px)] p-4 md:p-6">
            <p className="font-pixel text-[9px] text-[#8fd0f4] md:text-[10px]">
              ✦ ПЕРЕПУТЬЕ {questionIdx! + 1} / {level.questions.length}
            </p>
            <p className="font-pixel-body mt-3 text-xl leading-snug text-[#f4f1d8] md:text-2xl">
              {question.situation}
            </p>
            <div className="mt-4 flex flex-col gap-3">
              {question.answers.map((a, i) => {
                const gone = eliminated.includes(i)
                const showCorrect =
                  (feedback?.type === 'correct' || feedback?.type === 'reveal') && a.correct
                return (
                  <button
                    key={i}
                    disabled={gone || feedback?.type === 'correct' || feedback?.type === 'reveal'}
                    onClick={() => handleAnswer(a, i)}
                    className={`pixel-btn min-h-[52px] px-4 py-3 text-left text-[10px] leading-relaxed md:text-xs ${
                      showCorrect
                        ? 'bg-[#58a447] text-[#10182e]'
                        : gone
                          ? 'bg-[#3a4058] text-[#8fa8c0]'
                          : 'bg-[#e8e0c8] text-[#10182e]'
                    }`}
                  >
                    {gone ? '✕ ' : showCorrect ? '✓ ' : `${String.fromCharCode(1040 + i)}. `}
                    <span className="font-pixel-body align-middle text-xl leading-snug md:text-2xl">
                      {a.text}
                    </span>
                  </button>
                )
              })}
            </div>

            {feedback?.type === 'grace' && (
              <div className="mt-4 border-4 border-[#ffd94a] bg-[#ffd94a]/10 p-3">
                <p className="font-pixel text-[9px] text-[#ffd94a] md:text-[10px]">
                  МИЛОСТЬ: ВТОРОЙ ШАНС!
                </p>
                {feedback.note && (
                  <p className="font-pixel-body mt-2 text-lg leading-snug text-[#f4f1d8] md:text-xl">
                    {feedback.note}
                  </p>
                )}
              </div>
            )}

            {(feedback?.type === 'correct' || feedback?.type === 'reveal') && (
              <div className="mt-4 border-4 border-[#58a447] bg-[#58a447]/10 p-3">
                {feedback.type === 'reveal' && feedback.note && (
                  <p className="font-pixel-body text-lg leading-snug text-[#ff9e9e] md:text-xl">
                    {feedback.note}
                  </p>
                )}
                <p className="font-pixel-body mt-1 text-xl leading-snug text-[#b8f0a8] md:text-2xl">
                  {question.explain}
                </p>
                <p className="font-pixel-body mt-2 text-lg leading-snug text-[#b8e2f9] md:text-xl">
                  «{question.verse}»
                </p>
                <p className="font-pixel mt-1 text-[9px] text-[#8fa8c0] md:text-[10px]">
                  {question.verseRef}
                </p>
                <button
                  onClick={continueWalk}
                  className="pixel-btn mt-4 min-h-[52px] w-full bg-[#ffd94a] px-4 py-3 text-xs text-[#10182e] md:text-sm"
                >
                  ▶ ИДТИ ДАЛЬШЕ
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* pause menu */}
      {pauseOpen && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center bg-[#0a0e1c]/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Пауза"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPauseOpen(false)
              engineRef.current?.resume()
            }
          }}
        >
          <div className="pixel-panel w-[min(92vw,380px)] p-5">
            <p className="font-pixel text-center text-sm text-[#ffd94a]">ПАУЗА</p>
            <div className="mt-5 flex flex-col gap-3">
              <button
                onClick={() => {
                  sfx.click()
                  setPauseOpen(false)
                  engineRef.current?.resume()
                }}
                className="pixel-btn min-h-[52px] bg-[#58a447] px-4 py-3 text-xs text-[#10182e]"
              >
                ▶ ПРОДОЛЖИТЬ
              </button>
              <button
                onClick={() => {
                  setSoundOn(!soundOn)
                  sfx.click()
                }}
                className="pixel-btn min-h-[52px] bg-[#5f7d9c] px-4 py-3 text-xs text-[#f4f1d8]"
              >
                ЗВУК: {soundOn ? 'ВКЛ' : 'ВЫКЛ'}
              </button>
              {tiltSupported && (
                <button
                  onClick={enableTilt}
                  className="pixel-btn min-h-[52px] bg-[#5f7d9c] px-4 py-3 text-xs text-[#f4f1d8]"
                >
                  НАКЛОН: {tiltOn ? 'ВКЛ' : 'ВКЛЮЧИТЬ'}
                </button>
              )}
              <button
                onClick={restartLevel}
                className="pixel-btn min-h-[52px] bg-[#e8e0c8] px-4 py-3 text-xs text-[#10182e]"
              >
                ↻ УРОВЕНЬ ЗАНОВО
              </button>
              <button
                onClick={quitToTitle}
                className="pixel-btn min-h-[52px] bg-[#c04040] px-4 py-3 text-xs text-[#f4f1d8]"
              >
                ✕ В НАЧАЛО
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

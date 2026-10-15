import { ArrowRight, BellRing, Gauge, Inbox, PenLine, type LucideIcon } from 'lucide-react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';
import { Logo } from '../components/Layout';
import { Score } from '../components/ui';

const STEPS: Array<{ icon: LucideIcon; label: string; body: string }> = [
  { icon: Inbox, label: 'Collect', body: 'Job alerts, Jooble listings, and company career pages, pulled together every morning.' },
  { icon: Gauge, label: 'Score', body: 'A free AI model rates the fit from 0 to 100, with the reasons why.' },
  { icon: PenLine, label: 'Draft', body: 'A cover note and an outreach message, ready to edit.' },
  { icon: BellRing, label: 'Remind', body: 'Applications gone quiet for 6 days move to Follow-up due.' },
];

const EASE = [0.16, 1, 0.3, 1] as const;
const rise: Variants = { hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } };

export function Welcome({ onGetStarted }: { onGetStarted: () => void }) {
  const reduce = useReducedMotion();

  return (
    <div className="welcome">
      <header className="welcome-top">
        <div className="brand">
          <Logo />
          <span className="brand-name">Unslog</span>
        </div>
      </header>

      <section className="welcome-hero">
        <motion.div
          className="welcome-hero-copy"
          initial={reduce ? false : 'hidden'}
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        >
          <motion.h1 className="welcome-h1" variants={rise} transition={{ duration: 0.5, ease: EASE }}>
            Your job hunt, run
            <br />
            before you've had coffee.
          </motion.h1>
          <motion.p className="welcome-sub" variants={rise} transition={{ duration: 0.5, ease: EASE }}>
            Unslog reads your job alerts, scores the fit, and drafts the note. You review and hit send.
          </motion.p>
          <motion.div variants={rise} transition={{ duration: 0.5, ease: EASE }}>
            <button type="button" className="btn btn-primary btn-hero" onClick={onGetStarted}>
              Get started
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </motion.div>
        </motion.div>

        <div className="welcome-field" aria-hidden="true">
          <FloatCard className="welcome-card welcome-card-match" delay={0.35} reduce={!!reduce}>
            <Score value={82} />
            <div>
              <strong>Senior Backend Developer</strong>
              <span className="muted small">Dubai</span>
            </div>
          </FloatCard>
          <FloatCard className="welcome-card welcome-card-draft" delay={0.5} reduce={!!reduce}>
            <PenLine size={18} aria-hidden="true" />
            <div>
              <strong>Cover note ready</strong>
              <span className="muted small">Backend developer with 4 years in Node.js, ready to send.</span>
            </div>
          </FloatCard>
          <FloatCard className="welcome-card welcome-card-followup" delay={0.65} reduce={!!reduce}>
            <BellRing size={18} aria-hidden="true" />
            <div>
              <strong>Follow-up due</strong>
              <span className="muted small">Senior Backend Developer, in 6 days</span>
            </div>
          </FloatCard>
        </div>
      </section>

      <section className="welcome-steps">
        <motion.h2
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          What happens before 8am
        </motion.h2>
        <div className="welcome-steps-grid">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.label}
              className="welcome-step"
              initial={reduce ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.45, delay: i * 0.08, ease: EASE }}
            >
              <s.icon size={20} aria-hidden="true" />
              <h3>{s.label}</h3>
              <p className="small muted">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <motion.section
        className="welcome-closing"
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <h2>Ready when you are.</h2>
        <p className="muted">Free. Bring your own Gemini or Groq key, or skip AI and use the built-in heuristic.</p>
        <button type="button" className="btn btn-primary btn-hero" onClick={onGetStarted}>
          Get started
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </motion.section>
    </div>
  );
}

function FloatCard({ className, delay, reduce, children }: { className: string; delay: number; reduce: boolean; children: ReactNode }) {
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, scale: 0.92, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

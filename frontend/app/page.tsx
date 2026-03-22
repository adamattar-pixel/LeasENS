'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

const FLOORS = [
  {
    tag: 'The Platform',
    title: 'ENS Lease Pay',
    desc: 'On-chain rental payments secured by ENS subnames. Every lease is cryptographically verifiable. Every fake payment link is blocked before a single USDC moves.',
    pills: ['Ethereum Sepolia', 'ENS Subnames', 'Privy Wallets', 'MockUSDC'],
    cta: null,
    extra: null,
  },
  {
    tag: 'The Problem',
    title: 'Fake QR codes steal from tenants',
    desc: 'Every month, scammers send identical-looking payment QR codes. Without on-chain verification, there is no way to tell real from fake — until money is gone.',
    pills: ['No Trust Required', 'Cryptographic Proof', 'Anti-Scam Guard', 'Zero False Positives'],
    cta: null,
    extra: null,
  },
  {
    tag: 'The Guarantee',
    title: 'The subname is the lease',
    desc: 'Fake link → ENS name doesn\'t exist → "Invalid payment link". Real link → subname resolves → lease terms verified on-chain. The guarantee is cryptographic.',
    pills: ['subnameExists()', 'ENS Text Records', 'lease.status', 'persona.verified'],
    cta: null,
    extra: null,
  },
  {
    tag: 'Property Managers',
    title: 'Three-tier ENS hierarchy',
    desc: 'Own the root ENS name. Register owner subnames. Lease subnames are minted automatically — all terms stored as ENS text records visible to any ENS-aware app.',
    pills: ['residence-epfl.eth', 'dupont.residence-epfl.eth', 'apt1.dupont.…', 'registerOwner()'],
    cta: { label: 'PM Setup', href: '/onboard/add-owner', variant: 'ghost' as const },
    extra: null,
  },
  {
    tag: 'Floor 1 · Owners',
    title: 'Your lease dashboard',
    desc: 'Create leases, track payment history, set late penalties. Terminating a lease deletes the ENS subname — verifiable proof the contract is over, forever.',
    pills: ['createLease()', 'Payment History', 'Late Penalty bps', 'terminateLease()'],
    cta: { label: 'Login as Owner', href: '/owner/dashboard', variant: 'blue' as const },
    extra: null,
  },
  {
    tag: 'Ground Floor · Tenants',
    title: 'Pay rent in one click',
    desc: 'Email login via Privy — no seed phrase needed. Scan or click your payment link. Amount and terms verified on-chain. Your KYC identity badge travels with your ENS name.',
    pills: ['Email Login', 'Embedded Wallet', 'KYC Badge', 'MockUSDC'],
    cta: { label: 'Login as Tenant', href: '/onboarding', variant: 'teal' as const },
    extra: { label: 'Verify an ENS Lease →', href: '/verify' },
  },
];

const FLOOR_LABELS = ['5', '4', '3', '2', '1', 'G'];

const IMG_URL =
  'https://images.unsplash.com/photo-1542144950-b68de6e03b57?auto=format&fit=crop&w=2880&q=90';

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const carRef = useRef<HTMLDivElement>(null);
  const labRef = useRef<HTMLDivElement>(null);
  const tickRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const currentSectionRef = useRef(0);
  const tickingRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img) return;

    const SHAFT_H = 160 - 16; // shaft height 160px minus car height 16px

    function sizeImage() {
      if (!img || !img.naturalWidth) return;
      const ratio = img.naturalHeight / img.naturalWidth;
      const w = Math.max(window.innerWidth, 700);
      img.style.width = w + 'px';
      img.style.height = Math.round(w * ratio) + 'px';
    }

    function update() {
      if (!container || !img) return;
      const sy = container.scrollTop;
      const vh = container.clientHeight;
      const maxScroll = container.scrollHeight - vh;
      const progress = maxScroll > 0 ? Math.min(1, Math.max(0, sy / maxScroll)) : 0;

      const imgH = img.offsetHeight;
      const shift = -(imgH - vh) * progress;
      img.style.transform = `translateX(-50%) translateY(${shift}px)`;

      if (carRef.current) {
        carRef.current.style.top = Math.round(progress * SHAFT_H) + 'px';
      }

      let activeIdx = 0;
      for (let i = 0; i < sectionRefs.current.length; i++) {
        const sec = sectionRefs.current[i];
        if (!sec) continue;
        const rect = sec.getBoundingClientRect();
        if (rect.top < vh * 0.55 && rect.bottom > vh * 0.4) activeIdx = i;
      }
      currentSectionRef.current = activeIdx;

      if (labRef.current) labRef.current.textContent = FLOOR_LABELS[activeIdx];

      tickRefs.current.forEach((tk, i) => {
        if (tk) tk.className = 'elev-tick' + (i === activeIdx ? ' tk-on' : '');
      });

      cardRefs.current.forEach((card, i) => {
        const sec = sectionRefs.current[i];
        if (!card || !sec) return;
        const r = sec.getBoundingClientRect();
        const visible = r.top < vh * 0.72 && r.bottom > vh * 0.28;
        card.className = 'scroll-card' + (visible ? ' card-vis' : '');
      });

      tickingRef.current = false;
    }

    function onScroll() {
      if (!tickingRef.current) {
        tickingRef.current = true;
        requestAnimationFrame(update);
      }
    }

    img.onload = () => { sizeImage(); update(); };
    if (img.complete && img.naturalWidth) { sizeImage(); update(); }

    container.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => { sizeImage(); update(); });

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        const next = Math.min(currentSectionRef.current + 1, FLOORS.length - 1);
        const target = sectionRefs.current[next];
        if (target) container.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const prev = Math.max(currentSectionRef.current - 1, 0);
        const target = sectionRefs.current[prev];
        if (target) container.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
      }
    };
    document.addEventListener('keydown', handleKey);

    return () => {
      container.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', () => { sizeImage(); update(); });
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="scroll-root"
    >
      {/* Parallax building image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={IMG_URL}
        alt=""
        className="building-img"
      />

      {/* Subtle dark gradient overlay for readability */}
      <div className="building-overlay" />

      {/* Fixed brand logo — top left */}
      <div className="brand-logo">
        <span className="brand-leas">Leas</span><span className="brand-ens">ENS</span>
      </div>

      {/* Elevator navigator */}
      <nav className="elev-nav">
        <div ref={labRef} className="elev-num">5</div>
        <div className="elev-sub">FLOOR</div>
        <div className="elev-shaft">
          <div ref={carRef} className="elev-car" />
          <div className="elev-ticks">
            {FLOOR_LABELS.map((label, i) => (
              <span
                key={label}
                ref={el => { tickRefs.current[i] = el; }}
                className={'elev-tick' + (i === 0 ? ' tk-on' : '')}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </nav>

      {/* Scroll hint */}
      <div className="scroll-hint">
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path d="M7 2v10M3.5 8.5L7 12l3.5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Scroll ou ↑↓
      </div>

      {/* Sections */}
      {FLOORS.map((floor, i) => (
        <section
          key={i}
          ref={el => { sectionRefs.current[i] = el; }}
          className="scroll-section"
        >
          <div className="scroll-section-inner">
          <div
            ref={el => { cardRefs.current[i] = el; }}
            className="scroll-card"
          >
            <span className="scroll-tag">{floor.tag}</span>
            <h2 className="scroll-h2">{floor.title}</h2>
            <p className="scroll-p">{floor.desc}</p>

            <div className="scroll-pills">
              {floor.pills.map(pill => (
                <span key={pill} className="scroll-pill">{pill}</span>
              ))}
            </div>

            {floor.cta && (
              <div style={{ marginTop: 22 }}>
                <Link href={floor.cta.href} className={`scroll-cta scroll-cta-${floor.cta.variant}`}>
                  {floor.cta.label}
                </Link>
              </div>
            )}

            {floor.extra && (
              <div style={{ marginTop: 12, textAlign: 'center' }}>
                <Link href={floor.extra.href} className="scroll-verify-link">
                  {floor.extra.label}
                </Link>
              </div>
            )}
          </div>
          </div>
        </section>
      ))}
    </div>
  );
}

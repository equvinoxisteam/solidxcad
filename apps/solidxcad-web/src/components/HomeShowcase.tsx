import Image from 'next/image';
import { BRAND_NAME } from '@/lib/brand';

const SHOWCASE_TAGS = ['Parametric STEP', 'Browser viewer', 'AI agent', 'STL & G-code'];

export function HomeShowcase() {
  return (
    <section className="landing-showcase" aria-labelledby="landing-showcase-title">
      <div className="landing-showcase-inner">
        <p className="landing-showcase-badge">
          IN-BROWSER WORKBENCH · {BRAND_NAME.toUpperCase()}
        </p>

        <h2 id="landing-showcase-title" className="landing-showcase-title">
          Design, inspect, and export from one workspace
        </h2>
        <p className="landing-showcase-hint">
          Describe a part in chat, preview geometry in the CAD workbench, and download manufacturing files.
        </p>

        <figure className="landing-showcase-frame">
          <Image
            src="/image.png"
            alt={`${BRAND_NAME} studio with a parametric gear model in the browser workbench`}
            width={1600}
            height={900}
            className="landing-showcase-shot"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1100px"
            priority
          />
        </figure>

        <div className="landing-showcase-tags">
          {SHOWCASE_TAGS.map((tag) => (
            <span key={tag} className="landing-showcase-tag">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';
import { HOME_SHOWCASE_MODELS } from '@/lib/homeShowcase';

export function HomeShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const model = HOME_SHOWCASE_MODELS[activeIndex];
  const count = HOME_SHOWCASE_MODELS.length;

  function goPrev() {
    setActiveIndex((i) => (i - 1 + count) % count);
  }

  function goNext() {
    setActiveIndex((i) => (i + 1) % count);
  }

  return (
    <section className="landing-showcase" aria-labelledby="landing-showcase-title">
      <div className="landing-showcase-inner">
        <p className="landing-showcase-badge">
          REAL MODELS — GENERATED IN {BRAND_NAME.toUpperCase()}
        </p>

        <h2 id="landing-showcase-title" className="landing-showcase-title">
          Professional-Grade Output
        </h2>
        <p className="landing-showcase-hint">Drag to rotate · Scroll to zoom</p>

        <div className="landing-showcase-viewer">
          <button
            type="button"
            className="landing-showcase-nav landing-showcase-nav-prev"
            onClick={goPrev}
            aria-label="Previous model"
          >
            <ChevronLeft aria-hidden />
          </button>

          <div className="landing-showcase-stage">
            {model.imageSrc ? (
              <Image
                src={model.imageSrc}
                alt={model.name}
                fill
                className="landing-showcase-image"
                sizes="(max-width: 768px) 100vw, 900px"
                priority={activeIndex === 0}
              />
            ) : (
              <div className="landing-showcase-placeholder" aria-hidden />
            )}

            <div className="landing-showcase-label">
              <p className="landing-showcase-label-name">{model.name}</p>
              <p className="landing-showcase-label-category">{model.category}</p>
            </div>

            <span className="landing-showcase-ai-badge">{BRAND_NAME} AI</span>

            <div className="landing-showcase-tools">
              <button type="button" className="landing-showcase-tool" aria-label="Reset view">
                <RotateCcw aria-hidden />
              </button>
              <button type="button" className="landing-showcase-tool landing-showcase-tool-ar" aria-label="AR preview">
                AR
              </button>
            </div>
          </div>

          <button
            type="button"
            className="landing-showcase-nav landing-showcase-nav-next"
            onClick={goNext}
            aria-label="Next model"
          >
            <ChevronRight aria-hidden />
          </button>
        </div>

        <div className="landing-showcase-dots" role="tablist" aria-label="Showcase models">
          {HOME_SHOWCASE_MODELS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              aria-label={item.name}
              className={`landing-showcase-dot${index === activeIndex ? ' is-active' : ''}`}
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>

        <div className="landing-showcase-tabs" role="tablist" aria-label="Select showcase model">
          {HOME_SHOWCASE_MODELS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              className={`landing-showcase-tab${index === activeIndex ? ' is-active' : ''}`}
              onClick={() => setActiveIndex(index)}
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

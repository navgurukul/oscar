import { memo, useEffect, useState } from "react";
import { SparklesCore } from "@/components/ui/sparkles";
import { Cover } from "@/components/ui/cover";

const MemoizedSparkles = memo(() => (
  <div className="sparkles-container">
    <SparklesCore
      background="transparent"
      minSize={0.4}
      maxSize={1}
      particleDensity={100}
      className="h-full w-full"
      particleColor="#FFFFFF"
    />
  </div>
));

export function CoverShowcase() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const totalSlides = 3;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((previous) => (previous + 1) % totalSlides);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="cover-showcase">
      <MemoizedSparkles />

      <div className={`cover-slide ${currentSlide === 0 ? "active" : ""}`}>
        <div className="cover-content">
          <p className="cover-subtitle">Using OSCAR</p>
          <h2 className="cover-title">4x faster than typing</h2>
          <div className="cover-highlight">
            <span className="cover-speed">220 wpm</span>
          </div>
          <div className="cover-demo-text">
            <p>
              "Just started with the project, how would you like to set up the
              file? Here are a few options..."
            </p>
          </div>
          <div className="cover-waveform">
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
          </div>
        </div>
      </div>

      <div className={`cover-slide ${currentSlide === 1 ? "active" : ""}`}>
        <div className="cover-content">
          <p className="cover-subtitle">Experience the future</p>
          <h2 className="cover-title warp-title">
            Write at <Cover>warp speed</Cover>
          </h2>
          <div className="cover-highlight">
            <span className="cover-speed">AI-powered</span>
          </div>
          <div className="cover-demo-text">
            <p>
              Transform your thoughts into text instantly. Just speak naturally
              and let OSCAR do the rest.
            </p>
          </div>
          <div className="cover-waveform">
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
          </div>
        </div>
      </div>

      <div className={`cover-slide ${currentSlide === 2 ? "active" : ""}`}>
        <div className="cover-content">
          <p className="cover-subtitle">Works everywhere</p>
          <h2 className="cover-title">Use in any app</h2>
          <div className="cover-highlight">
            <span className="cover-speed">Global shortcut</span>
          </div>
          <div className="cover-demo-text">
            <p>
              Hold <kbd>Ctrl</kbd>+<kbd>Space</kbd> to start dictating. Works in
              Slack, Notion, VS Code, and everywhere else.
            </p>
          </div>
          <div className="cover-waveform">
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
          </div>
        </div>
      </div>

      <div className="slide-indicators">
        {Array.from({ length: totalSlides }).map((_, index) => (
          <button
            key={index}
            type="button"
            className={`slide-dot ${currentSlide === index ? "active" : ""}`}
            onClick={() => setCurrentSlide(index)}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

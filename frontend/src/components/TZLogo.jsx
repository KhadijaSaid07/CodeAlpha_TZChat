/**
 * Minimalist TZ monogram logo with signature gradient, crisp border, and hover effect.
 */
export default function TZLogo({ size = 36, showText = false, subtitle = "", lightText = false }) {
  const fontSize = Math.round(size * 0.44);
  const radius = Math.round(size * 0.3);

  return (
    <span className="tz-logo-wrap">
      <span
        aria-hidden="true"
        className="tz-logo-badge"
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          fontSize: `${fontSize}px`,
        }}
      >
        TZ
      </span>
      {showText && (
        <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
          <span
            style={{
              fontWeight: 800,
              fontSize: size >= 40 ? "1.35rem" : "1.15rem",
              letterSpacing: "-0.03em",
              color: lightText ? "#ffffff" : "var(--text)",
            }}
          >
            TZ<span style={{ color: lightText ? "#f0abfc" : "var(--primary)" }}>Chat</span>
          </span>
          {subtitle && (
            <span
              style={{
                fontSize: "0.7rem",
                color: lightText ? "rgba(255,255,255,0.75)" : "var(--muted)",
                fontWeight: 600,
              }}
            >
              {subtitle}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

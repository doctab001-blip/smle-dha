// Server-renderable SVG radar chart: your accuracy vs. the average of all users.
export default function Radar({ axes, mine, cohort }) {
  const size = 340;
  const c = size / 2;
  const r = 118;
  const n = axes.length;
  const angle = (i) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const pt = (i, v) => {
    const a = angle(i);
    const rr = (Math.max(0, Math.min(100, v ?? 0)) / 100) * r;
    return [c + rr * Math.cos(a), c + rr * Math.sin(a)];
  };
  const poly = (vals) => vals.map((v, i) => pt(i, v).join(',')).join(' ');
  const rings = [25, 50, 75, 100];

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: 400, display: 'block', margin: '0 auto' }} role="img"
      aria-label="Radar chart of accuracy by subject">
      {rings.map((ring) => (
        <polygon key={ring} points={poly(axes.map(() => ring))} fill="none" stroke="#e2e6ec" strokeWidth="1" />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, 100);
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="#e2e6ec" />;
      })}
      {rings.map((ring) => (
        <text key={ring} x={c + 3} y={c - (ring / 100) * r - 2} fontSize="9" fill="#9aa3b0">{ring}%</text>
      ))}
      {cohort && (
        <polygon points={poly(cohort)} fill="rgba(123,133,149,0.12)" stroke="#9aa3b0" strokeWidth="1.5" strokeDasharray="4 3" />
      )}
      <polygon points={poly(mine)} fill="rgba(13,148,136,0.22)" stroke="#0d9488" strokeWidth="2" />
      {mine.map((v, i) => {
        const [x, y] = pt(i, v);
        return <circle key={i} cx={x} cy={y} r="3.5" fill="#0d9488" />;
      })}
      {axes.map((label, i) => {
        const a = angle(i);
        const x = c + (r + 22) * Math.cos(a);
        const y = c + (r + 22) * Math.sin(a);
        const anchor = Math.abs(Math.cos(a)) < 0.2 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
        return (
          <text key={label} x={x} y={y + 4} fontSize="11.5" fontWeight="600" fill="#4a5566" textAnchor={anchor}>
            {label}
          </text>
        );
      })}
    </svg>
  );
}

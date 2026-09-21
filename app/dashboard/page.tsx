import { MODULES } from '@/lib/modules';

export default function DashboardPage() {
  return (
    <main>
      <h1>Trendulon Desk</h1>
      <p className="sub">Self-improving newsroom OS. Module status:</p>
      <ul className="grid">
        {MODULES.map((m) => (
          <li key={m.number} className="card" data-testid={`module-${m.number}`}>
            <span>
              <span className="num">{m.number}</span>
              {m.name}
            </span>
            <span className={m.built ? 'badge built' : 'badge'}>{m.built ? 'Built' : 'Not Built'}</span>
          </li>
        ))}
      </ul>
      <div className="empty">Not yet available</div>
    </main>
  );
}

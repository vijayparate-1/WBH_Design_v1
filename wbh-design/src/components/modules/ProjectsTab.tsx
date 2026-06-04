'use client';
// src/components/modules/ProjectsTab.tsx

import { useState, useEffect } from 'react';

interface LibraryProject {
  id: number;
  libId: string;
  name: string;
  location?: string;
  docNo?: string;
  date?: string;
  sector?: string;
  isValidated: boolean;
  description?: string;
  kpis?: string[];
  params?: Record<string, unknown>;
}

interface Props {
  onLoad?: (state: Record<string, unknown>) => void;
}

export default function ProjectsTab({ onLoad }: Props) {
  const [libraryProjects, setLibraryProjects] = useState<LibraryProject[]>([]);
  const [userProjects, setUserProjects] = useState<{ id:number; jobNo:string; tagNo?:string; service?:string; location?:string; status?:string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<'library'|'saved'>('library');
  const [filter, setFilter] = useState('');
  const [dbStatus, setDbStatus] = useState<'unknown'|'ok'|'error'>('unknown');

  useEffect(() => {
    loadLibrary();
    loadUserProjects();
  }, []);

  const loadLibrary = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/library');
      const data = await res.json();
      if (data.success) {
        setLibraryProjects(data.projects);
        setDbStatus('ok');
      } else {
        setDbStatus('error');
      }
    } catch {
      setDbStatus('error');
    }
    setLoading(false);
  };

  const loadUserProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.success) setUserProjects(data.projects);
    } catch {}
  };

  const filteredLib = libraryProjects.filter(p =>
    !filter || p.name.toLowerCase().includes(filter.toLowerCase()) ||
    (p.location ?? '').toLowerCase().includes(filter.toLowerCase()) ||
    (p.docNo ?? '').toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div>
      <div className="section-title">Projects & Reference Library</div>

      {/* DB Status */}
      <div className={`alert ${dbStatus === 'ok' ? 'alert-ok' : dbStatus === 'error' ? 'alert-warn' : 'alert-info'}`}
        style={{ marginBottom:12 }}>
        {dbStatus === 'ok'
          ? `✔ Neon DB connected — ${libraryProjects.length} library projects loaded`
          : dbStatus === 'error'
          ? '⚠ Database not connected. Set DATABASE_URL in .env.local to enable project persistence.'
          : 'ℹ Connecting to database…'}
      </div>

      {/* Section tabs */}
      <div style={{ display:'flex', gap:0, marginBottom:16, background:'var(--panel)',
        border:'1px solid var(--border)', borderRadius:6, overflow:'hidden', width:'fit-content' }}>
        {[{id:'library', label:'📚 Reference Library'},{id:'saved',label:'💾 My Projects'}].map(s => (
          <button key={s.id}
            style={{
              padding:'8px 18px', border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
              background: activeSection === s.id ? 'var(--accent)' : 'none',
              color: activeSection === s.id ? '#fff' : 'var(--text-dim)',
              borderRight:'1px solid var(--border)',
            }}
            onClick={() => setActiveSection(s.id as 'library'|'saved')}
          >{s.label}</button>
        ))}
      </div>

      {activeSection === 'library' && (
        <div>
          <div style={{ marginBottom:12 }}>
            <input type="text" value={filter} placeholder="Search by name, location, doc no…"
              style={{ width:320 }} onChange={e => setFilter(e.target.value)} />
          </div>

          {loading ? (
            <div style={{ color:'var(--text-dim)', padding:20 }}>Loading library…</div>
          ) : filteredLib.length === 0 ? (
            <div className="alert alert-info">
              No library projects found. Run <code>npm run db:seed</code> to populate the reference library with 6 validated historical projects.
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(360px,1fr))', gap:12 }}>
              {filteredLib.map(proj => (
                <div key={proj.id} className="panel" style={{
                  borderColor: proj.isValidated ? 'rgba(14,122,62,0.4)' : 'var(--border)',
                }}>
                  <div className="panel-header" style={{
                    background: proj.isValidated ? 'rgba(14,122,62,0.06)' : 'var(--panel2)',
                    borderColor: proj.isValidated ? 'rgba(14,122,62,0.25)' : 'var(--border)',
                  }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:12, color: proj.isValidated ? 'var(--green)' : 'var(--text)' }}>
                        {proj.isValidated ? '★ ' : ''}{proj.name}
                      </div>
                      <div style={{ fontSize:10, color:'var(--text-dim)', fontFamily:'var(--mono)', marginTop:2 }}>
                        {proj.docNo} · {proj.location} · {proj.date}
                      </div>
                    </div>
                    <div style={{ fontSize:10, padding:'2px 6px', borderRadius:3,
                      background: proj.sector === 'OilGas' ? 'rgba(10,95,168,0.1)' : 'rgba(14,122,62,0.1)',
                      color: proj.sector === 'OilGas' ? 'var(--blue)' : 'var(--green)',
                      border: `1px solid ${proj.sector === 'OilGas' ? 'var(--blue)' : 'var(--green)'}`,
                    }}>
                      {proj.sector}
                    </div>
                  </div>
                  <div className="panel-body" style={{ fontSize:11 }}>
                    {proj.kpis && proj.kpis.length > 0 && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
                        {proj.kpis.map((kpi, i) => (
                          <span key={i} style={{
                            background:'rgba(176,96,0,0.08)', border:'1px solid rgba(176,96,0,0.3)',
                            borderRadius:3, padding:'2px 6px', fontSize:10, color:'var(--accent)',
                            fontFamily:'var(--mono)',
                          }}>{kpi}</span>
                        ))}
                      </div>
                    )}
                    {proj.description && (
                      <div style={{ color:'var(--text-dim)', marginBottom:8, lineHeight:1.5 }}>
                        {proj.description.slice(0, 200)}{proj.description.length > 200 ? '…' : ''}
                      </div>
                    )}
                    <button className="btn btn-secondary btn-sm"
                      onClick={() => onLoad?.({ libraryId: proj.libId, params: proj.params })}>
                      Load Design Parameters →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSection === 'saved' && (
        <div>
          {userProjects.length === 0 ? (
            <div className="alert alert-info">
              No saved projects yet. Complete a calculation and click "Save to DB" in the project header bar.
            </div>
          ) : (
            <table className="res-table">
              <thead>
                <tr>
                  <th>Job No.</th><th>Tag No.</th><th>Service</th><th>Location</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {userProjects.map(p => (
                  <tr key={p.id}>
                    <td className="val">{p.jobNo}</td>
                    <td>{p.tagNo ?? '—'}</td>
                    <td>{p.service ?? '—'}</td>
                    <td>{p.location ?? '—'}</td>
                    <td><span style={{ fontSize:10, padding:'2px 6px', borderRadius:3,
                      background:'rgba(10,95,168,0.1)', color:'var(--blue)' }}>{p.status}</span></td>
                    <td><button className="btn btn-secondary btn-sm">Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
//  SAFE JSON PARSER
// ══════════════════════════════════════════════════════
function safeParseJSON(raw) {
  if (!raw) return null;

  // 1. Strip markdown fences
  let s = raw
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '')
    .replace(/\s*```$/,'').trim();

  // 2. Try straight parse first
  try { return JSON.parse(s); } catch(e) {}

  // 3. Find the outermost { ... } or [ ... ]
  const start = s.search(/[\[{]/);
  if (start > -1) {
    const opener = s[start];
    const closer = opener === '{' ? '}' : ']';
    // Walk from the end to find matching closer
    let depth = 0, end = -1;
    for (let i = start; i < s.length; i++) {
      if (s[i] === opener) depth++;
      else if (s[i] === closer) { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end > -1) s = s.slice(start, end + 1);
  }

  // 4. Fix trailing commas only (safe operation)
  s = s.replace(/,\s*([}\]])/g, '$1');

  // 5. Try again
  try { return JSON.parse(s); } catch(e) {
    console.error('safeParseJSON failed:', e.message, '\nSnippet:', s.slice(0,300));
    return null;
  }
}

/* ═══════════════════════════════════════════════════════
   NETSCOUT Africa · Sales Intelligence
   app.js — All application logic
   ══════════════════════════════════════════════════════ */

// ══════════════════════════════════════════════════════
//  APP STATE  (persisted in localStorage)
// ══════════════════════════════════════════════════════
const DEFAULTS = {
  profile: { name:'Sales Manager', role:'Sales Manager', territory:'North Africa', company:'NETSCOUT' },
  opportunities: [
    { id:1, name:'Maroc Telecom – nGeniusONE',  domain:'Service Providers', region:'Morocco', value:680000, stage:'Proposal Sent',  close:'2025-06', prob:75,  product:'nGeniusONE',      industry:'Service Provider', partner:'',  activityLog:[], revenue:null, capex:null, revenueNote:'', priority:'normal' },
    { id:2, name:'Telecom Egypt – DDoS Arbor',  domain:'Security',          region:'Libya',   value:540000, stage:'Negotiation',    close:'2025-05', prob:85,  product:'Arbor DDoS',       industry:'Service Provider', partner:'' },
    { id:3, name:'Banque Centrale Maroc',        domain:'Enterprise',        region:'Morocco', value:480000, stage:'Qualification',  close:'2025-07', prob:60,  product:'nGeniusONE',       industry:'Enterprise',       partner:'' },
    { id:4, name:'Algérie Télécom – SA Upgrade', domain:'Service Assurance', region:'Morocco', value:420000, stage:'Proposal Sent',  close:'2025-08', prob:50,  product:'Omnis Analytics',  industry:'Service Provider', partner:'' },
    { id:5, name:'Orange Tunisia – nGeniusONE', domain:'Service Providers', region:'Togo',    value:310000, stage:'Qualification',  close:'2025-09', prob:40,  product:'nGeniusONE',      industry:'Service Provider', partner:'' },
    { id:6, name:'Ooredoo Algeria – Security',   domain:'Security',          region:'Mali',    value:290000, stage:'Prospect',       close:'2025-06', prob:30,  product:'Arbor TMS',        industry:'Service Provider', partner:'' },
    { id:7, name:"Cairo Int'l Airport – Ent.",   domain:'Enterprise',        region:'Libya',   value:260000, stage:'Qualification',  close:'2025-10', prob:35,  product:'nGeniusONE Edge',  industry:'Enterprise',       competitor:'Viavi' },
  ],
  regions: [
    { id:1, name:'Morocco',    active:true, color:'#00c8ff' },
    { id:2, name:'Mali',       active:true, color:'#00e5a0' },
    { id:3, name:'Mauritania', active:true, color:'#ffc542' },
    { id:4, name:'Togo',       active:true, color:'#ff6b35' },
    { id:5, name:'Benin',      active:true, color:'#7b2fff' },
    { id:6, name:'Libya',      active:true, color:'#00c8ff' },
  ],
  targets: [
    { domain:'Enterprise',        color:'#00c8ff', target:4700000 },
    { domain:'Service Providers', color:'#00e5a0', target:5000000 },
    { domain:'Security',          color:'#ff6b35', target:4000000 },
    { domain:'Service Assurance', color:'#ffc542', target:3500000 },
  ],
  // Annual target split by region x industry
  // structure: { region: { industry: { domain: amount } } }
  regionTargets: {
    Morocco:    { Enterprise:{ Security:500000, 'Service Assurance':1200000 }, 'Service Provider':{ Security:300000, 'Service Assurance':2000000 } },
    Mali:       { Enterprise:{ Security:200000, 'Service Assurance':500000  }, 'Service Provider':{ Security:100000, 'Service Assurance':800000  } },
    Mauritania: { Enterprise:{ Security:150000, 'Service Assurance':300000  }, 'Service Provider':{ Security:100000, 'Service Assurance':500000  } },
    Togo:       { Enterprise:{ Security:100000, 'Service Assurance':250000  }, 'Service Provider':{ Security:80000,  'Service Assurance':400000  } },
    Benin:      { Enterprise:{ Security:100000, 'Service Assurance':250000  }, 'Service Provider':{ Security:80000,  'Service Assurance':400000  } },
    Libya:      { Enterprise:{ Security:200000, 'Service Assurance':400000  }, 'Service Provider':{ Security:150000, 'Service Assurance':600000  } },
  },
  annualTarget: 8000000,
  meetings: [],
  actions: [],
};

function load(key) {
  try { const v = localStorage.getItem('ns_'+key); return v ? JSON.parse(v) : DEFAULTS[key]; } catch(e){ return DEFAULTS[key]; }
}
function save(key, val) {
  try { localStorage.setItem('ns_'+key, JSON.stringify(val)); } catch(e){}
}

let APP = {
  profile:       load('profile'),
  opportunities: load('opportunities'),
  regions:       load('regions'),
  targets:       load('targets'),
  regionTargets: load('regionTargets') || DEFAULTS.regionTargets,
  annualTarget:  load('annualTarget')  || DEFAULTS.annualTarget,
  strategies:    load('strategies')    || [],
  prospectSessions: load('prospectSessions') || [],
  meetings:      load('meetings'),
  actions:       load('actions'),
};

// ── DOMAIN COLORS ──
const DOMAIN_COLORS = {
  'Enterprise':'#00c8ff','Service Providers':'#00e5a0','Security':'#ff6b35','Service Assurance':'#ffc542'
};

// ══════════════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════════════
const TITLES = {
  'dashboard':'Overview','strategy':'AI Strategy',
  'actions':'Daily Actions','config-opportunities':'Configure · Opportunities',
  'config-regions':'Configure · Regions & Targets','config-profile':'Configure · Profile','sfdc':'Salesforce · Import & Sync','actlog':'Activity Log','stratlib':'Strategy Library','prospects':'Prospect Intelligence','prospects':'Prospect Intelligence'
};

function navigate(page, el) {
  document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const pageEl = document.getElementById('page-'+page);
  if (pageEl) { pageEl.classList.remove('hidden'); pageEl.classList.add('anim'); setTimeout(()=>pageEl.classList.remove('anim'),400); }
  if (el) el.classList.add('active');
  document.getElementById('topbarTitle').textContent = TITLES[page]||page;
  document.getElementById('topbarCrumb').textContent = '';
  if (page==='dashboard') renderDashboard();
  if (page==='config-opportunities') renderOppTable();
  if (page==='config-regions') renderRegionsConfig();
  if (page==='config-profile') loadProfileForm();

  if (page==='strategy') populateStrategyForm();
  if (page==='sfdc') renderSFDCPage();
  if (page==='stratlib') renderStratLib();
  if (page==='prospects') { initProspectPage(); updateProspectHistoryBadge(); }
  if (page==='prospects') { initProspectPage(); updateProspectHistoryBadge(); }
  if (page==='actlog') initActivityLog();
  if (page==='actions') { document.getElementById('actDateLabel2').textContent = new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}); if(APP.actions.length) renderActSidebar(); }
}

// ══════════════════════════════════════════════════════
//  DASHBOARD RENDER
// ══════════════════════════════════════════════════════
function renderDashboard() {
  renderExecHeader();
  renderPipelineHealth(); // calls renderTimelineView internally
  renderIndustryView(); // also calls renderRegionCards + renderPartnerCards
  renderTopOpportunities();
}

function getPipelineByDomain() {
  // Exclude Closed Lost — only count active pipeline
  const res = {};
  APP.opportunities
    .filter(o => o.stage !== 'Closed Lost' && o.value > 0)
    .forEach(o => {
      const domain = o.domain || 'Other';
      res[domain] = (res[domain] || 0) + o.value;
    });
  return res;
}

function getPipelineActive() {
  return APP.opportunities.filter(o => o.stage !== 'Closed Lost');
}

function renderExecHeader() {
  const active      = APP.opportunities.filter(o => o.stage !== 'Closed Lost');
  const lost        = APP.opportunities.filter(o => o.stage === 'Closed Lost');
  const totalPipe   = active.reduce((s,o) => s+(o.value||0), 0);
  const weightedFcst= active.reduce((s,o) => s+(o.value||0)*(o.prob||0)/100, 0);
  const avgProb     = active.length ? active.reduce((s,o)=>s+(o.prob||0),0)/active.length : 0;

  // Pipeline health buckets
  const atRisk    = active.filter(o=>(o.prob||0)<=30);
  const developing= active.filter(o=>(o.prob||0)>30&&(o.prob||0)<=60);
  const strong    = active.filter(o=>(o.prob||0)>60);
  const atRiskVal = atRisk.reduce((s,o)=>s+(o.value||0),0);

  // Stalled = no activity log entry in >30 days (or never logged)
  const stalled    = active.filter(o => getDaysSinceLastActivity(o) > 30);
  const stalledVal = stalled.reduce((s,o)=>s+(o.value||0),0);

  // Priority deals
  const mustWin  = active.filter(o => o.priority === 'must_win');
  const highPrio = active.filter(o => o.priority === 'high');

  // Nearest to close
  const hotDeals    = active.filter(o=>(o.prob||0)>=50).sort((a,b)=>b.prob-a.prob);

  const kpiRow = document.getElementById('kpiRow');
  kpiRow.style.gridTemplateColumns = 'repeat(5,1fr)';
  kpiRow.innerHTML = `

    <!-- Card 1: Total Pipeline -->
    <div class="kpi-card" style="border-top:2px solid var(--accent);grid-row:span 1;cursor:pointer" data-action="drillTotalPipeline">
      <div class="kpi-domain" style="color:var(--accent)">Total Pipeline</div>
      <div class="kpi-value" style="font-size:26px">$${(totalPipe/1e6).toFixed(2)}M</div>
      <div class="kpi-sub">${active.length} active · ${lost.length} lost/closed</div>
      <div style="margin:10px 0 6px;display:flex;gap:6px">
        <div style="flex:1;text-align:center;background:rgba(255,68,68,0.08);border:1px solid rgba(255,68,68,0.15);border-radius:8px;padding:6px 4px">
          <div style="font-size:14px;font-weight:700;color:#ff4444">${atRisk.length}</div>
          <div style="font-size:8px;color:var(--muted)">At Risk</div>
        </div>
        <div style="flex:1;text-align:center;background:rgba(255,197,66,0.08);border:1px solid rgba(255,197,66,0.15);border-radius:8px;padding:6px 4px">
          <div style="font-size:14px;font-weight:700;color:var(--accent4)">${developing.length}</div>
          <div style="font-size:8px;color:var(--muted)">Developing</div>
        </div>
        <div style="flex:1;text-align:center;background:rgba(0,229,160,0.08);border:1px solid rgba(0,229,160,0.15);border-radius:8px;padding:6px 4px">
          <div style="font-size:14px;font-weight:700;color:var(--accent3)">${strong.length}</div>
          <div style="font-size:8px;color:var(--muted)">Strong</div>
        </div>
      </div>
    </div>

    <!-- Card 2: Weighted Forecast -->
    <div class="kpi-card" style="border-top:2px solid var(--accent3);cursor:pointer" data-action="drillForecast">
      <div class="kpi-domain" style="color:var(--accent3)">Weighted Forecast</div>
      <div class="kpi-value" style="font-size:26px">$${(weightedFcst/1e6).toFixed(2)}M</div>
      <div class="kpi-sub">${Math.round(avgProb)}% avg win probability</div>
      <div class="kpi-bar" style="margin:10px 0 4px"><div class="kpi-bar-fill" style="width:${Math.round(avgProb)}%;background:var(--accent3)"></div></div>
      <div class="kpi-footer">
        <span style="color:var(--muted)">Coverage ratio</span>
        <span style="color:${totalPipe>0?'var(--accent3)':'var(--muted)'}">${totalPipe>0?(weightedFcst/totalPipe*100).toFixed(0)+'%':'—'}</span>
      </div>
    </div>

    <!-- Card 3: Stalled Deals -->
    <div class="kpi-card" style="border-top:2px solid ${stalled.length>0?'#ff6b35':'var(--border)'};cursor:pointer" data-action="drillStalled">
      <div class="kpi-domain" style="color:${stalled.length>0?'var(--accent2)':'var(--muted)'}">
        ${stalled.length>0?'⚠ Stalled Deals':'Stalled Deals'}
      </div>
      <div class="kpi-value" style="font-size:26px;color:${stalled.length>0?'var(--accent2)':'var(--muted)'}">
        ${stalled.length}
      </div>
      <div class="kpi-sub">No activity &gt;30 days · $${(stalledVal/1e6).toFixed(1)}M at risk</div>
      <div style="margin-top:10px;display:flex;flex-direction:column;gap:4px">
        ${stalled.slice(0,3).map(o=>`
          <div style="display:flex;justify-content:space-between;font-size:9px;padding:3px 0;border-bottom:1px solid rgba(26,47,74,0.4)">
            <span style="color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px">${(o.account||o.name||'').slice(0,22)}</span>
            <span style="color:var(--accent2);flex-shrink:0">$${((o.value||0)/1000).toFixed(0)}K</span>
          </div>`).join('')}
        ${stalled.length>3?`<div style="font-size:9px;color:var(--muted)">+${stalled.length-3} more stalled</div>`:''}
      </div>
    </div>

    <!-- Card 3b: Must Win -->
    <div class="kpi-card" style="border-top:2px solid #ffd700;cursor:pointer" data-action="drillMustWin">
      <div class="kpi-domain" style="color:#ffd700">⭐ Must Win</div>
      <div class="kpi-value" style="font-size:26px">${mustWin.length}</div>
      <div class="kpi-sub">$${(mustWin.reduce((s,o)=>s+(o.value||0),0)/1e6).toFixed(1)}M · ${highPrio.length} high priority</div>
      <div style="margin-top:10px;display:flex;flex-direction:column;gap:4px">
        ${mustWin.slice(0,3).map(o=>`
          <div style="display:flex;justify-content:space-between;font-size:9px;padding:3px 0;border-bottom:1px solid rgba(26,47,74,0.4)">
            <span style="color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:130px">${(o.account||o.name).slice(0,22)}</span>
            <span style="color:#ffd700;flex-shrink:0">$${((o.value||0)/1000).toFixed(0)}K</span>
          </div>`).join('')}
        ${mustWin.length===0?`<div style="font-size:10px;color:var(--muted);text-align:center;padding:8px 0">No must-win deals flagged yet</div>`:''}
      </div>
    </div>

    <!-- Card 4: Hot Deals / Next to Close -->
    <div class="kpi-card" style="border-top:2px solid var(--accent4);cursor:pointer" data-action="drillHotDeals">
      <div class="kpi-domain" style="color:var(--accent4)">🔥 Hot Deals</div>
      <div class="kpi-value" style="font-size:26px">${hotDeals.length}</div>
      <div class="kpi-sub">Win probability ≥50% · $${(hotDeals.reduce((s,o)=>s+(o.value||0),0)/1e6).toFixed(1)}M</div>
      <div style="margin-top:10px;display:flex;flex-direction:column;gap:4px">
        ${hotDeals.slice(0,3).map(o=>`
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:9px;padding:3px 0;border-bottom:1px solid rgba(26,47,74,0.4)">
            <span style="color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:110px">${(o.account||o.name||'').slice(0,18)}</span>
            <div style="display:flex;gap:5px;align-items:center;flex-shrink:0">
              <span style="color:var(--accent3);font-weight:600">${o.prob}%</span>
              <span style="color:var(--muted)">$${((o.value||0)/1000).toFixed(0)}K</span>
            </div>
          </div>`).join('')}
        ${hotDeals.length===0?`<div style="font-size:10px;color:var(--muted);text-align:center;padding:10px 0">No deals above 50% yet</div>`:''}
      </div>
    </div>`;
}

// ── Pipeline health bar (thin row between KPIs and industry cards) ──
function renderPipelineHealth() {
  const active = APP.opportunities.filter(o => o.stage !== 'Closed Lost' && (o.value||0)>0);
  const total  = active.reduce((s,o)=>s+(o.value||0),0);
  if (!total) return;

  const stages = ['Qualification','Proposal Sent','Negotiation','Closed Won'];
  const STAGE_COLORS = {
    'Qualification':'#00c8ff','Proposal Sent':'#7b2fff',
    'Negotiation':'#ffc542','Closed Won':'#00e5a0',
  };

  const byStage = {};
  active.forEach(o => {
    const s = o.stage||'Other';
    byStage[s] = (byStage[s]||0) + (o.value||0);
  });

  const kpiRow = document.getElementById('kpiRow');
  if (!kpiRow) return;

  // Render timeline FIRST (inserted before health bar)
  renderTimelineView();

  // Insert health bar panel after timeline panel
  let healthBar = document.getElementById('pipelineHealthBar');
  if (!healthBar) {
    healthBar = document.createElement('div');
    healthBar.id = 'pipelineHealthBar';
    healthBar.style.cssText = 'margin-bottom:20px';
    const timelinePanel = document.getElementById('timelinePanel');
    if (timelinePanel) {
      timelinePanel.parentNode.insertBefore(healthBar, timelinePanel.nextSibling);
    } else {
      kpiRow.parentNode.insertBefore(healthBar, kpiRow.nextSibling);
    }
  }

  const segments = [...stages, ...Object.keys(byStage).filter(s=>!stages.includes(s))]
    .filter(s => byStage[s] > 0)
    .map(s => {
      const val = byStage[s]||0;
      const pct = (val/total*100).toFixed(1);
      const color = STAGE_COLORS[s]||'#5a7a99';
      const cnt   = active.filter(o=>o.stage===s).length;
      return { s, val, pct, color, cnt };
    });

  // ── Attainment calculations ──
  const target          = APP.annualTarget || 0;
  const weighted        = active.reduce((s,o)=>s+(o.value||0)*(o.prob||0)/100, 0);
  const coverage        = target > 0 ? total / target : 0;
  const needed          = target > 0 ? Math.max(0, target * 3 - total) : 0;
  const gap             = target > 0 ? Math.max(0, target - weighted) : 0;
  const coveragePct     = Math.min(coverage * 100, 100);
  const coverageColor   = coverage >= 3 ? '#00e5a0' : coverage >= 2 ? '#ffc542' : '#ff6b35';

  // Attainment buckets
  const bookedOpps      = APP.opportunities.filter(o => o.stage === 'Closed Won');
  const bestCaseOpps    = active.filter(o => o.stage === 'Negotiation');
  const commitOpps      = active.filter(o => o.stage === 'Proposal Sent' && (o.prob||0) >= 50);
  const pipelineRestOpps= active.filter(o => !['Closed Won','Negotiation'].includes(o.stage) && !(o.stage==='Proposal Sent'&&(o.prob||0)>=50));

  const booked          = bookedOpps.reduce((s,o)=>s+(o.value||0),0);
  const bestCase        = bestCaseOpps.reduce((s,o)=>s+(o.value||0),0);
  const commit          = commitOpps.reduce((s,o)=>s+(o.value||0),0);
  const pipeline_rest   = pipelineRestOpps.reduce((s,o)=>s+(o.value||0),0);

  healthBar.innerHTML = `
    <div class="panel" style="padding:0;overflow:hidden">

      ${target > 0 ? `
      <!-- ── ATTAINMENT TRACKER ── -->
      <div style="padding:16px 20px;border-bottom:1px solid var(--border)">

        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
          <div>
            <div style="font-family:'Syne',sans-serif;font-size:12px;font-weight:700">FY Attainment Tracker</div>
            <div style="font-size:9px;color:var(--muted);margin-top:2px">Target: $${(target/1e6).toFixed(2)}M · Coverage: <span style="color:${coverageColor};font-weight:600">${coverage.toFixed(1)}x</span></div>
          </div>
          <div style="font-size:9px;color:var(--muted)">
            ${gap > 0
              ? `<span style="color:var(--accent2)">⚠ $${(gap/1e6).toFixed(2)}M gap to target</span>`
              : `<span style="color:var(--accent3)">✓ Forecast exceeds target</span>`}
          </div>
        </div>

        <!-- Stacked attainment bar -->
        <div style="margin-bottom:8px">
          <div style="display:flex;height:32px;border-radius:8px;overflow:hidden;background:var(--border);position:relative">

            <!-- Booked (Closed Won) -->
            ${booked > 0 ? `<div style="width:${Math.min(booked/target*100,100).toFixed(1)}%;background:#00e5a0;display:flex;align-items:center;justify-content:center;transition:width 0.6s ease;min-width:${booked>0?'2px':'0'}">
              ${booked/target>0.07?`<span style="font-size:9px;font-weight:700;color:#000">$${(booked/1e6).toFixed(1)}M</span>`:''}
            </div>` : ''}

            <!-- Best Case (Negotiation) -->
            ${bestCase > 0 ? `<div style="width:${Math.min(bestCase/target*100,100).toFixed(1)}%;background:#ffc542;opacity:0.9;display:flex;align-items:center;justify-content:center;transition:width 0.6s ease;min-width:${bestCase>0?'2px':'0'}">
              ${bestCase/target>0.07?`<span style="font-size:9px;font-weight:700;color:#000">$${(bestCase/1e6).toFixed(1)}M</span>`:''}
            </div>` : ''}

            <!-- Commit (Proposal Sent 50%+) -->
            ${commit > 0 ? `<div style="width:${Math.min(commit/target*100,100).toFixed(1)}%;background:#7b2fff;opacity:0.85;display:flex;align-items:center;justify-content:center;transition:width 0.6s ease;min-width:${commit>0?'2px':'0'}">
              ${commit/target>0.07?`<span style="font-size:9px;font-weight:700;color:#fff">$${(commit/1e6).toFixed(1)}M</span>`:''}
            </div>` : ''}

            <!-- Pipeline (rest) -->
            ${pipeline_rest > 0 ? `<div style="width:${Math.min(pipeline_rest/target*100,100).toFixed(1)}%;background:#00c8ff;opacity:0.4;display:flex;align-items:center;justify-content:center;transition:width 0.6s ease;min-width:${pipeline_rest>0?'2px':'0'}">
              ${pipeline_rest/target>0.1?`<span style="font-size:9px;font-weight:600;color:#fff">$${(pipeline_rest/1e6).toFixed(1)}M</span>`:''}
            </div>` : ''}

            <!-- Target line at 100% -->
            <div style="position:absolute;right:0;top:0;bottom:0;width:2px;background:#ffd700;opacity:0.8"></div>
          </div>

          <!-- % markers -->
          <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:9px;color:var(--muted)">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span style="color:#ffd700;font-weight:600">100% = $${(target/1e6).toFixed(1)}M</span>
          </div>
        </div>

        <!-- Legend + metrics grid -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:10px">
          <div style="background:rgba(0,229,160,0.06);border:1px solid rgba(0,229,160,0.2);border-radius:8px;padding:8px 10px">
            <div style="display:flex;align-items:center;gap:5px;margin-bottom:4px">
              <div style="width:8px;height:8px;border-radius:2px;background:#00e5a0;flex-shrink:0"></div>
              <span style="font-size:8px;text-transform:uppercase;letter-spacing:0.1em;color:var(--muted)">Booked</span>
            </div>
            <div style="font-family:'Syne',sans-serif;font-size:15px;font-weight:800;color:#00e5a0">$${(booked/1e6).toFixed(2)}M</div>
            <div style="font-size:9px;color:var(--muted)">${target>0?(booked/target*100).toFixed(0):0}% of target · ${bookedOpps.length} deals</div>
          </div>

          <div style="background:rgba(255,197,66,0.06);border:1px solid rgba(255,197,66,0.2);border-radius:8px;padding:8px 10px">
            <div style="display:flex;align-items:center;gap:5px;margin-bottom:4px">
              <div style="width:8px;height:8px;border-radius:2px;background:#ffc542;flex-shrink:0"></div>
              <span style="font-size:8px;text-transform:uppercase;letter-spacing:0.1em;color:var(--muted)">Best Case</span>
            </div>
            <div style="font-family:'Syne',sans-serif;font-size:15px;font-weight:800;color:#ffc542">$${(bestCase/1e6).toFixed(2)}M</div>
            <div style="font-size:9px;color:var(--muted)">Negotiation · ${bestCaseOpps.length} deals</div>
          </div>

          <div style="background:rgba(123,47,255,0.06);border:1px solid rgba(123,47,255,0.2);border-radius:8px;padding:8px 10px">
            <div style="display:flex;align-items:center;gap:5px;margin-bottom:4px">
              <div style="width:8px;height:8px;border-radius:2px;background:#7b2fff;flex-shrink:0"></div>
              <span style="font-size:8px;text-transform:uppercase;letter-spacing:0.1em;color:var(--muted)">Commit</span>
            </div>
            <div style="font-family:'Syne',sans-serif;font-size:15px;font-weight:800;color:#a07fff">$${(commit/1e6).toFixed(2)}M</div>
            <div style="font-size:9px;color:var(--muted)">Proposal ≥50% · ${commitOpps.length} deals</div>
          </div>

          <div style="background:rgba(0,200,255,0.06);border:1px solid rgba(0,200,255,0.2);border-radius:8px;padding:8px 10px">
            <div style="display:flex;align-items:center;gap:5px;margin-bottom:4px">
              <div style="width:8px;height:8px;border-radius:2px;background:#00c8ff;opacity:0.6;flex-shrink:0"></div>
              <span style="font-size:8px;text-transform:uppercase;letter-spacing:0.1em;color:var(--muted)">Pipeline</span>
            </div>
            <div style="font-family:'Syne',sans-serif;font-size:15px;font-weight:800;color:var(--accent)">$${(pipeline_rest/1e6).toFixed(2)}M</div>
            <div style="font-size:9px;color:var(--muted)">Early stage · ${pipelineRestOpps.length} deals</div>
          </div>
        </div>

        <!-- Coverage insight -->
        <div style="margin-top:10px;padding:8px 12px;border-radius:8px;font-size:10px;
          background:${coverage>=3?'rgba(0,229,160,0.06)':coverage>=2?'rgba(255,197,66,0.06)':'rgba(255,107,53,0.06)'};
          border:1px solid ${coverage>=3?'rgba(0,229,160,0.2)':coverage>=2?'rgba(255,197,66,0.2)':'rgba(255,107,53,0.2)'};
          color:${coverageColor}">
          ${coverage>=3
            ? `✓ Pipeline coverage ${coverage.toFixed(1)}x — healthy. Focus on converting Negotiation and Proposal deals.`
            : coverage>=2
            ? `⚠ Coverage ${coverage.toFixed(1)}x — getting tight. Add $${(needed/1e6).toFixed(1)}M more pipeline to reach 3x ideal.`
            : `🚨 Coverage only ${coverage.toFixed(1)}x — critical gap. Need $${(needed/1e6).toFixed(1)}M more pipeline · ~${Math.ceil(needed/300000)} new deals at avg $300K.`}
        </div>
      </div>` : ''}

      <!-- ── FUNNEL BAR ── -->
      <div style="padding:14px 20px">
        <div style="font-family:'Syne',sans-serif;font-size:12px;font-weight:700;margin-bottom:12px">Pipeline Funnel</div>

        <!-- Segmented bar -->
        <div style="display:flex;height:28px;border-radius:8px;overflow:hidden;gap:2px">
          ${segments.map(seg=>`
            <div style="flex:${seg.pct};background:${seg.color};min-width:${seg.pct<3?'6px':'0'};cursor:pointer;
              display:flex;align-items:center;justify-content:center;transition:opacity 0.2s;position:relative;overflow:hidden"
              onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'"
              title="${seg.s}: $${(seg.val/1000).toFixed(0)}K · ${seg.cnt} deals"
              data-action="drillStage" data-stage="${seg.s}">
              ${parseFloat(seg.pct)>=8?`<span style="font-size:10px;font-weight:700;color:#000;text-shadow:none;pointer-events:none">${seg.pct}%</span>`:''}
            </div>
          `).join('')}
        </div>

        <!-- Labels below bar -->
        <div style="display:flex;gap:2px;margin-top:2px">
          ${segments.map(seg=>`
            <div style="flex:${seg.pct};min-width:0;min-width:${seg.pct<3?'6px':'0'}">
            </div>
          `).join('')}
        </div>

        <!-- Legend row -->
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
          ${segments.map(seg=>`
            <div style="display:flex;align-items:center;gap:5px;cursor:pointer"
              data-action="drillStage" data-stage="${seg.s}">
              <div style="width:10px;height:10px;border-radius:2px;background:${seg.color};flex-shrink:0"></div>
              <span style="font-size:9px;color:var(--text2)">${seg.s}</span>
              <span style="font-size:9px;font-weight:600;color:${seg.color}">${seg.pct}%</span>
              <span style="font-size:9px;color:var(--muted)">${seg.cnt} · $${(seg.val/1e6).toFixed(1)}M</span>
            </div>`).join('')}
        </div>

        <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:9px;color:var(--muted)">
          <span>Early Stage</span>
          <span style="color:var(--text2);font-weight:600">Total: $${(total/1e6).toFixed(2)}M</span>
          <span>Close</span>
        </div>
      </div>
    </div>`;
}


function getPipelineByDomain() {
  // Exclude Closed Lost — only count active pipeline
  const res = {};
  APP.opportunities
    .filter(o => o.stage !== 'Closed Lost' && o.value > 0)
    .forEach(o => {
      const domain = o.domain || 'Other';
      res[domain] = (res[domain] || 0) + o.value;
    });
  return res;
}

function getPipelineActive() {
  return APP.opportunities.filter(o => o.stage !== 'Closed Lost');
}

function renderKPIs() {
  const active      = APP.opportunities.filter(o => o.stage !== 'Closed Lost');
  const lost        = APP.opportunities.filter(o => o.stage === 'Closed Lost');
  const totalPipeline = active.reduce((s,o) => s + (o.value||0), 0);
  const weightedProb  = active.length
    ? active.reduce((s,o) => s + (o.value||0)*(o.prob||0), 0) / Math.max(totalPipeline, 1)
    : 0;
  const forecastVal   = active.reduce((s,o) => s + (o.value||0)*(o.prob||0)/100, 0);

  const kpiRow = document.getElementById('kpiRow');

  // ── ROW 1: Pipeline summary cards ──────────────────────────────
  // Card 1: Total Active Pipeline
  // Card 2: Weighted Forecast
  // Card 3+: One card per domain present in data
  // Card last: Closed Lost summary

  const byDomain = {};
  active.forEach(o => {
    const d = o.domain || 'Other';
    if (!byDomain[d]) byDomain[d] = { count:0, value:0 };
    byDomain[d].count++;
    byDomain[d].value += (o.value||0);
  });

  const COLOR_MAP = {
    'Enterprise':'#00c8ff','Service Providers':'#00e5a0',
    'Security':'#ff6b35','Service Assurance':'#ffc542',
    'Service Assurance/Security':'#ff9f35','Other':'#5a7a99',
  };

  kpiRow.innerHTML = '';

  // ── Card 1: Total Pipeline ──
  kpiRow.innerHTML += `
    <div class="kpi-card" style="border-top:2px solid var(--accent)">
      <div class="kpi-domain" style="color:var(--accent)">Total Active Pipeline</div>
      <div class="kpi-value">$${(totalPipeline/1e6).toFixed(2)}M</div>
      <div class="kpi-sub">${active.length} active opportunit${active.length!==1?'ies':'y'}</div>
      <div class="kpi-bar"><div class="kpi-bar-fill" style="width:100%;background:var(--accent)"></div></div>
      <div class="kpi-footer">
        <span style="color:var(--muted)">${lost.length} closed lost</span>
        <span style="color:var(--accent3)">▲ ${active.length} open</span>
      </div>
    </div>`;

  // ── Card 2: Weighted Forecast ──
  kpiRow.innerHTML += `
    <div class="kpi-card" style="border-top:2px solid var(--accent3)">
      <div class="kpi-domain" style="color:var(--accent3)">Weighted Forecast</div>
      <div class="kpi-value">$${(forecastVal/1e6).toFixed(2)}M</div>
      <div class="kpi-sub">Based on win probability</div>
      <div class="kpi-bar"><div class="kpi-bar-fill" style="width:${Math.round(weightedProb)}%;background:var(--accent3)"></div></div>
      <div class="kpi-footer">
        <span style="color:var(--muted)">Avg probability</span>
        <span style="color:var(--accent3)">${Math.round(weightedProb)}%</span>
      </div>
    </div>`;

  // ── Cards 3+: One per domain ──
  const domainEntries = Object.entries(byDomain).sort((a,b) => b[1].value - a[1].value);
  domainEntries.forEach(([domain, data], i) => {
    const color  = COLOR_MAP[domain] || '#5a7a99';
    const target = APP.targets.find(t => t.domain === domain);
    const tgtVal = target ? target.target : 0;
    const pct    = tgtVal > 0 ? Math.min(100, Math.round(data.value/tgtVal*100)) : 0;
    const lostD  = lost.filter(o => o.domain === domain).length;
    kpiRow.innerHTML += `
      <div class="kpi-card" style="border-top:2px solid ${color}">
        <div class="kpi-domain" style="color:${color}">${domain}</div>
        <div class="kpi-value">$${(data.value/1e6).toFixed(2)}M</div>
        <div class="kpi-sub">${data.count} opportunit${data.count!==1?'ies':'y'} · Active</div>
        <div class="kpi-bar"><div class="kpi-bar-fill" style="width:${tgtVal>0?pct:100}%;background:${color}"></div></div>
        <div class="kpi-footer">
          ${tgtVal > 0
            ? `<span>Target: $${(tgtVal/1e6).toFixed(1)}M</span><span style="color:${pct>=70?'var(--accent3)':'var(--accent2)'}">${pct}%</span>`
            : `<span style="color:var(--muted)">${lostD > 0 ? lostD+' lost in this domain' : 'Set target in Config'}</span>`
          }
        </div>
      </div>`;
  });

  // Adjust grid columns to fit actual card count
  const cardCount = 2 + domainEntries.length;
  kpiRow.style.gridTemplateColumns = `repeat(${Math.min(cardCount, 4)}, 1fr)`;
}

// ── renderIndustryView: Industry cards with sub-domain breakdown ──
function renderIndustryView() {
  const active = APP.opportunities.filter(o => o.stage !== 'Closed Lost' && (o.value||0) > 0);

  // ── Build industry → domain → opps tree ──
  const tree = {};
  active.forEach(o => {
    const ind = (o.industry || 'Other').trim();
    const dom = (o.domain   || 'Other').trim();
    if (!tree[ind]) tree[ind] = {};
    if (!tree[ind][dom]) tree[ind][dom] = { count:0, value:0, opps:[] };
    tree[ind][dom].count++;
    tree[ind][dom].value += (o.value||0);
    tree[ind][dom].opps.push(o);
  });

  const IND_COLORS = {
    'Service Provider':'#00e5a0','Enterprise':'#00c8ff',
    'Other':'#5a7a99',
  };
  const DOM_COLORS = {
    'Service Assurance':'#ffc542','Security':'#ff6b35',
    'Service Assurance/Security':'#ff9f35','Enterprise':'#00c8ff',
    'Service Providers':'#00e5a0','Other':'#5a7a99',
  };
  const STAGE_COLORS = {
    'Qualification':'#00c8ff','Proposal Sent':'#7b2fff',
    'Negotiation':'#ffc542','Closed Won':'#00e5a0',
  };

  // ── Render into the dash-grid ──
  const dashGrid = document.querySelector('.dash-grid');
  if (!dashGrid) return;

  // Build industry cards HTML
  const industryTotal = active.reduce((s,o)=>s+(o.value||0),0);
  let industryHTML = '';

  Object.entries(tree)
    .sort((a,b) => {
      const sumA = Object.values(a[1]).reduce((s,d)=>s+d.value,0);
      const sumB = Object.values(b[1]).reduce((s,d)=>s+d.value,0);
      return sumB - sumA;
    })
    .forEach(([industry, domains]) => {
      const indTotal = Object.values(domains).reduce((s,d)=>s+d.value,0);
      const indCount = Object.values(domains).reduce((s,d)=>s+d.count,0);
      const indPct   = industryTotal > 0 ? (indTotal/industryTotal*100).toFixed(0) : 0;
      const indColor = IND_COLORS[industry] || '#5a7a99';

      // Stage breakdown for this industry
      const stageBreakdown = {};
      Object.values(domains).forEach(d => {
        d.opps.forEach(o => {
          const st = o.stage || 'Unknown';
          if (!stageBreakdown[st]) stageBreakdown[st] = 0;
          stageBreakdown[st] += (o.value||0);
        });
      });

      // Domain rows
      const domainRows = Object.entries(domains)
        .sort((a,b) => b[1].value - a[1].value)
        .map(([domain, data]) => {
          const domPct = indTotal > 0 ? (data.value/indTotal*100).toFixed(0) : 0;
          const domColor = DOM_COLORS[domain] || '#5a7a99';
          return `
            <div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                <div style="display:flex;align-items:center;gap:6px">
                  <div style="width:8px;height:8px;border-radius:2px;background:${domColor};flex-shrink:0"></div>
                  <span style="font-size:10px;color:${domColor};font-weight:500">${domain}</span>
                  <span style="font-size:9px;color:var(--muted)">${data.count} opp${data.count!==1?'s':''}</span>
                </div>
                <span style="font-size:11px;font-weight:600;color:var(--text)">$${(data.value/1e6).toFixed(2)}M</span>
              </div>
              <div style="height:5px;background:var(--surface2);border-radius:3px;overflow:hidden">
                <div style="width:${domPct}%;height:100%;background:${domColor};border-radius:3px;opacity:0.85"></div>
              </div>
            </div>`;
        }).join('');

      // Stage pills
      const stagePills = Object.entries(stageBreakdown)
        .sort((a,b)=>b[1]-a[1])
        .map(([st, val]) => {
          const sc = STAGE_COLORS[st] || '#5a7a99';
          const cnt = Object.values(domains).reduce((s,d)=>s+d.opps.filter(o=>o.stage===st).length,0);
          return `<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(26,47,74,0.4)">
            <div style="display:flex;align-items:center;gap:6px">
              <div style="width:6px;height:6px;border-radius:50%;background:${sc}"></div>
              <span style="font-size:10px;color:var(--text2)">${st}</span>
              <span style="font-size:9px;color:var(--muted)">${cnt}</span>
            </div>
            <span style="font-size:10px;color:var(--muted)">$${(val/1e6).toFixed(2)}M</span>
          </div>`;
        }).join('');

      industryHTML += `
        <div class="panel" style="border-top:3px solid ${indColor};cursor:pointer" data-action="drillIndustry" data-industry="${industry}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
            <div>
              <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.14em;color:${indColor};margin-bottom:4px">${industry}</div>
              <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--text)">$${(indTotal/1e6).toFixed(2)}M</div>
              <div style="font-size:10px;color:var(--muted);margin-top:2px">${indCount} active opportunit${indCount!==1?'ies':'y'} · ${indPct}% of total</div>
            </div>
            <div style="text-align:center;background:${indColor}15;border:1px solid ${indColor}30;border-radius:10px;padding:8px 14px">
              <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:${indColor}">${indPct}%</div>
              <div style="font-size:8px;color:var(--muted);margin-top:1px">of pipeline</div>
            </div>
          </div>

          <div style="font-size:8px;text-transform:uppercase;letter-spacing:0.12em;color:var(--muted);margin-bottom:10px;display:flex;align-items:center;gap:6px">
            Sub-domains<span style="flex:1;height:1px;background:var(--border)"></span>
          </div>
          ${domainRows}

          <div style="font-size:8px;text-transform:uppercase;letter-spacing:0.12em;color:var(--muted);margin:12px 0 6px;display:flex;align-items:center;gap:6px">
            By Stage<span style="flex:1;height:1px;background:var(--border)"></span>
          </div>
          ${stagePills}
        </div>`;
    });

  // ── Update dash-grid: industry cards span full width, then region cards ──
  dashGrid.innerHTML = `
    <div style="grid-column:1/-1;display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">
      ${industryHTML}
    </div>`;

  // Side-by-side wrapper: Region View + Partner View
  const sideBySide = document.createElement('div');
  sideBySide.style.cssText = 'grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:16px';

  // Region panel
  const rp = document.createElement('div');
  rp.className = 'panel';
  rp.innerHTML = `
    <div class="panel-hd">
      <div class="panel-title">Regional View</div>
      <div class="panel-badge">Active pipeline</div>
    </div>
    <div class="region-grid" id="regionGrid"></div>`;

  // Partner panel
  const pp = document.createElement('div');
  pp.className = 'panel';
  pp.innerHTML = `
    <div class="panel-hd">
      <div class="panel-title">Partner View</div>
      <div class="panel-badge">Active pipeline</div>
    </div>
    <div id="partnerGrid"></div>`;

  sideBySide.appendChild(rp);
  sideBySide.appendChild(pp);
  dashGrid.appendChild(sideBySide);

  renderRegionCards();
  renderPartnerCards();
}

function renderPartnerCards() {
  const el = document.getElementById('partnerGrid');
  if (!el) return;

  const active = APP.opportunities.filter(o => o.stage !== 'Closed Lost');

  // Group by partner
  const byPartner = {};
  active.forEach(o => {
    const p = (o.partner || '').trim() || 'No Partner';
    if (!byPartner[p]) byPartner[p] = { value:0, count:0, opps:[] };
    byPartner[p].value += (o.value||0);
    byPartner[p].count++;
    byPartner[p].opps.push(o);
  });

  const entries  = Object.entries(byPartner).sort((a,b) => b[1].value - a[1].value);
  const maxVal   = Math.max(...entries.map(([,d]) => d.value), 1);

  const PARTNER_COLORS = [
    '#00c8ff','#00e5a0','#ffc542','#ff6b35','#7b2fff',
    '#ff9f35','#00b8ec','#a07fff','#ff6b9d','#4ecdc4',
  ];

  if (!entries.length || (entries.length === 1 && entries[0][0] === 'No Partner')) {
    el.innerHTML = `<div style="text-align:center;padding:28px 16px;color:var(--muted);font-size:11px">
      <div style="font-size:24px;opacity:0.2;margin-bottom:8px">🤝</div>
      No partners assigned yet.<br>Add partner names in the Opportunities config.
    </div>`;
    return;
  }

  // Store partner data for drill-down
  window._partnerData = {};
  entries.forEach(([p, d], i) => {
    const color = p === 'No Partner' ? '#5a7a99' : PARTNER_COLORS[i % PARTNER_COLORS.length];
    window._partnerData[p] = { ...d, color };
  });

  const total = entries.reduce((s,[,d])=>s+d.value,0);

  // ── SVG Donut chart ──
  // ── Horizontal bar chart ──
  const barRows = entries.map(([partner, data], i) => {
    const color    = partner === 'No Partner' ? '#5a7a99' : PARTNER_COLORS[i % PARTNER_COLORS.length];
    const pipePct  = (data.value / maxVal * 100).toFixed(1);
    const weighted = data.opps.reduce((s,o)=>s+(o.value||0)*(o.prob||0)/100,0);
    const wPct     = (weighted / maxVal * 100).toFixed(1);
    const sharePct = (data.value / total * 100).toFixed(0);
    const safeP    = partner.replace(/'/g,"\'");

    // Attainment bar (booked / negotiation / commit / pipeline)
    const pBooked   = data.opps.filter(o=>o.stage==='Closed Won').reduce((s,o)=>s+(o.value||0),0);
    const pNego     = data.opps.filter(o=>o.stage==='Negotiation').reduce((s,o)=>s+(o.value||0),0);
    const pCommit   = data.opps.filter(o=>o.stage==='Proposal Sent'&&(o.prob||0)>=50).reduce((s,o)=>s+(o.value||0),0);
    const pRest     = data.value - pBooked - pNego - pCommit;

    return `
      <div data-partner="${safeP}" style="padding:8px 0;border-bottom:1px solid rgba(26,47,74,0.3);cursor:pointer;transition:background 0.15s;border-radius:6px"
        onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
        <!-- Partner name row -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;padding:0 4px">
          <div style="display:flex;align-items:center;gap:6px">
            <div style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></div>
            <span style="font-size:10px;font-weight:600;color:${color}">${partner}</span>
            <span style="font-size:9px;color:var(--muted)">${data.count} opp${data.count!==1?'s':''}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-family:'Syne',sans-serif;font-size:12px;font-weight:800">$${(data.value/1e6).toFixed(2)}M</span>
            <span style="font-size:9px;padding:1px 7px;border-radius:8px;background:${color}15;color:${color};border:1px solid ${color}30">${sharePct}%</span>
            <span style="font-size:11px;color:var(--muted)">›</span>
          </div>
        </div>

        <!-- Stacked attainment bar -->
        <div style="display:flex;height:14px;border-radius:4px;overflow:hidden;background:var(--border);margin:0 4px">
          ${pBooked>0?`<div style="width:${(pBooked/data.value*100).toFixed(1)}%;background:#00e5a0;min-width:2px" title="Booked: $${(pBooked/1000).toFixed(0)}K"></div>`:''}
          ${pNego>0?`<div style="width:${(pNego/data.value*100).toFixed(1)}%;background:#ffc542;opacity:0.9;min-width:2px" title="Negotiation: $${(pNego/1000).toFixed(0)}K"></div>`:''}
          ${pCommit>0?`<div style="width:${(pCommit/data.value*100).toFixed(1)}%;background:#7b2fff;opacity:0.85;min-width:2px" title="Commit: $${(pCommit/1000).toFixed(0)}K"></div>`:''}
          ${pRest>0?`<div style="width:${(pRest/data.value*100).toFixed(1)}%;background:#00c8ff;opacity:0.35;min-width:2px" title="Pipeline: $${(pRest/1000).toFixed(0)}K"></div>`:''}
        </div>

        <!-- Pipeline vs weighted -->
        <div style="display:flex;align-items:center;gap:6px;margin-top:5px;padding:0 4px">
          <div style="flex:1;height:5px;background:var(--border);border-radius:2px;overflow:hidden;position:relative">
            <div style="position:absolute;left:0;top:0;height:100%;width:${pipePct}%;background:${color};border-radius:2px;opacity:0.3"></div>
            <div style="position:absolute;left:0;top:0;height:100%;width:${wPct}%;background:${color};border-radius:2px"></div>
          </div>
          <span style="font-size:9px;color:var(--muted);white-space:nowrap">fcst $${(weighted/1e6).toFixed(2)}M</span>
        </div>
      </div>`;
  }).join('');

  el.innerHTML = `<div style="padding:4px 0">${barRows}</div>`;

  // Wire up click handlers via event delegation on the grid
  el.onclick = e => {
    const card = e.target.closest('[data-partner]');
    if (!card) return;
    drillPartner(card.dataset.partner);
  };
}

function drillPartner(partnerName) {
  const data = window._partnerData?.[partnerName];
  if (!data) return;

  const DOM_C   = {'Service Assurance':'#ffc542','Security':'#ff6b35','Service Assurance/Security':'#ff9f35','Enterprise':'#00c8ff','Service Providers':'#00e5a0'};
  const STAGE_C = {'Qualification':'#00c8ff','Proposal Sent':'#7b2fff','Negotiation':'#ffc542','Closed Won':'#00e5a0','Closed Lost':'#ff4444'};
  const PC      = p => (p>=70)?'#00e5a0':(p>=40)?'#ffc542':'#ff6b35';
  const color   = data.color;
  const weighted= data.opps.reduce((s,o)=>s+(o.value||0)*(o.prob||0)/100,0);

  const rows = data.opps
    .sort((a,b) => (b.value||0)-(a.value||0))
    .map(o => {
      const dc  = DOM_C[o.domain]  || '#5a7a99';
      const sc  = STAGE_C[o.stage] || '#5a7a99';
      const pc  = PC(o.prob||0);
      const last = getLastActivity(o);
      const days = last ? getDaysAgo(last.date) : null;
      const daysStr = days===null?'No activity':days===0?'Today':days===1?'Yesterday':days+'d ago';
      const daysC   = days===null?'var(--muted)':days>30?'var(--accent2)':days>7?'var(--accent4)':'var(--accent3)';
      return `
        <div class="drawer-opp-row">
          <div style="width:3px;height:40px;border-radius:2px;background:${dc};flex-shrink:0"></div>
          <div style="flex:1;min-width:0">
            <div style="font-size:11px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.name}</div>
            <div style="font-size:9px;color:var(--muted);margin-top:2px;display:flex;gap:6px;flex-wrap:wrap">
              <span>${o.account||''}</span>
              <span style="color:${dc}">${o.domain||''}</span>
              <span style="padding:1px 6px;border-radius:4px;background:${sc}15;color:${sc};border:1px solid ${sc}30">${o.stage}</span>
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-family:'Syne',sans-serif;font-size:12px;font-weight:700">$${((o.value||0)/1000).toFixed(0)}K</div>
            <div style="font-size:9px;padding:1px 6px;border-radius:6px;color:${pc};border:1px solid ${pc}30;background:${pc}10;margin-top:2px">${o.prob||0}%</div>
            <div style="font-size:9px;color:${daysC};margin-top:2px">${daysStr}</div>
          </div>
        </div>`;
    }).join('');

  openDrawer(
    `🤝 ${partnerName}`,
    `$${(data.value/1e6).toFixed(2)}M pipeline · ${data.opps.length} opportunit${data.opps.length!==1?'ies':'y'}`,
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
       <div class="drawer-stat">
         <div class="drawer-stat-label">Total Pipeline</div>
         <div class="drawer-stat-value" style="color:${color}">$${(data.value/1e6).toFixed(2)}M</div>
       </div>
       <div class="drawer-stat">
         <div class="drawer-stat-label">Weighted Forecast</div>
         <div class="drawer-stat-value" style="color:var(--accent3)">$${(weighted/1e6).toFixed(2)}M</div>
       </div>
     </div>
     <div class="drawer-section-title">Opportunities (${data.opps.length})</div>
     ${rows}`
  );
}


// ══════════════════════════════════════════════════════
//  TIMELINE VIEW (Quarter / Year toggle)

// ── NETSCOUT Fiscal Year helpers (FY starts March 1) ──
function getFiscalQuarter(year, month) {
  // month is 1-based
  // FY quarters: Q1=Mar-May, Q2=Jun-Aug, Q3=Sep-Nov, Q4=Dec-Feb
  const MONTH_TO_FQ = {1:4, 2:4, 3:1, 4:1, 5:1, 6:2, 7:2, 8:2, 9:3, 10:3, 11:3, 12:4};
  const q  = MONTH_TO_FQ[month];
  // FY year: if month >= 3, FY = calendar year; if month < 3 (Jan/Feb), FY = calendar year - 1
  const fy = month >= 3 ? year : year - 1;
  return { fy, q, label: `Q${q} FY${fy}` };
}

function getCurrentFiscalQuarter() {
  const now = new Date();
  return getFiscalQuarter(now.getFullYear(), now.getMonth() + 1);
}


// ══════════════════════════════════════════════════════
let _timelineMode = 'quarter'; // 'quarter' | 'year'

function renderTimelineView() {
  const dashGrid = document.querySelector('.dash-grid');
  if (!dashGrid) return;

  const active = APP.opportunities.filter(o => o.stage !== 'Closed Lost' && (o.value||0)>0);
  const target = APP.annualTarget || 0;

  // ── Parse close date → fiscal quarter ──
  function parseClose(o) {
    const s = String(o.close||'').trim();
    const m = s.match(/^(\d{4})-(\d{2})$/);
    if (m) {
      const yr = parseInt(m[1]);
      const mo = parseInt(m[2]);
      const fq = getFiscalQuarter(yr, mo);
      return { year: fq.fy, quarter: fq.q, label: fq.label };
    }
    return null;
  }

  // ── Group opps ──
  const grouped = {};
  active.forEach(o => {
    const d = parseClose(o);
    if (!d) return;
    const key = _timelineMode === 'quarter' ? d.label : `FY${d.year}`;
    if (!grouped[key]) grouped[key] = { pipeline:0, weighted:0, opps:[], mustWin:0 };
    grouped[key].pipeline += (o.value||0);
    grouped[key].weighted += (o.value||0)*(o.prob||0)/100;
    grouped[key].opps.push(o);
    if (o.priority === 'must_win') grouped[key].mustWin++;
  });

  // ── Sort keys chronologically ──
  const keys = Object.keys(grouped).sort((a,b) => {
    if (_timelineMode === 'quarter') {
      // Q1 FY2025 → sort by FY year first, then Q number
      const [qa, ya] = [parseInt(a[1]), parseInt(a.slice(6))];
      const [qb, yb] = [parseInt(b[1]), parseInt(b.slice(6))];
      return ya !== yb ? ya-yb : qa-qb;
    }
    // FY2025 → sort by numeric year
    return parseInt(a.replace('FY','')) - parseInt(b.replace('FY',''));
  });

  if (!keys.length) return;

  const maxPipeline = Math.max(...keys.map(k => grouped[k].pipeline), 1);
  const targetPerPeriod = _timelineMode === 'quarter' ? target/4 : target;

  const STAGE_C = {'Qualification':'#00c8ff','Proposal Sent':'#7b2fff','Negotiation':'#ffc542','Closed Won':'#00e5a0'};

  // ── Build columns ──
  const columns = keys.map(key => {
    const d = grouped[key];
    const barH = Math.round((d.pipeline / maxPipeline) * 140);
    const wBarH = Math.round((d.weighted / maxPipeline) * 140);
    const tBarH = targetPerPeriod > 0 ? Math.round((targetPerPeriod / maxPipeline) * 140) : 0;
    const isNow = _timelineMode === 'quarter'
      ? key === getCurrentFiscalQuarter().label
      : (() => { const cfy = getCurrentFiscalQuarter(); return key === `FY${cfy.fy}`; })();
    const overTarget = targetPerPeriod > 0 && d.weighted >= targetPerPeriod;

    // Stage breakdown for tooltip
    const byStage = {};
    d.opps.forEach(o => { const s=o.stage||'Other'; byStage[s]=(byStage[s]||0)+(o.value||0); });
    const stagePills = Object.entries(byStage)
      .sort((a,b)=>b[1]-a[1])
      .map(([s,v])=>`<div style="display:flex;justify-content:space-between;font-size:9px;padding:2px 0">
        <span style="color:${STAGE_C[s]||'#5a7a99'}">${s}</span>
        <span style="color:var(--muted)">$${(v/1e6).toFixed(1)}M</span>
      </div>`).join('');

    return `
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex:1;min-width:60px;cursor:pointer"
        onclick="drillTimeline('${key}')"
        onmouseenter="showTimelineTooltip(event,'${key}')"
        onmouseleave="hideTimelineTooltip()">

        <!-- Value labels -->
        <div style="text-align:center">
          <div style="font-family:'Syne',sans-serif;font-size:11px;font-weight:800;color:var(--text)">$${(d.pipeline/1e6).toFixed(1)}M</div>
          <div style="font-size:9px;color:var(--accent3)">$${(d.weighted/1e6).toFixed(1)}M fcst</div>
          ${d.mustWin > 0 ? `<div style="font-size:9px;color:#ffd700">⭐ ${d.mustWin}</div>` : ''}
        </div>

        <!-- Bar chart area -->
        <div style="position:relative;width:100%;height:150px;display:flex;align-items:flex-end;justify-content:center;gap:3px">
          <!-- Target line -->
          ${tBarH > 0 ? `<div style="position:absolute;left:0;right:0;bottom:${tBarH}px;height:1px;background:rgba(255,197,66,0.5);border-top:1px dashed rgba(255,197,66,0.4);z-index:2"></div>` : ''}

          <!-- Pipeline bar -->
          <div style="width:38%;height:${barH}px;background:${isNow?'var(--accent)':'var(--border)'};border-radius:4px 4px 0 0;transition:height 0.4s ease;position:relative;overflow:hidden">
            ${Object.entries(byStage).sort((a,b)=>b[1]-a[1]).map(([s,v])=>{
              const pct = (v/d.pipeline*100).toFixed(0);
              return `<div style="width:100%;height:${pct}%;background:${STAGE_C[s]||'#5a7a99'};opacity:0.8;position:absolute;bottom:0;left:0"></div>`;
            }).join('')}
          </div>

          <!-- Weighted bar -->
          <div style="width:38%;height:${wBarH}px;background:var(--accent3);border-radius:4px 4px 0 0;opacity:0.7;transition:height 0.4s ease"></div>
        </div>

        <!-- Period label -->
        <div style="text-align:center">
          <div style="font-size:${_timelineMode==='quarter'?'10':'11'}px;font-weight:${isNow?700:500};color:${isNow?'var(--accent)':'var(--text2)'}">${key}</div>
          ${isNow ? `<div style="width:6px;height:6px;border-radius:50%;background:var(--accent);margin:2px auto"></div>` : ''}
          <div style="font-size:9px;color:var(--muted)">${d.opps.length} opp${d.opps.length!==1?'s':''}</div>
        </div>
      </div>`;
  }).join('');

  // ── Legend ──
  const legend = `
    <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:5px;font-size:9px">
        <div style="width:10px;height:10px;border-radius:2px;background:var(--accent);opacity:0.9"></div>
        <span style="color:var(--text2)">Pipeline</span>
      </div>
      <div style="display:flex;align-items:center;gap:5px;font-size:9px">
        <div style="width:10px;height:10px;border-radius:2px;background:var(--accent3);opacity:0.7"></div>
        <span style="color:var(--text2)">Weighted Fcst</span>
      </div>
      ${target>0?`<div style="display:flex;align-items:center;gap:5px;font-size:9px">
        <div style="width:16px;height:2px;border-top:1px dashed rgba(255,197,66,0.6)"></div>
        <span style="color:var(--accent4)">${_timelineMode==='quarter'?'FY Quarterly':'FY Annual'} Target</span>
      </div>`:''}
    </div>`;

  // ── Totals summary ──
  const totalPipe = keys.reduce((s,k)=>s+grouped[k].pipeline,0);
  const totalFcst = keys.reduce((s,k)=>s+grouped[k].weighted,0);

  // Create or update timeline panel — insert after kpiRow
  let tp = document.getElementById('timelinePanel');
  if (!tp) {
    tp = document.createElement('div');
    tp.id = 'timelinePanel';
    tp.style.cssText = 'grid-column:1/-1;margin-bottom:0';
    const kpiRow2 = document.getElementById('kpiRow');
    if (kpiRow2 && kpiRow2.parentNode) {
      kpiRow2.parentNode.insertBefore(tp, kpiRow2.nextSibling);
    } else if (dashGrid) {
      dashGrid.insertBefore(tp, dashGrid.firstChild);
    }
  }

  tp.innerHTML = `
    <div class="panel">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
        <div>
          <div class="panel-title">Pipeline Timeline</div>
          <div style="font-size:10px;color:var(--muted);margin-top:2px">
            $${(totalPipe/1e6).toFixed(2)}M pipeline · $${(totalFcst/1e6).toFixed(2)}M weighted · ${active.filter(o=>parseClose(o)).length} opps with close dates
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          ${legend}
          <!-- Toggle -->
          <div style="display:flex;background:var(--surface2);border:1px solid var(--border);border-radius:8px;overflow:hidden">
            <button onclick="setTimelineMode('quarter')" id="tlBtnQ"
              style="padding:5px 14px;font-family:'DM Mono',monospace;font-size:10px;border:none;cursor:pointer;transition:all 0.15s;background:${_timelineMode==='quarter'?'var(--accent)':'transparent'};color:${_timelineMode==='quarter'?'#000':'var(--muted)'}">
              By FY Quarter
            </button>
            <button onclick="setTimelineMode('year')" id="tlBtnY"
              style="padding:5px 14px;font-family:'DM Mono',monospace;font-size:10px;border:none;cursor:pointer;transition:all 0.15s;background:${_timelineMode==='year'?'var(--accent)':'transparent'};color:${_timelineMode==='year'?'#000':'var(--muted)'}">
              By FY Year
            </button>
          </div>
        </div>
      </div>

      <!-- Bar chart -->
      <div style="display:flex;gap:8px;align-items:flex-end;overflow-x:auto;padding-bottom:4px;min-height:220px">
        ${columns}
      </div>
    </div>`;
}

function setTimelineMode(mode) {
  _timelineMode = mode;
  const tp = document.getElementById('timelinePanel');
  if (tp) tp.remove();
  renderTimelineView();
}

// ── Tooltip ──
function showTimelineTooltip(event, key) {
  hideTimelineTooltip();
  const active = APP.opportunities.filter(o => o.stage !== 'Closed Lost' && (o.value||0)>0);
  function parseClose(o) {
    const s = String(o.close||'').trim();
    const m = s.match(/^(\d{4})-(\d{2})$/);
    if (m) {
      const fq = getFiscalQuarter(parseInt(m[1]), parseInt(m[2]));
      return _timelineMode === 'quarter' ? fq.label : `FY${fq.fy}`;
    }
    return null;
  }
  const opps = active.filter(o => parseClose(o) === key);
  if (!opps.length) return;

  const STAGE_C = {'Qualification':'#00c8ff','Proposal Sent':'#7b2fff','Negotiation':'#ffc542','Closed Won':'#00e5a0'};
  const rows = opps.sort((a,b)=>(b.value||0)-(a.value||0)).slice(0,6).map(o=>`
    <div style="display:flex;justify-content:space-between;gap:12px;padding:3px 0;border-bottom:1px solid rgba(26,47,74,0.3);font-size:10px">
      <div style="display:flex;align-items:center;gap:5px;overflow:hidden">
        ${o.priority==='must_win'?'<span>⭐</span>':o.priority==='high'?'<span>🔥</span>':''}
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text2)">${(o.account||o.name).slice(0,20)}</span>
      </div>
      <div style="display:flex;gap:8px;flex-shrink:0;align-items:center">
        <span style="font-size:9px;padding:1px 5px;border-radius:4px;background:${STAGE_C[o.stage]||'#5a7a99'}20;color:${STAGE_C[o.stage]||'#5a7a99'}">${o.stage}</span>
        <span style="font-weight:600">$${((o.value||0)/1000).toFixed(0)}K</span>
      </div>
    </div>`).join('');

  const pipe = opps.reduce((s,o)=>s+(o.value||0),0);
  const fcst = opps.reduce((s,o)=>s+(o.value||0)*(o.prob||0)/100,0);

  const tip = document.createElement('div');
  tip.id = 'timelineTooltip';
  tip.style.cssText = 'position:fixed;z-index:9999;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 14px;box-shadow:0 8px 32px rgba(0,0,0,0.3);min-width:240px;max-width:300px;pointer-events:none';
  tip.innerHTML = `
    <div style="font-family:'Syne',sans-serif;font-size:12px;font-weight:800;margin-bottom:8px">${key}</div>
    <div style="display:flex;gap:16px;margin-bottom:10px">
      <div><div style="font-size:8px;color:var(--muted)">Pipeline</div><div style="font-size:12px;font-weight:700;color:var(--accent)">$${(pipe/1e6).toFixed(2)}M</div></div>
      <div><div style="font-size:8px;color:var(--muted)">Forecast</div><div style="font-size:12px;font-weight:700;color:var(--accent3)">$${(fcst/1e6).toFixed(2)}M</div></div>
      <div><div style="font-size:8px;color:var(--muted)">Deals</div><div style="font-size:12px;font-weight:700">${opps.length}</div></div>
    </div>
    ${rows}
    ${opps.length>6?`<div style="font-size:9px;color:var(--muted);margin-top:4px">+${opps.length-6} more</div>`:''}`;
  document.body.appendChild(tip);
  const r = event.target.getBoundingClientRect();
  tip.style.left = Math.min(r.left, window.innerWidth-310) + 'px';
  tip.style.top  = (r.top - tip.offsetHeight - 8) + 'px';
  setTimeout(() => {
    tip.style.top = Math.min(r.top + 20, window.innerHeight - tip.offsetHeight - 10) + 'px';
  }, 0);
}

function hideTimelineTooltip() {
  const t = document.getElementById('timelineTooltip');
  if (t) t.remove();
}

function drillTimeline(key) {
  const active = APP.opportunities.filter(o => o.stage !== 'Closed Lost' && (o.value||0)>0);
  function parseClose(o) {
    const s = String(o.close||'').trim();
    const m = s.match(/^(\d{4})-(\d{2})$/);
    if (m) {
      const fq = getFiscalQuarter(parseInt(m[1]), parseInt(m[2]));
      return _timelineMode === 'quarter' ? fq.label : `FY${fq.fy}`;
    }
    return null;
  }
  const opps = active.filter(o => parseClose(o) === key);
  const pipe = opps.reduce((s,o)=>s+(o.value||0),0);
  const fcst = opps.reduce((s,o)=>s+(o.value||0)*(o.prob||0)/100,0);
  openDrawer(
    `📅 ${key}`,
    `$${(pipe/1e6).toFixed(2)}M pipeline · $${(fcst/1e6).toFixed(2)}M forecast · ${opps.length} opportunities`,
    oppListHTML(opps.sort((a,b)=>(b.value||0)-(a.value||0)), 'Opportunities closing ' + key)
  );
}


function renderTopOpportunities() {
  // Render top opps as a full-width table below the industry view
  const dashGrid = document.querySelector('.dash-grid');
  if (!dashGrid) return;

  const PRIO_ORDER = { must_win:0, high:1, normal:2 };
  const active = APP.opportunities.filter(o=>o.stage!=='Closed Lost').sort((a,b)=>{
    const pa = PRIO_ORDER[a.priority||'normal'] ?? 2;
    const pb = PRIO_ORDER[b.priority||'normal'] ?? 2;
    if (pa !== pb) return pa - pb;
    return (b.value||0) - (a.value||0);
  });
  const lost   = APP.opportunities.filter(o=>o.stage==='Closed Lost').sort((a,b)=>b.value-a.value);
  const sorted = [...active, ...lost].slice(0,10);

  const DOM_COLORS = {
    'Service Assurance':'#ffc542','Security':'#ff6b35',
    'Service Assurance/Security':'#ff9f35','Enterprise':'#00c8ff',
    'Service Providers':'#00e5a0','Other':'#5a7a99',
  };
  const IND_COLORS = {'Service Provider':'#00e5a0','Enterprise':'#00c8ff'};
  const STAGE_COLORS = {
    'Qualification':'#00c8ff','Proposal Sent':'#7b2fff',
    'Negotiation':'#ffc542','Closed Won':'#00e5a0','Closed Lost':'#ff4444',
  };

  const rows = sorted.map(o => {
    const isLost   = o.stage === 'Closed Lost';
    const dc       = DOM_COLORS[o.domain]  || '#5a7a99';
    const ic       = IND_COLORS[o.industry]|| '#5a7a99';
    const sc       = STAGE_COLORS[o.stage] || '#5a7a99';
    const pc       = o.prob>=70?'#00e5a0':o.prob>=50?'#ffc542':'#ff6b35';
    const prodShort = o.product ? o.product.split(',')[0].trim().slice(0,22) : '—';
    return `
      <tr style="border-bottom:1px solid rgba(26,47,74,0.4);opacity:${isLost?0.35:1};transition:background 0.15s" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background=''">
        <td style="padding:6px 8px;text-align:center;white-space:nowrap">
          ${o.priority==='must_win'?'<span title="Must Win" style="font-size:14px">⭐</span>':o.priority==='high'?'<span title="High Priority" style="font-size:14px">🔥</span>':''}
        </td>
        <td style="padding:10px 12px;max-width:180px">
          <div style="font-size:11px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${isLost?'text-decoration:line-through;color:var(--muted)':''}">${o.name}</div>
        </td>
        <td style="padding:10px 12px;max-width:130px">
          <div style="font-size:10px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:default"
            data-acct-tooltip="${o.id}"
            onmouseenter="showAccountTooltipById(event,${o.id})"
            onmouseleave="hideAccountTooltip()"
          >${o.account||'—'}${(o.revenue||o.capex)?` <span style="font-size:8px;color:#a07fff">●</span>`:''}</div>
        </td>
        <td style="padding:10px 12px">
          <span style="font-size:9px;padding:2px 8px;border-radius:6px;background:${ic}15;border:1px solid ${ic}30;color:${ic};white-space:nowrap">${o.industry||'—'}</span>
        </td>
        <td style="padding:10px 12px">
          <span style="font-size:9px;padding:2px 8px;border-radius:6px;background:${dc}15;border:1px solid ${dc}30;color:${dc};white-space:nowrap">${o.domain||'—'}</span>
        </td>
        <td style="padding:10px 12px;font-size:10px;color:var(--muted);max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${o.product||''}">${prodShort}</td>
        <td style="padding:10px 12px">
          <span style="font-size:9px;padding:2px 8px;border-radius:6px;background:${sc}15;border:1px solid ${sc}30;color:${sc};white-space:nowrap">${o.stage}</span>
        </td>
        <td style="padding:10px 12px;text-align:right">
          <div style="font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:var(--text)">$${(o.value/1000).toFixed(0)}K</div>
        </td>
        <td style="padding:10px 12px;text-align:center">
          <span style="font-size:10px;padding:2px 8px;border-radius:8px;color:${pc};border:1px solid ${pc}30;background:${pc}10">${o.prob}%</span>
        </td>
        <td style="padding:10px 12px">
          ${(()=>{
            const last = getLastActivity(o);
            if (!last) return '<span style="font-size:9px;color:var(--muted)">No activity</span>';
            const days = getDaysAgo(last.date);
            const dc   = days>30?'var(--accent2)':days>7?'var(--accent4)':'var(--accent3)';
            const ds   = days===0?'Today':days===1?'Yesterday':days+'d ago';
            return '<div style="font-size:10px;color:'+dc+'">'+ds+'</div><div style="font-size:9px;color:var(--muted)">'+last.type+'</div>';
          })()}
        </td>
      </tr>`;
  }).join('');

  const oppPanel = document.createElement('div');
  oppPanel.className = 'panel';
  oppPanel.style.gridColumn = '1/-1';
  oppPanel.innerHTML = `
    <div class="panel-hd">
      <div class="panel-title">Top Opportunities</div>
      <div class="panel-badge">${active.length} active · ${lost.length} lost</div>
    </div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="border-bottom:1px solid var(--border)">
            ${['','Opportunity','Account','Industry','Domain','Product','Stage','Value','Win %','Last Activity']
              .map(h=>`<th style="text-align:left;padding:6px 12px 10px;font-size:8px;text-transform:uppercase;letter-spacing:0.12em;color:var(--muted);white-space:nowrap">${h}</th>`)
              .join('')}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  dashGrid.appendChild(oppPanel);
}

// Keep renderOppList as alias for backwards compat in meetings etc
function renderOppList() {
  const el = document.getElementById('oppList');
  if (!el) return;
  const PRIO_ORDER = { must_win:0, high:1, normal:2 };
  const active = APP.opportunities.filter(o=>o.stage!=='Closed Lost').sort((a,b)=>{
    const pa = PRIO_ORDER[a.priority||'normal'] ?? 2;
    const pb = PRIO_ORDER[b.priority||'normal'] ?? 2;
    if (pa !== pb) return pa - pb;
    return (b.value||0) - (a.value||0);
  });
  const lost   = APP.opportunities.filter(o=>o.stage==='Closed Lost').sort((a,b)=>b.value-a.value);
  const sorted = [...active, ...lost].slice(0,8);
  el.innerHTML = sorted.map(o => {
    const c = DOMAIN_COLORS[o.domain]||'#5a7a99';
    const pc = o.prob>=70?'#00e5a0':o.prob>=50?'#ffc542':'#ff6b35';
    const prodTag     = o.product    ? `<span style="font-size:8px;padding:1px 6px;border-radius:5px;background:rgba(123,47,255,0.1);border:1px solid rgba(123,47,255,0.25);color:#a07fff;margin-left:4px">${o.product}</span>` : '';
    const partnerTag  = o.partner ? `<span style="font-size:8px;padding:1px 6px;border-radius:5px;background:rgba(0,229,160,0.08);border:1px solid rgba(0,229,160,0.2);color:var(--accent3);margin-left:3px">🤝 ${o.partner}</span>` : '';
    const industryTag = o.industry   ? `<span style="font-size:8px;padding:1px 6px;border-radius:5px;background:rgba(0,229,160,0.07);border:1px solid rgba(0,229,160,0.2);color:var(--accent3);margin-left:3px">${o.industry}</span>` : '';
    const isLost = o.stage === 'Closed Lost';
    return `<div class="opp-row" style="${isLost?'opacity:0.35':''}">
      <div class="opp-stripe" style="background:${isLost?'#333':c}"></div>
      <div class="opp-info">
        <div class="opp-name" style="${isLost?'text-decoration:line-through;color:var(--muted)':''}">${o.name}</div>
        <div class="opp-meta" style="display:flex;align-items:center;flex-wrap:wrap;gap:2px">${o.domain} · ${o.region}${industryTag}${prodTag}${partnerTag}${isLost?'<span style="font-size:8px;padding:1px 6px;border-radius:5px;background:rgba(255,68,68,0.08);border:1px solid rgba(255,68,68,0.2);color:#ff4444;margin-left:3px">Lost</span>':''}</div>
      </div>
      <div class="opp-right"><div class="opp-val" style="${isLost?'color:var(--muted)':''}">$${(o.value/1000).toFixed(0)}K</div><div class="opp-close">${o.close}</div></div>
      <div class="prob-pill" style="color:${pc};border-color:${pc};background:${pc}18">${o.prob}%</div>
    </div>`;
  }).join('');
}

// Track selected region for the region card
let _selectedRegion = null;

function renderRegionCards() {
  const el = document.getElementById('regionGrid');
  if (!el) return;

  const activeOpps = APP.opportunities.filter(o => o.stage !== 'Closed Lost');
  const activeRegs = APP.regions.filter(r => r.active);
  const dataRegions = [...new Set(activeOpps.map(o => o.region).filter(Boolean))];
  const allRegionNames = [...new Set([...activeRegs.map(r=>r.name), ...dataRegions])];

  // Default to first region
  if (!_selectedRegion || !allRegionNames.includes(_selectedRegion)) {
    _selectedRegion = allRegionNames[0] || null;
  }

  // ── Radio buttons row ──
  const radioHTML = allRegionNames.map(rn => {
    const cfg   = activeRegs.find(r => r.name === rn);
    const color = cfg ? cfg.color : '#5a7a99';
    const total = activeOpps.filter(o=>o.region===rn).reduce((s,o)=>s+(o.value||0),0);
    const sel   = rn === _selectedRegion;
    return `<label style="display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;flex:1;min-width:60px" onclick="selectRegion('${rn}')">
      <div style="width:14px;height:14px;border-radius:50%;border:2px solid ${color};background:${sel?color:'transparent'};transition:all 0.2s;flex-shrink:0"></div>
      <span style="font-size:10px;font-weight:${sel?700:400};color:${sel?color:'var(--muted)'};text-align:center;line-height:1.2">${rn}</span>
      <span style="font-size:9px;color:var(--muted)">$${(total/1e6).toFixed(1)}M</span>
    </label>`;
  }).join('');

  // ── Detail for selected region ──
  const detailHTML = _selectedRegion ? buildRegionDetail(_selectedRegion, activeOpps, activeRegs) : '';

  el.innerHTML = `
    <div style="padding:4px 0 14px">
      <div style="display:flex;gap:8px;justify-content:space-around;padding:8px 0 12px;border-bottom:1px solid var(--border);flex-wrap:wrap">
        ${radioHTML}
      </div>
      <div id="regionDetail" style="margin-top:12px">${detailHTML}</div>
    </div>`;
}

function selectRegion(name) {
  _selectedRegion = name;
  const activeOpps = APP.opportunities.filter(o => o.stage !== 'Closed Lost');
  const activeRegs = APP.regions.filter(r => r.active);
  // Update radio visuals
  const allRegionNames = [...new Set([
    ...activeRegs.map(r=>r.name),
    ...activeOpps.map(o=>o.region).filter(Boolean)
  ])];
  allRegionNames.forEach(rn => {
    const cfg   = activeRegs.find(r=>r.name===rn);
    const color = cfg?cfg.color:'#5a7a99';
    const label = document.querySelector(`[onclick="selectRegion('${rn}')"]`);
    if (!label) return;
    const dot  = label.querySelector('div');
    const span = label.querySelectorAll('span')[0];
    if (dot)  { dot.style.background = rn===name?color:'transparent'; dot.style.borderColor = color; }
    if (span) { span.style.color = rn===name?color:'var(--muted)'; span.style.fontWeight = rn===name?'700':'400'; }
  });
  // Update detail panel
  const det = document.getElementById('regionDetail');
  if (det) det.innerHTML = buildRegionDetail(name, activeOpps, activeRegs);
}

function buildRegionDetail(regionName, activeOpps, activeRegs) {
  const cfg    = activeRegs.find(r => r.name === regionName);
  const color  = cfg ? cfg.color : '#5a7a99';
  const opps   = activeOpps.filter(o => o.region === regionName);
  const total  = opps.reduce((s,o) => s+(o.value||0), 0);
  const fcst   = opps.reduce((s,o) => s+(o.value||0)*(o.prob||0)/100, 0);

  if (!opps.length) {
    return `<div style="text-align:center;padding:24px;color:var(--muted);font-size:11px">No active opportunities in ${regionName}</div>`;
  }

  // ── SVG Donut Chart (accounts) ──
  const byAccount = {};
  opps.forEach(o => {
    const a = (o.account || o.name || 'Unknown').trim();
    byAccount[a] = (byAccount[a]||0) + (o.value||0);
  });
  const acctEntries = Object.entries(byAccount).sort((a,b)=>b[1]-a[1]);

  const SLICE_COLORS = [color,'#7b2fff','#ffc542','#ff6b35','#00e5a0','#00c8ff','#ff9f35','#a07fff','#4ecdc4','#ff6b9d'];
  const SIZE = 110, CX = SIZE/2, CY = SIZE/2, R = 42, INNER = 24;
  let slices = '', startAngle = -Math.PI/2;
  const total2 = acctEntries.reduce((s,[,v])=>s+v,0);

  acctEntries.forEach(([acct, val], i) => {
    const pct   = val/total2;
    const angle = pct * 2 * Math.PI;
    const end   = startAngle + angle;
    const large = angle > Math.PI ? 1 : 0;
    const x1 = CX + R*Math.cos(startAngle), y1 = CY + R*Math.sin(startAngle);
    const x2 = CX + R*Math.cos(end),        y2 = CY + R*Math.sin(end);
    const ix1= CX + INNER*Math.cos(end),    iy1= CY + INNER*Math.sin(end);
    const ix2= CX + INNER*Math.cos(startAngle), iy2= CY + INNER*Math.sin(startAngle);
    const sc  = SLICE_COLORS[i % SLICE_COLORS.length];
    slices += `<path d="M${x1},${y1} A${R},${R} 0 ${large},1 ${x2},${y2} L${ix1},${iy1} A${INNER},${INNER} 0 ${large},0 ${ix2},${iy2} Z"
      fill="${sc}" opacity="0.9" stroke="var(--surface)" stroke-width="1.5"/>`;
    startAngle = end;
  });

  const donutSVG = `<svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" style="flex-shrink:0">
    ${slices}
    <text x="${CX}" y="${CY-6}" text-anchor="middle" font-family="Syne,sans-serif" font-size="10" font-weight="800" fill="var(--text)">$${(total/1e6).toFixed(1)}M</text>
    <text x="${CX}" y="${CY+8}" text-anchor="middle" font-family="DM Mono,monospace" font-size="7" fill="var(--muted)">${opps.length} opps</text>
  </svg>`;

  // ── Account table ──
  const acctRows = acctEntries.map(([acct, val], i) => {
    const sc   = SLICE_COLORS[i % SLICE_COLORS.length];
    const pct  = (val/total2*100).toFixed(0);
    const opp  = activeOpps.find(o => (o.account||o.name) === acct);
    const oppId = opp ? opp.id : null;
    const hasData = opp && (opp.revenue || opp.capex || opp.description);
    const dot  = hasData ? `<span style="font-size:7px;color:#a07fff;margin-left:2px">●</span>` : '';
    return `<div style="display:flex;align-items:center;gap:7px;padding:5px 0;border-bottom:1px solid rgba(26,47,74,0.3);cursor:${hasData?'default':'default'}"
      ${oppId ? `onmouseenter="showAccountTooltipById(event,${oppId})" onmouseleave="hideAccountTooltip()"` : ''}>
      <div style="width:8px;height:8px;border-radius:2px;background:${sc};flex-shrink:0"></div>
      <div style="flex:1;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${acct}${dot}</div>
      <div style="font-size:10px;font-weight:600;flex-shrink:0">$${(val/1e6).toFixed(2)}M</div>
      <div style="font-size:9px;color:var(--muted);min-width:28px;text-align:right">${pct}%</div>
    </div>`;
  }).join('');

  // ── Attainment buckets for this region ──
  const regionTarget  = (() => {
    let t = 0;
    if (APP.regionTargets && APP.regionTargets[regionName]) {
      Object.values(APP.regionTargets[regionName]).forEach(ind => {
        Object.values(ind).forEach(v => t += (v||0));
      });
    }
    return t;
  })();

  const rBooked     = opps.filter(o=>o.stage==='Closed Won').reduce((s,o)=>s+(o.value||0),0);
  const rBestCase   = opps.filter(o=>o.stage==='Negotiation').reduce((s,o)=>s+(o.value||0),0);
  const rCommit     = opps.filter(o=>o.stage==='Proposal Sent'&&(o.prob||0)>=50).reduce((s,o)=>s+(o.value||0),0);
  const rPipeline   = opps.filter(o=>!['Closed Won','Negotiation'].includes(o.stage)&&!(o.stage==='Proposal Sent'&&(o.prob||0)>=50)).reduce((s,o)=>s+(o.value||0),0);
  const rMax        = regionTarget > 0 ? regionTarget : total;

  const attBar = regionTarget > 0 || total > 0 ? `
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--muted);margin-bottom:4px">
        <span>Attainment vs ${regionTarget>0?'region target':'pipeline'}</span>
        ${regionTarget>0?`<span style="color:${color};font-weight:600">$${(regionTarget/1e6).toFixed(1)}M target</span>`:''}
      </div>
      <div style="display:flex;height:20px;border-radius:6px;overflow:hidden;background:var(--border);position:relative">
        ${rBooked>0?`<div style="width:${Math.min(rBooked/rMax*100,100).toFixed(1)}%;background:#00e5a0;display:flex;align-items:center;justify-content:center;min-width:2px">
          ${rBooked/rMax>0.1?`<span style="font-size:8px;font-weight:700;color:#000">$${(rBooked/1e6).toFixed(1)}M</span>`:''}
        </div>`:''}
        ${rBestCase>0?`<div style="width:${Math.min(rBestCase/rMax*100,100).toFixed(1)}%;background:#ffc542;opacity:0.9;display:flex;align-items:center;justify-content:center;min-width:2px">
          ${rBestCase/rMax>0.1?`<span style="font-size:8px;font-weight:700;color:#000">$${(rBestCase/1e6).toFixed(1)}M</span>`:''}
        </div>`:''}
        ${rCommit>0?`<div style="width:${Math.min(rCommit/rMax*100,100).toFixed(1)}%;background:#7b2fff;opacity:0.85;min-width:2px"></div>`:''}
        ${rPipeline>0?`<div style="width:${Math.min(rPipeline/rMax*100,100).toFixed(1)}%;background:#00c8ff;opacity:0.35;min-width:2px"></div>`:''}
        ${regionTarget>0?`<div style="position:absolute;right:0;top:0;bottom:0;width:2px;background:#ffd700;opacity:0.8"></div>`:''}
      </div>
      <div style="display:flex;gap:8px;margin-top:5px;flex-wrap:wrap">
        ${rBooked>0?`<div style="display:flex;align-items:center;gap:3px;font-size:9px"><div style="width:7px;height:7px;border-radius:1px;background:#00e5a0"></div><span style="color:var(--muted)">Booked $${(rBooked/1e6).toFixed(2)}M</span></div>`:''}
        ${rBestCase>0?`<div style="display:flex;align-items:center;gap:3px;font-size:9px"><div style="width:7px;height:7px;border-radius:1px;background:#ffc542"></div><span style="color:var(--muted)">Negotiation $${(rBestCase/1e6).toFixed(2)}M</span></div>`:''}
        ${rCommit>0?`<div style="display:flex;align-items:center;gap:3px;font-size:9px"><div style="width:7px;height:7px;border-radius:1px;background:#7b2fff"></div><span style="color:var(--muted)">Commit $${(rCommit/1e6).toFixed(2)}M</span></div>`:''}
        ${rPipeline>0?`<div style="display:flex;align-items:center;gap:3px;font-size:9px"><div style="width:7px;height:7px;border-radius:1px;background:#00c8ff;opacity:0.5"></div><span style="color:var(--muted)">Pipeline $${(rPipeline/1e6).toFixed(2)}M</span></div>`:''}
      </div>
    </div>` : '';

  return `
    <div>
      <!-- Attainment bar -->
      ${attBar}
      <!-- Donut + accounts -->
      <div style="display:flex;gap:12px;align-items:flex-start">
        ${donutSVG}
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <div>
              <div style="font-family:'Syne',sans-serif;font-size:15px;font-weight:800;color:${color}">$${(total/1e6).toFixed(2)}M</div>
              <div style="font-size:9px;color:var(--muted)">fcst $${(fcst/1e6).toFixed(2)}M · ${opps.length} opps</div>
            </div>
          </div>
          <div style="max-height:140px;overflow-y:auto">${acctRows}</div>
        </div>
      </div>
    </div>`;
}

// ══════════════════════════════════════════════════════
//  CONFIG: OPPORTUNITIES
// ══════════════════════════════════════════════════════
function renderOppTable() {
  const tbody = document.getElementById('oppTableBody');
  const stages = ['Prospect','Qualification','Proposal Sent','Negotiation','Closed Won','Closed Lost'];
  tbody.innerHTML = APP.opportunities.map((o,i) => `
    <tr data-id="${o.id}">
      <td style="text-align:center">
        <select class="cfg-select" onchange="APP.opportunities[${i}].priority=this.value;save('opportunities',APP.opportunities)" style="width:90px;font-size:10px;padding:4px 6px">
          <option value="normal" ${(o.priority||'normal')==='normal'?'selected':''}>Normal</option>
          <option value="high"   ${o.priority==='high'?'selected':''}>🔥 High</option>
          <option value="must_win" ${o.priority==='must_win'?'selected':''}>⭐ Must Win</option>
        </select>
      </td>
      <td><input class="cfg-input" value="${o.name}" onchange="APP.opportunities[${i}].name=this.value" style="width:180px"></td>
      <td><input class="cfg-input" value="${o.account||''}" onchange="APP.opportunities[${i}].account=this.value" style="width:140px" placeholder="Account name"></td>
      <td><select class="cfg-select" onchange="APP.opportunities[${i}].domain=this.value" style="width:130px">
        ${['Enterprise','Service Providers','Security','Service Assurance'].map(d=>`<option ${o.domain===d?'selected':''}>${d}</option>`).join('')}
      </select></td>
      <td><select class="cfg-select" onchange="APP.opportunities[${i}].region=this.value" style="width:100px">
        ${APP.regions.map(r=>`<option ${o.region===r.name?'selected':''}>${r.name}</option>`).join('')}
      </select></td>
      <td><input class="cfg-input" type="number" value="${o.value}" onchange="APP.opportunities[${i}].value=+this.value" style="width:90px"></td>
      <td><select class="cfg-select" onchange="APP.opportunities[${i}].stage=this.value" style="width:130px">
        ${stages.map(s=>`<option ${o.stage===s?'selected':''}>${s}</option>`).join('')}
      </select></td>
      <td><input class="cfg-input" value="${o.close}" onchange="APP.opportunities[${i}].close=this.value" style="width:90px" placeholder="2025-06"></td>
      <td><input class="cfg-input" type="number" min="0" max="100" value="${o.prob}" onchange="APP.opportunities[${i}].prob=+this.value" style="width:55px"></td>
      <td>
        <input class="cfg-input" value="${o.product||''}" onchange="APP.opportunities[${i}].product=this.value" style="width:130px" placeholder="nGeniusONE, Arbor…" title="${o.product||''}">
        ${o.productLines?.length>1?`<div style="font-size:8px;color:#a07fff;margin-top:2px">${o.productLines.length} SKUs</div>`:''}
      </td>
      <td><input class="cfg-input" value="${o.industry||''}" onchange="APP.opportunities[${i}].industry=this.value" style="width:110px" placeholder="Enterprise, SP…"></td>
      <td><input class="cfg-input" value="${o.partner||''}" onchange="APP.opportunities[${i}].partner=this.value" style="width:110px" placeholder="e.g. Ericsson, Nokia…"></td>
      <td><input class="cfg-input" type="number" value="${o.revenue||''}" onchange="APP.opportunities[${i}].revenue=+this.value||null" style="width:90px" placeholder="e.g. 1200" title="${o.revenueNote||''}"></td>
      <td><input class="cfg-input" type="number" value="${o.capex||''}" onchange="APP.opportunities[${i}].capex=+this.value||null" style="width:80px" placeholder="e.g. 300"></td>
      <td><button onclick="enrichOpp(${i})" style="background:rgba(123,47,255,0.12);border:1px solid rgba(123,47,255,0.3);color:#a07fff;border-radius:7px;padding:4px 8px;cursor:pointer;font-size:10px" title="AI Enrich">✦ AI</button></td>
      <td><button class="cfg-btn danger" onclick="deleteOpp(${o.id})">✕</button></td>
    </tr>`).join('');
}

function addOppRow() {
  const newId = Date.now();
  APP.opportunities.push({ id:newId, name:'New Opportunity', account:'', domain:'Enterprise', region: APP.regions[0]?.name||'Morocco', value:100000, stage:'Prospect', close:'2025-12', prob:20, product:'', industry:'', partner:'', activityLog:[] });
  renderOppTable();
  document.getElementById('oppTableBody').lastElementChild?.scrollIntoView({behavior:'smooth'});
}

function deleteOpp(id) {
  APP.opportunities = APP.opportunities.filter(o=>o.id!==id);
  renderOppTable();
}

function saveOpportunities() {
  save('opportunities', APP.opportunities);
  const t = document.getElementById('oppSavedToast');
  t.style.opacity='1'; setTimeout(()=>t.style.opacity='0',2500);
}

// ══════════════════════════════════════════════════════
//  CONFIG: REGIONS & TARGETS
// ══════════════════════════════════════════════════════
function renderRegionsConfig() {
  if (!APP.regionTargets) APP.regionTargets = DEFAULTS.regionTargets;

  const container = document.getElementById('regionsConfigContainer');
  if (!container) return;

  const INDUSTRIES = ['Service Provider', 'Enterprise'];
  const DOMAINS    = {
    'Service Provider': ['Service Assurance', 'Security'],
    'Enterprise':       ['Service Assurance', 'Security'],
  };
  const DOM_C = { 'Service Assurance':'#ffc542', 'Security':'#ff6b35' };
  const IND_C = { 'Service Provider':'#00e5a0',  'Enterprise':'#00c8ff' };

  // ── Annual summary ──
  let grandTotal = 0;
  APP.regions.filter(r=>r.active).forEach(r => {
    const rt = APP.regionTargets[r.name] || {};
    INDUSTRIES.forEach(ind => {
      const it = rt[ind] || {};
      Object.values(it).forEach(v => grandTotal += (v||0));
    });
  });

  container.innerHTML = `
    <!-- OVERALL ANNUAL TARGET (configurable) -->
    <div class="cfg-card" style="border-left:3px solid var(--accent);margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px">
        <div>
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.14em;color:var(--muted);margin-bottom:6px">Overall Annual Target (USD)</div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:18px;color:var(--muted);font-weight:300">$</span>
            <input id="annualTargetInput" class="cfg-input"
              style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--accent);width:180px;background:transparent;border-color:var(--border)"
              value="${(APP.annualTarget||0).toLocaleString()}"
              onchange="APP.annualTarget=parseInt(this.value.replace(/[^0-9]/g,''))||0;renderRegionsConfig()"
              placeholder="e.g. 8000000">
          </div>
          <div style="font-size:10px;color:var(--muted);margin-top:4px">
            Region targets sum: <span style="color:${grandTotal>(APP.annualTarget||0)?'var(--accent2)':'var(--accent3)'}">$${(grandTotal/1e6).toFixed(2)}M</span>
            ${grandTotal>(APP.annualTarget||0)?'<span style="color:var(--accent2)"> ⚠ exceeds overall target</span>':grandTotal<(APP.annualTarget||0)?`<span style="color:var(--muted)"> · $${((APP.annualTarget||0)-grandTotal)/1e6>0?'$'+((APP.annualTarget-grandTotal)/1e6).toFixed(2)+'M unallocated':''}</span>`:'<span style="color:var(--accent3)"> ✓ fully allocated</span>'}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.12em;color:var(--muted);margin-bottom:2px">By Industry</div>
          <div style="display:flex;gap:8px">
            ${INDUSTRIES.map(ind => {
              let indTotal = 0;
              APP.regions.filter(r=>r.active).forEach(r => {
                const it = (APP.regionTargets[r.name]||{})[ind] || {};
                Object.values(it).forEach(v => indTotal += (v||0));
              });
              const indPct = grandTotal>0?(indTotal/grandTotal*100).toFixed(0):0;
              return `<div style="background:${IND_C[ind]}10;border:1px solid ${IND_C[ind]}30;border-radius:8px;padding:8px 14px;text-align:center">
                <div style="font-size:13px;font-weight:700;color:${IND_C[ind]}">$${(indTotal/1e6).toFixed(1)}M</div>
                <div style="font-size:9px;color:var(--muted)">${ind}</div>
                <div style="font-size:9px;color:${IND_C[ind]};opacity:0.7">${indPct}%</div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>
      <!-- Allocation progress bar -->
      <div style="margin-top:14px">
        <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--muted);margin-bottom:4px">
          <span>Target allocation progress</span>
          <span>${APP.annualTarget>0?Math.min(100,(grandTotal/(APP.annualTarget||1)*100)).toFixed(0):0}% allocated</span>
        </div>
        <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden">
          <div style="width:${APP.annualTarget>0?Math.min(100,(grandTotal/(APP.annualTarget||1)*100)).toFixed(0):0}%;height:100%;background:var(--accent);border-radius:3px;transition:width 0.4s"></div>
        </div>
      </div>
    </div>

    <!-- REGION CARDS -->
    ${APP.regions.map((r,ri) => {
      if (!APP.regionTargets[r.name]) APP.regionTargets[r.name] = {};
      const rt = APP.regionTargets[r.name];

      // Region total
      let regTotal = 0;
      INDUSTRIES.forEach(ind => { const it=rt[ind]||{}; Object.values(it).forEach(v=>regTotal+=(v||0)); });

      // Pipeline for this region
      const pipeline = APP.opportunities
        .filter(o=>o.stage!=='Closed Lost'&&o.region===r.name)
        .reduce((s,o)=>s+(o.value||0),0);
      const pct = regTotal>0 ? Math.min(100,(pipeline/regTotal*100)).toFixed(0) : 0;
      const pc  = pct>=70?'var(--accent3)':pct>=40?'var(--accent4)':'var(--accent2)';

      const industryRows = INDUSTRIES.map(ind => {
        if (!rt[ind]) rt[ind] = {};
        const indDomains = DOMAINS[ind] || [];
        let indTotal = 0;
        indDomains.forEach(d => indTotal += (rt[ind][d]||0));

        const domainInputs = indDomains.map(dom => {
          const val = rt[ind][dom] || 0;
          return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <div style="width:8px;height:8px;border-radius:2px;background:${DOM_C[dom]};flex-shrink:0"></div>
            <span style="font-size:10px;color:${DOM_C[dom]};min-width:120px">${dom}</span>
            <input type="number" class="cfg-input"
              style="width:110px;font-size:10px;padding:5px 8px"
              value="${val}"
              onchange="setRegionTarget('${r.name}','${ind}','${dom}',+this.value)"
              placeholder="0">
            <span style="font-size:9px;color:var(--muted)">$${(val/1000).toFixed(0)}K</span>
          </div>`;
        }).join('');

        return `<div style="background:${IND_C[ind]}06;border:1px solid ${IND_C[ind]}20;border-radius:8px;padding:12px 14px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="font-size:10px;font-weight:600;color:${IND_C[ind]}">${ind}</div>
            <div style="font-size:11px;font-weight:700;color:${IND_C[ind]}">$${(indTotal/1000).toFixed(0)}K</div>
          </div>
          ${domainInputs}
        </div>`;
      }).join('');

      return `<div class="cfg-card" style="border-top:3px solid ${r.color};margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:12px">
            <input type="color" value="${r.color}"
              onchange="APP.regions[${ri}].color=this.value;save('regions',APP.regions);renderRegionsConfig()"
              style="width:24px;height:24px;border:none;background:transparent;cursor:pointer;border-radius:4px">
            <input class="cfg-input" value="${r.name}"
              onchange="renameRegion(${ri},this.value)"
              style="font-family:'Syne',sans-serif;font-size:13px;font-weight:700;width:140px;background:transparent;border-color:transparent;padding:4px 6px"
              onmouseover="this.style.borderColor='var(--border)'"
              onmouseout="this.style.borderColor='transparent'">
            <label class="toggle" title="${r.active?'Active':'Inactive'}">
              <input type="checkbox" ${r.active?'checked':''} onchange="APP.regions[${ri}].active=this.checked;save('regions',APP.regions);renderRegionsConfig()">
              <div class="toggle-slider"></div>
            </label>
          </div>
          <div style="text-align:right">
            <div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:800">$${(regTotal/1e6).toFixed(2)}M</div>
            <div style="font-size:9px;color:var(--muted)">annual target</div>
            <div style="font-size:10px;color:${pc};margin-top:2px">Pipeline: $${(pipeline/1e6).toFixed(2)}M · ${pct}%</div>
          </div>
        </div>
        ${r.active ? industryRows : '<div style="font-size:10px;color:var(--muted);text-align:center;padding:10px">Region inactive — toggle on to set targets</div>'}
        <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden;margin-top:8px">
          <div style="width:${pct}%;height:100%;background:${r.color};border-radius:2px;transition:width 0.4s"></div>
        </div>
      </div>`;
    }).join('')}

    <!-- ADD REGION -->
    <button class="cfg-btn add" onclick="addRegion()" style="width:100%">＋ Add Region</button>
  `;
}

function setRegionTarget(region, industry, domain, value) {
  if (!APP.regionTargets) APP.regionTargets = {};
  if (!APP.regionTargets[region]) APP.regionTargets[region] = {};
  if (!APP.regionTargets[region][industry]) APP.regionTargets[region][industry] = {};
  APP.regionTargets[region][industry][domain] = value;
  // Update grand total display without full re-render
  renderRegionsConfig();
}

function renameRegion(idx, newName) {
  const oldName = APP.regions[idx].name;
  APP.regions[idx].name = newName;
  // Migrate regionTargets key
  if (APP.regionTargets && APP.regionTargets[oldName]) {
    APP.regionTargets[newName] = APP.regionTargets[oldName];
    delete APP.regionTargets[oldName];
  }
}

function addRegion() {
  const newName = 'New Region';
  APP.regions.push({ id:Date.now(), name:newName, active:true, color:'#7b2fff' });
  if (!APP.regionTargets) APP.regionTargets = {};
  APP.regionTargets[newName] = {};
  renderRegionsConfig();
}

function saveRegionsTargets() {
  save('regions',       APP.regions);
  save('targets',       APP.targets);
  save('regionTargets', APP.regionTargets);
  const newAT = parseInt(document.getElementById('annualTargetInput')?.value?.replace(/[^0-9]/g,'') || APP.annualTarget);
  if (!isNaN(newAT) && newAT > 0) { APP.annualTarget = newAT; save('annualTarget', newAT); }
  const t = document.getElementById('regSavedToast');
  t.style.opacity='1'; setTimeout(()=>t.style.opacity='0',2500);
}

// ══════════════════════════════════════════════════════
//  CONFIG: PROFILE
// ══════════════════════════════════════════════════════
function loadProfileForm() {
  document.getElementById('cfgName').value      = APP.profile.name||'';
  document.getElementById('cfgRole').value      = APP.profile.role||'';
  document.getElementById('cfgTerritory').value = APP.profile.territory||'';
  document.getElementById('cfgCompany').value   = APP.profile.company||'';
}

function saveProfile() {
  APP.profile.name      = document.getElementById('cfgName').value;
  APP.profile.role      = document.getElementById('cfgRole').value;
  APP.profile.territory = document.getElementById('cfgTerritory').value;
  APP.profile.company   = document.getElementById('cfgCompany').value;
  save('profile', APP.profile);
  applyProfile();
  const t = document.getElementById('profileSavedToast');
  t.style.opacity='1'; setTimeout(()=>t.style.opacity='0',2500);
}

function applyProfile() {
  const p = APP.profile;
  document.getElementById('userNameDisplay').textContent = p.name||'Sales Manager';
  document.getElementById('userRoleDisplay').textContent = p.territory||'North Africa';
  const initials = (p.name||'SM').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('userInitials').textContent = initials;
}

// ══════════════════════════════════════════════════════
//  DAILY ACTIONS
// ══════════════════════════════════════════════════════
const ATYPE={email:{i:'📧',c:'#00c8ff'},proposal:{i:'📄',c:'#7b2fff'},call:{i:'📞',c:'#00e5a0'},poc:{i:'🧪',c:'#ffc542'},meeting:{i:'🤝',c:'#ff6b35'},followup:{i:'🔁',c:'#5a7a99'},demo:{i:'🖥',c:'#00c8ff'}};
let selActId = null;

async function generateDailyActions() {
  const btn = document.getElementById('genActBtn2');
  btn.disabled=true; btn.textContent='⏳ Generating…';
  document.getElementById('actSidebar2').innerHTML='<div style="text-align:center;padding:40px 10px;color:var(--muted);font-size:11px"><div style="width:28px;height:28px;border:2px solid var(--border);border-top-color:var(--accent4);border-radius:50%;animation:spin 0.9s linear infinite;margin:0 auto 12px"></div>Analysing pipeline…</div>';

  const mCtx = APP.meetings.slice(0,6).map(m=>`${m.opp}|${m.date}|${m.type}|${m.sentiment}|${m.notes.slice(0,150)}`).join('\n')||'No meetings yet';
  const oCtx = APP.opportunities.map(o=>`${o.name}|$${o.value}|${o.domain}|${o.region}|${o.stage}|${o.close}`).join('\n');
  const today = new Date().toISOString().split('T')[0];

  const prompt=`Sales coach for NETSCOUT Africa. Today: ${today}. Rep: ${APP.profile.name} covering ${APP.profile.territory}.
PIPELINE:\n${oCtx}\nMEETINGS:\n${mCtx}
Generate 9-11 daily actions. Include: emails, MoM, proposals, POC use cases, calls, demos.
JSON only: {"actions":[{"id":"a1","type":"email|proposal|call|poc|meeting|followup|demo","title":"max 8 words","opportunity":"name","due":"today|tomorrow|this_week|overdue","priority":"high|medium|low","why":"1 sentence","template":"ready-to-use email/message/MoM/talking points specific to NETSCOUT and account (3-6 sentences)","checklist":["step1","step2","step3"]}]}`;

  try {
    const res=await fetch('/api/claude',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1000,messages:[{role:'user',content:prompt}]})});
    const data=await res.json();
    const raw=data.content.map(b=>b.text||'').join('');
    const parsed=safeParseJSON(raw);
    const done=new Set(APP.actions.filter(a=>a.done).map(a=>a.id));
    APP.actions=parsed.actions.map(a=>({...a,done:done.has(a.id)}));
    save('actions',APP.actions);
    renderActSidebar(); updateActionsBadge();
  } catch(e){
    document.getElementById('actSidebar2').innerHTML=`<div style="padding:16px;color:#ff6b35;font-size:11px">⚠ ${e.message}</div>`;
  } finally { btn.disabled=false; btn.textContent='⚡ Regenerate'; }
}

function renderActSidebar() {
  const el=document.getElementById('actSidebar2');
  if (!APP.actions.length){el.innerHTML='<div style="text-align:center;padding:30px;color:var(--muted);font-size:11px">No actions</div>';return;}
  const pending=APP.actions.filter(a=>!a.done);
  el.innerHTML=`<div style="font-size:9px;text-transform:uppercase;letter-spacing:0.12em;color:var(--muted);margin-bottom:10px">${pending.length} pending</div>`+
    APP.actions.map(a=>{
      const t=ATYPE[a.type]||ATYPE.followup;
      const dueC={today:'#ff6b35',tomorrow:'#ffc542',this_week:'#00e5a0',overdue:'#ff4444'}[a.due]||'#5a7a99';
      const dueL={today:'Today',tomorrow:'Tomorrow',this_week:'This Week',overdue:'Overdue'}[a.due]||a.due;
      return `<div onclick="selectAct('${a.id}')" style="border:1px solid ${selActId===a.id?t.c:'var(--border)'};border-radius:10px;padding:10px 12px;margin-bottom:6px;background:${selActId===a.id?t.c+'08':'var(--surface2)'};cursor:pointer;transition:all 0.15s;opacity:${a.done?0.4:1}">
        <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px">
          <div style="width:24px;height:24px;border-radius:6px;background:${t.c}18;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0">${t.i}</div>
          <div style="flex:1;min-width:0"><div style="font-size:10px;font-weight:500;line-height:1.3;margin-bottom:1px">${a.title}</div><div style="font-size:9px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.opportunity}</div></div>
          <div onclick="toggleAct(event,'${a.id}')" style="width:16px;height:16px;border:1.5px solid ${a.done?'var(--accent3)':'var(--border)'};border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;background:${a.done?'var(--accent3)':'transparent'};font-size:9px;color:#000;flex-shrink:0;margin-top:1px">${a.done?'✓':''}</div>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="font-size:8px;padding:2px 7px;border-radius:6px;color:${dueC};background:${dueC}18;border:1px solid ${dueC}30">${dueL}</span>
          <span style="font-size:8px;color:var(--muted);text-transform:uppercase">${a.priority}</span>
        </div>
      </div>`;
    }).join('');
}

function selectAct(id) {
  selActId=id;
  const a=APP.actions.find(x=>x.id===id); if(!a) return;
  const t=ATYPE[a.type]||ATYPE.followup;
  renderActSidebar();
  document.getElementById('actDetail2').innerHTML=`
    <div style="padding:4px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;padding-bottom:16px;border-bottom:1px solid var(--border)">
        <div>
          <div style="display:inline-flex;align-items:center;gap:5px;font-size:9px;padding:3px 10px;border-radius:16px;border:1px solid ${t.c}40;color:${t.c};background:${t.c}10;margin-bottom:7px">${t.i} ${a.type}</div>
          <div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:800;margin-bottom:3px">${a.title}</div>
          <div style="font-size:11px;color:var(--muted)">${a.opportunity}</div>
        </div>
        <button onclick="toggleAct(event,'${a.id}');selectAct('${a.id}')" style="background:${a.done?'var(--surface2)':'var(--accent3)'};color:${a.done?'var(--muted)':'#000'};border:${a.done?'1px solid var(--border)':'none'};border-radius:9px;padding:7px 16px;font-family:'Syne',sans-serif;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">${a.done?'↩ Reopen':'✓ Mark Done'}</button>
      </div>
      <div style="margin-bottom:16px">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.13em;color:var(--muted);margin-bottom:7px;display:flex;align-items:center;gap:8px">Why Now<span style="flex:1;height:1px;background:var(--border)"></span></div>
        <div style="font-size:12px;line-height:1.7">${a.why}</div>
      </div>
      <div style="margin-bottom:16px">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.13em;color:var(--muted);margin-bottom:7px;display:flex;align-items:center;gap:8px">Template<span style="flex:1;height:1px;background:var(--border)"></span></div>
        <div style="background:var(--surface2);border:1px solid var(--border);border-left:3px solid var(--accent4);border-radius:0 10px 10px 0;padding:14px 16px;font-size:11px;line-height:1.75;white-space:pre-wrap">${a.template}</div>
        <button onclick="navigator.clipboard.writeText(APP.actions.find(x=>x.id==='${a.id}').template).then(()=>showMsg('Copied!'))" style="margin-top:8px;background:transparent;border:1px solid var(--border);color:var(--muted);border-radius:7px;padding:5px 12px;font-family:'DM Mono',monospace;font-size:9px;cursor:pointer">📋 Copy</button>
      </div>
      <div>
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.13em;color:var(--muted);margin-bottom:7px;display:flex;align-items:center;gap:8px">Checklist<span style="flex:1;height:1px;background:var(--border)"></span></div>
        ${(a.checklist||[]).map(s=>`<div style="display:flex;gap:8px;margin-bottom:7px;font-size:11px;line-height:1.4"><div style="width:6px;height:6px;border-radius:50%;background:var(--accent4);flex-shrink:0;margin-top:5px"></div>${s}</div>`).join('')}
      </div>
    </div>`;
}

function toggleAct(e,id) {
  e.stopPropagation();
  const a=APP.actions.find(x=>x.id===id); if(a) a.done=!a.done;
  save('actions',APP.actions);
  renderActSidebar(); updateActionsBadge();
}

function updateActionsBadge() {
  const n=APP.actions.filter(a=>!a.done&&(a.due==='today'||a.due==='overdue')).length;
  const b=document.getElementById('actionsBadge');
  if(n>0){b.textContent=n;b.style.display='flex';}else{b.style.display='none';}
}

// ══════════════════════════════════════════════════════
//  AI STRATEGY (reuse from page)
// ══════════════════════════════════════════════════════
function populateStrategyForm() {
  const sel = document.getElementById('aiOppSelect');
  if (!sel) return;

  // Only show ACTIVE opportunities (not Closed Lost / Closed Won)
  const activeOpps = APP.opportunities.filter(o =>
    o.stage !== 'Closed Lost' && o.stage !== 'Closed Won'
  );

  const DOM_C = {
    'Service Assurance':'#ffc542','Security':'#ff6b35',
    'Service Assurance/Security':'#ff9f35','Enterprise':'#00c8ff',
    'Service Providers':'#00e5a0',
  };

  sel.innerHTML = '<option value="">— Select an active opportunity —</option>' +
    activeOpps
      .sort((a,b) => (b.value||0) - (a.value||0))
      .map(o => {
        const prob = o.prob || 0;
        const flag = prob >= 70 ? '🟢' : prob >= 40 ? '🟡' : '🔴';
        const acct = o.account ? o.account + ' · ' : '';
        return `<option value="${o.id}">${flag} ${acct}${o.name} — $${((o.value||0)/1000).toFixed(0)}K</option>`;
      }).join('');

  // Clear summary
  document.getElementById('aiOppSummary').style.display = 'none';
  document.getElementById('aiOutput').innerHTML = '';
  document.getElementById('aiCompetitor').value = '';
  document.getElementById('aiStakeholder').value = '';
  document.getElementById('aiContext').value = '';
}

function onStrategyOppSelect() {
  const sel   = document.getElementById('aiOppSelect');
  const oppId = parseInt(sel.value);
  const opp   = APP.opportunities.find(o => o.id === oppId);

  if (!opp) {
    document.getElementById('aiOppSummary').style.display = 'none';
    return;
  }

  const DOM_C = {
    'Service Assurance':'#ffc542','Security':'#ff6b35',
    'Service Assurance/Security':'#ff9f35','Enterprise':'#00c8ff',
    'Service Providers':'#00e5a0',
  };
  const pc = (opp.prob||0)>=70?'#00e5a0':(opp.prob||0)>=40?'#ffc542':'#ff6b35';
  const dc = DOM_C[opp.domain] || '#5a7a99';

  // Fill summary card
  document.getElementById('aiSumAccount').textContent  = opp.account || opp.name;
  document.getElementById('aiSumDomain').innerHTML     = `<span style="color:${dc}">${opp.domain||'—'}</span>`;
  document.getElementById('aiSumStage').textContent    = opp.stage || '—';
  document.getElementById('aiSumValue').textContent    = opp.value ? '$'+((opp.value)/1000).toFixed(0)+'K' : '—';
  document.getElementById('aiSumIndustry').textContent = opp.industry || '—';
  document.getElementById('aiSumRegion').textContent   = opp.region || '—';
  document.getElementById('aiSumProb').innerHTML       = `<span style="color:${pc};font-weight:600">${opp.prob||0}%</span>`;
  document.getElementById('aiSumProduct').textContent  = opp.product || '—';

  // Last activity
  const lastAct = getLastActivity(opp);
  const lastActEl = document.getElementById('aiSumLastAct');
  if (lastAct) {
    const days = getDaysAgo(lastAct.date);
    const daysStr = days===0?'Today':days===1?'Yesterday':days+' days ago';
    const dc2 = days>30?'var(--accent2)':days>7?'var(--accent4)':'var(--accent3)';
    lastActEl.innerHTML = `Last activity: <span style="color:${dc2}">${daysStr}</span> · ${lastAct.type} · ${lastAct.note.slice(0,80)}${lastAct.note.length>80?'…':''}`;
  } else {
    lastActEl.innerHTML = '<span style="color:var(--accent2)">⚠ No activity logged yet</span>';
  }

  // Pre-fill competitor and context from opp data + activity log
  document.getElementById('aiCompetitor').value = '';

  // Build context from recent activity log
  const recentActs = (opp.activityLog||[])
    .sort((a,b) => (b.date||'') > (a.date||'') ? 1 : -1)
    .slice(0,3)
    .map(a => `[${a.date}] ${a.type}: ${a.note}`)
    .join('\n');
  if (recentActs && !document.getElementById('aiContext').value) {
    document.getElementById('aiContext').value = recentActs;
  }

  // Fill hidden fields for generateStrategy
  document.getElementById('aiOpp').value    = opp.name;
  document.getElementById('aiAcct').value   = opp.account || opp.name;
  document.getElementById('aiValue').value  = opp.value ? '$'+opp.value.toFixed(0) : '';
  document.getElementById('aiStage').value  = opp.stage || '';
  document.getElementById('aiDomain').value = opp.domain || '';
  document.getElementById('aiRegion').value = opp.region || '';

  document.getElementById('aiOppSummary').style.display = 'block';
  document.getElementById('aiOutput').innerHTML = '';
}

async function generateStrategy() {
  const opp=document.getElementById('aiOpp').value.trim();
  const acct=document.getElementById('aiAcct').value.trim();
  if(!opp){showMsg('Please select an opportunity first.');return;}
  const btn=document.getElementById('aiGenBtn');
  btn.disabled=true; btn.textContent='Generating…';
  const out=document.getElementById('aiOutput');
  out.innerHTML='<div style="display:flex;align-items:center;gap:12px;padding:20px;color:var(--muted);font-size:12px"><div style="width:20px;height:20px;border:2px solid var(--border);border-top-color:#7b2fff;border-radius:50%;animation:spin 0.8s linear infinite"></div>Analysing opportunity…</div>';

  const prompt=`Senior NETSCOUT sales strategist, North Africa specialist.
OPPORTUNITY: ${document.getElementById('aiOpp').value}
ACCOUNT: ${acct}
DOMAIN: ${document.getElementById('aiDomain').value}
REGION: ${document.getElementById('aiRegion').value}
VALUE: ${document.getElementById('aiValue').value||'not specified'}
STAGE: ${document.getElementById('aiStage').value}
CONTEXT: ${document.getElementById('aiContext').value||'none'}
Return ONLY JSON: {"executiveSummary":"","winThemes":["","",""],"risks":["",""],"actionPlan":[{"week":"Week 1-2","action":"","owner":"","priority":"high|medium|low"}],"stakeholders":[{"role":"","concern":"","approach":""}],"competitiveEdge":"","closingProbability":70,"recommendedNextStep":""}`;

  try {
    const res=await fetch('/api/claude',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1000,messages:[{role:'user',content:prompt}]})});
    const data=await res.json();
    const s=safeParseJSON(data.content.map(b=>b.text||'').join(''));
    const prob=s.closingProbability||60;
    const pc=prob>=70?'#00e5a0':prob>=50?'#ffc542':'#ff6b35';
    const pc_map={high:'#ff6b35',medium:'#ffc542',low:'#00e5a0'};

    // Auto-save to strategy library
    const stratEntry = {
      id:       Date.now(),
      date:     new Date().toISOString().split('T')[0],
      opp:      opp,
      acct:     acct,
      domain:   document.getElementById('aiDomain').value,
      region:   document.getElementById('aiRegion').value,
      stage:    document.getElementById('aiStage').value,
      value:    document.getElementById('aiValue').value,
      strategy: s,
    };
    APP.strategies.unshift(stratEntry);
    if (APP.strategies.length > 50) APP.strategies = APP.strategies.slice(0,50); // keep last 50
    save('strategies', APP.strategies);
    updateStratBadge();

    out.innerHTML=`<div style="background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:22px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
        <div>
          <div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:800;margin-bottom:4px">${opp}</div>
          <div style="font-size:11px;color:var(--muted)">${acct}</div>
          <div style="margin-top:6px;display:inline-flex;align-items:center;gap:5px;font-size:9px;padding:2px 10px;border-radius:10px;background:rgba(123,47,255,0.1);border:1px solid rgba(123,47,255,0.25);color:#a07fff">
            📚 Saved to Strategy Library
          </div>
        </div>
        <div style="text-align:center;border:2px solid ${pc};border-radius:50%;width:60px;height:60px;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 0 14px ${pc}40">
          <div style="font-family:'Syne',sans-serif;font-size:17px;font-weight:800;color:${pc}">${prob}%</div>
          <div style="font-size:8px;color:var(--muted)">WIN</div>
        </div>
      </div>
      <div style="background:rgba(0,229,160,0.06);border:1px solid rgba(0,229,160,0.2);border-left:3px solid var(--accent3);border-radius:0 9px 9px 0;padding:11px 14px;font-size:12px;color:var(--accent3);margin-bottom:16px">→ ${s.recommendedNextStep}</div>
      <div style="font-size:11px;line-height:1.7;margin-bottom:18px">${s.executiveSummary}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px">
        <div><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.13em;color:var(--muted);margin-bottom:8px">Win Themes</div>${s.winThemes.map(t=>`<div style="font-size:10px;padding:4px 10px;border-radius:8px;background:rgba(0,200,255,0.06);border:1px solid rgba(0,200,255,0.18);color:var(--accent);margin-bottom:5px">${t}</div>`).join('')}</div>
        <div><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.13em;color:var(--muted);margin-bottom:8px">Risks</div>${s.risks.map(r=>`<div style="font-size:10px;padding:4px 10px;border-radius:8px;background:rgba(255,107,53,0.06);border:1px solid rgba(255,107,53,0.18);color:var(--accent2);margin-bottom:5px">⚠ ${r}</div>`).join('')}</div>
      </div>
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.13em;color:var(--muted);margin-bottom:10px">8-Week Action Plan</div>
      ${s.actionPlan.map(a=>`<div style="display:flex;gap:10px;align-items:flex-start;background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:10px 14px;margin-bottom:6px">
        <div style="font-size:9px;color:var(--muted);white-space:nowrap;min-width:70px;padding-top:1px">${a.week}</div>
        <div style="flex:1"><div style="font-size:11px;line-height:1.4;margin-bottom:2px">${a.action}</div><div style="font-size:9px;color:var(--muted)">👤 ${a.owner}</div></div>
        <div style="font-size:8px;text-transform:uppercase;padding:2px 8px;border-radius:8px;color:${pc_map[a.priority]||'#5a7a99'};background:${pc_map[a.priority]||'#5a7a99'}15;border:1px solid ${pc_map[a.priority]||'#5a7a99'}30">${a.priority}</div>
      </div>`).join('')}
      <div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div style="padding:12px 16px;background:rgba(0,200,255,0.05);border:1px solid rgba(0,200,255,0.15);border-radius:9px">
          <div style="font-size:8px;text-transform:uppercase;letter-spacing:0.13em;color:var(--muted);margin-bottom:5px">Target Buyer Persona</div>
          <div style="font-size:11px;color:var(--accent)">👤 ${s.buyerPersona||'—'}</div>
        </div>
        <div style="padding:12px 16px;background:rgba(255,107,53,0.05);border:1px solid rgba(255,107,53,0.15);border-radius:9px">
          <div style="font-size:8px;text-transform:uppercase;letter-spacing:0.13em;color:var(--muted);margin-bottom:5px">Key Pain Point</div>
          <div style="font-size:11px;color:var(--accent2)">⚡ ${s.keyPainPoint||'—'}</div>
        </div>
      </div>
      <div style="margin-top:10px;padding:13px 16px;background:rgba(255,197,66,0.06);border:1px solid rgba(255,197,66,0.2);border-radius:9px;font-size:11px;line-height:1.6">🏆 ${s.competitiveEdge}</div>
    </div>`;
  } catch(e) {
    out.innerHTML=`<div style="color:#ff6b35;font-size:11px;padding:16px">⚠ ${e.message}</div>`;
  } finally {
    btn.disabled=false; btn.textContent='✦ Generate Strategy';
  }
}

// ══════════════════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════════════════
function showMsg(msg) {
  let t=document.getElementById('globalToast');
  if(!t){t=document.createElement('div');t.id='globalToast';t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#0d1624;border:1px solid var(--accent);color:var(--accent);padding:9px 20px;border-radius:20px;font-size:11px;z-index:9999;font-family:DM Mono,monospace;box-shadow:0 4px 20px rgba(0,0,0,0.4)';document.body.appendChild(t);}
  t.textContent=msg;t.style.opacity='1';
  setTimeout(()=>t.style.opacity='0',2500);
}


// ══════════════════════════════════════════════════════
//  SALESFORCE CSV IMPORT — TWO FILE VERSION
// ══════════════════════════════════════════════════════

const DEFAULT_MAPPING = {
  name:       'Opportunity Name',
  account:    'Account Name',
  domain:     'domain',
  industry:   'industry',
  region:     'Account Territory',
  value:      'Sales Potential',
  stage:      'Stage',
  close:      'Last Modified Date',
  prob:       'Probability (%)',
  status:     'Opportunity Status',
  partner:    'Partner',
};

let csvMapping     = {...DEFAULT_MAPPING};
let parsedCSVRows  = [];   // opportunities rows
let parsedProdRows = [];   // products rows
let csvHeaders     = [];
let prodHeaders    = [];

function renderSFDCPage() {
  renderFieldMapping();
  const lastSync = localStorage.getItem('ns_last_sync');
  if (lastSync) {
    document.getElementById('lastSyncBar').style.display   = 'flex';
    document.getElementById('lastSyncText').textContent    = 'Last synced: ' + new Date(+lastSync).toLocaleString();
    document.getElementById('lastImportDisplay').textContent = new Date(+lastSync).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
    document.getElementById('sfdcBadge').style.display = 'flex';
  }
}

// ── DRAG & DROP ──────────────────────────────────────
function handleDropOpp(e) {
  e.preventDefault();
  document.getElementById('dropZoneOpp').style.borderColor='var(--border2)';
  document.getElementById('dropZoneOpp').style.background='var(--surface)';
  const file = e.dataTransfer.files[0];
  if (file) loadOppCSV(file); else showMsg('Please drop a CSV file');
}
function handleDropProd(e) {
  e.preventDefault();
  document.getElementById('dropZoneProd').style.borderColor='var(--border2)';
  document.getElementById('dropZoneProd').style.background='var(--surface)';
  const file = e.dataTransfer.files[0];
  if (file) loadProdCSV(file); else showMsg('Please drop a CSV file');
}
function handleFileOpp(input)  { if(input.files[0]) loadOppCSV(input.files[0]); }
function handleFileProd(input) { if(input.files[0]) loadProdCSV(input.files[0]); }

// ── LOAD OPPORTUNITIES CSV ────────────────────────────
function loadOppCSV(file) {
  readCSV(file, (headers, rows) => {
    csvHeaders    = headers;
    parsedCSVRows = rows;
    autoDetectMapping(headers);
    renderFieldMapping(headers);
    const status = document.getElementById('oppFileStatus');
    status.textContent = '✓ ' + rows.length + ' rows loaded';
    status.style.color = 'var(--accent3)';
    document.getElementById('dropZoneOpp').style.borderColor = 'var(--accent3)';
    showMsg('✓ Opportunities file loaded — ' + rows.length + ' rows');
  });
}

// ── LOAD PRODUCTS CSV ─────────────────────────────────
// Expected columns (tab or comma separated):
// Account name | Opportunity name | Product | Product Description |
// Quantity | List Price | Discount | Total Price
function loadProdCSV(file) {
  readCSV(file, (headers, rows) => {
    prodHeaders    = headers;
    parsedProdRows = rows;

    // Find column indexes — case-insensitive, trimmed
    const norm    = s => (s||'').toLowerCase().replace(/\s+/g,' ').trim();
    const hNorm   = headers.map(norm);
    const colIdx  = key => hNorm.findIndex(h => h.includes(key));

    const oppCol   = colIdx('opportunity name');
    const prodCol  = colIdx('product description');  // use description for display
    const skuCol   = colIdx('product');              // product SKU code
    const qtyCol   = colIdx('quantity');
    const listCol  = colIdx('list price');
    const discCol  = colIdx('discount');
    const totalCol = colIdx('total price');

    if (oppCol < 0) {
      showMsg('⚠ Could not find "Opportunity name" column in products file');
      return;
    }

    const summary = {};

    rows.forEach(r => {
      const oppName = (r[oppCol]||'').trim();
      if (!oppName) return;

      const sku         = skuCol  >= 0 ? (r[skuCol]||'').trim()  : '';
      const description = prodCol >= 0 ? (r[prodCol]||'').trim() : sku;
      const qty         = qtyCol  >= 0 ? parseInt(r[qtyCol]||1)  : 1;
      const listPrice   = listCol >= 0 ? parseValue(r[listCol])  : 0;
      const discount    = discCol >= 0 ? parseDiscount(r[discCol]) : 0;
      const totalPrice  = totalCol>= 0 ? parseValue(r[totalCol]) : listPrice * (1 - discount) * qty;

      if (!summary[oppName]) {
        summary[oppName] = {
          skus:         [],
          descriptions: [],
          lines:        [],
          listTotal:    0,
          discTotal:    0,
          netTotal:     0,
        };
      }

      const s = summary[oppName];
      if (sku)         s.skus.push(sku);
      if (description) s.descriptions.push(description);
      s.lines.push({ sku, description, qty, listPrice, discount, totalPrice });
      s.listTotal += listPrice * qty;
      s.discTotal += listPrice * qty * discount;
      s.netTotal  += totalPrice;
    });

    window._productSummary = summary;

    const oppCount  = Object.keys(summary).length;
    const lineCount = rows.length;
    const status    = document.getElementById('prodFileStatus');
    status.textContent = `✓ ${lineCount} lines · ${oppCount} opps`;
    status.style.color = '#a07fff';
    document.getElementById('dropZoneProd').style.borderColor = '#a07fff';

    showMsg(`✓ Products loaded · ${lineCount} line items across ${oppCount} opportunities`);
  });
}

// Parse discount: "45.00%" → 0.45  |  "0.45" → 0.45  |  "45" → 0.45
function parseDiscount(raw) {
  const s = (raw||'').trim().replace('%','');
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return n > 1 ? n / 100 : n;
}

// ── READ CSV HELPER ───────────────────────────────────
function readCSV(file, callback) {
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split(/\r?\n/).filter(Boolean);
    if (!lines.length) { showMsg('Empty file'); return; }
    const delim   = lines[0].includes('\t') ? '\t' : ',';
    const headers = parseCSVLine(lines[0], delim);
    const rows    = lines.slice(1).map(l=>parseCSVLine(l,delim)).filter(r=>r.some(Boolean));
    callback(headers, rows);
  };
  reader.readAsText(file);
}

// ── RUN JOIN & IMPORT ─────────────────────────────────
function runImport() {
  if (!parsedCSVRows.length) { showMsg('Please load the Opportunities CSV first'); return; }
  const preview = parsedCSVRows.slice(0,12).map((r,i) => buildOpp(r,i));
  document.getElementById('previewTitle').textContent = `Preview — ${parsedCSVRows.length} opportunities · ${parsedProdRows.length} product lines`;
  document.getElementById('importPreview').style.display = 'block';

  const COLS = ['name','account','domain','region','value','stage','prob','product','totalPrice'];
  const table = document.getElementById('previewTable');
  table.innerHTML = `
    <thead><tr style="border-bottom:1px solid var(--border)">
      ${['Opportunity','Account','Domain','Industry','Territory','Value','Stage','Prob%','Products'].map(c=>`<th style="text-align:left;padding:6px 10px 8px;font-size:8px;text-transform:uppercase;letter-spacing:0.1em;color:var(--muted);white-space:nowrap">${c}</th>`).join('')}
    </tr></thead>
    <tbody>
      ${preview.map(o=>`<tr style="border-bottom:1px solid rgba(26,47,74,0.4)">
        <td style="padding:7px 10px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.name}</td>
        <td style="padding:7px 10px;color:var(--muted);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.account||'—'}</td>
        <td style="padding:7px 10px"><span style="color:${DOMAIN_COLORS[o.domain]||'#5a7a99'};font-size:10px">${o.domain}</span></td>
        <td style="padding:7px 10px">${o.region}</td>
        <td style="padding:7px 10px;color:var(--accent3)">$${(o.value/1000).toFixed(0)}K</td>
        <td style="padding:7px 10px">${o.stage}</td>
        <td style="padding:7px 10px">${o.prob}%</td>
        <td style="padding:7px 10px;color:#a07fff;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${o.product||''}">${o.product||'—'}</td>
        <td style="padding:7px 10px;color:var(--accent3)">${o.partner||'—'}</td>
      </tr>`).join('')}
      ${parsedCSVRows.length>12?`<tr><td colspan="9" style="padding:8px 10px;color:var(--muted);font-size:10px">… and ${parsedCSVRows.length-12} more rows</td></tr>`:''}
    </tbody>`;
}

// ── BUILD SINGLE OPP WITH JOINED PRODUCTS ────────────
function buildOpp(row, idx) {
  const statusRaw = getCol(row,'status',csvHeaders);
  const name      = getCol(row,'name',csvHeaders) || getCol(row,'account',csvHeaders) || `Opportunity ${idx+1}`;

  // Join products from product table using rich summary
  let product    = getCol(row,'product',csvHeaders);
  let totalPrice = 0;
  let productLines = [];
  if (window._productSummary && window._productSummary[name]) {
    const ps = window._productSummary[name];
    // Use short descriptions for display (truncate long ones)
    if (ps.descriptions.length) {
      product = ps.descriptions
        .map(d => d.split(',')[0].split('(')[0].trim())  // first part before comma or bracket
        .filter((v,i,a) => a.indexOf(v)===i)             // unique
        .join(', ');
    } else if (ps.skus.length) {
      product = ps.skus.join(', ');
    }
    totalPrice   = ps.netTotal;
    productLines = ps.lines;
  }

  // Use Domain field directly, fall back to Industry, then product name
  const domainRaw   = getCol(row,'domain',csvHeaders);
  const industryRaw = getCol(row,'industry',csvHeaders);
  const domain      = mapDomain(domainRaw, industryRaw || product);

  return {
    id:         Date.now() + idx,
    name,
    account:    getCol(row,'account',csvHeaders),
    domain,
    region:     mapRegion(getCol(row,'region',csvHeaders)),
    value:      parseValue(getCol(row,'value',csvHeaders)) || totalPrice,
    stage:      getCol(row,'stage',csvHeaders) || statusRaw || 'Prospect',
    close:      parseDate(getCol(row,'close',csvHeaders)),
    prob:       Math.min(100,Math.max(0,parseInt(getCol(row,'prob',csvHeaders))||50)),
    product,
    productLines,
    industry:   industryRaw,
    partner:      getCol(row,'partner',csvHeaders),
    status:       statusRaw,
    totalPrice,
    activityLog:  [],
  };
}

function confirmImport() {
  const imported = parsedCSVRows.map((r,i)=>buildOpp(r,i)).filter(o=>o.name&&(o.value>0||o.totalPrice>0||o.stage));
  if (!imported.length) { showMsg('No valid rows found — check field mapping'); return; }
  APP.opportunities = enrichRegionFromAccount(imported);
  save('opportunities', APP.opportunities);
  const now = Date.now();
  localStorage.setItem('ns_last_sync', now);
  document.getElementById('importPreview').style.display='none';
  document.getElementById('lastSyncBar').style.display='flex';
  document.getElementById('lastSyncText').textContent='Last synced: just now — '+imported.length+' opportunities';
  document.getElementById('lastImportDisplay').textContent='Today';
  document.getElementById('sfdcBadge').style.display='flex';
  const withProd = imported.filter(o=>o.product).length;
  showMsg('✓ '+imported.length+' opportunities imported · '+withProd+' with products');
}

function clearImport() {
  APP.opportunities = DEFAULTS.opportunities;
  save('opportunities',APP.opportunities);
  localStorage.removeItem('ns_last_sync');
  parsedCSVRows=[]; parsedProdRows=[]; window._productSummary={};
  document.getElementById('lastSyncBar').style.display='none';
  document.getElementById('sfdcBadge').style.display='none';
  document.getElementById('lastImportDisplay').textContent='Never';
  document.getElementById('oppFileStatus').textContent='not loaded';
  document.getElementById('oppFileStatus').style.color='var(--muted)';
  document.getElementById('prodFileStatus').textContent='not loaded';
  document.getElementById('prodFileStatus').style.color='var(--muted)';
  document.getElementById('dropZoneOpp').style.borderColor='var(--border2)';
  document.getElementById('dropZoneProd').style.borderColor='var(--border2)';
  showMsg('Cleared — sample data restored');
}

// ── FIELD MAPPING UI ──────────────────────────────────
function renderFieldMapping(headers) {
  const grid = document.getElementById('fieldMappingGrid');
  const APP_FIELDS = [
    {key:'name',     label:'Opportunity Name',  required:true},
    {key:'account',  label:'Account Name',      required:false},
    {key:'domain',   label:'Domain',            required:true,  hint:'Security / Service Assurance'},
    {key:'industry', label:'Industry',          required:true,  hint:'Enterprise / Service Provider'},
    {key:'region',   label:'Account Territory', required:true},
    {key:'value',    label:'Sales Potential',   required:true},
    {key:'stage',    label:'Stage',             required:true},
    {key:'prob',     label:'Probability (%)',    required:false},
    {key:'status',   label:'Opportunity Status', required:false},
    {key:'close',    label:'Last Modified Date', required:false},
  ];
  grid.innerHTML = APP_FIELDS.map(f => {
    const opts = headers
      ? headers.map(h=>`<option value="${h}" ${csvMapping[f.key]===h?'selected':''}>${h}</option>`).join('')
      : `<option>${csvMapping[f.key]||''}</option>`;
    return `<div class="cfg-field">
      <div class="cfg-label">${f.label}${f.required?' <span style="color:var(--accent2)">*</span>':''} ${f.hint?'<span style="color:var(--muted);font-weight:400;text-transform:none;letter-spacing:0">— '+f.hint+'</span>':''}</div>
      <select class="cfg-select" onchange="csvMapping['${f.key}']=this.value" style="font-size:10px">
        ${headers?'<option value="">— skip —</option>':''}${opts}
      </select>
    </div>`;
  }).join('');
}

// ── HELPERS ───────────────────────────────────────────
function parseCSVLine(line, delim) {
  // Auto-detect delimiter: tab or comma
  if (!delim) {
    delim = line.includes('\t') ? '\t' : ',';
  }
  const result=[]; let cur=''; let inQ=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){inQ=!inQ;}
    else if(ch===delim&&!inQ){result.push(cur.trim());cur='';}
    else{cur+=ch;}
  }
  result.push(cur.trim()); return result;
}

function autoDetectMapping(headers) {
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g,'');
  const pats = {
    name:     ['opportunityname','opportunity name','name'],
    account:  ['accountname','account name','account','company'],
    domain:   ['domain'],
    industry: ['industry'],
    region:   ['accountterritory','account territory','territory','billingcountry','country','region'],
    value:    ['salespotential','sales potential','amount','value','revenue'],
    stage:    ['stage','stagename'],
    prob:     ['probability (%)','probability','prob'],
    status:   ['opportunitystatus','opportunity status','status'],
    close:    ['lastmodifieddate','last modified date','closedate'],
  };
  headers.forEach(h => {
    const n = norm(h);
    Object.entries(pats).forEach(([key,list]) => {
      if (list.includes(n)) csvMapping[key] = h;
    });
  });
}

function getCol(row, key, headers) {
  const h = headers || csvHeaders;
  const idx = h.indexOf(csvMapping[key]);
  return idx>=0 ? (row[idx]||'').trim() : '';
}

// ── DOMAIN MAP — matches your exact SFDC 'domain' column values ──
const SFDC_DOMAIN_MAP = {
  'service assurance':             'Service Assurance',
  'service assurance & visibility':'Service Assurance',
  'service assurance/security':    'Service Assurance',  // dual-domain — primary is SA
  'security':                      'Security',
  'cyber security':                'Security',
  'cybersecurity':                 'Security',
  'ddos protection':               'Security',
  'enterprise':                    'Enterprise',
  'enterprise networking':         'Enterprise',
  'service provider':              'Service Providers',
  'service providers':             'Service Providers',
  'carrier':                       'Service Providers',
  'telecom':                       'Service Providers',
};

// ── INDUSTRY MAP — matches your exact SFDC 'industry' column values ──
const SFDC_INDUSTRY_MAP = {
  // Your exact SFDC values
  'service provider':          'Service Providers',
  'service providers':         'Service Providers',
  'telecommunications':        'Service Providers',
  'telecom':                   'Service Providers',
  'carrier':                   'Service Providers',
  'enterprise':                'Enterprise',
  'banking':                   'Enterprise',
  'financial services':        'Enterprise',
  'government':                'Enterprise',
  'healthcare':                'Enterprise',
};

// ── STAGE MAP — normalise SFDC stage values ──
const SFDC_STAGE_MAP = {
  // Your exact SFDC stages
  'am verified':               'Qualification',
  'needs analysis':            'Qualification',
  'qualified opportunity':     'Qualification',
  'roi and poc':               'Proposal Sent',
  'value proposition':         'Proposal Sent',
  'id. decision makers':       'Proposal Sent',
  'perception analysis':       'Proposal Sent',
  'proposal/price quote':      'Proposal Sent',
  'netscout selected':         'Negotiation',
  'negotiation/review':        'Negotiation',
  'closed won':                'Closed Won',
  'closed lost':               'Closed Lost',
};

function mapDomain(rawDomain, rawIndustry) {
  // Priority 1: Domain column (lowercase exact match first)
  const d = (rawDomain||'').toLowerCase().trim();
  if (d) {
    if (SFDC_DOMAIN_MAP[d]) return SFDC_DOMAIN_MAP[d];
    for(const [k,v] of Object.entries(SFDC_DOMAIN_MAP)){ if(d.includes(k)) return v; }
  }
  // Priority 2: Industry column
  const ind = (rawIndustry||'').toLowerCase().trim();
  if (ind) {
    if (SFDC_INDUSTRY_MAP[ind]) return SFDC_INDUSTRY_MAP[ind];
    for(const [k,v] of Object.entries(SFDC_INDUSTRY_MAP)){ if(ind.includes(k)) return v; }
  }
  // Priority 3: infer from product
  const PROD_MAP = {
    'ngeniusone':'Service Providers','ngenius':'Service Providers',
    'arbor':'Security','ddos':'Security','omnis cyber':'Security',
    'omnis analytic':'Service Assurance','infinistream':'Service Assurance','ran':'Service Assurance',
  };
  for(const [k,v] of Object.entries(PROD_MAP)){ if(d.includes(k)) return v; }
  return rawDomain || 'Enterprise';
}

function normaliseStage(raw) {
  const r = (raw||'').toLowerCase().trim();
  return SFDC_STAGE_MAP[r] || raw || 'Prospect';
}

function mapRegion(raw) {
  if (!raw) return APP.regions[0]?.name || 'Morocco';
  const r = raw.toLowerCase().trim();

  // Direct country name match
  const known = APP.regions.map(x=>x.name);
  for(const k of known){ if(r.includes(k.toLowerCase())) return k; }

  // Country code / common aliases
  const maps = {
    'ma':'Morocco','morocco':'Morocco',
    'ly':'Libya','libya':'Libya',
    'ml':'Mali','mali':'Mali',
    'mr':'Mauritania','mauritania':'Mauritania',
    'tg':'Togo','togo':'Togo',
    'bj':'Benin','benin':'Benin',
    'sn':'Senegal','senegal':'Senegal',
  };
  if (maps[r]) return maps[r];

  // Team territory codes — infer from common North Africa account patterns
  // Since territory is "Team 4171" (not a country), fall back to first active region
  if (/^team/i.test(raw) || raw === '') {
    return APP.regions.find(r=>r.active)?.name || 'Morocco';
  }

  return raw;
}

// After import, enrich region from account name
function enrichRegionFromAccount(opps) {
  const ACCOUNT_REGION = {
    // Morocco
    'maroc telecom':'Morocco','iam':'Morocco','inwi':'Morocco','orange maroc':'Morocco',
    'al barid bank':'Morocco','ministere':'Morocco','wafa':'Morocco','attijariwafa':'Morocco',
    'banque centrale':'Morocco','onda':'Morocco',
    // Mali / West Africa
    'sotelma':'Mali','orange mali':'Mali','malitel':'Mali',
    'moov benin':'Benin','moov togo':'Togo','moov':'Togo',
    'togocel':'Togo','togocell':'Togo',
    'benin telecoms':'Benin','bbellite':'Benin',
    // Mauritania
    'mauritel':'Mauritania','mattel':'Mauritania','chinguitel':'Mauritania',
    // Libya
    'libyana':'Libya','lptic':'Libya','almadar':'Libya',
  };
  return opps.map(o => {
    if (!o.region || /^team/i.test(o.region)) {
      const acct = (o.account||o.name||'').toLowerCase();
      for (const [key, region] of Object.entries(ACCOUNT_REGION)) {
        if (acct.includes(key)) return {...o, region};
      }
    }
    return o;
  });
}

function parseValue(raw) {
  // Handles: $563,784.38  |  563784  |  $1,200,000.00
  const cleaned = (raw||'').replace(/[$,\s]/g,'').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function parseDate(raw) {
  if (!raw) return '';
  const s = (raw||'').trim();

  // MM/DD/YY or M/D/YY  e.g. 11/19/25 or 2/13/26
  const shortMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (shortMatch) {
    const [,mm,dd,yy] = shortMatch;
    const year = parseInt(yy) >= 50 ? '19'+yy : '20'+yy;
    return `${year}-${mm.padStart(2,'0')}`;
  }

  // MM/DD/YYYY
  const longMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (longMatch) {
    const [,mm,dd,yyyy] = longMatch;
    return `${yyyy}-${mm.padStart(2,'0')}`;
  }

  // ISO or other parseable formats
  const d = new Date(s);
  if (!isNaN(d)) return d.toISOString().slice(0,7);

  return s.slice(0,7);
}

// Legacy single-file drop (kept for backwards compat)
function handleDrop(e) { handleDropOpp(e); }
function handleFileInput(input) { handleFileOpp(input); }
function rebuildPreview() {}



// ══════════════════════════════════════════════════════
//  DRILL-DOWN DRAWER
// ══════════════════════════════════════════════════════
function openDrawer(title, sub, bodyHTML) {
  document.getElementById('drawerTitle').textContent = title;
  document.getElementById('drawerSub').textContent   = sub;
  document.getElementById('drawerBody').innerHTML    = bodyHTML;
  document.getElementById('drawerBody').scrollTop    = 0;

  const drawer  = document.getElementById('drillDrawer');
  const overlay = document.getElementById('drawerOverlay');

  // Set directly on style — no CSS class dependency
  overlay.style.visibility    = 'visible';
  overlay.style.opacity       = '1';
  overlay.style.pointerEvents = 'all';

  drawer.style.visibility    = 'visible';
  drawer.style.transform     = 'translateX(0)';
  drawer.style.pointerEvents = 'all';
  drawer.style.boxShadow     = '-8px 0 40px rgba(0,0,0,0.4)';
}

function closeDrawer() {
  const drawer  = document.getElementById('drillDrawer');
  const overlay = document.getElementById('drawerOverlay');

  overlay.style.opacity       = '0';
  overlay.style.visibility    = 'hidden';
  overlay.style.pointerEvents = 'none';

  drawer.style.transform     = 'translateX(110%)';
  drawer.style.visibility    = 'hidden';
  drawer.style.pointerEvents = 'none';
  drawer.style.boxShadow     = 'none';
}

// Close on Escape key
document.addEventListener('keydown', e => { if(e.key==='Escape') closeDrawer(); });

// ── Drawer content builders ──────────────────────────


function drillMustWin() {
  const active   = APP.opportunities.filter(o => o.stage !== 'Closed Lost');
  const mustWin  = active.filter(o => o.priority === 'must_win');
  const highPrio = active.filter(o => o.priority === 'high');
  const normal   = active.filter(o => !o.priority || o.priority === 'normal');

  const DOM_C = {'Service Assurance':'#ffc542','Security':'#ff6b35','Service Assurance/Security':'#ff9f35','Enterprise':'#00c8ff','Service Providers':'#00e5a0'};
  const PC    = p => p>=70?'#00e5a0':p>=40?'#ffc542':'#ff6b35';

  function oppRows(opps, icon) {
    if (!opps.length) return `<div style="font-size:10px;color:var(--muted);padding:8px 0">None</div>`;
    return opps.map(o => {
      const dc   = DOM_C[o.domain] || '#5a7a99';
      const days = getDaysSinceLastActivity(o);
      const daysC = days>14?'var(--accent2)':days>7?'var(--accent4)':'var(--accent3)';
      const daysStr = days===999?'No activity':days===0?'Today':days+'d ago';
      return `<div class="drawer-opp-row">
        <div style="width:3px;height:40px;border-radius:2px;background:${dc};flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${icon} ${o.name}</div>
          <div style="font-size:9px;color:var(--muted);margin-top:2px">${o.account||''} · <span style="color:${dc}">${o.domain}</span> · ${o.stage}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-family:'Syne',sans-serif;font-size:12px;font-weight:700">$${((o.value||0)/1000).toFixed(0)}K</div>
          <div style="font-size:9px;color:${PC(o.prob||0)}">${o.prob||0}%</div>
          <div style="font-size:9px;color:${daysC}">${daysStr}</div>
        </div>
      </div>`;
    }).join('');
  }

  const mustVal  = mustWin.reduce((s,o)=>s+(o.value||0),0);
  const highVal  = highPrio.reduce((s,o)=>s+(o.value||0),0);

  openDrawer('⭐ Priority Deals',
    `${mustWin.length} must-win · ${highPrio.length} high priority · $${((mustVal+highVal)/1e6).toFixed(2)}M combined`,
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
       <div class="drawer-stat" style="border-left:3px solid #ffd700">
         <div class="drawer-stat-label">Must Win</div>
         <div class="drawer-stat-value" style="color:#ffd700">${mustWin.length} deals · $${(mustVal/1e6).toFixed(2)}M</div>
       </div>
       <div class="drawer-stat" style="border-left:3px solid var(--accent2)">
         <div class="drawer-stat-label">High Priority</div>
         <div class="drawer-stat-value" style="color:var(--accent2)">${highPrio.length} deals · $${(highVal/1e6).toFixed(2)}M</div>
       </div>
     </div>
     <div class="drawer-section-title">⭐ Must Win (${mustWin.length})</div>
     ${oppRows(mustWin,'⭐')}
     <div class="drawer-section-title">🔥 High Priority (${highPrio.length})</div>
     ${oppRows(highPrio,'🔥')}
   `
  );
}

function drillTotalPipeline() {
  const active = APP.opportunities.filter(o=>o.stage!=='Closed Lost');
  const total  = active.reduce((s,o)=>s+(o.value||0),0);
  const STAGE_C = {'Qualification':'#00c8ff','Proposal Sent':'#7b2fff','Negotiation':'#ffc542','Closed Won':'#00e5a0'};
  const DOM_C   = {'Service Assurance':'#ffc542','Security':'#ff6b35','Service Assurance/Security':'#ff9f35','Enterprise':'#00c8ff','Service Providers':'#00e5a0'};
  const IND_C   = {'Service Provider':'#00e5a0','Enterprise':'#00c8ff'};

  // By Stage
  const byStage = {};
  active.forEach(o=>{ const s=o.stage||'Other'; byStage[s]=(byStage[s]||0)+(o.value||0); });

  // By Domain
  const byDomain = {};
  active.forEach(o=>{ const d=o.domain||'Other'; byDomain[d]=(byDomain[d]||0)+(o.value||0); });

  // By Industry
  const byInd = {};
  active.forEach(o=>{ const i=o.industry||'Other'; byInd[i]=(byInd[i]||0)+(o.value||0); });

  const stageRows = Object.entries(byStage).sort((a,b)=>b[1]-a[1]).map(([s,v])=>{
    const pct=(v/total*100).toFixed(0); const c=STAGE_C[s]||'#5a7a99';
    const cnt=active.filter(o=>o.stage===s).length;
    return `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
        <span style="color:${c}">${s} <span style="color:var(--muted);font-size:9px">(${cnt})</span></span>
        <span>$${(v/1e6).toFixed(2)}M · ${pct}%</span>
      </div>
      <div class="prob-bar-wrap"><div class="prob-bar-fill" style="width:${pct}%;background:${c}"></div></div>
    </div>`;
  }).join('');

  const domRows = Object.entries(byDomain).sort((a,b)=>b[1]-a[1]).map(([d,v])=>{
    const pct=(v/total*100).toFixed(0); const c=DOM_C[d]||'#5a7a99';
    const cnt=active.filter(o=>o.domain===d).length;
    return `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
        <span style="color:${c}">${d} <span style="color:var(--muted);font-size:9px">(${cnt})</span></span>
        <span>$${(v/1e6).toFixed(2)}M · ${pct}%</span>
      </div>
      <div class="prob-bar-wrap"><div class="prob-bar-fill" style="width:${pct}%;background:${c}"></div></div>
    </div>`;
  }).join('');

  const indRows = Object.entries(byInd).sort((a,b)=>b[1]-a[1]).map(([ind,v])=>{
    const pct=(v/total*100).toFixed(0); const c=IND_C[ind]||'#5a7a99';
    const cnt=active.filter(o=>o.industry===ind).length;
    return `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
        <span style="color:${c}">${ind} <span style="color:var(--muted);font-size:9px">(${cnt})</span></span>
        <span>$${(v/1e6).toFixed(2)}M · ${pct}%</span>
      </div>
      <div class="prob-bar-wrap"><div class="prob-bar-fill" style="width:${pct}%;background:${c}"></div></div>
    </div>`;
  }).join('');

  openDrawer('Total Pipeline Breakdown', `$${(total/1e6).toFixed(2)}M across ${active.length} active opportunities`,
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px">
       <div class="drawer-stat"><div class="drawer-stat-label">Active Opps</div><div class="drawer-stat-value" style="color:var(--accent)">${active.length}</div></div>
       <div class="drawer-stat"><div class="drawer-stat-label">Total Value</div><div class="drawer-stat-value" style="color:var(--accent)">$${(total/1e6).toFixed(2)}M</div></div>
     </div>
     <div class="drawer-section-title">By Stage</div>${stageRows}
     <div class="drawer-section-title">By Domain</div>${domRows}
     <div class="drawer-section-title">By Industry</div>${indRows}
     ${oppListHTML(active.sort((a,b)=>b.value-a.value).slice(0,15), 'All Active Opportunities')}`
  );
}

function drillForecast() {
  const active   = APP.opportunities.filter(o=>o.stage!=='Closed Lost');
  const forecast = active.reduce((s,o)=>s+(o.value||0)*(o.prob||0)/100,0);
  const buckets  = [
    {label:'🟢 Strong (>60%)',    color:'#00e5a0', opps: active.filter(o=>(o.prob||0)>60)},
    {label:'🟡 Developing (31-60%)', color:'#ffc542', opps: active.filter(o=>(o.prob||0)>30&&(o.prob||0)<=60)},
    {label:'🟠 At Risk (11-30%)', color:'#ff9f35', opps: active.filter(o=>(o.prob||0)>10&&(o.prob||0)<=30)},
    {label:'🔴 Critical (0-10%)',  color:'#ff4444', opps: active.filter(o=>(o.prob||0)<=10)},
  ];

  const bucketHTML = buckets.map(b=>{
    const val = b.opps.reduce((s,o)=>s+(o.value||0)*(o.prob||0)/100,0);
    const pipe = b.opps.reduce((s,o)=>s+(o.value||0),0);
    if (!b.opps.length) return '';
    return `<div class="drawer-stat" style="border-left:3px solid ${b.color}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:11px;font-weight:600;color:${b.color}">${b.label}</span>
        <span style="font-family:'Syne',sans-serif;font-size:14px;font-weight:800">$${(val/1000).toFixed(0)}K</span>
      </div>
      <div style="font-size:9px;color:var(--muted);margin-bottom:8px">${b.opps.length} opp${b.opps.length!==1?'s':''} · $${(pipe/1e6).toFixed(2)}M pipeline</div>
      ${b.opps.slice(0,3).map(o=>`
        <div style="display:flex;justify-content:space-between;font-size:10px;padding:4px 0;border-top:1px solid rgba(26,47,74,0.4)">
          <span style="color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px">${o.account||o.name}</span>
          <div style="display:flex;gap:8px;flex-shrink:0">
            <span style="color:${b.color}">${o.prob}%</span>
            <span style="color:var(--muted)">$${((o.value||0)/1000).toFixed(0)}K</span>
          </div>
        </div>`).join('')}
      ${b.opps.length>3?`<div style="font-size:9px;color:var(--muted);padding-top:4px">+${b.opps.length-3} more</div>`:''}
    </div>`;
  }).join('');

  openDrawer('Weighted Forecast Detail', `$${(forecast/1e6).toFixed(2)}M forecast · ${active.length} active opportunities`, bucketHTML);
}

function drillStalled() {
  const active = APP.opportunities.filter(o=>o.stage!=='Closed Lost');
  function daysSince(o) {
    const s = String(o.close||'').trim();
    const m = s.match(/^(\d{4})-(\d{2})$/);
    if (m) { const d=new Date(parseInt(m[1]),parseInt(m[2])-1,1); return Math.floor((today-d)/86400000); }
    const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m2) { const [,mm,dd,yy]=m2; const yr=yy.length===2?(parseInt(yy)<50?'20':'19')+yy:yy; const d=new Date(parseInt(yr),parseInt(mm)-1,parseInt(dd)); return Math.floor((today-d)/86400000); }
    return 999;
  }

  const withDays = active.map(o=>({...o, days:getDaysSinceLastActivity(o)})).sort((a,b)=>b.days-a.days);
  const stalled  = withDays.filter(o=>o.days>30);
  const fresh    = withDays.filter(o=>o.days<=30);

  const URGENCY = [
    {label:'🚨 Critical (>90 days)', min:90,   color:'#ff4444'},
    {label:'⚠ High (31-90 days)',    min:31, max:90, color:'#ff6b35'},
  ];

  const rows = (arr, color) => arr.map(o=>{
    const dc = o.days===999?'var(--muted)':o.days>90?'#ff4444':o.days>30?'#ff6b35':'var(--accent3)';
    return `<div class="drawer-opp-row">
      <div style="width:42px;text-align:center;flex-shrink:0">
        <div style="font-size:12px;font-weight:700;color:${dc}">${o.days===999?'?':o.days}</div>
        <div style="font-size:8px;color:var(--muted)">days</div>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:11px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.name}</div>
        <div style="font-size:9px;color:var(--muted);margin-top:1px">${o.account||''} · ${o.stage}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:12px;font-weight:600">$${((o.value||0)/1000).toFixed(0)}K</div>
        <div style="font-size:9px;color:var(--muted)">${o.prob}%</div>
      </div>
    </div>`;
  }).join('');

  const stalledVal = stalled.reduce((s,o)=>s+(o.value||0),0);
  openDrawer('⚠ Stalled Deals', `${stalled.length} deals with no activity · $${(stalledVal/1e6).toFixed(2)}M at risk`,
    `<div style="background:rgba(255,107,53,0.06);border:1px solid rgba(255,107,53,0.2);border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:11px;line-height:1.6;color:var(--text2)">
       These deals have had no recorded activity for over 30 days. Immediate outreach recommended to re-qualify or mark as lost.
     </div>
     <div class="drawer-section-title">Stalled — Needs Action (${stalled.length})</div>
     ${rows(stalled,'#ff6b35')}
     ${fresh.length?`<div class="drawer-section-title">Recently Active (${fresh.length})</div>${rows(fresh,'var(--accent3)')}`:''}
   `);
}

function drillHotDeals() {
  const active   = APP.opportunities.filter(o=>o.stage!=='Closed Lost');
  const hot      = active.filter(o=>(o.prob||0)>=50).sort((a,b)=>b.prob-a.prob);
  const hotVal   = hot.reduce((s,o)=>s+(o.value||0),0);
  const DOM_C    = {'Service Assurance':'#ffc542','Security':'#ff6b35','Service Assurance/Security':'#ff9f35','Enterprise':'#00c8ff','Service Providers':'#00e5a0'};

  const rows = hot.map(o=>{
    const pc  = o.prob>=70?'#00e5a0':'#ffc542';
    const dc  = DOM_C[o.domain]||'#5a7a99';
    return `<div class="drawer-opp-row">
      <div style="width:40px;text-align:center;flex-shrink:0">
        <div style="font-size:13px;font-weight:800;color:${pc}">${o.prob}%</div>
        <div style="font-size:8px;color:var(--muted)">win</div>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:11px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.name}</div>
        <div style="font-size:9px;color:var(--muted);margin-top:2px;display:flex;gap:6px;align-items:center">
          <span>${o.account||''}</span>
          <span style="padding:1px 6px;border-radius:4px;background:${dc}15;color:${dc};border:1px solid ${dc}30">${o.domain||''}</span>
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-family:'Syne',sans-serif;font-size:13px;font-weight:700">$${((o.value||0)/1000).toFixed(0)}K</div>
        <div style="font-size:9px;color:var(--muted)">${o.stage}</div>
      </div>
    </div>`;
  }).join('');

  const noHot = `<div style="text-align:center;padding:40px 20px;color:var(--muted)">
    <div style="font-size:32px;opacity:0.2;margin-bottom:10px">🎯</div>
    <div style="font-size:12px;font-weight:600;margin-bottom:6px">No hot deals yet</div>
    <div style="font-size:11px">Deals reach this list when win probability is set to 50% or higher. Update your opportunity probabilities to track momentum.</div>
  </div>`;

  openDrawer('🔥 Hot Deals', `${hot.length} deal${hot.length!==1?'s':''} above 50% · $${(hotVal/1e6).toFixed(2)}M`,
    hot.length ? rows : noHot
  );
}

function drillIndustry(industry) {
  const active  = APP.opportunities.filter(o=>o.stage!=='Closed Lost'&&(o.industry||'Other')===industry);
  const total   = active.reduce((s,o)=>s+(o.value||0),0);
  const DOM_C   = {'Service Assurance':'#ffc542','Security':'#ff6b35','Service Assurance/Security':'#ff9f35','Enterprise':'#00c8ff','Service Providers':'#00e5a0'};
  const STAGE_C = {'Qualification':'#00c8ff','Proposal Sent':'#7b2fff','Negotiation':'#ffc542','Closed Won':'#00e5a0'};

  const byDomain = {};
  active.forEach(o=>{ const d=o.domain||'Other'; byDomain[d]=(byDomain[d]||0)+(o.value||0); });

  const domRows = Object.entries(byDomain).sort((a,b)=>b[1]-a[1]).map(([d,v])=>{
    const pct=(v/total*100).toFixed(0); const c=DOM_C[d]||'#5a7a99';
    const cnt=active.filter(o=>o.domain===d).length;
    return `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
        <span style="color:${c}">${d} <span style="color:var(--muted);font-size:9px">(${cnt})</span></span>
        <span>$${(v/1e6).toFixed(2)}M</span>
      </div>
      <div class="prob-bar-wrap"><div class="prob-bar-fill" style="width:${pct}%;background:${c}"></div></div>
    </div>`;
  }).join('');

  openDrawer(industry, `$${(total/1e6).toFixed(2)}M · ${active.length} active opportunities`,
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px">
       <div class="drawer-stat"><div class="drawer-stat-label">Pipeline</div><div class="drawer-stat-value" style="color:var(--accent4)">$${(total/1e6).toFixed(2)}M</div></div>
       <div class="drawer-stat"><div class="drawer-stat-label">Forecast</div><div class="drawer-stat-value" style="color:var(--accent3)">$${(active.reduce((s,o)=>s+(o.value||0)*(o.prob||0)/100,0)/1e6).toFixed(2)}M</div></div>
     </div>
     <div class="drawer-section-title">Sub-Domains</div>${domRows}
     ${oppListHTML(active.sort((a,b)=>b.value-a.value), 'All Opportunities')}`
  );
}

function drillStage(stage) {
  const active = APP.opportunities.filter(o=>o.stage===stage);
  const total  = active.reduce((s,o)=>s+(o.value||0),0);
  const STAGE_C= {'Qualification':'#00c8ff','Proposal Sent':'#7b2fff','Negotiation':'#ffc542','Closed Won':'#00e5a0'};
  const color  = STAGE_C[stage]||'#5a7a99';
  openDrawer(stage, `$${(total/1e6).toFixed(2)}M · ${active.length} opportunities`,
    `<div class="drawer-stat" style="border-left:3px solid ${color};margin-bottom:16px">
       <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
         <div><div class="drawer-stat-label">Pipeline</div><div style="font-size:16px;font-weight:700;color:${color}">$${(total/1e6).toFixed(2)}M</div></div>
         <div><div class="drawer-stat-label">Opps</div><div style="font-size:16px;font-weight:700">${active.length}</div></div>
         <div><div class="drawer-stat-label">Avg Win %</div><div style="font-size:16px;font-weight:700">${active.length?Math.round(active.reduce((s,o)=>s+(o.prob||0),0)/active.length):0}%</div></div>
       </div>
     </div>
     ${oppListHTML(active.sort((a,b)=>b.value-a.value), 'Opportunities in this stage')}`
  );
}

// Shared opp list renderer for drawers
function oppListHTML(opps, title) {
  if (!opps.length) return '';
  const DOM_C = {'Service Assurance':'#ffc542','Security':'#ff6b35','Service Assurance/Security':'#ff9f35','Enterprise':'#00c8ff','Service Providers':'#00e5a0'};
  const PC    = p => p>=70?'#00e5a0':p>=50?'#ffc542':'#ff6b35';
  return `<div class="drawer-section-title">${title} (${opps.length})</div>` +
    opps.map(o=>`
      <div class="drawer-opp-row">
        <div style="width:3px;height:36px;border-radius:2px;background:${DOM_C[o.domain]||'#5a7a99'};flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.name}</div>
          <div style="font-size:9px;color:var(--muted);margin-top:1px">${o.account||''} · <span style="color:${DOM_C[o.domain]||'#5a7a99'}">${o.domain||''}</span></div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:12px;font-weight:600">$${((o.value||0)/1000).toFixed(0)}K</div>
          <div style="font-size:9px;padding:1px 6px;border-radius:6px;color:${PC(o.prob||0)};border:1px solid ${PC(o.prob||0)}30;background:${PC(o.prob||0)}10;margin-top:2px">${o.prob||0}%</div>
        </div>
      </div>`).join('');
}



// ══════════════════════════════════════════════════════
//  ACTIVITY LOG
// ══════════════════════════════════════════════════════

const ACTION_COLORS = {
  '📞 Call':          { bg:'rgba(0,200,255,0.1)',   border:'rgba(0,200,255,0.2)'   },
  '📧 Email':         { bg:'rgba(123,47,255,0.1)',  border:'rgba(123,47,255,0.2)'  },
  '🤝 Meeting':       { bg:'rgba(0,229,160,0.1)',   border:'rgba(0,229,160,0.2)'   },
  '📄 Proposal Sent': { bg:'rgba(255,197,66,0.1)',  border:'rgba(255,197,66,0.2)'  },
  '🧪 POC / Demo':    { bg:'rgba(255,107,53,0.1)',  border:'rgba(255,107,53,0.2)'  },
  '📋 MoM Sent':      { bg:'rgba(0,102,255,0.1)',   border:'rgba(0,102,255,0.2)'   },
  '💬 WhatsApp':      { bg:'rgba(0,229,160,0.1)',   border:'rgba(0,229,160,0.2)'   },
  '✈ On-site Visit':  { bg:'rgba(255,197,66,0.1)',  border:'rgba(255,197,66,0.2)'  },
  '📑 Contract Sent': { bg:'rgba(0,229,160,0.15)',  border:'rgba(0,229,160,0.3)'   },
  '🔁 Follow-up':     { bg:'rgba(90,122,153,0.1)',  border:'rgba(90,122,153,0.2)'  },
};

let alAttendees = [];

function initActivityLog() {
  const sel = document.getElementById('alOpp');
  if (!sel) return;

  // Active opps sorted by value — decorated display, clean name as value
  const activeOpps = APP.opportunities
    .filter(o => o.stage !== 'Closed Lost' && o.stage !== 'Closed Won')
    .sort((a,b) => (b.value||0) - (a.value||0));

  sel.innerHTML = '<option value="">— Select an active opportunity —</option>' +
    activeOpps.map(o => {
      const flag    = (o.prob||0)>=70?'🟢':(o.prob||0)>=40?'🟡':'🔴';
      const acct    = o.account ? o.account + ' · ' : '';
      const display = `${flag} ${acct}${o.name} — $${((o.value||0)/1000).toFixed(0)}K`;
      return `<option value="${o.name}">${display}</option>`;
    }).join('');

  // Hide context panel until opp selected
  document.getElementById('alOppContext').style.display = 'none';

  // Init custom date picker only if not already initialized
  const todayStr = new Date().toISOString().split('T')[0];
  const alDateEl = document.getElementById('alDate');
  if (alDateEl && !alDateEl.closest('.dp-wrap')) {
    setTimeout(() => initDatePicker('alDate', todayStr), 10);
  } else if (_datePickers['alDate']) {
    _datePickers['alDate'].setValue(todayStr);
  }

  // Wire up attendee chip input
  const inp = document.getElementById('alAttendeeInput');
  if (inp && !inp._wired) {
    inp._wired = true;
    inp.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ',') && e.target.value.trim()) {
        e.preventDefault();
        alAttendees.push(e.target.value.trim());
        e.target.value = '';
        renderAlChips();
      }
      if (e.key === 'Backspace' && !e.target.value && alAttendees.length) {
        alAttendees.pop();
        renderAlChips();
      }
    });
  }

  alAttendees = [];
  renderAlChips();
  renderActivityLog();
}

function onActLogOppSelect() {
  const oppName = document.getElementById('alOpp').value;
  const ctx     = document.getElementById('alOppContext');
  if (!oppName) { ctx.style.display = 'none'; return; }

  const opp = APP.opportunities.find(o => o.name === oppName);
  if (!opp) { ctx.style.display = 'none'; return; }

  // Show context panel
  ctx.style.display = 'block';

  // Fill opp summary strip
  const DOM_C = {'Service Assurance':'#ffc542','Security':'#ff6b35','Service Assurance/Security':'#ff9f35','Enterprise':'#00c8ff','Service Providers':'#00e5a0'};
  const dc    = DOM_C[opp.domain] || '#5a7a99';
  const pc    = (opp.prob||0)>=70?'#00e5a0':(opp.prob||0)>=40?'#ffc542':'#ff6b35';
  const last  = getLastActivity(opp);
  const days  = last ? getDaysAgo(last.date) : null;
  const daysStr = days===null?'No activity yet':days===0?'Today':days===1?'Yesterday':days+'d ago';
  const daysColor = days===null?'var(--muted)':days>30?'var(--accent2)':days>7?'var(--accent4)':'var(--accent3)';

  // Store current opp for tooltip
  window._currentActLogOpp = opp;
  document.getElementById('alOppStrip').innerHTML = `
    <div>
      <div style="font-size:8px;text-transform:uppercase;letter-spacing:0.12em;color:var(--muted);margin-bottom:3px">Account</div>
      <div style="font-size:11px;font-weight:500">${opp.account||opp.name}</div>
    </div>
    <div>
      <div style="font-size:8px;text-transform:uppercase;letter-spacing:0.12em;color:var(--muted);margin-bottom:3px">Domain</div>
      <div style="font-size:11px;color:${dc}">${opp.domain||'—'}</div>
    </div>
    <div>
      <div style="font-size:8px;text-transform:uppercase;letter-spacing:0.12em;color:var(--muted);margin-bottom:3px">Stage</div>
      <div style="font-size:11px">${opp.stage||'—'}</div>
    </div>
    <div>
      <div style="font-size:8px;text-transform:uppercase;letter-spacing:0.12em;color:var(--muted);margin-bottom:3px">Value</div>
      <div style="font-size:11px;font-weight:600;color:var(--accent3)">$${((opp.value||0)/1000).toFixed(0)}K</div>
    </div>
    <div>
      <div style="font-size:8px;text-transform:uppercase;letter-spacing:0.12em;color:var(--muted);margin-bottom:3px">Win %</div>
      <div style="font-size:11px;color:${pc};font-weight:600">${opp.prob||0}%</div>
    </div>
    <div>
      <div style="font-size:8px;text-transform:uppercase;letter-spacing:0.12em;color:var(--muted);margin-bottom:3px">Last Activity</div>
      <div style="font-size:11px;color:${daysColor}">${daysStr}${last?' · '+last.type:''}</div>
    </div>
    <div style="margin-left:auto">
      <div style="font-size:8px;text-transform:uppercase;letter-spacing:0.12em;color:var(--muted);margin-bottom:3px">Log Count</div>
      <div style="font-size:11px;font-weight:600">${(opp.activityLog||[]).length} entr${(opp.activityLog||[]).length!==1?'ies':'y'}</div>
    </div>`;

  renderActivityLog();
}

function renderAlChips() {
  const wrap = document.getElementById('alAttendeesWrap');
  const inp  = document.getElementById('alAttendeeInput');
  if (!wrap || !inp) return;
  wrap.innerHTML = '';
  alAttendees.forEach((a, i) => {
    const chip = document.createElement('div');
    chip.style.cssText = 'display:flex;align-items:center;gap:5px;background:rgba(0,102,255,0.12);border:1px solid rgba(0,102,255,0.25);color:#00c8ff;border-radius:20px;padding:2px 9px;font-size:10px';
    chip.innerHTML = `${a}<span style="cursor:pointer;opacity:0.6;margin-left:2px" onclick="alAttendees.splice(${i},1);renderAlChips()">×</span>`;
    wrap.appendChild(chip);
  });
  wrap.appendChild(inp);
}

function logActivity() {
  const oppName = (document.getElementById('alOpp').value || '').trim();
  const type      = document.getElementById('alType').value;
  const date      = getDatePickerValue('alDate');
  const note      = document.getElementById('alNote').value.trim();
  const next      = document.getElementById('alNext').value.trim();
  const sentiment = document.getElementById('alSentiment')?.value || 'neutral';

  if (!note) { showMsg('Please add a note or outcome.'); return; }

  const opp = APP.opportunities.find(o => o.name === oppName);
  if (!opp) return;

  if (!opp.activityLog) opp.activityLog = [];

  opp.activityLog.unshift({
    id: Date.now(),
    type, date, note, next, sentiment,
    attendees: [...alAttendees],
    user: APP.profile.name || 'Me',
  });

  opp.lastActivity = date;
  save('opportunities', APP.opportunities);

  // Reset form
  document.getElementById('alNote').value = '';
  document.getElementById('alNext').value = '';
  // Reset date picker to today
  const dp = _datePickers['alDate'];
  if (dp) dp.setValue(new Date().toISOString().split('T')[0]);
  document.getElementById('alSentiment').value = 'positive';
  alAttendees = [];
  renderAlChips();

  const msg = document.getElementById('alSavedMsg');
  msg.textContent = '✓ Logged';
  setTimeout(() => msg.textContent = '', 2000);

  // Refresh strip + timeline
  onActLogOppSelect();
}

function renderActivityLog() {
  const container  = document.getElementById('activityTimeline');
  if (!container) return;

  // Always filter by the selected opportunity
  const selectedOpp = (document.getElementById('alOpp')?.value || '').trim();
  const filterType  = document.getElementById('alFilterType')?.value || '';

  // Collect entries for selected opp only
  const allEntries = [];
  APP.opportunities.forEach(opp => {
    if (selectedOpp && opp.name !== selectedOpp) return;
    (opp.activityLog || []).forEach(entry => {
      allEntries.push({ ...entry, oppName: opp.name, oppDomain: opp.domain, oppAccount: opp.account });
    });
  });

  let filtered = allEntries;
  if (filterType) filtered = filtered.filter(e => e.type === filterType);

  // Sort by date descending
  filtered.sort((a,b) => (b.date||'') > (a.date||'') ? 1 : -1);

  if (!filtered.length) {
    container.innerHTML = `<div class="no-activity-msg">
      <div style="font-size:32px;opacity:0.2;margin-bottom:12px">📋</div>
      <div style="font-size:12px;font-weight:600;margin-bottom:6px">No activities yet</div>
      <div style="font-size:10px">Use the form on the right to log your first action for this opportunity.</div>
    </div>`;
    return;
  }

  container.innerHTML = filtered.map((e, i) => {
    const style   = ACTION_COLORS[e.type] || { bg:'rgba(90,122,153,0.1)', border:'rgba(90,122,153,0.2)' };
    const daysAgo = getDaysAgo(e.date);
    const daysStr = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : daysAgo + ' days ago';
    const isLast  = i === filtered.length - 1;
    const SENTIMENT = {
      positive:  { icon:'😊', color:'#00e5a0', label:'Positive'   },
      neutral:   { icon:'😐', color:'#ffc542', label:'Neutral'    },
      concerned: { icon:'😟', color:'#ff9f35', label:'Concerned'  },
      negative:  { icon:'🔴', color:'#ff6b35', label:'At Risk'    },
    };
    const sent = SENTIMENT[e.sentiment] || SENTIMENT.neutral;
    const attendeeStr = (e.attendees||[]).length
      ? `<div style="font-size:9px;color:var(--muted);margin-top:3px">👥 ${e.attendees.join(' · ')}</div>`
      : '';
    return `
      <div class="activity-item" id="act-${e.id}">
        ${!isLast ? '<div class="activity-timeline-line"></div>' : ''}
        <div class="activity-dot" style="background:${style.bg};border-color:${style.border}">${e.type.split(' ')[0]}</div>
        <div class="activity-body">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">
            <div class="activity-opp">${e.oppName}${e.oppAccount?' · '+e.oppAccount:''}</div>
            <span style="font-size:9px;padding:1px 8px;border-radius:10px;background:${sent.color}15;border:1px solid ${sent.color}30;color:${sent.color}">${sent.icon} ${sent.label}</span>
          </div>
          <div class="activity-type">${e.type}</div>
          <div class="activity-note">${e.note}</div>
          ${attendeeStr}
          ${e.next ? `<div class="activity-next">→ Next: ${e.next}</div>` : ''}
          <div style="font-size:9px;color:var(--muted);margin-top:4px">
            Logged by ${e.user||'Me'}${e.edited?' · <span style="color:var(--accent4)">edited</span>':''}
          </div>
        </div>
        <div class="activity-date">
          <div style="font-weight:600">${formatDate(e.date)}</div>
          <div class="activity-days-ago" style="color:${daysAgo>30?'var(--accent2)':daysAgo>7?'var(--accent4)':'var(--accent3)'}">${daysStr}</div>
          <div style="display:flex;gap:4px;margin-top:6px;justify-content:flex-end">
            <button onclick="editActivity('${e.oppName}',${e.id})"
              style="background:var(--surface2);border:1px solid var(--border);color:var(--muted);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px"
              title="Edit">✏</button>
            <button onclick="deleteActivity('${e.oppName}',${e.id})"
              style="background:transparent;border:1px solid transparent;color:var(--muted);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px"
              title="Delete">🗑</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function getDaysAgo(dateStr) {
  if (!dateStr) return 999;
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d)) return 999;
  return Math.max(0, Math.floor((new Date() - d) / 86400000));
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
}

function deleteActivity(oppName, id) {
  if (!confirm('Delete this activity entry?')) return;
  const opp = APP.opportunities.find(o => o.name === oppName);
  if (!opp) return;
  opp.activityLog = (opp.activityLog||[]).filter(e => e.id !== id);
  save('opportunities', APP.opportunities);
  renderActivityLog();
}

function editActivity(oppName, id) {
  const opp   = APP.opportunities.find(o => o.name === oppName);
  if (!opp) return;
  const entry = (opp.activityLog||[]).find(e => e.id === id);
  if (!entry) return;

  // Build edit form inside the entry card
  const card = document.getElementById('act-' + id);
  if (!card) return;

  const ACTION_TYPES = [
    '📞 Call','📧 Email','🤝 Meeting','📄 Proposal Sent',
    '🧪 POC / Demo','📋 MoM Sent','💬 WhatsApp',
    '✈ On-site Visit','📑 Contract Sent','🔁 Follow-up'
  ];
  const typeOpts = ACTION_TYPES.map(t =>
    `<option ${entry.type===t?'selected':''}>${t}</option>`
  ).join('');

  const sentOpts = [
    {v:'positive', l:'😊 Positive'},
    {v:'neutral',  l:'😐 Neutral'},
    {v:'concerned',l:'😟 Concerned'},
    {v:'negative', l:'🔴 At Risk'},
  ].map(s => `<option value="${s.v}" ${entry.sentiment===s.v?'selected':''}>${s.l}</option>`).join('');

  card.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px;padding:4px 0">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        <div class="cfg-field">
          <div class="cfg-label">Date</div>
          <input id="edit-date-${id}" type="text" class="cfg-input" placeholder="Pick a date" readonly style="cursor:pointer">
        </div>
        <div class="cfg-field">
          <div class="cfg-label">Action Type</div>
          <select id="edit-type-${id}" class="cfg-select">${typeOpts}</select>
        </div>
        <div class="cfg-field">
          <div class="cfg-label">Sentiment</div>
          <select id="edit-sent-${id}" class="cfg-select">${sentOpts}</select>
        </div>
        <div class="cfg-field" style="grid-column:span 2">
          <div class="cfg-label">Note / Outcome</div>
          <input id="edit-note-${id}" class="cfg-input" value="${(entry.note||'').replace(/"/g,'&quot;')}">
        </div>
        <div class="cfg-field">
          <div class="cfg-label">Next Action</div>
          <input id="edit-next-${id}" class="cfg-input" value="${(entry.next||'').replace(/"/g,'&quot;')}">
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="saveActivityEdit('${oppName}',${id})"
          style="background:var(--accent3);color:#000;border:none;border-radius:8px;padding:7px 18px;font-family:'Syne',sans-serif;font-size:11px;font-weight:700;cursor:pointer">
          ✓ Save
        </button>
        <button onclick="renderActivityLog()"
          style="background:transparent;border:1px solid var(--border);color:var(--muted);border-radius:8px;padding:7px 14px;font-family:'DM Mono',monospace;font-size:10px;cursor:pointer">
          Cancel
        </button>
      </div>
    </div>`;

  // Init date picker for edit form
  setTimeout(() => {
    const edp = initDatePicker('edit-date-' + id, entry.date || '');
    _datePickers['edit-date-' + id] = edp;
    edp._open();
  }, 30);
}

function saveActivityEdit(oppName, id) {
  const opp   = APP.opportunities.find(o => o.name === oppName);
  if (!opp) return;
  const entry = (opp.activityLog||[]).find(e => e.id === id);
  if (!entry) return;

  const newDate = getDatePickerValue('edit-date-'+id);
  const newType = document.getElementById('edit-type-'+id)?.value;
  const newSent = document.getElementById('edit-sent-'+id)?.value;
  const newNote = document.getElementById('edit-note-'+id)?.value?.trim();
  const newNext = document.getElementById('edit-next-'+id)?.value?.trim();

  if (!newNote) { showMsg('Note cannot be empty.'); return; }

  entry.date      = newDate || entry.date;
  entry.type      = newType || entry.type;
  entry.sentiment = newSent || entry.sentiment;
  entry.note      = newNote;
  entry.next      = newNext || '';
  entry.edited    = true;

  // Update lastActivity on opp if this is the most recent
  const latest = getLastActivity(opp);
  if (latest && latest.id === id) opp.lastActivity = entry.date;

  save('opportunities', APP.opportunities);
  showMsg('✓ Activity updated');
  renderActivityLog();
}

// ── Helper to get last activity for an opp (used in stalled deal calc) ──
function getLastActivity(opp) {
  const log = opp.activityLog || [];
  if (!log.length) return null;
  return log.reduce((latest, e) => (!latest || (e.date||'') > (latest.date||'')) ? e : latest, null);
}

function getDaysSinceLastActivity(opp) {
  const last = getLastActivity(opp);
  if (!last) return 999;
  return getDaysAgo(last.date);
}



// ══════════════════════════════════════════════════════
//  CUSTOM DATE PICKER
// ══════════════════════════════════════════════════════
class DatePicker {
  constructor(inputId, onChange) {
    this.inputId  = inputId;
    this.onChange = onChange;
    this.value    = '';
    this.viewDate = new Date();
    this.open     = false;
    this._build();
  }

  _build() {
    const inp = document.getElementById(this.inputId);
    if (!inp) return;

    // If already wrapped (e.g. navigated back to page), bail out
    if (inp.closest('.dp-wrap')) return;

    // Wrap the existing input
    const wrap = document.createElement('div');
    wrap.className = 'dp-wrap';
    inp.parentNode.insertBefore(wrap, inp);
    inp.remove();

    // Display input (read-only, shows formatted date)
    this.displayEl = document.createElement('div');
    this.displayEl.className = 'dp-input';
    this.displayEl.innerHTML = '<span class="dp-icon">📅</span><span class="dp-text">Select a date</span>';
    this.displayEl.addEventListener('click', e => { e.stopPropagation(); this._toggle(); });
    wrap.appendChild(this.displayEl);

    // Hidden real input for form reading
    this.hiddenEl = document.createElement('input');
    this.hiddenEl.type = 'hidden';
    this.hiddenEl.id   = this.inputId;
    wrap.appendChild(this.hiddenEl);

    // Calendar popup
    this.cal = document.createElement('div');
    this.cal.className = 'dp-calendar';
    wrap.appendChild(this.cal);

    // Close on outside click
    document.addEventListener('click', e => {
      if (!wrap.contains(e.target)) this._close();
    });

    this._render();
  }

  setValue(dateStr) {
    if (!dateStr) return;
    // Accept YYYY-MM-DD or YYYY-MM
    const d = new Date(dateStr.length === 7 ? dateStr + '-01' : dateStr);
    if (isNaN(d)) return;
    this.value    = dateStr.length === 7 ? dateStr + '-01' : dateStr;
    this.viewDate = new Date(d.getFullYear(), d.getMonth(), 1);
    this._updateDisplay();
    this.hiddenEl.value = this.value;
    this._render();
  }

  getValue() { return this.value || ''; }

  _toggle() { this.open ? this._close() : this._open(); }
  _open()   { this.open = true;  this.cal.classList.add('open');    this._render(); }
  _close()  { this.open = false; this.cal.classList.remove('open'); }

  _updateDisplay() {
    const textEl = this.displayEl.querySelector('.dp-text');
    if (!textEl) return;
    if (!this.value) { textEl.textContent = 'Select a date'; return; }
    const d = new Date(this.value + 'T12:00:00');
    if (isNaN(d)) { textEl.textContent = this.value; return; }
    textEl.textContent = d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  }

  _selectDate(year, month, day) {
    const d = new Date(year, month, day);
    this.value = d.toISOString().split('T')[0];
    this.hiddenEl.value = this.value;
    this._updateDisplay();
    this._render();
    this._close();
    if (this.onChange) this.onChange(this.value);
  }

  _render() {
    const y  = this.viewDate.getFullYear();
    const m  = this.viewDate.getMonth();
    const today  = new Date();
    const selDate = this.value ? new Date(this.value + 'T12:00:00') : null;

    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

    // First day of month and total days
    const firstDay  = new Date(y, m, 1).getDay();
    const totalDays = new Date(y, m+1, 0).getDate();
    const prevDays  = new Date(y, m, 0).getDate();

    let daysHTML = '';
    // Previous month filler
    for (let i = firstDay - 1; i >= 0; i--) {
      daysHTML += `<div class="dp-day other-month">${prevDays - i}</div>`;
    }
    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const isToday    = today.getFullYear()===y && today.getMonth()===m && today.getDate()===d;
      const isSelected = selDate && selDate.getFullYear()===y && selDate.getMonth()===m && selDate.getDate()===d;
      const cls = ['dp-day', isToday?'today':'', isSelected?'selected':''].filter(Boolean).join(' ');
      daysHTML += `<div class="${cls}" data-dp-y="${y}" data-dp-m="${m}" data-dp-d="${d}">${d}</div>`;
    }
    // Next month filler
    const remaining = 42 - firstDay - totalDays;
    for (let d = 1; d <= remaining; d++) {
      daysHTML += `<div class="dp-day other-month">${d}</div>`;
    }

    this.cal.innerHTML = `
      <div class="dp-header">
        <button class="dp-nav" data-dp-prev>‹</button>
        <div class="dp-month-label">${MONTHS[m]} ${y}</div>
        <button class="dp-nav" data-dp-next>›</button>
      </div>
      <div class="dp-weekdays">${DAYS.map(d=>`<div class="dp-weekday">${d}</div>`).join('')}</div>
      <div class="dp-days">${daysHTML}</div>
      <div class="dp-shortcuts">
        <div class="dp-shortcut" data-dp-today>Today</div>
        <div class="dp-shortcut" data-dp-yesterday>Yesterday</div>
        <div class="dp-shortcut" data-dp-lastweek>Last week</div>
        <div class="dp-shortcut" data-dp-last2weeks>2 weeks ago</div>
        <div class="dp-shortcut" data-dp-lastmonth>Last month</div>
      </div>`;

    // Wire up events
    this.cal.querySelectorAll('[data-dp-y]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        this._selectDate(+el.dataset.dpY, +el.dataset.dpM, +el.dataset.dpD);
      });
    });
    this.cal.querySelector('[data-dp-prev]').addEventListener('click', e => {
      e.stopPropagation();
      this.viewDate = new Date(y, m-1, 1); this._render();
    });
    this.cal.querySelector('[data-dp-next]').addEventListener('click', e => {
      e.stopPropagation();
      this.viewDate = new Date(y, m+1, 1); this._render();
    });

    // Shortcuts
    const shortcuts = {
      '[data-dp-today]':     0,
      '[data-dp-yesterday]': 1,
      '[data-dp-lastweek]':  7,
      '[data-dp-last2weeks]':14,
      '[data-dp-lastmonth]': 30,
    };
    Object.entries(shortcuts).forEach(([sel, daysAgo]) => {
      const el = this.cal.querySelector(sel);
      if (!el) return;
      el.addEventListener('click', e => {
        e.stopPropagation();
        const d = new Date(); d.setDate(d.getDate() - daysAgo);
        this._selectDate(d.getFullYear(), d.getMonth(), d.getDate());
      });
    });
  }
}

// Global registry of date pickers
const _datePickers = {};

function initDatePicker(inputId, defaultValue) {
  // If picker already exists in DOM, just update value and return it
  if (_datePickers[inputId] && _datePickers[inputId].displayEl) {
    if (defaultValue) _datePickers[inputId].setValue(defaultValue);
    return _datePickers[inputId];
  }
  // Otherwise create fresh
  const dp = new DatePicker(inputId, null);
  _datePickers[inputId] = dp;
  if (defaultValue) dp.setValue(defaultValue);
  return dp;
}

function getDatePickerValue(inputId) {
  // First try the custom picker, then fall back to native input
  if (_datePickers[inputId]) return _datePickers[inputId].getValue();
  const el = document.getElementById(inputId);
  return el ? el.value : '';
}



// ══════════════════════════════════════════════════════
//  STRATEGY LIBRARY
// ══════════════════════════════════════════════════════
function updateStratBadge() {
  const n = APP.strategies.length;
  const b = document.getElementById('stratBadge');
  if (!b) return;
  if (n > 0) { b.textContent = n; b.style.display = 'flex'; }
  else b.style.display = 'none';
}

function renderStratLib() {
  const el = document.getElementById('stratLibList');
  if (!el) return;

  if (!APP.strategies.length) {
    el.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--muted)">
      <div style="font-size:40px;opacity:0.2;margin-bottom:12px">📚</div>
      <div style="font-size:13px;font-weight:600;margin-bottom:6px">No strategies yet</div>
      <div style="font-size:11px">Generate a strategy from the AI Strategy page — it will be saved here automatically.</div>
    </div>`;
    return;
  }

  const DOM_C = {'Service Assurance':'#ffc542','Security':'#ff6b35','Service Assurance/Security':'#ff9f35','Enterprise':'#00c8ff','Service Providers':'#00e5a0'};

  el.innerHTML = APP.strategies.map((st,i) => {
    const s    = st.strategy || {};
    const prob = s.closingProbability || 0;
    const pc   = prob>=70?'#00e5a0':prob>=50?'#ffc542':'#ff6b35';
    const dc   = DOM_C[st.domain] || '#5a7a99';
    const date = new Date(st.date+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});

    return `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;margin-bottom:12px;overflow:hidden;transition:box-shadow 0.2s" onmouseover="this.style.boxShadow='0 4px 20px rgba(0,0,0,0.3)'" onmouseout="this.style.boxShadow=''">

        <!-- Header row -->
        <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border);cursor:pointer" onclick="toggleStratCard(${i})">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:3px;height:40px;border-radius:2px;background:${dc};flex-shrink:0"></div>
            <div>
              <div style="font-family:'Syne',sans-serif;font-size:13px;font-weight:700;margin-bottom:3px">${st.opp}</div>
              <div style="font-size:10px;color:var(--muted);display:flex;gap:8px;align-items:center">
                <span>${st.acct||''}</span>
                <span style="padding:1px 7px;border-radius:5px;background:${dc}15;color:${dc};border:1px solid ${dc}30">${st.domain||'—'}</span>
                <span>${st.region||'—'}</span>
                <span style="color:var(--muted)">·</span>
                <span>${date}</span>
              </div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;flex-shrink:0">
            <div style="text-align:center;border:2px solid ${pc};border-radius:50%;width:44px;height:44px;display:flex;flex-direction:column;align-items:center;justify-content:center">
              <div style="font-family:'Syne',sans-serif;font-size:13px;font-weight:800;color:${pc}">${prob}%</div>
            </div>
            <div style="display:flex;gap:6px">
              <button onclick="event.stopPropagation();deleteStrategy(${st.id})"
                style="background:transparent;border:1px solid var(--border);color:var(--muted);border-radius:7px;padding:5px 10px;cursor:pointer;font-size:10px"
                title="Delete">🗑</button>
              <div id="strat-chevron-${i}" style="font-size:16px;color:var(--muted);transition:transform 0.2s;display:flex;align-items:center">▸</div>
            </div>
          </div>
        </div>

        <!-- Collapsed summary -->
        <div id="strat-summary-${i}" style="padding:12px 20px;display:flex;gap:16px;flex-wrap:wrap">
          <div style="flex:1;min-width:200px">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.12em;color:var(--muted);margin-bottom:5px">Next Step</div>
            <div style="font-size:11px;color:var(--accent3)">→ ${s.recommendedNextStep||'—'}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${(s.winThemes||[]).map(t=>`<span style="font-size:9px;padding:2px 9px;border-radius:8px;background:rgba(0,200,255,0.08);border:1px solid rgba(0,200,255,0.2);color:var(--accent)">${t}</span>`).join('')}
          </div>
        </div>

        <!-- Expanded full strategy (hidden by default) -->
        <div id="strat-full-${i}" style="display:none;padding:0 20px 20px;border-top:1px solid var(--border)">
          <div style="margin-top:14px;font-size:11px;line-height:1.7;color:var(--text2);margin-bottom:14px">${s.executiveSummary||''}</div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
            <div>
              <div style="font-size:8px;text-transform:uppercase;letter-spacing:0.13em;color:var(--muted);margin-bottom:7px">Win Themes</div>
              ${(s.winThemes||[]).map(t=>`<div style="font-size:10px;padding:4px 10px;border-radius:7px;background:rgba(0,200,255,0.06);border:1px solid rgba(0,200,255,0.15);color:var(--accent);margin-bottom:4px">${t}</div>`).join('')}
            </div>
            <div>
              <div style="font-size:8px;text-transform:uppercase;letter-spacing:0.13em;color:var(--muted);margin-bottom:7px">Risks</div>
              ${(s.risks||[]).map(r=>`<div style="font-size:10px;padding:4px 10px;border-radius:7px;background:rgba(255,107,53,0.06);border:1px solid rgba(255,107,53,0.15);color:var(--accent2);margin-bottom:4px">⚠ ${r}</div>`).join('')}
            </div>
          </div>

          <div style="font-size:8px;text-transform:uppercase;letter-spacing:0.13em;color:var(--muted);margin-bottom:8px">8-Week Action Plan</div>
          ${(s.actionPlan||[]).map(a=>`
            <div style="display:flex;gap:10px;align-items:flex-start;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px 12px;margin-bottom:5px">
              <div style="font-size:9px;color:var(--muted);white-space:nowrap;min-width:65px;padding-top:1px">${a.week}</div>
              <div style="flex:1"><div style="font-size:11px;line-height:1.4;margin-bottom:1px">${a.action}</div><div style="font-size:9px;color:var(--muted)">👤 ${a.owner}</div></div>
              <div style="font-size:8px;text-transform:uppercase;padding:2px 7px;border-radius:7px;color:${{high:'#ff6b35',medium:'#ffc542',low:'#00e5a0'}[a.priority]||'#5a7a99'};background:${{high:'#ff6b35',medium:'#ffc542',low:'#00e5a0'}[a.priority]||'#5a7a99'}15;border:1px solid ${{high:'#ff6b35',medium:'#ffc542',low:'#00e5a0'}[a.priority]||'#5a7a99'}30">${a.priority}</div>
            </div>`).join('')}

          ${s.competitiveEdge ? `<div style="margin-top:12px;padding:12px 15px;background:rgba(255,197,66,0.05);border:1px solid rgba(255,197,66,0.2);border-radius:9px;font-size:11px;line-height:1.6">🏆 ${s.competitiveEdge}</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

function toggleStratCard(i) {
  const full     = document.getElementById('strat-full-'+i);
  const summary  = document.getElementById('strat-summary-'+i);
  const chevron  = document.getElementById('strat-chevron-'+i);
  if (!full) return;
  const isOpen = full.style.display !== 'none';
  full.style.display    = isOpen ? 'none'  : 'block';
  summary.style.display = isOpen ? 'flex'  : 'none';
  chevron.style.transform = isOpen ? '' : 'rotate(90deg)';
}

function deleteStrategy(id) {
  APP.strategies = APP.strategies.filter(s => s.id !== id);
  save('strategies', APP.strategies);
  updateStratBadge();
  renderStratLib();
}

function clearAllStrategies() {
  if (!confirm('Delete all saved strategies?')) return;
  APP.strategies = [];
  save('strategies', APP.strategies);
  updateStratBadge();
  renderStratLib();
}


// ══════════════════════════════════════════════════════
//  THEME SWITCHER
// ══════════════════════════════════════════════════════
function applyTheme(theme) {
  const btn = document.getElementById('themeToggleBtn');
  if (theme === 'light') {
    document.body.classList.add('light');
    if (btn) { btn.textContent = '🌙 Dark'; }
  } else {
    document.body.classList.remove('light');
    if (btn) { btn.textContent = '☀ Light'; }
  }
  localStorage.setItem('ns_theme', theme);
}

function toggleTheme() {
  const current = localStorage.getItem('ns_theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}


// ══════════════════════════════════════════════════════
//  PROSPECT INTELLIGENCE
// ══════════════════════════════════════════════════════

function initProspectPage() {
  // Populate region filter
  const sel = document.getElementById('prospectRegion');
  if (sel) {
    sel.innerHTML = '<option value="">All Regions</option>' +
      APP.regions.filter(r=>r.active).map(r=>`<option>${r.name}</option>`).join('');
  }
}

async function generateProspects() {
  const btn      = document.getElementById('prospectGenBtn');
  const output   = document.getElementById('prospectOutput');
  const region   = document.getElementById('prospectRegion')?.value   || '';
  const domain   = document.getElementById('prospectDomain')?.value   || '';
  const industry = document.getElementById('prospectIndustry')?.value || '';
  const count    = document.getElementById('prospectCount')?.value    || '12';

  btn.disabled   = true;
  btn.textContent = '⏳ Analysing…';

  output.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px;gap:16px;color:var(--muted)">
    <div style="width:36px;height:36px;border:3px solid var(--border);border-top-color:#7b2fff;border-radius:50%;animation:spin 0.9s linear infinite"></div>
    <div style="font-size:12px">Analysing your pipeline and North Africa market…</div>
  </div>`;

  // Build pipeline context
  const activeOpps = APP.opportunities.filter(o => o.stage !== 'Closed Lost');
  const existingAccounts = [...new Set(activeOpps.map(o=>(o.account||o.name)).filter(Boolean))];
  const pipelineCtx = activeOpps.slice(0,15).map(o=>
    `${o.account||o.name} | ${o.domain} | ${o.industry} | ${o.region} | ${o.stage} | $${((o.value||0)/1000).toFixed(0)}K`
  ).join('\\n');

  const regionCtx  = region   ? `Focus on region: ${region}` : `Cover all regions: ${APP.regions.filter(r=>r.active).map(r=>r.name).join(', ')}`;
  const domainCtx  = domain   ? `Focus on domain: ${domain}` : 'Cover all domains (Service Assurance, Security, Enterprise, Service Providers)';
  const industryCtx= industry ? `Focus on industry: ${industry}` : 'Cover all industries';

  const prompt = `You are a senior NETSCOUT sales intelligence analyst specialising in North and West Africa.

EXISTING PIPELINE (accounts already being worked):
${pipelineCtx}

EXISTING ACCOUNTS TO EXCLUDE: ${existingAccounts.join(', ')}

NETSCOUT SOLUTIONS:
- Service Assurance: nGeniusONE, Omnis Analytics, InfiniStream, TrueCall (for telecoms/operators)
- Security: Arbor DDoS Edge, Arbor TMS, Omnis Cyber Intelligence (for any org under threat)
- Enterprise: nGeniusONE APM, network visibility (for banks, airports, govt, enterprises)

TERRITORY: ${APP.regions.filter(r=>r.active).map(r=>r.name).join(', ')}
${regionCtx}
${domainCtx}
${industryCtx}
COUNT: Generate exactly ${count} prospect suggestions

For each prospect, think about:
- Telecoms/ISPs rolling out 5G or expanding networks
- Banks and financial institutions digitalising
- Government agencies and ministries modernising IT
- Airports, utilities, large enterprises with complex networks
- Any org that recently had a cyber incident or is under regulatory pressure

Return ONLY raw JSON. No markdown, no code fences, no comments, no explanation. Start your response with { and end with }. Example structure:
{
  "prospects": [
    {
      "account": "Company name",
      "country": "Country name",
      "region": "One of the territory regions",
      "industry": "Service Provider|Enterprise|Banking|Government|Utilities",
      "domain": "Service Assurance|Security|Enterprise|Service Providers",
      "solution": "Specific NETSCOUT product e.g. nGeniusONE, Arbor DDoS",
      "fitReason": "2 sentences why this account is a strong fit for NETSCOUT right now",
      "trigger": "Key business trigger e.g. 5G rollout, DDoS incident, digital transformation",
      "firstMove": "Specific recommended first action — who to contact and what to say",
      "estimatedMin": 150000,
      "estimatedMax": 500000,
      "fitScore": 85
    }
  ],
  "insight": "2-3 sentence strategic insight about the overall opportunity landscape in this territory"
}`;

  try {
    const res  = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await res.json();
    const raw    = data.content.map(b=>b.text||'').join('');
    const parsed = safeParseJSON(raw);
    if (!parsed || !parsed.prospects) throw new Error('AI returned invalid JSON — please try again');

    // Auto-save session
    const session = {
      id:        Date.now(),
      date:      new Date().toISOString().split('T')[0],
      time:      new Date().toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'}),
      region:    region || 'All Regions',
      domain:    domain || 'All Domains',
      industry:  industry || 'All Industries',
      count:     (parsed.prospects||[]).length,
      data:      parsed,
    };
    APP.prospectSessions.unshift(session);
    if (APP.prospectSessions.length > 20) APP.prospectSessions = APP.prospectSessions.slice(0,20);
    save('prospectSessions', APP.prospectSessions);
    updateProspectHistoryBadge();

    renderProspects(parsed);
  } catch(e) {
    output.innerHTML = `<div style="color:var(--accent2);padding:20px;font-size:11px">⚠ ${e.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = '🎯 Generate Prospects';
  }
}

function renderProspects(data) {
  const output = document.getElementById('prospectOutput');
  const prospects = data.prospects || [];
  const insight   = data.insight   || '';

  const DOM_C = {
    'Service Assurance':'#ffc542','Security':'#ff6b35',
    'Enterprise':'#00c8ff','Service Providers':'#00e5a0',
  };
  const IND_C = {
    'Service Provider':'#00e5a0','Enterprise':'#00c8ff',
    'Banking':'#7b2fff','Government':'#ff9f35','Utilities':'#4ecdc4',
  };

  const cards = prospects.map((p, i) => {
    const dc  = DOM_C[p.domain]  || '#5a7a99';
    const ic  = IND_C[p.industry]|| '#5a7a99';
    const sc  = p.fitScore>=80?'#00e5a0':p.fitScore>=60?'#ffc542':'#ff6b35';
    const estMin = p.estimatedMin||0;
    const estMax = p.estimatedMax||0;
    const estStr = estMin&&estMax
      ? `$${(estMin/1000).toFixed(0)}K – $${(estMax/1000).toFixed(0)}K`
      : '—';

    return `
      <div class="prospect-card" id="pcard-${i}">
        <div class="prospect-card-header" style="border-top:3px solid ${dc};cursor:pointer" onclick="toggleProspectCard(${i})">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div class="prospect-account">${p.account}</div>
            <span id="pchev-${i}" style="font-size:14px;color:var(--muted);transition:transform 0.2s;transform:rotate(180deg)">▾</span>
          </div>
          <div class="prospect-meta">
            <span style="color:${ic};padding:1px 7px;border-radius:5px;background:${ic}12;border:1px solid ${ic}25">${p.industry}</span>
            <span style="color:${dc};padding:1px 7px;border-radius:5px;background:${dc}12;border:1px solid ${dc}25">${p.domain}</span>
            <span>📍 ${p.country}</span>
          </div>
          <div class="prospect-score-bar">
            <span style="font-size:9px;color:var(--muted)">Fit</span>
            <div class="prospect-score-track">
              <div class="prospect-score-fill" style="width:${p.fitScore||0}%;background:${sc}"></div>
            </div>
            <span style="font-size:9px;font-weight:700;color:${sc}">${p.fitScore||0}%</span>
          </div>
        </div>
        <div class="prospect-body" id="pbody-${i}">
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.12em;color:var(--muted);margin-bottom:4px">Why now</div>
          <div class="prospect-fit">${p.fitReason}</div>
          <div style="margin-bottom:8px">
            <span style="font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:var(--muted)">Trigger: </span>
            <span style="font-size:10px;color:var(--accent4)">${p.trigger}</span>
          </div>
          <span class="prospect-solution" style="background:${dc}12;border:1px solid ${dc}25;color:${dc}">
            💡 ${p.solution}
          </span>
          <div class="prospect-move">→ ${p.firstMove}</div>
        </div>
        <div class="prospect-footer" id="pfoot-${i}">
          <div class="prospect-size">Est. deal: <strong>${estStr}</strong></div>
          <button class="add-prospect-btn" id="addbtn-${i}" onclick="addProspectToPipeline(${i})">
            ＋ Add to Pipeline
          </button>
        </div>
      </div>`;
  }).join('');

  output.innerHTML = `
    ${insight ? `<div style="background:rgba(123,47,255,0.06);border:1px solid rgba(123,47,255,0.2);border-radius:12px;padding:14px 18px;margin-bottom:16px;font-size:11px;line-height:1.7;color:var(--text2)">
      <span style="font-size:9px;text-transform:uppercase;letter-spacing:0.13em;color:#a07fff;margin-right:8px">Strategic Insight</span>${insight}
    </div>` : ''}
    <div style="font-size:10px;color:var(--muted);margin-bottom:12px">${prospects.length} prospects · click header to expand/collapse · <strong>＋ Add to Pipeline</strong> to create an opportunity</div>
    <div class="prospect-grid">${cards}</div>`;

  // Store for later use
  window._lastProspects = prospects;
}

function toggleProspectCard(i) {
  const body  = document.getElementById('pbody-' + i);
  const foot  = document.getElementById('pfoot-' + i);
  const chev  = document.getElementById('pchev-' + i);
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if (foot) foot.style.display = isOpen ? 'none' : 'flex';
  if (chev) chev.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
}

function addProspectToPipeline(idx) {
  const p   = (window._lastProspects||[])[idx];
  if (!p) return;

  const newOpp = {
    id:          Date.now() + idx,
    name:        `${p.account} – ${p.solution}`,
    account:     p.account,
    domain:      p.domain,
    industry:    p.industry,
    region:      p.region || p.country,
    value:       Math.round((p.estimatedMin + p.estimatedMax) / 2) || 200000,
    stage:       'Prospect',
    close:       new Date(Date.now() + 180*86400000).toISOString().slice(0,7),
    prob:        20,
    product:     p.solution,
    partner:     '',
    activityLog: [{
      id:        Date.now(),
      type:      '🎯 Prospect Intel',
      date:      new Date().toISOString().split('T')[0],
      note:      `Added from Prospect Intelligence. Trigger: ${p.trigger}. First move: ${p.firstMove}`,
      next:      p.firstMove,
      sentiment: 'neutral',
      attendees: [],
      user:      APP.profile.name || 'Me',
    }],
  };

  APP.opportunities.unshift(newOpp);
  save('opportunities', APP.opportunities);

  // Update button
  const btn = document.getElementById('addbtn-'+idx);
  if (btn) {
    btn.textContent = '✓ Added';
    btn.classList.add('added');
    btn.disabled = true;
  }

  // Mark as added in latest session
  if (APP.prospectSessions.length) {
    const latest = APP.prospectSessions[0];
    if (latest.data.prospects && latest.data.prospects[idx]) {
      latest.data.prospects[idx]._added = true;
      save('prospectSessions', APP.prospectSessions);
    }
  }
  showMsg(`✓ ${p.account} added to pipeline as a Prospect`);
}


// ══════════════════════════════════════════════════════
//  PROSPECT INTELLIGENCE
// ══════════════════════════════════════════════════════




function updateProspectHistoryBadge() {
  const n    = APP.prospectSessions.length;
  const badge = document.getElementById('historyCount');
  if (!badge) return;
  if (n > 0) { badge.textContent = n; badge.style.display = 'inline'; }
  else badge.style.display = 'none';
}

function toggleProspectHistory() {
  const panel = document.getElementById('prospectHistory');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) renderProspectHistoryList();
  const lbl = document.getElementById('historyBtnLabel');
  if (lbl) lbl.textContent = isOpen ? 'Previous Sessions' : 'Hide Sessions';
}

function renderProspectHistoryList() {
  const el = document.getElementById('prospectHistoryList');
  if (!el) return;

  if (!APP.prospectSessions.length) {
    el.innerHTML = `<div style="text-align:center;padding:24px;color:var(--muted);font-size:11px">No sessions saved yet. Generate prospects to start building your history.</div>`;
    return;
  }

  el.innerHTML = APP.prospectSessions.map((s, i) => {
    const highCount = (s.data.prospects||[]).filter(p=>p.fitScore>=80||p.priority==='high').length;
    const addedCount = (s.data.prospects||[]).filter(p=>p._added).length;
    return `
      <div style="display:flex;align-items:center;gap:14px;padding:12px 18px;border-bottom:1px solid rgba(26,47,74,0.4);cursor:pointer;transition:background 0.15s"
        onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''"
        onclick="loadProspectSession(${i})">
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;font-weight:600;margin-bottom:3px">
            ${s.region} · ${s.domain} · ${s.industry}
          </div>
          <div style="font-size:9px;color:var(--muted);display:flex;gap:10px">
            <span>📅 ${s.date} ${s.time}</span>
            <span>📋 ${s.count} prospects</span>
            ${highCount ? `<span style="color:var(--accent3)">🌟 ${highCount} high fit</span>` : ''}
            ${addedCount ? `<span style="color:var(--accent4)">✓ ${addedCount} added to pipeline</span>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button onclick="event.stopPropagation();deleteProspectSession(${s.id})"
            style="background:transparent;border:1px solid var(--border);color:var(--muted);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px">🗑</button>
          <span style="font-size:12px;color:var(--muted);align-self:center">›</span>
        </div>
      </div>`;
  }).join('');
}

function loadProspectSession(idx) {
  const s = APP.prospectSessions[idx];
  if (!s) return;
  // Close history panel
  const hp = document.getElementById('prospectHistory');
  if (hp) hp.style.display = 'none';
  const lbl = document.getElementById('historyBtnLabel');
  if (lbl) lbl.textContent = 'Previous';
  // Render the saved results using the main renderProspects fn
  renderProspects(s.data);
}

function deleteProspectSession(id) {
  APP.prospectSessions = APP.prospectSessions.filter(s => s.id !== id);
  save('prospectSessions', APP.prospectSessions);
  updateProspectHistoryBadge();
  renderProspectHistoryList();
}

function clearProspectHistory() {
  if (!confirm('Clear all saved prospect sessions?')) return;
  APP.prospectSessions = [];
  save('prospectSessions', APP.prospectSessions);
  updateProspectHistoryBadge();
  renderProspectHistoryList();
}


// ══════════════════════════════════════════════════════
//  ACCOUNT ENRICHMENT
// ══════════════════════════════════════════════════════

async function enrichOpp(idx) {
  const o   = APP.opportunities[idx];
  if (!o) return;

  const btn = document.querySelector(`tr[data-id="${o.id}"] button[onclick="enrichOpp(${idx})"]`);
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }

  const prompt = `You are a business intelligence analyst. Provide financial estimates for this company.

Company: ${o.account || o.name}
Country: ${o.region || 'North Africa'}
Industry: ${o.industry || 'Telecom/Enterprise'}

Return ONLY raw JSON starting with { and ending with }:
{
  "revenue": <annual revenue in USD millions, number only>,
  "capex": <annual capex in USD millions, number only>,
  "revenueNote": "<one sentence: source or confidence level e.g. 'Estimated from public filings 2023' or 'AI estimate, medium confidence'>",
  "employees": <approximate headcount, number>,
  "founded": <year founded, number or null>,
  "hqCity": "<headquarters city>",
  "description": "<one sentence company description>"
}`;

  try {
    const res  = await fetch('/api/claude', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:400,
        messages:[{role:'user', content:prompt}] })
    });
    const data = await res.json();
    const raw  = data.content.map(b=>b.text||'').join('');
    const info = safeParseJSON(raw);
    if (!info) throw new Error('No data returned');

    // Update opp
    if (info.revenue)     APP.opportunities[idx].revenue     = info.revenue;
    if (info.capex)       APP.opportunities[idx].capex       = info.capex;
    if (info.revenueNote) APP.opportunities[idx].revenueNote = info.revenueNote;
    if (info.employees)   APP.opportunities[idx].employees   = info.employees;
    if (info.founded)     APP.opportunities[idx].founded     = info.founded;
    if (info.hqCity)      APP.opportunities[idx].hqCity      = info.hqCity;
    if (info.description) APP.opportunities[idx].description = info.description;

    save('opportunities', APP.opportunities);
    renderOppTable();
    showMsg(`✓ ${o.account||o.name} enriched — Revenue: $${info.revenue||'?'}M`);
  } catch(e) {
    showMsg('⚠ Enrichment failed: ' + e.message);
  } finally {
    if (btn) { btn.textContent = '✦ AI'; btn.disabled = false; }
  }
}

// ── Hover tooltip for account revenue/capex ──
let _tooltipEl = null;

function showAccountTooltipById(event, oppId) {
  const opp = APP.opportunities.find(o => o.id === oppId);
  if (!opp || (!opp.revenue && !opp.capex && !opp.description)) return;
  showAccountTooltip(event, opp.account || opp.name, opp);
}

function showAccountTooltip(event, accountName, opp) {
  if (!opp) opp = APP.opportunities.find(o => (o.account||o.name) === accountName);
  if (!opp || (!opp.revenue && !opp.capex && !opp.description)) return;

  hideAccountTooltip();

  const tip = document.createElement('div');
  tip.id = 'accountTooltip';
  tip.style.cssText = `
    position:fixed;z-index:9999;
    background:var(--surface);border:1px solid var(--border);
    border-radius:10px;padding:12px 14px;
    box-shadow:0 8px 32px rgba(0,0,0,0.3);
    min-width:200px;max-width:280px;
    pointer-events:none;
    font-size:10px;line-height:1.6;
  `;

  const rows = [];
  if (opp.revenue)     rows.push(`<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:var(--muted)">Annual Revenue</span><span style="font-weight:600;color:var(--accent3)">$${opp.revenue.toLocaleString()}M</span></div>`);
  if (opp.capex)       rows.push(`<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:var(--muted)">CapEx</span><span style="font-weight:600;color:var(--accent4)">$${opp.capex.toLocaleString()}M</span></div>`);
  if (opp.employees)   rows.push(`<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:var(--muted)">Employees</span><span style="font-weight:600">${opp.employees.toLocaleString()}</span></div>`);
  if (opp.hqCity)      rows.push(`<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:var(--muted)">HQ</span><span>${opp.hqCity}</span></div>`);
  if (opp.founded)     rows.push(`<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:var(--muted)">Founded</span><span>${opp.founded}</span></div>`);

  tip.innerHTML = `
    <div style="font-family:'Syne',sans-serif;font-size:11px;font-weight:700;margin-bottom:8px;color:var(--text)">${opp.account||opp.name}</div>
    ${rows.join('')}
    ${opp.description ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);font-size:9px;color:var(--muted);line-height:1.5">${opp.description}</div>` : ''}
    ${opp.revenueNote ? `<div style="margin-top:6px;font-size:8px;color:var(--muted);font-style:italic">⚡ ${opp.revenueNote}</div>` : ''}
  `;

  document.body.appendChild(tip);
  _tooltipEl = tip;

  // Position near cursor
  const rect = event.target.getBoundingClientRect();
  const x = Math.min(rect.left, window.innerWidth - 300);
  const y = rect.bottom + 6;
  tip.style.left = x + 'px';
  tip.style.top  = y + 'px';
}

function hideAccountTooltip() {
  if (_tooltipEl) {
    _tooltipEl.remove();
    _tooltipEl = null;
  }
  const existing = document.getElementById('accountTooltip');
  if (existing) existing.remove();
}

// ══════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════

// ── Inject drawer + wire up event delegation ──
(function initDrawerAndDelegation() {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'drawerOverlay';
  overlay.style.position      = 'fixed';
  overlay.style.inset         = '0';
  overlay.style.background    = 'rgba(0,0,0,0.5)';
  overlay.style.zIndex        = '100';
  overlay.style.pointerEvents = 'none';
  overlay.style.visibility    = 'hidden';
  overlay.style.opacity       = '0';
  overlay.style.transition    = 'opacity 0.2s ease, visibility 0.2s ease';
  overlay.addEventListener('click', closeDrawer);
  document.body.appendChild(overlay);

  // Create drawer
  const drawer = document.createElement('div');
  drawer.id = 'drillDrawer';
  drawer.style.position      = 'fixed';
  drawer.style.top           = '0';
  drawer.style.right         = '0';
  drawer.style.width         = '480px';
  drawer.style.height        = '100vh';
  drawer.style.background    = 'var(--surface)';
  drawer.style.borderLeft    = '1px solid var(--border)';
  drawer.style.zIndex        = '101';
  drawer.style.display       = 'flex';
  drawer.style.flexDirection = 'column';
  drawer.style.overflow      = 'hidden';
  drawer.style.transform     = 'translateX(110%)';
  drawer.style.visibility    = 'hidden';
  drawer.style.pointerEvents = 'none';
  drawer.style.transition    = 'transform 0.25s cubic-bezier(0.4,0,0.2,1), visibility 0.25s';
  drawer.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;padding:20px 24px;border-bottom:1px solid var(--border);flex-shrink:0">' +
      '<div>' +
        '<div id="drawerTitle" style="font-family:Syne,sans-serif;font-size:15px;font-weight:800"></div>' +
        '<div id="drawerSub" style="font-size:10px;color:var(--muted);margin-top:2px"></div>' +
      '</div>' +
      '<button id="drawerCloseBtn" style="background:var(--surface2);border:1px solid var(--border);color:var(--muted);width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:16px">✕</button>' +
    '</div>' +
    '<div id="drawerBody" style="flex:1;overflow-y:auto;padding:20px 24px"></div>';
  document.body.appendChild(drawer);
  document.getElementById('drawerCloseBtn').addEventListener('click', closeDrawer);

  // ── EVENT DELEGATION — handles all data-action clicks anywhere in the page ──
  document.addEventListener('click', function(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    if (el.dataset.stop) e.stopPropagation();
    const action   = el.dataset.action;
    const industry = el.dataset.industry;
    const stage    = el.dataset.stage;
    switch(action) {
      case 'drillTotalPipeline': drillTotalPipeline(); break;
      case 'drillForecast':      drillForecast();      break;
      case 'drillStalled':       drillStalled();       break;
      case 'drillHotDeals':      drillHotDeals();      break;
      case 'drillMustWin':      drillMustWin();       break;
      case 'drillIndustry':      if(industry) drillIndustry(industry); break;
      case 'drillStage':         if(stage)    drillStage(stage);    break;
    }
  });
})();

document.getElementById('topbarDate').textContent =
  new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});

// Normalise raw SFDC stage names saved in localStorage
(function normaliseStoredStages() {
  const RAW_MAP = {
    'am verified':'Qualification','needs analysis':'Qualification',
    'qualified opportunity':'Qualification','roi and poc':'Proposal Sent',
    'value proposition':'Proposal Sent','id. decision makers':'Proposal Sent',
    'perception analysis':'Proposal Sent','proposal/price quote':'Proposal Sent',
    'netscout selected':'Negotiation','negotiation/review':'Negotiation',
    'closed won':'Closed Won','closed lost':'Closed Lost',
  };
  let changed = false;
  APP.opportunities.forEach(o => {
    const raw = (o.stage||'').toLowerCase().trim();
    if (RAW_MAP[raw]) {
      o.stage = RAW_MAP[raw];
      changed = true;
    }
  });
  if (changed) save('opportunities', APP.opportunities);
})();

// Clean up stale regions from localStorage (remove Egypt, Algeria, Tunisia)
(function cleanStaleRegions() {
  const stale = ['Egypt','Algeria','Tunisia'];
  let changed = false;
  APP.regions = APP.regions.filter(r => {
    if (stale.includes(r.name)) { changed = true; return false; }
    return true;
  });
  // Ensure Libya, Mauritania, Togo, Benin exist
  const required = [
    { id:3, name:'Mauritania', active:true, color:'#ffc542' },
    { id:4, name:'Togo',       active:true, color:'#ff6b35' },
    { id:5, name:'Benin',      active:true, color:'#7b2fff' },
    { id:6, name:'Libya',      active:true, color:'#00b8ec' },
  ];
  required.forEach(req => {
    if (!APP.regions.find(r => r.name === req.name)) {
      APP.regions.push(req);
      changed = true;
    }
  });
  if (changed) save('regions', APP.regions);
})();

// Migrate old meetings data into activityLog on each opportunity
(function migrateMeetings() {
  const meetings = APP.meetings || [];
  if (!meetings.length) return;
  let migrated = 0;
  meetings.forEach(m => {
    const opp = APP.opportunities.find(o => o.name === m.opp);
    if (!opp) return;
    if (!opp.activityLog) opp.activityLog = [];
    // Avoid duplicates
    if (opp.activityLog.find(e => e.id === m.id)) return;
    opp.activityLog.push({
      id:        m.id,
      type:      '🤝 Meeting',
      date:      m.date,
      note:      m.notes || '',
      next:      m.actions || '',
      sentiment: m.sentiment || 'neutral',
      attendees: m.attendees || [],
      user:      APP.profile.name || 'Me',
      migrated:  true,
    });
    migrated++;
  });
  if (migrated > 0) {
    save('opportunities', APP.opportunities);
    console.log(`Migrated ${migrated} meeting entries to activity log`);
  }
})();

// Apply saved theme
applyTheme(localStorage.getItem('ns_theme') || 'dark');
applyProfile();
renderDashboard();
updateStratBadge();
updateProspectHistoryBadge();

updateActionsBadge();
if(APP.actions.length) renderActSidebar();
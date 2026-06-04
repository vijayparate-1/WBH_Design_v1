'use client';
// src/app/page.tsx — WBH Design Module Main Page

import { useState, useCallback } from 'react';
import WBHHeader from '@/components/layout/WBHHeader';
import ProjectHeaderBar from '@/components/layout/ProjectHeaderBar';
import TabBar from '@/components/layout/TabBar';
import Stage1GasProps from '@/components/modules/Stage1GasProps';
import Stage2Firetube from '@/components/modules/Stage2Firetube';
import Stage3ProcessCoil from '@/components/modules/Stage3ProcessCoil';
import SummaryTab from '@/components/modules/SummaryTab';
import ProjectsTab from '@/components/modules/ProjectsTab';
import InsulationTab from '@/components/modules/InsulationTab';
import BOMTab from '@/components/modules/BOMTab';
import SourGasTab from '@/components/modules/SourGasTab';
import ExpTankTab from '@/components/modules/ExpTankTab';
import HTAnalyserTab from '@/components/modules/HTAnalyserTab';
import ValidationCasesTab from '@/components/modules/ValidationCasesTab';
import type { Stage1Results } from '@/lib/calculations/thermodynamics';
import type { Stage2Results, Stage3Results } from '@/lib/calculations/heater-sizing';

type ActiveTab =
  | 'stage1' | 'stage2' | 'stage3' | 'summary'
  | 'projects' | 'insulation' | 'bom'
  | 'sour' | 'exptank' | 'htanalyser' | 'validation';

interface DesignState {
  s1?: Stage1Results;
  s2?: Stage2Results;
  s3?: Stage3Results;
}

const TABS = [
  { id:'stage1',     label:'① Gas Props',      color: undefined },
  { id:'stage2',     label:'② Firetube',        color: undefined },
  { id:'stage3',     label:'③ Process Coil',    color: undefined },
  { id:'summary',    label:'④ Summary',         color: undefined },
  { id:'projects',   label:'📁 Projects',       color: '#1a7ab8' },
  { id:'insulation', label:'🌡 Insulation',     color: '#7a4500' },
  { id:'exptank',    label:'🔵 Exp. Tank',      color: '#0e6a3e' },
  { id:'sour',       label:'☠ Sour Gas',        color: '#7a1aa0' },
  { id:'htanalyser', label:'📈 HT Analyser',   color: '#1a5a8a' },
  { id:'bom',        label:'📋 BOM',            color: '#1a6a3e' },
  { id:'validation', label:'✔ Validation',      color: '#5a5a00' },
] as const;

export default function WBHDesignPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('stage1');
  const [design, setDesign] = useState<DesignState>({});

  const onS1Complete = useCallback((r: Stage1Results) =>
    setDesign(prev => ({ ...prev, s1: r })), []);
  const onS2Complete = useCallback((r: Stage2Results) =>
    setDesign(prev => ({ ...prev, s2: r })), []);
  const onS3Complete = useCallback((r: Stage3Results) =>
    setDesign(prev => ({ ...prev, s3: r })), []);

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <WBHHeader />
      <ProjectHeaderBar />
      <TabBar tabs={TABS} activeTab={activeTab}
        onTabChange={(t) => setActiveTab(t as ActiveTab)} />
      <main style={{ padding:'20px 24px' }}>
        {activeTab === 'stage1'     && <Stage1GasProps onComplete={onS1Complete} />}
        {activeTab === 'stage2'     && <Stage2Firetube s1Results={design.s1} onComplete={onS2Complete} />}
        {activeTab === 'stage3'     && <Stage3ProcessCoil s1Results={design.s1} s2Results={design.s2} onComplete={onS3Complete} />}
        {activeTab === 'summary'    && <SummaryTab design={design} />}
        {activeTab === 'projects'   && <ProjectsTab onLoad={(s) => setDesign(s as DesignState)} />}
        {activeTab === 'insulation' && <InsulationTab s1Results={design.s1} s2Results={design.s2} />}
        {activeTab === 'exptank'    && <ExpTankTab s2Results={design.s2} />}
        {activeTab === 'sour'       && <SourGasTab />}
        {activeTab === 'htanalyser' && <HTAnalyserTab s1Results={design.s1} s2Results={design.s2} s3Results={design.s3} />}
        {activeTab === 'bom'        && <BOMTab s2Results={design.s2} s3Results={design.s3} />}
        {activeTab === 'validation' && <ValidationCasesTab />}
      </main>
    </div>
  );
}

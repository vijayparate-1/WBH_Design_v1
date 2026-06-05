'use client';
// src/app/page.tsx — WBH Design Module Main Page
// Tab order: Stage1 → Stage2 → Stage3 → ShellSketcher → Insulation → ExpTank
//            → SourGas → BOM → FinalSummary | Projects | Validation | HTAnalyser

import { useState, useCallback } from 'react';
import WBHHeader from '@/components/layout/WBHHeader';
import ProjectHeaderBar from '@/components/layout/ProjectHeaderBar';
import TabBar from '@/components/layout/TabBar';
import Stage1GasProps from '@/components/modules/Stage1GasProps';
import Stage2Firetube from '@/components/modules/Stage2Firetube';
import Stage3ProcessCoil from '@/components/modules/Stage3ProcessCoil';
import ShellSketcherTab from '@/components/modules/ShellSketcherTab';
import InsulationTab from '@/components/modules/InsulationTab';
import ExpTankTab from '@/components/modules/ExpTankTab';
import SourGasTab from '@/components/modules/SourGasTab';
import BOMTab from '@/components/modules/BOMTab';
import FinalSummaryTab from '@/components/modules/FinalSummaryTab';
import ProjectsTab from '@/components/modules/ProjectsTab';
import ValidationCasesTab from '@/components/modules/ValidationCasesTab';
import HTAnalyserTab from '@/components/modules/HTAnalyserTab';
import type { Stage1Results } from '@/lib/calculations/thermodynamics';
import type { Stage2Results, Stage3Results } from '@/lib/calculations/heater-sizing';
import type { SketcherResults } from '@/components/modules/ShellSketcherTab';

type ActiveTab =
  | 'stage1' | 'stage2' | 'stage3'
  | 'sketcher' | 'insulation' | 'exptank' | 'sour' | 'bom' | 'final'
  | 'projects' | 'validation' | 'htanalyser';

interface DesignState {
  s1?: Stage1Results;
  s2?: Stage2Results;
  s3?: Stage3Results;
  sketcher?: SketcherResults;
  projectInfo?: {
    client: string; quotation: string; project: string;
    tagNo: string; rev: string; by: string; chkAppr: string;
    notes: string; date: string;
  };
}

// Tab definitions — numbered design flow + support tabs
// Progress indicator: design flow tabs show ✔ once data is available
const TABS = [
  { id:'stage1',    label:'① Gas Props',        color: undefined },
  { id:'stage2',    label:'② Firetube',          color: undefined },
  { id:'stage3',    label:'③ Process Coil',      color: undefined },
  { id:'sketcher',  label:'④ Shell Sketcher',    color: '#2d7a55' },
  { id:'insulation',label:'⑤ Insulation',        color: '#7a4500' },
  { id:'exptank',   label:'⑥ Exp. Tank',         color: '#0e6a3e' },
  { id:'sour',      label:'⑦ Sour Gas',          color: '#7a1aa0' },
  { id:'bom',       label:'⑧ BOM',               color: '#1a6a3e' },
  { id:'final',     label:'⑨ Final Summary',     color: '#b06000' },
  { id:'projects',  label:'📁 Projects',         color: '#1a7ab8' },
  { id:'validation',label:'✔ Validation',        color: '#5a5a00' },
  { id:'htanalyser',label:'🔥 HT Analyser',      color: '#c06000' },
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

  // Shell Sketcher emits confirmed OD — governs insulation and final summary
  const onSketcherComplete = useCallback((r: SketcherResults) =>
    setDesign(prev => ({ ...prev, sketcher: r })), []);

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <WBHHeader />
      <ProjectHeaderBar />
      <TabBar
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={(t) => setActiveTab(t as ActiveTab)} />
      <main style={{ padding:'20px 24px' }}>
        {activeTab === 'stage1'    && (
          <Stage1GasProps onComplete={onS1Complete} />
        )}
        {activeTab === 'stage2'    && (
          <Stage2Firetube
            s1Results={design.s1}
            onComplete={onS2Complete} />
        )}
        {activeTab === 'stage3'    && (
          <Stage3ProcessCoil
            s1Results={design.s1}
            s2Results={design.s2}
            onComplete={onS3Complete} />
        )}
        {activeTab === 'sketcher'  && (
          <ShellSketcherTab
            s2Results={design.s2}
            s3Results={design.s3}
            onComplete={onSketcherComplete} />
        )}
        {activeTab === 'insulation' && (
          <InsulationTab
            s1Results={design.s1}
            s2Results={design.s2}
            shellOD_mm={design.sketcher?.shellOD_mm} />
        )}
        {activeTab === 'exptank'   && (
          <ExpTankTab s2Results={design.s2} />
        )}
        {activeTab === 'sour'      && (
          <SourGasTab />
        )}
        {activeTab === 'bom'       && (
          <BOMTab s2Results={design.s2} s3Results={design.s3} />
        )}
        {activeTab === 'final'     && (
          <FinalSummaryTab design={design} />
        )}
        {activeTab === 'projects'  && (
          <ProjectsTab onLoad={(s) => setDesign(s as DesignState)} />
        )}
        {activeTab === 'validation' && (
          <ValidationCasesTab />
        )}
        {activeTab === 'htanalyser' && (
          <HTAnalyserTab
            s1Results={design.s1}
            s2Results={design.s2}
            s3Results={design.s3} />
        )}
      </main>
    </div>
  );
}

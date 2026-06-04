// drizzle/seed.ts
// Seed script: populates component library + historical reference projects
// Run: npx ts-node --esm drizzle/seed.ts
// OR:  npm run db:seed

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

// ─── HISTORICAL REFERENCE PROJECTS ─────────────────────────────────────────
// Sourced from HIST_PROJECTS in WBH_Design_v28.html

const HIST_PROJECTS = [
  {
    libId: 'q13048_berwick',
    tag: 'Q13048-DS002 Rev2',
    name: 'City Gate Station — 565 kW Natural Gas Heating WBH',
    location: 'Victoria, Australia',
    docNo: 'Q13048-DS002',
    date: '04/03/2022',
    sector: 'OilGas',
    country: 'Australia',
    isValidated: true,
    description: '565 kW WBH for natural gas custody transfer heating. Case 1 (Max Flow/Max Press): 35,000 Sm³/hr, 6890 kPag, 10→38.5°C. 2×DN400 2-pass ND natural draft. 3-path 8-row DN80/X-STG coil. A=41.62 m². Design duty 565 kW. Validated against certified GASCO datasheet Q13048-DS002 Rev2.',
    kpis: ['Q=565 kW','Shell Ø1716 × 7650 mm','2×DN400 WT6.35mm 2-pass','3×8 DN80 X-STG','A=41.62 m²','ΔP=50 kPa','Bath 62°C','★ DS Validated'],
    params: {
      comp_indices:{0:88.0,1:7.5,2:1.8,3:0.3,4:0.3,9:1.6,10:0.5},
      Tin:10,Tout:38.5,Pin:6890,dP:50,flow:26335,flowUnit:'kgh',
      basis:5,T_design:100,P_design:7600,
      config:'2x75',draftType:'natural',eta:80,fr:1.15,nPass:2,tubeLen:7.145,pipeDN:400,
      stackAlt:50,stackTamb:15,stackTflue:450,excessAir:22.5,stackH:3.25,stackDia:406,
      Tbath:62,s3_qnet:565,s3_Tin:10,s3_Tout:38.5,nPaths:3,nRows:8,nps:'3',
      s3_mat:'a106b',s3_pd:7600,s3_td:100,s3_corr:3,cf:1.15,uMethod:'natco_hi',
    },
    validationRef: 'Q13048-DS002 Rev 2, March 2022 — City Gate 565 kW WBH — DS Validated',
  },
  {
    libId: 'q10928_dongbrk',
    tag: 'Q10928-DS02 Rev0',
    name: 'City Gate Station — 80 kW Natural Gas Heating WBH (Phase 1)',
    location: 'Victoria, Australia',
    docNo: 'Q10928-DS02',
    date: '20/11/2013',
    sector: 'OilGas',
    country: 'Australia',
    isValidated: true,
    description: '80 kW WBH for natural gas heating at city gate PRS. Single 100% burner, U-tube firetube DN219.1mm (NPS8"). Process coil NPS2"/Sch80, 1 path, 10 passes. Ø816×3343mm.',
    kpis: ['Q=80 kW','Shell Ø816 × 3343 mm','1×DN219.1 2-pass 1×100%','1×10-pass NPS2"/Sch80','A=5.84 m²','ΔP=26 kPa','Bath 65.7°C','★ DS Validated'],
    params: {
      comp_indices:{0:88.0,1:7.5,2:1.8,3:0.3,4:0.3,9:1.6,10:0.5},
      Tin:10,Tout:44.4,Pin:8800,dP:100,flow:2953,flowUnit:'kgh',
      basis:5,T_design:100,P_design:10200,
      config:'1x100',draftType:'natural',eta:73,fr:1.15,nPass:2,tubeLen:3.14,pipeDN:200,
      stackAlt:50,stackTamb:15,stackTflue:420,excessAir:22.5,stackH:2.5,stackDia:219,
      Tbath:65.7,s3_qnet:80,s3_Tin:10,s3_Tout:44.4,nPaths:1,nRows:10,nps:'2',
      s3_mat:'a106b',s3_pd:10200,s3_td:100,s3_corr:1.5,cf:1.0,uMethod:'natco_hi',
    },
    validationRef: 'Q10928-DS02 Rev 0, November 2013',
  },
  {
    libId: 'donnybrook',
    tag: 'Q12896-DS001 Rev2',
    name: 'Donnybrook City Gate — 621 kW WBH',
    location: 'Donnybrook, VIC',
    docNo: 'Q12896-DS001',
    date: '16/11/2022',
    sector: 'OilGas',
    country: 'Australia',
    isValidated: true,
    description: '621 kW WBH at Donnybrook City Gate. DN450 radiant/DN400 convective firetube. 2×75% configuration.',
    kpis: ['Q=621 kW','Shell Ø 1,890 mm','L=8,533 mm','2×(DN450+DN400) 2×75%','ΔP=33.2 kPa','Bath 60°C'],
    params: {
      comp_indices:{0:90.93,1:5.24,2:0.74,4:0.07,6:0.02,9:0.87,10:2.1},
      Tin:10,Tout:44.86,Pin:8800,dP:50,flow:22457,flowUnit:'kgh',
      basis:5,T_design:100,P_design:8800,
      config:'2x75',draftType:'natural',eta:73,fr:1.15,nPass:2,tubeLen:7.23,pipeDN:450,
      stackAlt:100,stackTamb:15,stackTflue:388,excessAir:22.5,stackH:3.5,stackDia:406,
      Tbath:60,s3_qnet:621,nPaths:3,nRows:8,nps:'3',
    },
    validationRef: 'Q12896-DS001 Rev 2, November 2022',
  },
  {
    libId: 'newman',
    tag: 'Q10417-DS01 Rev3',
    name: 'Newman Power Station — Yarnima PRS Gas Heating',
    location: 'Newman, WA',
    docNo: 'Q10417-DS01',
    date: '25/09/2014',
    sector: 'Power',
    country: 'Australia',
    isValidated: false,
    description: '1,040 kW WBH for fuel gas heating at Newman Power Station Yarnima PRS. Highest pressure project in library: 102 barg.',
    kpis: ['Q=1,040 kW','Shell Ø 2,416 mm','L=9,765 mm','1×100% DN711/DN610','3×10-pass DN100 Sch80','A=102.2 m²'],
    params: {
      comp_indices:{0:90.93,1:5.24,2:0.74,4:0.07,6:0.02,9:0.87,10:2.1},
      Tin:15,Tout:53.87,Pin:10200,dP:70,flow:33264,flowUnit:'kgh',
      basis:5,T_design:85,P_design:10200,
      config:'1x100',eta:69,fr:1.15,nPass:2,tubeLen:9.2,pipeDN:600,
      Tbath:68,s3_qnet:1040,nPaths:3,nRows:10,nps:'4',
    },
    validationRef: 'Q10417-DS01 Rev 3, September 2014',
  },
  {
    libId: 'ruwais_lng',
    tag: 'Q11435',
    name: 'Ruwais LNG — 3522 kW Gas Heating WBH',
    location: 'Ruwais, UAE',
    docNo: 'Q11435',
    date: '2017',
    sector: 'OilGas',
    country: 'UAE',
    isValidated: true,
    description: 'Large 3522 kW WBH for LNG regasification gas heating at Ruwais. 70,000 kg/hr flow, 7.5→26.6°C.',
    kpis: ['Q=3,522 kW','Flow=70,000 kg/hr','P=214 barg','7.5→26.6°C','★ DS Validated'],
    params: {
      comp_indices:{0:90.0,1:6.0,2:2.0,9:1.5,10:0.5},
      Tin:7.5,Tout:26.6,Pin:21407,dP:100,flow:70000,flowUnit:'kgh',
      basis:6,T_design:60,P_design:21407,
    },
    validationRef: 'Q11435 — Ruwais LNG 3522kW',
  },
  {
    libId: 'kurri_kurri',
    tag: 'Q12971',
    name: 'Kurri Kurri Power Station — 6795 kW Fuel Gas Heating',
    location: 'Kurri Kurri, NSW',
    docNo: 'Q12971',
    date: '2021',
    sector: 'Power',
    country: 'Australia',
    isValidated: true,
    description: '6795 kW WBH (3×50% arrangement) for fuel gas pre-heating at Kurri Kurri gas peaker plant.',
    kpis: ['Q=6,795 kW','3×50% = 2,265 kW each','Shell Ø2000mm','★ DS Validated'],
    params: {
      comp_indices:{0:90.93,1:5.24,2:0.74,4:0.07,6:0.02,9:0.87,10:2.1},
      Tin:9,Tout:65,Pin:1500,dP:30,flow:135052,flowUnit:'kgh',
      basis:5,T_design:80,P_design:1700,
    },
    validationRef: 'Q12971 — Kurri Kurri 6795kW · 3×50%',
  },
];

async function seedComponentLibrary() {
  console.log('Seeding component library…');
  // Component data matches COMPONENTS array in thermodynamics.ts
  const components = [
    { symbol:'CH4',  name:'Methane',           formula:'CH₄',   casNo:'74-82-8',   mw:16.043, tc_K:190.56, pc_bar:45.99, omega:0.0115 },
    { symbol:'C2H6', name:'Ethane',             formula:'C₂H₆',  casNo:'74-84-0',   mw:30.070, tc_K:305.32, pc_bar:48.72, omega:0.0995 },
    { symbol:'C3H8', name:'Propane',            formula:'C₃H₈',  casNo:'74-98-6',   mw:44.097, tc_K:369.83, pc_bar:42.48, omega:0.1523 },
    { symbol:'iC4',  name:'i-Butane',           formula:'iC₄',   casNo:'75-28-5',   mw:58.123, tc_K:408.14, pc_bar:36.48, omega:0.1808 },
    { symbol:'nC4',  name:'n-Butane',           formula:'nC₄',   casNo:'106-97-8',  mw:58.123, tc_K:425.12, pc_bar:37.96, omega:0.2002 },
    { symbol:'iC5',  name:'i-Pentane',          formula:'iC₅',   casNo:'78-78-4',   mw:72.150, tc_K:460.43, pc_bar:33.78, omega:0.2275 },
    { symbol:'nC5',  name:'n-Pentane',          formula:'nC₅',   casNo:'109-66-0',  mw:72.150, tc_K:469.70, pc_bar:33.70, omega:0.2515 },
    { symbol:'nC6',  name:'n-Hexane',           formula:'nC₆',   casNo:'110-54-3',  mw:86.177, tc_K:507.60, pc_bar:30.25, omega:0.3013 },
    { symbol:'nC7',  name:'n-Heptane',          formula:'nC₇',   casNo:'142-82-5',  mw:100.20, tc_K:540.20, pc_bar:27.40, omega:0.3498 },
    { symbol:'N2',   name:'Nitrogen',           formula:'N₂',    casNo:'7727-37-9', mw:28.014, tc_K:126.20, pc_bar:33.98, omega:0.0372 },
    { symbol:'CO2',  name:'Carbon Dioxide',     formula:'CO₂',   casNo:'124-38-9',  mw:44.010, tc_K:304.10, pc_bar:73.75, omega:0.2239, sourFlag:true },
    { symbol:'H2S',  name:'Hydrogen Sulfide',   formula:'H₂S',   casNo:'7783-06-4', mw:34.082, tc_K:373.10, pc_bar:89.63, omega:0.0942, sourFlag:true },
    { symbol:'He',   name:'Helium',             formula:'He',    casNo:'7440-59-7', mw:4.003,  tc_K:5.19,   pc_bar:2.27,  omega:-0.3836 },
    { symbol:'H2',   name:'Hydrogen',           formula:'H₂',   casNo:'1333-74-0', mw:2.016,  tc_K:33.19,  pc_bar:13.13, omega:-0.2160 },
  ];

  for (const [i, comp] of components.entries()) {
    try {
      await db.insert(schema.componentLibrary).values({
        ...comp,
        sourFlag: comp.sourFlag ?? false,
        sortOrder: i,
        bip_kij: {},
      }).onConflictDoNothing();
    } catch (e) {
      console.warn(`Skip ${comp.symbol}:`, e);
    }
  }
  console.log(`✔ ${components.length} components seeded`);
}

async function seedLibraryProjects() {
  console.log('Seeding library projects…');
  for (const proj of HIST_PROJECTS) {
    try {
      await db.insert(schema.libraryProjects).values({
        libId:       proj.libId,
        tag:         proj.tag,
        name:        proj.name,
        location:    proj.location,
        docNo:       proj.docNo,
        date:        proj.date,
        sector:      proj.sector,
        country:     proj.country,
        isValidated: proj.isValidated,
        description: proj.description,
        kpis:        proj.kpis ?? [],
        tags:        [proj.sector, proj.country].filter(Boolean),
        validationRef: proj.validationRef,
        params:      proj.params,
        updatedAt:   new Date(),
      }).onConflictDoNothing();
    } catch (e) {
      console.warn(`Skip ${proj.libId}:`, e);
    }
  }
  console.log(`✔ ${HIST_PROJECTS.length} library projects seeded`);
}

async function main() {
  console.log('WBH Design — Database Seed');
  console.log('Connected to:', process.env.DATABASE_URL?.split('@')[1]);
  await seedComponentLibrary();
  await seedLibraryProjects();
  console.log('\n✅ Seed complete');
}

main().catch(console.error);
